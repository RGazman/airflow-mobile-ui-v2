export interface DAGDetail {
  dag_id: string
  is_paused: boolean
  is_active: boolean
  description: string | null
  schedule_interval: { __type?: string; value: string | null } | null
  timetable_summary: string | null
  owners: string[]
  tags: { name: string }[]
  fileloc: string
  max_active_runs: number
  default_view: string | null
  dag_display_name: string | null
  [key: string]: unknown
}

export type { DAGRun, DAGRunListResponse } from '@/types/airflow'

export interface TaskInstance {
  task_id: string
  dag_id: string
  dag_run_id: string
  logical_date: string | null
  execution_date: string | null
  start_date: string | null
  end_date: string | null
  state: string
  try_number: number
  note: string | null
  map_index?: number
  [key: string]: unknown
}

export interface TaskInstanceListResponse {
  task_instances: TaskInstance[]
  total_entries: number
}

export interface XComEntry {
  key: string
  value: string | null
  timestamp: string | null
  execution_date: string | null
  map_index: number
  try_number: number
  [key: string]: unknown
}

export interface XComListResponse {
  xcom_entries: XComEntry[]
  total_entries: number
}

export type RunState = 'success' | 'failed' | 'running' | 'queued' | 'none'
