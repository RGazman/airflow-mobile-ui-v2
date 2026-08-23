export interface DAG {
  dag_id: string
  is_paused: boolean
  schedule_interval: { value: string | null } | null
  owners: string[]
  tags: { name: string }[]
  [key: string]: unknown
}

export interface DAGStat {
  state: string
  count: number
}

export interface DAGStatsItem {
  dag_id: string
  stats: DAGStat[]
}

export interface DAGStatsResponse {
  dags: DAGStatsItem[]
  total_entries: number
}

export interface DAGListResponse {
  dags: DAG[]
  total_entries: number
}

export type { DAGRun, DAGRunListResponse } from '@/types/airflow'

export type StatusFilter = 'all' | 'active' | 'paused'
export type RunFilter = 'running' | 'failed' | null
