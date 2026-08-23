import { useState } from 'react'
import { Box, HStack, Text, IconButton, Collapsible } from '@chakra-ui/react'
import { IoChevronDown } from 'react-icons/io5'
import { TaskInstanceCard } from './TaskInstanceCard'
import type { TaskInstance } from '@/features/dagDetail/types'

interface TaskGroupSectionProps {
  id: string
  tasks: TaskInstance[]
  onClear: (task: TaskInstance) => void
  onShowLogs: (task: TaskInstance) => void
}

/** "group.task" -> "task" (keeps map_index suffix implicit). */
function stripGroupPrefix(taskId: string, groupId: string): string {
  const prefix = `${groupId}.`
  return taskId.startsWith(prefix) ? taskId.slice(prefix.length) : taskId
}

export function TaskGroupSection({ id, tasks, onClear, onShowLogs }: TaskGroupSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <Box bg="white" borderWidth="1px" borderRadius="md" mb={2.5} overflow="hidden">
      <HStack
        justify="space-between"
        px={3}
        py={2.5}
        bg="gray.50"
        borderBottomWidth={open ? '1px' : '0'}
        cursor="pointer"
        onClick={() => setOpen(!open)}
      >
        <Text fontWeight="semibold" fontSize="sm">
          {id}{' '}
          <Text as="span" color="gray.500" fontWeight="normal">
            ({tasks.length})
          </Text>
        </Text>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={open ? 'Collapse group' : 'Expand group'}
          transform={open ? 'rotate(180deg)' : ''}
        >
          <IoChevronDown />
        </IconButton>
      </HStack>
      <Collapsible.Root open={open}>
        <Collapsible.Content>
          <Box p={3}>
            {tasks.map((task) => (
              <TaskInstanceCard
                key={`${task.task_id}-${task.map_index ?? 0}`}
                task={task}
                label={stripGroupPrefix(task.task_id, id)}
                onClear={onClear}
                onShowLogs={onShowLogs}
              />
            ))}
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  )
}
