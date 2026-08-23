import { Box, Text, HStack, Button, Flex } from '@chakra-ui/react'
import type { TaskInstance } from '@/features/dagDetail/types'
import { STATE_COLORS } from '@/features/dagDetail/stateColors'

interface TaskInstanceCardProps {
  task: TaskInstance
  label?: string
  onClear: (task: TaskInstance) => void
  onShowLogs: (task: TaskInstance) => void
}

export function TaskInstanceCard({ task, label, onClear, onShowLogs }: TaskInstanceCardProps) {
  const state = task.state || 'none'
  const color = STATE_COLORS[state] || '#808080'
  const displayName = label ?? task.task_id

  const timeLabel = task.start_date && task.end_date
    ? `${new Date(task.start_date).toLocaleTimeString()} - ${new Date(task.end_date).toLocaleTimeString()}`
    : task.state === 'queued' || task.state === 'none'
      ? 'waiting...'
      : task.start_date
        ? `${new Date(task.start_date).toLocaleTimeString()} - now`
        : '—'

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      borderLeftWidth="4px"
      borderLeftColor={color}
      p={3}
      bg="white"
      mb={2.5}
    >
      <HStack justify="space-between" gap={3} mb={1.5}>
        <Text fontWeight="semibold" fontSize="sm" wordBreak="break-all">
          {displayName}
          {task.map_index !== undefined && task.map_index > 0 ? ` [${task.map_index}]` : ''}
        </Text>
        <HStack gap={1} flexShrink={0}>
          <Box w="8px" h="8px" borderRadius="full" bg={color} />
          <Text fontSize="sm" fontWeight="medium" color={color}>
            {state}
          </Text>
        </HStack>
      </HStack>
      <Flex justify="space-between" align="center" gap={2} wrap="wrap">
        <Text fontSize="sm" color="gray.500">
          {timeLabel}
        </Text>
        <HStack gap={2}>
          <Button size="xs" colorPalette="brand" variant="solid" onClick={() => onClear(task)}>
            Clear
          </Button>
          <Button size="xs" onClick={() => onShowLogs(task)} bg="#9b9b9b" _hover={{ bg: '#808080' }} color="white">
            Logs
          </Button>
        </HStack>
      </Flex>
    </Box>
  )
}
