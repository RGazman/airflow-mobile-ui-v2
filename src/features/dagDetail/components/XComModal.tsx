import { useState } from 'react'
import { Dialog, Portal, Table, Text, Spinner, Button, Box, VStack } from '@chakra-ui/react'
import { SimpleSelect, SelectField } from '@/components/SimpleSelect'
import type { TaskInstance } from '@/features/dagDetail/types'
import { useTaskInstanceXCom } from '@/features/dagDetail/api/dagDetail'
import type { XComEntry } from '@/features/dagDetail/types'

function formatValue(value: XComEntry['value']): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

interface XComModalProps {
  dagId: string
  dagRunId: string
  tasks: TaskInstance[]
  tasksLoading?: boolean
  open: boolean
  onClose: () => void
}

export function XComModal({ dagId, dagRunId, tasks, tasksLoading = false, open, onClose }: XComModalProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Default to the first task when the modal opens / tasks arrive
  // (adjust state during render, no effect).
  if (open && selectedTaskId == null && tasks[0]) {
    setSelectedTaskId(tasks[0].task_id)
  }

  const selectedTask = tasks.find((t) => t.task_id === selectedTaskId) ?? tasks[0]
  const xcomQuery = useTaskInstanceXCom(
    dagId,
    dagRunId,
    selectedTask?.task_id ?? '',
    selectedTask?.map_index ?? -1,
  )

  return (
    <Dialog.Root open={open} onOpenChange={(e) => e.open === false && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header display="flex" justifyContent="space-between" alignItems="center">
              <Dialog.Title>XCom</Dialog.Title>
              <Button size="sm" variant="ghost" onClick={onClose}>
                ✕
              </Button>
            </Dialog.Header>
            <Dialog.Body>
              {tasks.length > 0 && (
                <Box mb={4}>
                  <SelectField label="Task:">
                    <SimpleSelect
                      value={selectedTask?.task_id ?? tasks[0].task_id}
                      onValueChange={setSelectedTaskId}
                      options={tasks.map((t) => ({ value: t.task_id, label: t.task_id }))}
                    />
                  </SelectField>
                </Box>
              )}

              {tasksLoading && tasks.length === 0 ? (
                <VStack py={6} textAlign="center">
                  <Spinner size="sm" />
                </VStack>
              ) : !selectedTask ? (
                <Text color="gray.500" textAlign="center" py={6}>
                  Select a run with tasks first
                </Text>
              ) : xcomQuery.isLoading ? (
                <Text textAlign="center" py={6}>
                  <Spinner size="sm" />
                </Text>
              ) : xcomQuery.data && xcomQuery.data.xcom_entries.length > 0 ? (
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Key</Table.ColumnHeader>
                      <Table.ColumnHeader>Value</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {xcomQuery.data.xcom_entries.map((entry) => (
                      <Table.Row key={`${entry.key}-${entry.map_index}-${entry.try_number}`}>
                        <Table.Cell fontWeight="medium">{entry.key}</Table.Cell>
                        <Table.Cell wordBreak="break-word">
                          <Box fontFamily="monospace" fontSize="xs" whiteSpace="pre-wrap">
                            {formatValue(entry.value)}
                          </Box>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              ) : (
                <VStack gap={1} py={6} textAlign="center">
                  <Text color="gray.500">No XCom entries</Text>
                </VStack>
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
