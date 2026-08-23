import { useMemo, useCallback, useRef } from 'react'
import { Box, VStack, Spinner, Text, Alert, Button } from '@chakra-ui/react'
import { usePersistedState } from '@/hooks/usePersistedState'
import { useDAGQuery, useDAGPool, useDAGStats, useDAGLastRuns } from '@/features/dags/api/dags'
import { DAGCard } from '@/features/dags/components/DAGCard'
import { DAGToolbar } from '@/features/dags/components/DAGToolbar'
import { DAGPagination } from '@/features/dags/components/DAGPagination'
import type { StatusFilter, RunFilter, DAGRunListResponse } from '@/features/dags/types'

export function DAGsList() {
  const [page, setPage] = usePersistedState('dags.page', 1)
  const [pageSize, setPageSize] = usePersistedState('dags.pageSize', 10)
  const [searchQuery, setSearchQuery] = usePersistedState('dags.search', '')
  const [tagFilter, setTagFilter] = usePersistedState('dags.tag', '')
  const [statusFilter, setStatusFilter] = usePersistedState<StatusFilter>('dags.status', 'all')
  const [runFilter, setRunFilter] = usePersistedState<RunFilter>('dags.run', null)

  // Previous values for change detection — avoids calling setPage inside
  // another setState's updater (R8) while keeping handler identity stable.
  const searchRef = useRef(searchQuery)
  const tagRef = useRef(tagFilter)
  const statusRef = useRef(statusFilter)
  const runRef = useRef(runFilter)

  // When any client-side filter is active (search, tag, run), fetch ALL DAGs
  // (across all pages) so client-side filtering sees the complete dataset.
  const pausedParam = statusFilter === 'active' ? false : statusFilter === 'paused' ? true : undefined
  const needsFullData = Boolean(searchQuery || tagFilter || runFilter)

  // Single hook for both modes — no conditional hook calls (Rules of Hooks).
  const dagsQuery = useDAGQuery({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    paused: needsFullData ? undefined : pausedParam, // in filter mode status is applied client-side
    fetchAll: needsFullData,
  })

  // Counting/indicator source for Running/Failed badges, the run filter, and
  // the cards: the LATEST run per DAG. One compact POST /last_dagruns for the
  // whole basis (pool in paginated mode, the full-pool query in filter mode) —
  // like the PC UI. Counters and filter share the same semantics as the card dot,
  // so failed = DAG whose last run is failed, nothing else.
  const poolQuery = useDAGPool(!needsFullData)
  const poolIds = useMemo(() => poolQuery.data?.dags.map((d) => d.dag_id) ?? [], [poolQuery.data])

  const dagIds = useMemo(
    () => dagsQuery.data?.dags.map((d) => d.dag_id) ?? [],
    [dagsQuery.data],
  )
  const basisIds = needsFullData ? dagIds : poolIds
  const lastRunsQuery = useDAGLastRuns(basisIds, { priorityIds: dagIds })
  const lastRunsData = useMemo(
    () => lastRunsQuery.data ?? new Map<string, DAGRunListResponse>(),
    [lastRunsQuery.data],
  )
  const statusLoading = basisIds.length > 0 && !lastRunsQuery.isFetched
  const runFiltersDisabled = !lastRunsQuery.isFetched

  // last-run state lookup: true=running, false=failed, undefined=other/none
  const lastRunState = useMemo(() => {
    const map = new Map<string, boolean | undefined>()
    for (const [dagId, resp] of lastRunsData) {
      map.set(
        dagId,
        resp.dag_runs.length > 0
          ? resp.dag_runs[0].state === 'running'
            ? true
            : resp.dag_runs[0].state === 'failed'
              ? false
              : undefined
          : undefined,
      )
    }
    return map
  }, [lastRunsData])

  const dagStatsQuery = useDAGStats(dagIds)
  const statsMap = useMemo(() => {
    const map = new Map<string, { state: string; count: number }[]>()
    for (const item of dagStatsQuery.data?.dags ?? []) map.set(item.dag_id, item.stats)
    return map
  }, [dagStatsQuery.data])

  const filteredDags = useMemo(() => {
    let list = dagsQuery.data?.dags ?? []

    // Client-side search: dag_id + owners
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((d) =>
        d.dag_id.toLowerCase().includes(q) ||
        d.owners?.some((o) => o.toLowerCase().includes(q)),
      )
    }

    if (tagFilter) {
      const q = tagFilter.toLowerCase()
      list = list.filter((d) => d.tags?.some((t) => t.name.toLowerCase().includes(q)))
    }

    // statusFilter is server-side, but still apply client-side for consistency
    if (statusFilter === 'active') {
      list = list.filter((d) => !d.is_paused)
    } else if (statusFilter === 'paused') {
      list = list.filter((d) => d.is_paused)
    }

    // Run filter by the LAST run state once the basis data is ready
    if (!runFiltersDisabled) {
      if (runFilter === 'running') {
        list = list.filter((d) => lastRunState.get(d.dag_id) === true)
      } else if (runFilter === 'failed') {
        list = list.filter((d) => lastRunState.get(d.dag_id) === false)
      }
    }

    return list
  }, [dagsQuery.data, searchQuery, tagFilter, statusFilter, runFilter, lastRunState, runFiltersDisabled])

  // Client-side pagination of the filtered pool in filter mode; in paginated
  // mode the query page is already sliced, so pass it through unchanged.
  const displayedDags = useMemo(() => {
    if (!needsFullData) return filteredDags
    const start = (page - 1) * pageSize
    return filteredDags.slice(start, start + pageSize)
  }, [needsFullData, filteredDags, page, pageSize])

  // Keep the page within the filtered result count (render-time adjust).
  if (needsFullData && filteredDags.length > 0) {
    const filteredTotalPages = Math.max(1, Math.ceil(filteredDags.length / pageSize))
    if (page > filteredTotalPages) setPage(filteredTotalPages)
  }

  const filterCounts = useMemo(() => {
    // Counting source: the full pool in BOTH modes so badges are never
    // "per current page" — the (full-pool) main query in filter mode, the
    // dedicated pool query otherwise.
    const raw = needsFullData ? (dagsQuery.data?.dags ?? []) : (poolQuery.data?.dags ?? [])

    const sq = searchQuery.toLowerCase()
    const tq = tagFilter.toLowerCase()
    const base = raw.filter((d) =>
      (!searchQuery || d.dag_id.toLowerCase().includes(sq) ||
        d.owners?.some((o) => o.toLowerCase().includes(sq))) &&
      (!tagFilter || d.tags?.some((tg) => tg.name.toLowerCase().includes(tq)))
    )
    const afterStatus = base.filter((d) =>
      statusFilter === 'all' ? true : statusFilter === 'active' ? !d.is_paused : d.is_paused
    )

    return {
      all: base.length,
      active: base.filter((d) => !d.is_paused).length,
      paused: base.filter((d) => d.is_paused).length,
      running: afterStatus.filter((d) => lastRunState.get(d.dag_id) === true).length,
      failed: afterStatus.filter((d) => lastRunState.get(d.dag_id) === false).length,
    }
  }, [
    needsFullData,
    dagsQuery.data,
    poolQuery.data,
    searchQuery,
    tagFilter,
    statusFilter,
    lastRunState,
  ])

  // When client-side filters are active we fetch all DAGs at once; show filtered count
  const paginationTotal = needsFullData
    ? filteredDags.length
    : dagsQuery.data?.total_entries ?? 0

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setPage(1)
  }, [setPage, setPageSize])

  // Reset to page 1 only when a filter VALUE actually changes. Comparing via
  // refs (R8) — no setState inside updaters, no identity churn from reading
  // the current filter value in deps.
  const handleSearchChange = useCallback((v: string) => {
    if (v !== searchRef.current) {
      searchRef.current = v
      setPage(1)
    }
    setSearchQuery(v)
  }, [setPage, setSearchQuery])
  const handleTagFilterChange = useCallback((v: string) => {
    if (v !== tagRef.current) {
      tagRef.current = v
      setPage(1)
    }
    setTagFilter(v)
  }, [setPage, setTagFilter])
  const handleStatusFilterChange = useCallback((v: StatusFilter) => {
    if (v !== statusRef.current) {
      statusRef.current = v
      setPage(1)
    }
    setStatusFilter(v)
  }, [setPage, setStatusFilter])
  const handleRunFilterChange = useCallback((v: RunFilter) => {
    if (v !== runRef.current) {
      runRef.current = v
      setPage(1)
    }
    setRunFilter(v)
  }, [setPage, setRunFilter])

  const isLoading = dagsQuery.isLoading
  const isError = dagsQuery.isError
  const errorMessage = dagsQuery.error instanceof Error ? dagsQuery.error.message : 'Unknown error'

  if (isError) {
    return (
      <Box p={4}>
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Title>Failed to load DAGs</Alert.Title>
          <Alert.Description>{errorMessage}</Alert.Description>
        </Alert.Root>
        <Button mt={4} onClick={() => dagsQuery.refetch()}>
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      <DAGToolbar
        searchQuery={searchQuery}
        tagFilter={tagFilter}
        onSearchChange={handleSearchChange}
        onTagFilterChange={handleTagFilterChange}
        onStatusFilterChange={handleStatusFilterChange}
        onRunFilterChange={handleRunFilterChange}
        statusFilter={statusFilter}
        runFilter={runFilter}
        filterCounts={filterCounts}
        runFiltersDisabled={runFiltersDisabled}
      />

      <Box>
        {isLoading ? (
          <VStack py={10}>
            <Spinner size="lg" />
          </VStack>
        ) : filteredDags.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={10}>
            {dagsQuery.data?.dags.length === 0 && !searchQuery && !tagFilter
              ? 'No DAGs found. Check Airflow connection.'
              : 'No DAGs match the current filters.'}
          </Text>
        ) : (
          <VStack gap={0} borderWidth="1px" borderRadius="md" overflow="hidden" mx="5px">
            {statusLoading && (
              <Text px={4} py={2} fontSize="xs" color="gray.500" bg="gray.50">
                Checking last run statuses…
              </Text>
            )}
            {displayedDags.map((dag, idx) => (
              <DAGCard
                key={dag.dag_id}
                dag={dag}
                stats={statsMap.get(dag.dag_id)}
                lastRun={lastRunsData.get(dag.dag_id)}
                statusLoading={statusLoading}
                odd={idx % 2 === 1}
              />
            ))}
          </VStack>
        )}
      </Box>

      {dagsQuery.data && (
        <DAGPagination
          totalEntries={paginationTotal}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </Box>
  )
}
