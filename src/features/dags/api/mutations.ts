import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { DAGListResponse } from '@/features/dags/types'
import type { DAGDetail } from '@/features/dagDetail/types'

export function useTogglePause() {
  const queryClient = useQueryClient()

  const LIST_KEYS = ['dags', 'allDags'] as const

  return useMutation({
    mutationFn: async ({ dagId, isPaused }: { dagId: string; isPaused: boolean }) => {
      await api.patch(`/dags/${encodeURIComponent(dagId)}`, { is_paused: isPaused })
    },
    onMutate: async ({ dagId, isPaused }) => {
      await Promise.all(
        LIST_KEYS.flatMap((key) => queryClient.cancelQueries({ queryKey: [key] })),
      )
      await queryClient.cancelQueries({ queryKey: ['dagDetail'] })

      // Snapshot types are inferred from getQueriesData/getQueryData.
      const previous = {
        dags: queryClient.getQueriesData<DAGListResponse>({ queryKey: ['dags'] }),
        allDags: queryClient.getQueriesData<DAGListResponse>({ queryKey: ['allDags'] }),
        detail: queryClient.getQueryData<DAGDetail>(['dagDetail', dagId]),
      }

      // Optimistically update both list caches (paginated + full-pool)
      for (const key of LIST_KEYS) {
        queryClient.setQueriesData<DAGListResponse>({ queryKey: [key] }, (old) => {
          if (!old) return old
          return {
            ...old,
            dags: old.dags.map((dag) =>
              dag.dag_id === dagId ? { ...dag, is_paused: isPaused } : dag,
            ),
          }
        })
      }

      // Optimistically update the detail page cache
      queryClient.setQueryData<DAGDetail>(['dagDetail', dagId], (old) =>
        old ? { ...old, is_paused: isPaused } : old,
      )

      return { previous }
    },
    onError: (_err, variables, context) => {
      if (!context) return
      for (const [key, data] of context.previous.dags) queryClient.setQueryData(key, data)
      for (const [key, data] of context.previous.allDags) queryClient.setQueryData(key, data)
      if (context.previous.detail) {
        queryClient.setQueryData(['dagDetail', variables.dagId], context.previous.detail)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dags'] })
      queryClient.invalidateQueries({ queryKey: ['allDags'] })
      queryClient.invalidateQueries({ queryKey: ['dagDetail'] })
      queryClient.invalidateQueries({ queryKey: ['dagCount'] })
      queryClient.invalidateQueries({ queryKey: ['dagPool'] })
    },
  })
}

export function useTriggerDAG() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ dagId, conf }: { dagId: string; conf?: Record<string, unknown> }) => {
      const body = conf ? { conf } : {}
      await api.post(`/dags/${encodeURIComponent(dagId)}/dagRuns`, body)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dags'] })
      queryClient.invalidateQueries({ queryKey: ['allDags'] })
      queryClient.invalidateQueries({ queryKey: ['dagStats'] })
      queryClient.invalidateQueries({ queryKey: ['dagCount'] })
      queryClient.invalidateQueries({ queryKey: ['dagLastRun'] })
      queryClient.invalidateQueries({ queryKey: ['dagRuns'] })
      queryClient.invalidateQueries({ queryKey: ['dagPool'] })
    },
  })
}
