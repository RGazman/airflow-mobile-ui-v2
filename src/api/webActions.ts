let cachedCsrf: string | null = null

function extractCsrf(html: string): string | null {
  const patterns: RegExp[] = [
    // <input ... name="csrf_token" ... value="...">
    /name="csrf_token"[^>]*value="([^"]+)"/i,
    /value="([^"]+)"[^>]*name="csrf_token"/i,
    // <meta name="csrf_token" content="...">
    /name="csrf_token"\s+content="([^"]+)"/i,
    /content="([^"]+)"[^>]*name="csrf_token"/i,
    // JS globals (snake + camel cases):
    //   csrf_token = "..." / csrfToken = "..." / csrf_token: "..." / csrfToken: "..."
    /csrf_token["']?\s*[:=]\s*["']([^"']+)["']/i,
    /csrfToken["']?\s*[:=]\s*["']([^"']+)["']/,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1] && m[1].trim()) return m[1].trim()
  }
  return null
}

/**
 * Fetch a CSRF token the way the original Airflow UI does — it is rendered
 * into the HTML of any page (we use the DAG grid page). The token is bound to
 * the current session cookie and is required by the web-form actions.
 *
 * Robustness: never cache a token when the page redirected (typically to
 * /login after session expiry) or the response was not OK — otherwise a stale
 * anonymous-session token would get cached forever.
 */
export async function getCsrfToken(dagId: string): Promise<string> {
  if (cachedCsrf) return cachedCsrf
  const res = await fetch(`/dags/${encodeURIComponent(dagId)}/grid`)
  const finalUrl = res.url || ''
  if (!res.ok || res.redirected || /\/login([?/#]|$)/i.test(finalUrl)) {
    throw new Error('Not authenticated: could not obtain a CSRF token (redirected to login)')
  }
  const html = await res.text()
  const token = extractCsrf(html)
  if (!token) {
    throw new Error('Could not extract CSRF token from Airflow page')
  }
  cachedCsrf = token
  return token
}

function extractErrorMessage(text: string): string {
  try {
    const j = JSON.parse(text) as Record<string, unknown>
    if (j && typeof j === 'object') {
      return String(j.detail ?? j.message ?? j.title ?? JSON.stringify(j))
    }
  } catch {
    // not JSON — fall through
  }
  return text.slice(0, 200)
}

/**
 * POST a form-encoded body to an Airflow web endpoint.
 * - Sends `Accept: application/json` so Airflow replies with a JSON error
 *   (non-2xx) on logical failures instead of a 302 + flash redirect.
 * - Uses `redirect: 'manual'`; a redirect (opaque) means the action succeeded.
 * - Throws errors carrying `.status` so callers can retry on CSRF failures.
 */
async function postForm(url: string, fields: Record<string, string | string[] | undefined>): Promise<void> {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      value.forEach((v) => body.append(key, v))
    } else {
      body.set(key, value)
    }
  }
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json',
    },
    body: body.toString(),
  })

  // Opaque redirect = Airflow followed through and redirected after applying
  if (res.type === 'opaqueredirect') return

  const text = await res.text()
  if (!res.ok) {
    const err: Error & { status?: number } = new Error(
      `${url} failed with status ${res.status}: ${extractErrorMessage(text)}`,
    )
    err.status = res.status
    throw err
  }

  // 2xx non-redirect: expect a JSON payload. Surface explicit error objects.
  try {
    const json = JSON.parse(text) as { error?: unknown; message?: unknown; status?: unknown }
    if (json && typeof json === 'object') {
      if (json.error != null) {
        throw new Error(String(json.error))
      }
      // dagrun_* return HTTP 200 even on logical failures
      if (json.status === 'error') {
        throw new Error(String(json.message ?? 'Action failed'))
      }
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Non-JSON 2xx (HTML) — treat as success
      return
    }
    throw err
  }
}

/**
 * Run a web action with a CSRF token. If the action fails with a client/CSRF
 * error (400/403), drop the cached token and retry once with a fresh one.
 */
export async function runWithCsrf<T>(
  dagId: string,
  run: (csrf: string) => Promise<T>,
): Promise<T> {
  try {
    return await run(await getCsrfToken(dagId))
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status !== 400 && status !== 403) throw err
    cachedCsrf = null
    return await run(await getCsrfToken(dagId))
  }
}

export interface TaskRef {
  task_id: string
  map_index?: number
}

export interface WebActionParams {
  dagId: string
  dagRunId: string
  executionDate: string
  tasks: TaskRef[]
}

interface RunOutcome<T> {
  ok: number
  errors: { item: T; error: unknown }[]
}

/**
 * Run `fn` on every item with bounded concurrency. Collection is resilient:
 * a failure of one item does NOT abort the rest — errors are gathered and
 * reported together (R4), so a run-clear keeps going after one bad task.
 */
async function runOnEach<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<RunOutcome<T>> {
  let index = 0
  const errors: { item: T; error: unknown }[] = []
  let ok = 0
  const worker = async () => {
    while (index < items.length) {
      const current = items[index++]
      try {
        await fn(current)
        ok++
      } catch (err) {
        errors.push({ item: current, error: err })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return { ok, errors }
}

function isCsrfError(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  return status === 400 || status === 403
}

/**
 * Split tasks into small batches; each batch runs (concurrently) under its
 * own CSRF. Per-item failures are gathered (R4 — allSettled), but CSRF
 * failures (400/403) are NOT re-sent from the top. Instead only the items
 * that failed with a stale token are re-sent once under a freshly fetched
 * token (R10) — restoring auto-recovery without re-flying the whole batch.
 * Mobile note: this keeps extra traffic to ~(failed items + 1 token GET),
 * not a full batch double.
 */
const ACTION_BATCH = 6

async function runActionBatches(
  dagId: string,
  tasks: TaskRef[],
  send: (csrf: string, task: TaskRef) => Promise<void>,
): Promise<void> {
  let ok = 0
  const failures: string[] = []
  const collectOutcome = (outcome: RunOutcome<TaskRef>) => {
    ok += outcome.ok
    for (const e of outcome.errors) {
      failures.push(`${e.item.task_id}: ${e.error instanceof Error ? e.error.message : String(e.error)}`)
    }
  }
  const applyBatch = (batch: TaskRef[]): Promise<RunOutcome<TaskRef>> =>
    runWithCsrf(dagId, (csrf) => runOnEach(batch, ACTION_BATCH, (task) => send(csrf, task)))

  for (let i = 0; i < tasks.length; i += ACTION_BATCH) {
    const batch = tasks.slice(i, i + ACTION_BATCH)
    let pass1: RunOutcome<TaskRef>
    try {
      pass1 = await applyBatch(batch)
    } catch (err) {
      // Unreachable batch (e.g. fresh token itself rejected twice) — count it whole
      const msg = err instanceof Error ? err.message : String(err)
      failures.push(`batch of ${batch.length} tasks failed: ${msg}`)
      continue
    }
    ok += pass1.ok
    // T1: CSRF errors must NOT reach `failures` before the retry — otherwise a
    // fully-successful retry still surfaces a "failed" aggregate.
    for (const e of pass1.errors) {
      if (isCsrfError(e.error)) continue
      failures.push(`${e.item.task_id}: ${e.error instanceof Error ? e.error.message : String(e.error)}`)
    }

    // Re-send ONLY the items that tripped the cached CSRF token, once,
    // under a freshly fetched token — aut-recovery without a full batch replay.
    const csrfItems = pass1.errors.filter((e) => isCsrfError(e.error)).map((e) => e.item)
    if (csrfItems.length === 0) continue
    cachedCsrf = null
    try {
      collectOutcome(await applyBatch(csrfItems))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      failures.push(`retry of ${csrfItems.length} items failed: ${msg}`)
    }
  }

  if (failures.length > 0) {
    throw new Error(`${ok} task instances processed, ${failures.length} error(s). First: ${failures[0]}`)
  }
}

/**
 * N4/R3: preview check before marking. GET /confirm (Accept: json) returns
 * the list of tasks that WOULD be altered; an empty list means the action would
 * be a no-op/failure, so we abort instead of POSTing "successfully". Mirrors
 * the original grid flow (preview → apply). Returns the number of discovered
 * alterations so callers can surface the volume for downstream=true segments.
 */
async function verifyMarkPreview(
  dagId: string,
  dagRunId: string,
  task: TaskRef,
  state: 'success' | 'failed',
  downstream = false,
): Promise<number> {
  const query = new URLSearchParams({
    dag_id: dagId,
    dag_run_id: dagRunId,
    past: 'false',
    future: 'false',
    upstream: 'false',
    downstream: String(downstream),
    state,
    task_id: task.task_id,
  })
  if (task.map_index !== undefined && task.map_index >= 0) {
    query.set('map_index', String(task.map_index))
  }
  const res = await fetch(`/confirm?${query.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`mark preview failed with status ${res.status}`)
  }
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // Non-JSON preview (HTML) — cannot inspect; proceed but let the apply
    // POST surface any real error.
    return 0
  }

  // Accept both the raw array and object wrappers; log unknown shapes instead of
  // silently passing — otherwise we are back to a "false success" hole.
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error(`Task "${task.task_id}" cannot be marked as ${state} — no task matched`)
    }
    return parsed.length
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as { to_be_altered?: unknown[]; task_instances?: unknown[] }
    const list = obj.to_be_altered ?? obj.task_instances
    if (Array.isArray(list)) {
      if (list.length === 0) {
        throw new Error(`Task "${task.task_id}" cannot be marked as ${state} — no task matched`)
      }
      return list.length
    }
  }
  console.warn('[markPreview] unrecognized /confirm payload format', parsed)
  return 0
}

/**
 * Mirrors the original Airflow grid "Clear" action:
 * POST /clear (form-encoded) with csrf_token.
 * The /clear view reads a single `task_id` (not `task_ids`), so we send one
 * request per task — same pattern as markTaskState (now in concurrent batches).
 * When a task has a map_index >= 0 we pass it so only that mapped instance is
 * cleared.
 */
export async function clearWebTasks(params: WebActionParams): Promise<void> {
  await runActionBatches(params.dagId, params.tasks, async (csrf, task) => {
    const fields: Record<string, string> = {
      csrf_token: csrf,
      dag_id: params.dagId,
      dag_run_id: params.dagRunId,
      execution_date: params.executionDate,
      confirmed: 'true',
      past: 'false',
      future: 'false',
      upstream: 'false',
      downstream: 'false',
      recursive: 'true',
      only_failed: 'false',
      task_id: task.task_id,
    }
    if (task.map_index !== undefined && task.map_index >= 0) {
      fields.map_index = String(task.map_index)
    }
    await postForm('/clear', fields)
  })
}

/**
 * Mirrors the original Airflow grid "Mark state": preview via GET /confirm,
 * then APPLY via POST /success or POST /failed (form-encoded, csrf_token +
 * confirmed=true).
 */
export interface MarkDagRunParams {
  dagId: string
  dagRunId: string
  state: 'success' | 'failed'
}

/**
 * Run-level mark: POST /dagrun_success or /dagrun_failed with a CSRF token.
 * Mirrors the original grid run action (body per `prod_mark_state_one_run.har`).
 * The endpoint returns JSON `{status}` even for logical errors (HTTP 2xx) —
 * postForm now throws on `status: 'error'`.
 */
export async function markDagRunState({ dagId, dagRunId, state }: MarkDagRunParams): Promise<void> {
  const endpoint = state === 'success' ? '/dagrun_success' : '/dagrun_failed'
  await runWithCsrf(dagId, async (csrf) => {
    await postForm(endpoint, {
      csrf_token: csrf,
      dag_id: dagId,
      dag_run_id: dagRunId,
      confirmed: 'true',
    })
  })
}

export interface MarkSegmentParams {
  dagId: string
  dagRunId: string
  state: 'success' | 'failed'
  /** Consecutive-task groups; group length > 1 is sent as one `downstream=true` POST. */
  segments: TaskRef[][]
}

/**
 * PC-mirror marking: a segment of consecutive tasks is applied with a single
 * `downstream=true` POST started from the segment's first task (the original
 * grid flow: confirm down=false, confirm down=true, then POST down=true);
 * separated groups are sent as separate POSTs (flow order; reversed for
 * success so an earlier segment doesn't reset a later one).
 */
export async function markTaskState({
  dagId,
  dagRunId,
  state,
  segments,
}: MarkSegmentParams): Promise<void> {
  const endpoint = state === 'success' ? '/success' : '/failed'
  const orderedSegments = state === 'success' ? [...segments].reverse() : segments

  for (const segment of orderedSegments) {
    const first = segment[0]
    const isChain = segment.length > 1
    await runWithCsrf(dagId, async (csrf) => {
      await verifyMarkPreview(dagId, dagRunId, first, state, isChain)
      const fields: Record<string, string> = {
        csrf_token: csrf,
        dag_id: dagId,
        dag_run_id: dagRunId,
        confirmed: 'true',
        past: 'false',
        future: 'false',
        upstream: 'false',
        downstream: isChain ? 'true' : 'false',
        task_id: first.task_id,
      }
      if (first.map_index !== undefined && first.map_index >= 0) {
        fields.map_index = String(first.map_index)
      }
      await postForm(endpoint, fields)
    })
  }
}
