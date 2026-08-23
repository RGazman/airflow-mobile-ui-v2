import { useMemo, useState } from 'react'
import { Dialog, Portal, Text, Box, VStack, Checkbox, Button, Flex, Spinner } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markTaskState, markDagRunState, type TaskRef } from '@/api/webActions'
import { SimpleSelect, SelectField } from '@/components/SimpleSelect'
import type { DAGRun, TaskInstance } from '@/features/dagDetail/types'

interface MarkStateModalProps {
  dagId: string
  run: DAGRun | null
  tasks: TaskInstance[] | undefined
  open: boolean
  onClose: () => void
}

// Only success / failed are supported (as in the original Airflow UI)
const MARK_STATES = ['success', 'failed'] as const
type MarkState = (typeof MARK_STATES)[number]

const taskKey = (t: TaskInstance) => `${t.task_id}::${t.map_index ?? -1}`

/** True when at least one pair of selected tasks sits at adjacent flow positions. */
function hasConsecutiveSelection(list: TaskInstance[], selected: Set<string>): boolean {
  let prev: number | null = null
  for (let i = 0; i < list.length; i++) {
    if (!selected.has(taskKey(list[i]))) continue
    if (prev !== null && i === prev + 1) return true
    prev = i
  }
  return false
}

export function MarkStateModal({ dagId, run, tasks, open, onClose }: MarkStateModalProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newState, setNewState] = useState<MarkState>('success')
  const [runState, setRunState] = useState<MarkState>('success')
  const [error, setError] = useState<string | null>(null)
  const [lastOpen, setLastOpen] = useState(open)

  // Clear transient state when the modal reopens (adjust state during render,
  // no effect / no sync setState in effect).
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setError(null)
      setSelected(new Set())
    }
  }

  const markState = useMutation({
    mutationFn: async ({ segments, state }: { segments: TaskRef[][]; state: MarkState }) => {
      if (!run) return
      await markTaskState({ dagId, dagRunId: run.dag_run_id, state, segments })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dagRunTaskInstances'] })
      queryClient.invalidateQueries({ queryKey: ['dagRuns'] })
      queryClient.invalidateQueries({ queryKey: ['dagPool'] })
      onClose()
      setSelected(new Set())
      setError(null)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to update state')
    },
  })

  const markRunState = useMutation({
    mutationFn: async ({ state }: { state: MarkState }) => {
      if (!run) return
      await markDagRunState({ dagId, dagRunId: run.dag_run_id, state })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dagRunTaskInstances'] })
      queryClient.invalidateQueries({ queryKey: ['dagRuns'] })
      queryClient.invalidateQueries({ queryKey: ['dagPool'] })
      onClose()
      setSelected(new Set())
      setError(null)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to update run state')
    },
  })

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const consecutiveSelected = useMemo(
    () => hasConsecutiveSelection(tasks ?? [], selected),
    [tasks, selected],
  )

  return (
    <Dialog.Root open={open} onOpenChange={(e) => e.open === false && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header display="flex" justifyContent="space-between" alignItems="center">
              <Dialog.Title>Mark State as...</Dialog.Title>
              <Button size="sm" variant="ghost" onClick={onClose}>
                ✕
              </Button>
            </Dialog.Header>
            <Dialog.Body>
              <Box bg="gray.50" borderWidth="1px" borderRadius="md" p={2.5} mb={4} fontSize="sm" color="gray.500">
                <Text>
                  DAG: <Text as="strong" color="gray.800">{dagId}</Text>
                </Text>
                <Text>
                  Run: <Text as="strong" color="gray.800">{run?.dag_run_id}</Text>
                </Text>
              </Box>

              <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" p={2.5} mb={4}>
                <Text fontSize="xs" fontWeight="semibold" color="gray.500" mb={1.5}>
                  Whole run
                </Text>
                <Flex gap={2} alignItems="center">
                  <Box flex="1">
                    <SimpleSelect
                      value={runState}
                      onValueChange={(v) => setRunState(v as MarkState)}
                      options={MARK_STATES.map((s) => ({ value: s, label: s }))}
                    />
                  </Box>
                  <Button
                    size="sm"
                    variant="solid"
                    colorPalette={runState === 'failed' ? 'red' : 'green'}
                    disabled={markRunState.isPending || markState.isPending}
                    onClick={() => markRunState.mutate({ state: runState })}
                  >
                    {markRunState.isPending ? 'Applying...' : 'Apply to run'}
                  </Button>
                </Flex>
              </Box>

              {tasks === undefined ? (
                <VStack py={5} mb={4}>
                  <Spinner size="sm" />
                </VStack>
              ) : tasks.length === 0 ? (
                <Text color="gray.500" textAlign="center" py={5} mb={4}>
                  No tasks in this run
                </Text>
              ) : (
                <VStack gap={2} mb={4} align="stretch">
                  {tasks.map((t) => (
                    <Checkbox.Root
                      key={taskKey(t)}
                      checked={selected.has(taskKey(t))}
                      onCheckedChange={() => toggle(taskKey(t))}
                      px={2.5}
                      py={2}
                      borderWidth="1px"
                      borderRadius="md"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>
                        {t.task_id}
                        {t.map_index !== undefined && t.map_index > 0 ? ` [${t.map_index}]` : ''}
                      </Checkbox.Label>
                    </Checkbox.Root>
                  ))}
                </VStack>
              )}

              <SelectField label="Set state:">
                <SimpleSelect
                  value={newState}
                  onValueChange={(v) => setNewState(v as MarkState)}
                  options={MARK_STATES.map((s) => ({ value: s, label: s }))}
                />
              </SelectField>

              {consecutiveSelected && (
                <Text fontSize="xs" color="gray.500" mb={2}>
                  Consecutive tasks are marked together with their downstream.
                </Text>
              )}

              {error && (
                <Text color="red.500" fontSize="sm" mb={2}>
                  {error}
                </Text>
              )}

              <Flex gap={2}>
                <Button flex={1} variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  flex={1}
                  size="sm"
                  colorPalette="brand"
                  onClick={() => {
                    const list = tasks ?? []
                    const pos = new Map<string, number>()
                    list.forEach((t, i) => pos.set(taskKey(t), i))

                    // Consecutive selected tasks become one segment
                    // (PC: single `downstream=true` POST); a gap splits segments.
                    const segments: TaskRef[][] = []
                    let prevPos: number | null = null
                    for (const t of list) {
                      if (!selected.has(taskKey(t))) continue
                      const p = pos.get(taskKey(t))!
                      const ref: TaskRef = {
                        task_id: t.task_id,
                        map_index: t.map_index ?? -1,
                      }
                      if (prevPos !== null && p === prevPos + 1) {
                        segments[segments.length - 1].push(ref)
                      } else {
                        segments.push([ref])
                      }
                      prevPos = p
                    }
                    markState.mutate({ segments, state: newState })
                  }}
                  disabled={selected.size === 0 || markState.isPending}
                >
                  {markState.isPending ? 'Updating...' : 'Confirm'}
                </Button>
              </Flex>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
