// Official Airflow status → color mapping (from airflow CSS):
export const STATE_COLORS: Record<string, string> = {
  deferred: 'mediumpurple',
  failed: 'red',
  queued: 'gray',
  removed: 'lightgrey',
  restarting: 'violet',
  running: 'lime',
  scheduled: 'tan',
  skipped: 'hotpink',
  success: 'green',
  up_for_reschedule: 'turquoise',
  up_for_retry: 'gold',
  upstream_failed: 'orange',
  shutdown: 'blue',
  none: 'gray',
}

export const STATE_LABELS: Record<string, string> = {
  success: 'success',
  failed: 'failed',
  running: 'running',
  queued: 'queued',
  skipped: 'skipped',
  up_for_retry: 'up_for_retry',
  upstream_failed: 'upstream_failed',
  deferred: 'deferred',
  none: 'none',
  removed: 'removed',
  restarting: 'restarting',
  scheduled: 'scheduled',
  up_for_reschedule: 'up_for_reschedule',
  shutdown: 'shutdown',
}
