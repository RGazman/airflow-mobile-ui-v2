import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Text,
  VStack,
  HStack,
  Flex,
  Button,
  Spinner,
  Switch,
  Alert,
  Collapsible,
  IconButton,
} from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { clearWebTasks } from '@/api/webActions'
import { toaster } from '@/components/toaster'
import { SimpleSelect } from '@/components/SimpleSelect'
import { useDAGDetail, useDAGGraphOrder, useDAGRuns, useDAGRunTaskInstances } from '@/features/dagDetail/api/dagDetail'
import { useTogglePause, useTriggerDAG } from '@/features/dags/api/mutations'
import { DAGDetailHeader } from '@/features/dagDetail/components/DAGDetailHeader'
import { DAGRunCard } from '@/features/dagDetail/components/DAGRunCard'
import { TaskInstanceCard } from '@/features/dagDetail/components/TaskInstanceCard'
import { TaskGroupSection } from '@/features/dagDetail/components/TaskGroupSection'
import { LogsModal } from '@/features/dagDetail/components/LogsModal'
import { MarkStateModal } from '@/features/dagDetail/components/MarkStateModal'
import { XComModal } from '@/features/dagDetail/components/XComModal'
import { IoPlay, IoChevronDown } from 'react-icons/io5'
import type { TaskInstance, DAGRun, TaskInstanceListResponse } from '@/features/dagDetail/types'

const RUN_LIMITS = [5, 10, 15, 20, 30]

export function DAGDetail() {
  const { dagId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [runsLimit, setRunsLimit] = useState(5)
  const [runsPage, setRunsPage] = useState(1)
  const [descOpen, setDescOpen] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const [logsTask, setLogsTask] = useState<TaskInstance | null>(null)
  const [markRun, setMarkRun] = useState<DAGRun | null>(null)
  const [xcomOpen, setXcomOpen] = useState(false)

  const dagsQuery = useDAGDetail(dagId)

  // Runs pagination: limit from the selector, offset from runsPage
  const runsOffset = (runsPage - 1) * runsLimit
  const runsQuery = useDAGRuns(dagId, runsLimit, runsOffset)
  const runs = runsQuery.data?.dag_runs ?? []
  const totalRuns = runsQuery.data?.total_entries ?? runs.length
  const runsTotalPages = Math.max(1, Math.ceil(totalRuns / runsLimit))

  // Clamp when the total shrinks below the current page (runs removed
  // externally) — render-time adjustment, no effect.
  if (runsPage > runsTotalPages) {
    setRunsPage(runsTotalPages)
  }

  const handleRunsLimitChange = useCallback((size: number) => {
    setRunsLimit(size)
    setRunsPage(1)
  }, [setRunsLimit, setRunsPage])
  const handleRunsPageChange = useCallback((page: number) => {
    setRunsPage(Math.min(Math.max(1, page), runsTotalPages))
  }, [setRunsPage, runsTotalPages])

  const selectedRun = selectedRunId
    ? runs.find((r) => r.dag_run_id === selectedRunId) ?? runs[0]
    : runs[0]

  const taskInstancesQuery = useDAGRunTaskInstances(dagId, selectedRun?.dag_run_id ?? null)
  const tasks = useMemo(
    () => taskInstancesQuery.data?.task_instances ?? [],
    [taskInstancesQuery.data],
  )

  // Task order + subdag groups derived from the DAG graph (/object/graph_data).
  const dagGraphOrderQuery = useDAGGraphOrder(dagId)
  const graphOrder = useMemo(() => dagGraphOrderQuery.data?.order ?? [], [dagGraphOrderQuery.data])
  const graphGroups = useMemo(
    () => dagGraphOrderQuery.data?.groups ?? [],
    [dagGraphOrderQuery.data],
  )

  const sortTasksByGraph = useCallback(
    (list: TaskInstance[]) => {
      const orderIdx = new Map(graphOrder.map((id, i) => [id, i]))
      return list
        .map((t, i) => ({ t, i }))
        .sort((a, b) => {
          const ai = orderIdx.get(a.t.task_id) ?? 9999
          const bi = orderIdx.get(b.t.task_id) ?? 9999
          return ai !== bi ? ai - bi : a.i - b.i
        })
        .map((x) => x.t)
    },
    [graphOrder],
  )

  const orderedTasks = useMemo(() => sortTasksByGraph(tasks), [tasks, sortTasksByGraph])

  // Task instances of the run whose "Mark State as..." was actually clicked
  // (not the currently selected run) — prevents marking the wrong run.
  const markRunInstancesQuery = useDAGRunTaskInstances(dagId, markRun?.dag_run_id ?? null)
  const markRunTasks = useMemo(
    () => sortTasksByGraph(markRunInstancesQuery.data?.task_instances ?? []),
    [markRunInstancesQuery.data, sortTasksByGraph],
  )

  // Group contiguous ordered tasks under their cluster (subdag) headers.
  const groupIdOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of graphGroups) {
      for (const mid of g.members) m.set(mid, g.id)
    }
    return m
  }, [graphGroups])

  const displayUnits = useMemo(() => {
    type Unit =
      | { kind: 'task'; task: TaskInstance }
      | { kind: 'group'; id: string; tasks: TaskInstance[] }
    const units: Unit[] = []
    let i = 0
    while (i < orderedTasks.length) {
      const t = orderedTasks[i]
      const gid = groupIdOf.get(t.task_id)
      if (gid) {
        const members: TaskInstance[] = []
        while (i < orderedTasks.length && groupIdOf.get(orderedTasks[i].task_id) === gid) {
          members.push(orderedTasks[i])
          i++
        }
        units.push({ kind: 'group', id: gid, tasks: members })
      } else {
        units.push({ kind: 'task', task: t })
        i++
      }
    }
    return units
  }, [orderedTasks, groupIdOf])

  const togglePause = useTogglePause()
  const triggerDAG = useTriggerDAG()

  const triggerFeedback = useCallback(() => {
    triggerDAG.mutate(
      { dagId },
      {
        onSuccess: () => toaster.create({ type: 'success', title: 'DAG triggered' }),
        onError: (err) =>
          toaster.create({
            type: 'error',
            title: 'Trigger failed',
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    )
  }, [triggerDAG, dagId])

  const clearRun = useMutation({
    mutationFn: async (run: DAGRun) => {
      const { data } = await api.get<
        { task_instances: { task_id: string; map_index?: number }[] } | TaskInstanceListResponse
      >(
        `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(run.dag_run_id)}/taskInstances`,
        // Explicit high limit — same as useDAGRunTaskInstances, otherwise
        // Airflow's default (100) silently drops tasks on large runs.
        { params: { limit: 1000 } },
      )
      const tasks = (data.task_instances ?? []).map((t) => ({
        task_id: t.task_id,
        map_index: t.map_index ?? -1,
      }))
      await clearWebTasks({
        dagId,
        dagRunId: run.dag_run_id,
        executionDate: run.logical_date ?? run.execution_date ?? run.data_interval_start ?? '',
        tasks,
      })
    },
    onError: (err) =>
      toaster.create({
        type: 'error',
        title: 'Clear failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dagRuns'] })
      queryClient.invalidateQueries({ queryKey: ['dagRunTaskInstances'] })
      // Keep the list's last-run indicator in sync after clearing a run
      queryClient.invalidateQueries({ queryKey: ['dagLastRun'] })
      queryClient.invalidateQueries({ queryKey: ['dags'] })
      queryClient.invalidateQueries({ queryKey: ['dagPool'] })
    },
  })

  const clearTask = useMutation({
    mutationFn: async (task: TaskInstance) => {
      if (!selectedRun) return
      await clearWebTasks({
        dagId,
        dagRunId: selectedRun.dag_run_id,
        executionDate: selectedRun.logical_date ?? selectedRun.execution_date ?? selectedRun.data_interval_start ?? '',
        tasks: [{ task_id: task.task_id, map_index: task.map_index ?? -1 }],
      })
    },
    onError: (err) =>
      toaster.create({
        type: 'error',
        title: 'Clear failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dagRunTaskInstances'] })
      queryClient.invalidateQueries({ queryKey: ['dagRuns'] })
      // Keep the list's last-run indicator in sync after clearing a task
      queryClient.invalidateQueries({ queryKey: ['dagLastRun'] })
      queryClient.invalidateQueries({ queryKey: ['dags'] })
      queryClient.invalidateQueries({ queryKey: ['dagPool'] })
    },
  })

  if (dagsQuery.isLoading || runsQuery.isLoading) {
    return (
      <VStack justify="center" minH="100dvh">
        <Spinner size="lg" />
      </VStack>
    )
  }

  if (dagsQuery.isError || !dagsQuery.data) {
    return (
      <Box p={4}>
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Title>Failed to load DAG</Alert.Title>
          <Alert.Description>
            {dagsQuery.error instanceof Error ? dagsQuery.error.message : 'Unknown error'}
          </Alert.Description>
        </Alert.Root>
        <Button mt={4} onClick={() => navigate('/')}>
          Back to DAGs
        </Button>
      </Box>
    )
  }

  const dag = dagsQuery.data
  const schedule = dag.schedule_interval?.value ?? 'None'
  const owners = dag.owners?.length ? dag.owners : ['—']

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dagDetail'] })
    queryClient.invalidateQueries({ queryKey: ['dagRuns'] })
    queryClient.invalidateQueries({ queryKey: ['dagRunTaskInstances'] })
    queryClient.invalidateQueries({ queryKey: ['dagGraphOrder'] })
  }

  return (
    <Box minH="100dvh" bg="gray.50">
      <DAGDetailHeader
        dagId={dagId}
        onOpenXCom={() => setXcomOpen(true)}
        onRefresh={handleRefresh}
      />

      {/* Actions bar */}
      <Flex
        align="center"
        justify="space-between"
        gap={3}
        px={4}
        py={3}
        bg="gray.50"
        borderBottomWidth="1px"
      >
        <HStack gap={2.5}>
          <Switch.Root
            colorPalette="brand"
            checked={!dag.is_paused}
            onCheckedChange={(e) => togglePause.mutate({ dagId, isPaused: !e.checked })}
            disabled={togglePause.isPending}
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Label fontWeight="medium">
              {dag.is_paused ? 'Paused' : 'Active'}
            </Switch.Label>
          </Switch.Root>
        </HStack>
        <Button
          colorPalette="brand"
          variant="solid"
          onClick={triggerFeedback}
          disabled={triggerDAG.isPending}
        >
          <IoPlay /> Trigger DAG
        </Button>
      </Flex>

      {/* Meta info */}
      <Box bg="white" px={4} py={2.5} borderBottomWidth="1px">
        <VStack align="flex-start" gap={1}>
          <HStack gap={2}>
            <Text fontSize="sm" color="gray.500" width="80px">Schedule:</Text>
            <Text fontSize="sm">{schedule}</Text>
          </HStack>
          <HStack gap={2}>
            <Text fontSize="sm" color="gray.500" width="80px">Owner:</Text>
            <Text fontSize="sm">{owners.join(', ')}</Text>
          </HStack>
          {dag.tags && dag.tags.length > 0 && (
            <HStack gap={2}>
              <Text fontSize="sm" color="gray.500" width="80px">Tags:</Text>
              <HStack gap={1} wrap="wrap">
                {dag.tags.map((t) => (
                  <Box
                    key={t.name}
                    as="span"
                    bg="gray.100"
                    color="gray.700"
                    fontSize="xs"
                    fontWeight="bold"
                    px={2}
                    py={0.5}
                    borderRadius="sm"
                  >
                    {t.name}
                  </Box>
                ))}
              </HStack>
            </HStack>
          )}
        </VStack>
      </Box>

      {/* Description */}
      <Box bg="white" borderBottomWidth="1px">
        <HStack justify="space-between" px={4} py={3}>
          <Text fontWeight="semibold">Description</Text>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Expand description"
            onClick={() => setDescOpen(!descOpen)}
            transform={descOpen ? 'rotate(180deg)' : ''}
          >
            <IoChevronDown />
          </IconButton>
        </HStack>
        <Collapsible.Root open={descOpen}>
          <Collapsible.Content>
            <Box px={4} pb={3} fontSize="sm" lineHeight="1.4" color="gray.700">
              {dag.description || 'No description'}
            </Box>
          </Collapsible.Content>
        </Collapsible.Root>
      </Box>

      {/* DAG Runs */}
      <Box bg="white" borderBottomWidth="1px">
        <HStack justify="space-between" px={4} py={3}>
          <Text fontWeight="semibold">DAG Runs</Text>
          <SimpleSelect
            size="sm"
            value={String(runsLimit)}
            onValueChange={(v) => handleRunsLimitChange(Number(v))}
            options={RUN_LIMITS.map((n) => ({ value: String(n), label: String(n) }))}
          />
        </HStack>

        {runsQuery.isLoading ? (
          <Box px={4} py={8} textAlign="center">
            <Spinner size="sm" />
          </Box>
        ) : runs.length === 0 ? (
          <Box px={4} py={8}>
            <Text color="gray.500" textAlign="center">
              No runs yet
            </Text>
          </Box>
        ) : (
          <Box overflowX="auto" mt={2}>
            <Flex
              gap={3}
              px={4}
              pb={4}
              w="max-content"
              onClick={(e) => e.stopPropagation()}
            >
              {runs.map((run) => (
                <DAGRunCard
                  key={run.dag_run_id}
                  run={run}
                  tasks={run.dag_run_id === selectedRun?.dag_run_id ? orderedTasks : undefined}
                  selected={run.dag_run_id === selectedRun?.dag_run_id}
                  isClearing={
                    clearRun.isPending && clearRun.variables?.dag_run_id === run.dag_run_id
                  }
                  onSelect={() => setSelectedRunId(run.dag_run_id)}
                  onClear={() => clearRun.mutate(run)}
                  onMarkState={() => setMarkRun(run)}
                />
              ))}
            </Flex>
          </Box>
        )}

        <HStack justify="space-between" px={4} pb={3}>
          <IconButton
            size="sm"
            variant="outline"
            aria-label="Previous"
            disabled={runsPage <= 1}
            onClick={() => handleRunsPageChange(runsPage - 1)}
          >
            ‹
          </IconButton>
          <Text fontSize="sm" color="gray.500">
            {totalRuns === 0 ? 0 : runsOffset + 1}
            -{Math.min(runsOffset + runs.length, totalRuns)} of {totalRuns}
          </Text>
          <IconButton
            size="sm"
            variant="outline"
            aria-label="Next"
            disabled={runsPage >= runsTotalPages}
            onClick={() => handleRunsPageChange(runsPage + 1)}
          >
            ›
          </IconButton>
        </HStack>
      </Box>

      {/* Task Instances */}
      <Box bg="white" borderBottomWidth="1px">
        <HStack justify="space-between" px={4} py={3}>
          <Text fontWeight="semibold">Task Instances</Text>
          {selectedRun && (
            <Text fontSize="sm" color="gray.500" truncate maxW="50%">
              {selectedRun.dag_run_id}
            </Text>
          )}
        </HStack>
        <Box px={4} pb={4}>
          {taskInstancesQuery.isLoading ? (
            <Box py={6} textAlign="center">
              <Spinner size="sm" />
            </Box>
          ) : tasks.length === 0 ? (
            <Text color="gray.500" textAlign="center" py={6}>
              No task instances
            </Text>
          ) : (
            displayUnits.map((unit) =>
              unit.kind === 'group' ? (
                <TaskGroupSection
                  key={unit.id}
                  id={unit.id}
                  tasks={unit.tasks}
                  onClear={(task) => clearTask.mutate(task)}
                  onShowLogs={(task) => setLogsTask(task)}
                />
              ) : (
                <TaskInstanceCard
                  key={`${unit.task.task_id}-${unit.task.map_index ?? 0}`}
                  task={unit.task}
                  onClear={(task) => clearTask.mutate(task)}
                  onShowLogs={(task) => setLogsTask(task)}
                />
              ),
            )
          )}
        </Box>
      </Box>

      {/* Modals */}
      <LogsModal
        dagId={dagId}
        dagRunId={selectedRun?.dag_run_id ?? ''}
        task={logsTask}
        open={logsTask !== null}
        onClose={() => setLogsTask(null)}
      />
      <MarkStateModal
        dagId={dagId}
        run={markRun}
        tasks={markRun ? (markRunInstancesQuery.isPending ? undefined : markRunTasks) : undefined}
        open={markRun !== null}
        onClose={() => setMarkRun(null)}
      />
      <XComModal
        dagId={dagId}
        dagRunId={selectedRun?.dag_run_id ?? ''}
        tasks={orderedTasks}
        tasksLoading={taskInstancesQuery.isPending}
        open={xcomOpen}
        onClose={() => setXcomOpen(false)}
      />
    </Box>
  )
}
