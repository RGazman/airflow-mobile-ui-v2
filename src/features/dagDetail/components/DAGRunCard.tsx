import { Box, Text, HStack, VStack, Button, Flex } from '@chakra-ui/react'
import type { DAGRun, TaskInstance } from '@/features/dagDetail/types'
import { STATE_COLORS } from '@/features/dagDetail/stateColors'
import { formatDuration } from '@/lib/duration'
import { formatRelativeTime } from '@/lib/date'

interface DAGRunCardProps {
  run: DAGRun
  tasks: TaskInstance[] | undefined
  selected: boolean
  onSelect: () => void
  onClear: () => void
  onMarkState: () => void
  isClearing?: boolean
}

export function DAGRunCard({
  run,
  tasks,
  selected,
  onSelect,
  onClear,
  onMarkState,
  isClearing = false,
}: DAGRunCardProps) {
  const state = run.state || 'none'
  const color = STATE_COLORS[state] || '#808080'
  const duration = formatDuration(run.start_date, run.end_date)
  const startRel = run.start_date ? formatRelativeTime(run.start_date) : undefined
  const startedLabel = run.start_date
    ? (startRel ? `started ${startRel}` : '')  // hide if the date failed to parse
    : 'not started'
  // The card header shows the run's SCHEDULED (logical) date, not last start —
  // after clear+rerun start_date changes to "today" and runs become ambiguous.
  const runDate = run.logical_date ?? run.execution_date ?? run.start_date
  // Dots mirror the actual tasks (exact count, no padding to 4).
  // tasks are only provided for the run that's currently selected.
  const dots = tasks?.map((t) => t.state) ?? []
  const hasTasks = tasks !== undefined && tasks.length > 0
  const done = tasks?.filter((t) => t.state === 'success').length ?? 0
  const total = tasks?.length ?? 0

  return (
    <Box
      w="260px"
      flexShrink={0}
      borderWidth="1px"
      borderRadius="md"
      borderTopWidth="3px"
      borderTopColor={color}
      p={3}
      bg="white"
      boxShadow={selected ? 'outline' : 'none'}
      onClick={onSelect}
      cursor="pointer"
    >
      <HStack gap={2} mb={2}>
        <Box w="10px" h="10px" borderRadius="full" bg={color} flexShrink={0} />
        <Text flex={1} fontWeight="semibold" fontSize="sm">
          {runDate ? new Date(runDate).toLocaleString() : run.dag_run_id}
        </Text>
      </HStack>
      <Text fontSize="11px" color="gray.500" mb={1}>
        {state}
      </Text>
      <VStack align="flex-start" gap={1} fontSize="13px" color="gray.500" mb={2.5}>
        {startedLabel !== '' && <Text>{startedLabel}</Text>}
        <Text>duration {duration ?? '-'}</Text>
        {hasTasks && (
          <VStack align="flex-start" gap={1.5} w="100%">
            <Text>
              {done}/{total} tasks
            </Text>
            <Flex gap={1} wrap="wrap">
              {dots.map((s, i) => (
                <Box
                  key={i}
                  w="10px"
                  h="10px"
                  borderRadius="full"
                  bg={STATE_COLORS[s] || '#808080'}
                  flexShrink={0}
                />
              ))}
            </Flex>
          </VStack>
        )}
      </VStack>
      <Flex gap={2} pt={2.5} borderTopWidth="1px">
        <Button
          size="sm"
          colorPalette="brand"
          variant="solid"
          flex={1}
          px={1}
          disabled={isClearing}
          onClick={(e) => { e.stopPropagation(); onClear() }}
        >
          {isClearing ? 'Clearing…' : 'Clear'}
        </Button>
        <Button
          size="sm"
          colorPalette="brand"
          variant="solid"
          flex={1}
          px={1}
          onClick={(e) => { e.stopPropagation(); onMarkState() }}
        >
          Mark State as...
        </Button>
      </Flex>
    </Box>
  )
}
