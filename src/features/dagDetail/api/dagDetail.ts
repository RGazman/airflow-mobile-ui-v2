import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import type {
  DAGDetail,
  DAGRunListResponse,
  TaskInstanceListResponse,
  XComListResponse,
} from '@/features/dagDetail/types'

export function useDAGDetail(dagId: string) {
  return useQuery<DAGDetail>({
    queryKey: ['dagDetail', dagId],
    queryFn: async () => {
      const { data } = await api.get(`/dags/${encodeURIComponent(dagId)}`)
      return data
    },
    enabled: Boolean(dagId),
    staleTime: 30_000,
  })
}

export function useDAGRuns(dagId: string, limit: number, offset = 0) {
  return useQuery<DAGRunListResponse>({
    queryKey: ['dagRuns', dagId, limit, offset],
    queryFn: async () => {
      const { data } = await api.get(`/dags/${encodeURIComponent(dagId)}/dagRuns`, {
        params: { limit, offset, order_by: '-execution_date' },
      })
      return data
    },
    enabled: Boolean(dagId),
    staleTime: 15_000,
    // Keep the previous page while loading the next one — no full-screen flash
    placeholderData: keepPreviousData,
  })
}

export interface GraphElement {
  id: string
  children?: GraphElement[]
  value?: { label?: string | null; shape?: string | null }
}

export interface GraphDataResponse {
  arrange?: string
  edges?: { source_id: string; target_id: string }[]
  nodes?: { children?: GraphElement[] }
}

export interface GraphGroup {
  id: string
  members: string[]
}

export interface GraphOrderResult {
  /** Flat real task ids in flow order (groups expanded inline). */
  order: string[]
  /** Subdag clusters (groups) in flow order. */
  groups: GraphGroup[]
}

/** Join/synthetic nodes (graph connectors) are not real tasks. */
function isSynthetic(el: GraphElement): boolean {
  return el.value?.shape === 'circle' || el.value?.label == null || el.value?.label === ''
}

/**
 * Deterministic topological sort (Kahn's algorithm). Nodes with no incoming
 * edge come first; leftover nodes (shouldn't happen for acyclic DAGs) are
 * appended in deterministic order.
 */
function topoSortIds(ids: string[], edges: [string, string][]): string[] {
  const adj = new Map<string, string[]>()
  const indeg = new Map<string, number>()
  for (const id of ids) {
    adj.set(id, [])
    indeg.set(id, 0)
  }
  for (const [s, t] of edges) {
    if (!adj.has(s)) { adj.set(s, []); indeg.set(s, indeg.get(s) ?? 0) }
    if (!adj.has(t)) { adj.set(t, []); indeg.set(t, indeg.get(t) ?? 0) }
    adj.get(s)!.push(t)
    indeg.set(t, (indeg.get(t) ?? 0) + 1)
  }
  // Use an index-pointer queue (avoids O(n²) shift) and a Set for the
  // leftover lookup (avoids order.includes → O(n) per node).
  const queue = [...indeg.keys()].filter((k) => indeg.get(k) === 0).sort()
  const order: string[] = []
  let head = 0
  while (head < queue.length) {
    const n = queue[head++]
    order.push(n)
    for (const m of adj.get(n) ?? []) {
      indeg.set(m, (indeg.get(m) ?? 1) - 1)
      if (indeg.get(m) === 0) queue.push(m)
    }
  }
  const inOrder = new Set(order)
  for (const k of indeg.keys()) {
    if (!inOrder.has(k)) {
      inOrder.add(k)
      order.push(k)
    }
  }
  return order
}

/**
 * Build the grouping structure from the graph's nested `nodes.children`:
 * - elements with `children` are subdag clusters (groups)
 * - leaf elements are tasks (synthetic join nodes are excluded)
 */
function buildNodeMap(elements: GraphElement[]): {
  unitOf: Map<string, string>
  groups: GraphGroup[]
  allRealTasks: Set<string>
  idsByGroup: Map<string, string[]>
} {
  const unitOf = new Map<string, string>()
  const groups: GraphGroup[] = []
  const allRealTasks = new Set<string>()
  const idsByGroup = new Map<string, string[]>()

  const visitChildren = (list: GraphElement[], groupId: string | null) => {
    for (const el of list) {
      if (el.children) {
        visitChildren(el.children, groupId ?? el.id)
        continue
      }
      const unit = groupId ?? el.id
      unitOf.set(el.id, unit)
      if (groupId && unit === groupId) {
        if (!idsByGroup.has(groupId)) idsByGroup.set(groupId, [])
        idsByGroup.get(groupId)!.push(el.id)
      }
      if (!isSynthetic(el)) allRealTasks.add(el.id)
    }
  }

  for (const el of elements) {
    if (el.children) {
      visitChildren(el.children, el.id)
      const members: string[] = []
      const collect = (list: GraphElement[], out: string[]) => {
        for (const x of list) {
          if (x.children) { collect(x.children, out); continue }
          if (!isSynthetic(x)) out.push(x.id)
        }
      }
      collect(el.children, members)
      groups.push({ id: el.id, members })
    } else {
      unitOf.set(el.id, el.id)
      if (!isSynthetic(el)) allRealTasks.add(el.id)
    }
  }

  return { unitOf, groups, allRealTasks, idsByGroup }
}

/**
 * Compute task order AND subdag groups from the graph data.
 *
 * Units (groups + top-level tasks) are topologically ordered by edges between
 * them; within each group, member tasks are topologically ordered by the
 * intra-group edges. DAGs without clusters return a flat order with no groups.
 */
export function computeGroupedOrder(data: GraphDataResponse): GraphOrderResult {
  const { unitOf, groups, allRealTasks, idsByGroup } = buildNodeMap(data.nodes?.children ?? [])

  // Unit-level edges (collapse group members into their group unit)
  const unitEdges: [string, string][] = []
  for (const e of data.edges ?? []) {
    const s = unitOf.get(e.source_id) ?? e.source_id
    const t = unitOf.get(e.target_id) ?? e.target_id
    if (s !== t) unitEdges.push([s, t])
  }
  const unitOrder = topoSortIds([...new Set(unitOf.values())], unitEdges)

  // Intra-group member orders
  const memberOrder = new Map<string, string[]>()
  for (const g of groups) {
    const intra = (data.edges ?? [])
      .filter(
        (e) =>
          unitOf.get(e.source_id) === g.id &&
          unitOf.get(e.target_id) === g.id,
      )
      .map((e) => [e.source_id, e.target_id] as [string, string])
    const sorted = topoSortIds(idsByGroup.get(g.id) ?? g.members, intra)
    const memberSet = new Set(g.members)
    memberOrder.set(g.id, sorted.filter((id) => memberSet.has(id)))
  }

  const groupsById = new Map(groups.map((g) => [g.id, g]))
  const order: string[] = []
  const orderedGroups: GraphGroup[] = []
  for (const unit of unitOrder) {
    const g = groupsById.get(unit)
    if (g) {
      const members = memberOrder.get(g.id) ?? g.members
      if (members.length > 0) {
        orderedGroups.push({ id: g.id, members })
        order.push(...members)
      }
    } else if (allRealTasks.has(unit)) {
      order.push(unit)
    }
  }

  return { order, groups: orderedGroups }
}

/**
 * Fetch the DAG's graph (web UI endpoint /object/graph_data) and derive task
 * order + subdag groups from its edges/nested nodes — authoritative flow order.
 */
export function useDAGGraphOrder(dagId: string) {
  return useQuery<GraphOrderResult>({
    queryKey: ['dagGraphOrder', dagId],
    queryFn: async () => {
      try {
        const res = await fetch(
          `/object/graph_data?dag_id=${encodeURIComponent(dagId)}`,
          { headers: { Accept: 'application/json' } },
        )
        if (!res.ok) throw new Error(`graph_data failed with status ${res.status}`)
        const data = (await res.json()) as GraphDataResponse
        return computeGroupedOrder(data)
      } catch (err) {
        // Diagnostics: a graph failure silently degrades task order to
        // "as-is" — log it so it can be traced.
        console.error('[DAGGraphOrder] failed for', dagId, err)
        throw err
      }
    },
    enabled: Boolean(dagId),
    staleTime: 60_000,
  })
}

export function useDAGRunTaskInstances(dagId: string, dagRunId: string | null) {
  return useQuery<TaskInstanceListResponse>({
    queryKey: ['dagRunTaskInstances', dagId, dagRunId],
    queryFn: async () => {
      const { data } = await api.get(
        `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId!)}/taskInstances`,
        // Explicit high limit — Airflow's default (100) silently drops tasks
        // for DAGs with many (mapped) instances.
        { params: { limit: 1000 } },
      )
      return data
    },
    enabled: Boolean(dagId && dagRunId),
    staleTime: 15_000,
    // Keep the previous run's tasks while the new run's tasks load (no flash)
    placeholderData: keepPreviousData,
  })
}

export function useTaskInstanceXCom(dagId: string, dagRunId: string, taskId: string, mapIndex = -1) {
  return useQuery<XComListResponse>({
    queryKey: ['taskXCom', dagId, dagRunId, taskId, mapIndex],
    queryFn: async () => {
      const base = `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId)}/taskInstances/${encodeURIComponent(taskId)}`
      // Collection response omits `value`; fetch each key's single entry to get the value
      const { data } = await api.get<XComListResponse>(`${base}/xcomEntries`, {
        params: { map_index: mapIndex },
      })
      const entries = data?.xcom_entries ?? []
      const withValues = await Promise.all(
        entries.map(async (entry) => {
          try {
            const { data: single } = await api.get(`${base}/xcomEntries/${encodeURIComponent(entry.key)}`, {
              params: { map_index: entry.map_index ?? mapIndex },
            })
            // single is XComEntry with `value`; fall back to raw object
            const value = (single as { value?: unknown } | null)?.value ?? single ?? null
            return { ...entry, value }
          } catch {
            return { ...entry, value: null }
          }
        }),
      )
      return { xcom_entries: withValues, total_entries: withValues.length }
    },
    enabled: Boolean(dagId && dagRunId && taskId),
    staleTime: 15_000,
  })
}

export interface TaskAttempt {
  task_id: string
  try_number: number
  state: string
  max_tries: number
  [key: string]: unknown
}

export function useTaskAttempts(
  dagId: string,
  dagRunId: string,
  taskId: string,
  mapIndex = -1,
) {
  return useQuery<TaskAttempt[]>({
    queryKey: ['taskAttempts', dagId, dagRunId, taskId, mapIndex],
    queryFn: async () => {
      const { data } = await api.get(
        `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId)}/taskInstances/${encodeURIComponent(taskId)}/attempts`,
        { params: { map_index: mapIndex } },
      )
      return data.attempts ?? []
    },
    enabled: Boolean(dagId && dagRunId && taskId),
    staleTime: 15_000,
  })
}

export function useTaskLogs(
  dagId: string,
  dagRunId: string,
  taskId: string,
  tryNumber: number,
  mapIndex = -1,
) {
  return useQuery<string>({
    queryKey: ['taskLogs', dagId, dagRunId, taskId, tryNumber, mapIndex],
    queryFn: async () => {
      const { data } = await api.get(
        `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId)}/taskInstances/${encodeURIComponent(taskId)}/logs/${tryNumber}`,
        { params: { map_index: mapIndex } },
      )
      if (typeof data === 'string') return data
      // Unexpected payload (e.g. an HTML error page) — don't dump raw
      // structure into the UI, log it and return a friendly message.
      console.error('Unexpected log response:', data)
      return 'Unexpected log format from server'
    },
    enabled: Boolean(dagId && dagRunId && taskId && tryNumber),
    staleTime: 60_000,
    retry: 1,
  })
}
