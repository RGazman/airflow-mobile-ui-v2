import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { runWithCsrf } from '@/api/webActions'
import type { DAGListResponse, DAGStatsResponse, DAGRunListResponse, DAGRun, DAGStatsItem } from '@/features/dags/types'

interface DAGQueryParams {
  limit: number
  offset: number
  paused?: boolean
  /** When true, fetch every page (full pool) for client-side filtering. */
  fetchAll?: boolean
}

/**
 * Single hook for both paginated list and "fetch the whole pool" mode.
 * One `useQuery` call (no conditional hooks — Rules of Hooks). When
 * `fetchAll` is set it pages through the entire dataset; otherwise it
 * requests a single page. The cache key keeps the `dags`/`allDags` split
 * so prefix invalidations of either key still work.
 */
export function useDAGQuery({ limit, offset, paused, fetchAll = false }: DAGQueryParams) {
  // fetchAll ignores limit/offset — keep them out of the key so changing the
  // page size under an active filter doesn't create throwaway cache entries.
  const queryKey = fetchAll ? (['allDags', { paused }] as const) : (['dags', { limit, offset, paused }] as const)
  return useQuery<DAGListResponse>({
    queryKey,
    queryFn: async () => {
      if (fetchAll) {
        return fetchAllDAGs(paused)
      }
      const params: Record<string, string | number | boolean> = {
        limit, offset, order_by: '-dag_id',
      }
      if (paused !== undefined) params.paused = paused
      const { data } = await api.get('/dags', { params })
      return data
    },
    staleTime: 30_000,
  })
}

/**
 * Fetches ALL DAGs (across all pages) by making sequential API calls
 * with a batch size of 100. The Airflow REST API caps the page size, so
 * a single large-limit request may not return every DAG.
 */
async function fetchAllDAGs(paused?: boolean): Promise<DAGListResponse> {
  const BATCH = 100
  let allDags: DAGListResponse['dags'] = []
  let total: number | undefined

  for (let offset = 0; ; offset += BATCH) {
    const params: Record<string, string | number | boolean> = {
      limit: BATCH, offset, order_by: '-dag_id',
    }
    if (paused !== undefined) params.paused = paused
    const { data } = await api.get<DAGListResponse>('/dags', { params })
    allDags = allDags.concat(data.dags)
    total = data.total_entries
    if (offset + BATCH >= total) break
  }

  return { dags: allDags, total_entries: total ?? allDags.length }
}

/**
 * The full pool of DAGs, fetched once and cached for a long time. Used as a
 * counting source so Running/Failed badges stay honest even in paginated
 * (non-filter) mode — server counts can't express run state.
 */
export function useDAGPool(enabled: boolean) {
  return useQuery<DAGListResponse>({
    queryKey: ['dagPool'],
    queryFn: () => fetchAllDAGs(),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useDAGCount(paused?: boolean, dagIdPattern?: string) {
  return useQuery<number>({
    queryKey: ['dagCount', { paused, dagIdPattern }],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { limit: 1 }
      if (paused !== undefined) params.paused = paused
      if (dagIdPattern) params.dag_id_pattern = dagIdPattern
      const { data } = await api.get('/dags', { params })
      return (data as DAGListResponse).total_entries
    },
    staleTime: 30_000,
  })
}

export function useDAGStats(dagIds: string[]) {
  return useQuery<DAGStatsResponse>({
    queryKey: ['dagStats', dagIds],
    queryFn: async () => {
      // Airflow caps dag_ids filter size; chunk to avoid huge URLs when the
      // whole pool is loaded (filter mode).
      const BATCH = 50
      const chunks: string[][] = []
      for (let i = 0; i < dagIds.length; i += BATCH) {
        chunks.push(dagIds.slice(i, i + BATCH))
      }
      const results = await Promise.allSettled(
        chunks.map((chunk) =>
          api.get<DAGStatsResponse>('/dagStats', { params: { dag_ids: chunk.join(',') } }),
        ),
      )
      const merged: DAGStatsItem[] = []
      for (const r of results) {
        // Keep partial data — one failed chunk must not zero out the stats
        if (r.status === 'fulfilled') {
          merged.push(...(r.value.data.dags ?? []))
        } else {
          console.warn('[dagStats] chunk failed, counts may be understated:', r.reason)
        }
      }
      return { dags: merged, total_entries: merged.length }
    },
    enabled: dagIds.length > 0,
    staleTime: 30_000,
  })
}

/**
 * Latest run per DAG via a single compact `POST /last_dagruns` (form
 * `dag_ids`) — the exact endpoint the PC Airflow UI uses for its DAGs list
 * (`no_many_list_api.har`). One request returns the last run for the whole
 * requested set; this is far cheaper than the REST batch pagination (bytes of
 * large run objects) or hundreds of per-DAG `limit=1` GETs, and it keeps
 * the "last run" semantics (the card dot / failed filter match).
 * Note: legacy web endpoint (same family as `/object/graph_data`), not REST
 * v1 — documented in the README non-stable section.
 */
const LAST_RUN_FORM_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
}
const LAST_RUN_CONCURRENCY = 8
// Failure-mode bounds: the per-DAG fallback only covers visible-page-sized
// subsets, and a failed legacy call backs off so the list doesn't hammer the
// instance on every refetch (found in ITER7 review). The flag flips in the
// query fn (never during render) so the render reads stay pure.
const LAST_RUN_FALLBACK_LIMIT = 50
const LAST_RUN_FAILURE_COOLDOWN_MS = 5 * 60 * 1000
let lastRunLegacyDown = false

/** REST v1 fallback: one compact `limit=1` GET per DAG (bounded concurrency). */
async function fetchLastRunsPerDag(dagIds: string[], map: Map<string, DAGRunListResponse>): Promise<void> {
  let index = 0
  const worker = async () => {
    while (index < dagIds.length) {
      const dagId = dagIds[index++]
      try {
        const { data } = await api.get<DAGRunListResponse>(
          `/dags/${encodeURIComponent(dagId)}/dagRuns`,
          { params: { limit: 1, order_by: '-execution_date' } },
        )
        map.set(dagId, data)
      } catch (err) {
        // keep the pre-filled empty entry; don't fail the whole query
        console.warn(`[dagLastRun] per-DAG failed for ${dagId}:`, err)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(LAST_RUN_CONCURRENCY, dagIds.length) }, worker))
}

export function useDAGLastRuns(dagIds: string[], opts?: { priorityIds?: string[] }) {
  return useQuery<Map<string, DAGRunListResponse>>({
    queryKey: ['dagLastRun', dagIds],
    queryFn: async () => {
      // Pre-fill with empty entries — consumers know data loaded even for
      // DAGs without runs.
      const map = new Map<string, DAGRunListResponse>()
      for (const id of dagIds) map.set(id, { dag_runs: [], total_entries: 0 })
      if (dagIds.length === 0) return map

      try {
        const body = new URLSearchParams()
        for (const id of dagIds) body.append('dag_ids', id)

        // Flask-WTF CSRF also guards /last_dagruns (like the PC UI, which
        // sends an X-CSRFToken header) — 400 without it. runWithCsrf clears
        // the stale cached token and retries once on 400/403, so a single
        // expired token can't lock the list into the per-DAG fallback (T2).
        const sendLastDagruns = async (csrf: string): Promise<Response> => {
          const res = await fetch('/last_dagruns', {
            method: 'POST',
            headers: { ...LAST_RUN_FORM_HEADERS, 'X-CSRFToken': csrf },
            body: body.toString(),
          })
          if (!res.ok) {
            const err = new Error(`last_dagruns failed with status ${res.status}`) as Error & {
              status?: number
            }
            err.status = res.status
            throw err
          }
          return res
        }

        const data = (await (await runWithCsrf(dagIds[0], sendLastDagruns)).json()) as Record<string, unknown>
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('unexpected last_dagruns payload')
        }

        for (const [dagId, run] of Object.entries(data)) {
          const runObj = run as { dag_id?: string; state?: string } | null
          if (!runObj || typeof runObj !== 'object') {
            map.set(dagId, { dag_runs: [], total_entries: 0 })
            continue
          }
          map.set(dagId, { dag_runs: [runObj as unknown as DAGRun], total_entries: 1 })
        }
        return map
      } catch (err) {
        // Legacy endpoint down / CSRF unrecoverable: fall back on the LAST
        // run for a visible-page-sized subset ONLY (the whole pool would be a
        // ~N-request burst) and back off to a longer cache (ITER7 review).
        console.warn('[dagLastRun] legacy /last_dagruns failed, per-DAG fallback (limited):', err)
        lastRunLegacyDown = true
        setTimeout(() => {
          lastRunLegacyDown = false
        }, LAST_RUN_FAILURE_COOLDOWN_MS)
        // U1: fall back on the VISIBLE page first, then the rest, capped at
        // the limit — avoids "empty" cards on far pages during the outage.
        const prioritized = (opts?.priorityIds ?? []).filter((id) => dagIds.includes(id))
        const rest = dagIds.filter((id) => !prioritized.includes(id))
        await fetchLastRunsPerDag([...prioritized, ...rest].slice(0, LAST_RUN_FALLBACK_LIMIT), map)
        return map
      }
    },
    enabled: dagIds.length > 0,
    staleTime: lastRunLegacyDown ? 5 * 60 * 1000 : 30_000,
  })
}
