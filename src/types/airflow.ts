/**
 * Общие типы Airflow, разделяемые фичами (список DAG и детали DAG).
 * Источник истины для DAGRun / DAGRunListResponse.
 */
export interface DAGRun {
  dag_run_id: string
  dag_id: string
  logical_date: string | null
  execution_date: string | null
  start_date: string | null
  end_date: string | null
  state: string
  external_trigger: boolean
  run_type: string | null
  note: string | null
  conf: Record<string, unknown> | null
  data_interval_start: string | null
  data_interval_end: string | null
  queued_at: string | null
  [key: string]: unknown
}

export interface DAGRunListResponse {
  dag_runs: DAGRun[]
  total_entries: number
}
