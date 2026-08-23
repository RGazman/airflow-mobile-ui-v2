import { useState, useEffect } from 'react'
import { Box, Input, Button, Badge, Flex } from '@chakra-ui/react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { StatusFilter, RunFilter } from '@/features/dags/types'

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
]

const RUN_OPTIONS: { key: 'running' | 'failed'; label: string }[] = [
  { key: 'running', label: 'Running' },
  { key: 'failed', label: 'Failed' },
]

interface FilterCounts {
  all: number
  active: number
  paused: number
  running: number
  failed: number
}

interface DAGToolbarProps {
  searchQuery: string
  tagFilter: string
  onSearchChange: (value: string) => void
  onTagFilterChange: (value: string) => void
  onStatusFilterChange: (value: StatusFilter) => void
  onRunFilterChange: (value: RunFilter) => void
  statusFilter: StatusFilter
  runFilter: RunFilter
  filterCounts: FilterCounts
  runFiltersDisabled: boolean
}

export function DAGToolbar({
  searchQuery,
  tagFilter,
  onSearchChange,
  onTagFilterChange,
  onStatusFilterChange,
  onRunFilterChange,
  statusFilter,
  runFilter,
  filterCounts,
  runFiltersDisabled,
}: DAGToolbarProps) {
  // Drafts start from the persisted filter values (restored on remount after
  // returning from DAG detail), so the debounce effects don't wipe them.
  const [searchDraft, setSearchDraft] = useState(searchQuery)
  const [tagDraft, setTagDraft] = useState(tagFilter)

  const debouncedSearch = useDebouncedValue(searchDraft, 300)
  const debouncedTag = useDebouncedValue(tagDraft, 300)

  // Sync debounced values to parent
  useEffect(() => { onSearchChange(debouncedSearch) }, [debouncedSearch, onSearchChange])
  useEffect(() => { onTagFilterChange(debouncedTag) }, [debouncedTag, onTagFilterChange])

  return (
    <Box
      bg="gray.50"
      borderBottomWidth="1px"
      px={4}
      py={3}
      className="airflow-toolbar"
    >
      <Flex
        gap={3}
        align="center"
        wrap="wrap"
        css={{
          '@media (orientation: portrait)': {
            flexDirection: 'column',
            alignItems: 'stretch',
          },
        }}
      >
        <Input type="search" placeholder="Search DAGs" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} size="md" css={{ '@media (orientation: landscape)': { flex: '1', minWidth: '160px' } }} />
        <Input type="search" placeholder="Filter DAGs by tag" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} size="md" css={{ '@media (orientation: landscape)': { flex: '1', minWidth: '120px' } }} />
        <Flex gap={2}>
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              size="sm"
              variant={statusFilter === opt.key ? 'solid' : 'outline'}
              onClick={() => onStatusFilterChange(opt.key)}
              css={{ '@media (orientation: portrait)': { flex: '1' } }}
            >
              {opt.label}{' '}
              <Badge
                bg={statusFilter === opt.key ? 'whiteAlpha.300' : 'gray.400'}
                color="white"
                borderRadius="full"
                px={1.5}
                py={0.5}
                fontSize="xs"
              >
                {filterCounts[opt.key]}
              </Badge>
            </Button>
          ))}
        </Flex>
        <Flex gap={2}>
          {RUN_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              size="sm"
              variant={runFilter === opt.key ? 'solid' : 'outline'}
              onClick={() => onRunFilterChange(runFilter === opt.key ? null : opt.key)}
              disabled={runFiltersDisabled}
              css={{ '@media (orientation: portrait)': { flex: '1' } }}
            >
              {opt.label}{' '}
              <Badge
                bg={runFilter === opt.key ? 'whiteAlpha.300' : 'gray.400'}
                color="white"
                borderRadius="full"
                px={1.5}
                py={0.5}
                fontSize="xs"
              >
                {filterCounts[opt.key]}
              </Badge>
            </Button>
          ))}
        </Flex>
      </Flex>
    </Box>
  )
}
