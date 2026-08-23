import { useState } from 'react'
import { Dialog, Portal, Text, Box, Button, Flex, Spinner, IconButton } from '@chakra-ui/react'
import { IoClose } from 'react-icons/io5'
import { SimpleSelect } from '@/components/SimpleSelect'
import type { TaskInstance } from '@/features/dagDetail/types'
import { useTaskAttempts, useTaskLogs } from '@/features/dagDetail/api/dagDetail'

interface LogsModalProps {
  dagId: string
  dagRunId: string
  task: TaskInstance | null
  open: boolean
  onClose: () => void
}

export function LogsModal({ dagId, dagRunId, task, open, onClose }: LogsModalProps) {
  const [tryNumber, setTryNumber] = useState(1)
  const [seenTaskKey, setSeenTaskKey] = useState<string | null>(null)

  // Reset the selected attempt without an effect when a new task opens
  // (React "adjust state during render" pattern).
  const taskKey = task ? `${task.task_id}:${task.map_index ?? -1}` : null
  if (taskKey !== seenTaskKey) {
    setSeenTaskKey(taskKey)
    setTryNumber(task && task.try_number && task.try_number > 0 ? task.try_number : 1)
  }

  const mapIndex = task?.map_index ?? -1
  const attemptsQuery = useTaskAttempts(dagId, dagRunId, task?.task_id ?? '', mapIndex)
  const logsQuery = useTaskLogs(dagId, dagRunId, task?.task_id ?? '', tryNumber, mapIndex)

  // All attempts 1..maxTry so previous attempts can be selected even if the
  // /attempts endpoint only reports the latest (or is unavailable).
  const maxTry = Math.max(
    1,
    task?.try_number ?? 1,
    ...(attemptsQuery.data ?? []).map((a) => a.try_number),
  )
  const attemptOptions = Array.from({ length: maxTry }, (_, i) => i + 1)

  const downloadLogs = () => {
    if (!logsQuery.data) return
    const blob = new Blob([logsQuery.data], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${dagId}-${task?.task_id}-attempt=${tryNumber}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => e.open === false && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxH="100dvh" h="100dvh" maxW="100%" borderRadius="0">
            <Dialog.Header display="flex" justifyContent="space-between" alignItems="center">
              <Dialog.Title
                flex={1}
                minW={0}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                pr={2}
                title={task?.task_id ?? undefined}
              >
                Logs: {task?.task_id ?? ''}
              </Dialog.Title>
              <IconButton
                variant="ghost"
                aria-label="Close"
                fontSize="24px"
                flexShrink={0}
                onClick={onClose}
              >
                <IoClose />
              </IconButton>
            </Dialog.Header>
            <Dialog.Body p={3} display="flex" flexDirection="column" overflow="hidden">
              <Flex gap={3} alignItems="center" mb={3} flexShrink={0} wrap="wrap">
                <Text fontSize="sm" color="gray.500">
                  Attempt:
                </Text>
                <SimpleSelect
                  size="sm"
                  value={String(Math.min(tryNumber, maxTry))}
                  onValueChange={(v) => setTryNumber(Number(v))}
                  options={attemptOptions.map((n) => ({
                    value: String(n),
                    label: String(n),
                  }))}
                />
                <Button size="sm" ml="auto" variant="outline" onClick={downloadLogs} disabled={!logsQuery.data}>
                  Download
                </Button>
              </Flex>
              <Box
                flex={1}
                minH="0"
                overflow="auto"
                bg="gray.100"
                borderWidth="1px"
                borderRadius="md"
                p={2}
                fontFamily="Consolas, Monaco, monospace"
                fontSize="xs"
                lineHeight="1.5"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
              >
                {logsQuery.isLoading ? (
                  <Flex justify="center" py={8}>
                    <Spinner size="sm" />
                  </Flex>
                ) : logsQuery.isError ? (
                  <Text color="red.500" fontFamily="inherit">
                    Failed to load logs. {logsQuery.error instanceof Error ? logsQuery.error.message : ''}
                  </Text>
                ) : (
                  logsQuery.data || 'No logs'
                )}
              </Box>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
