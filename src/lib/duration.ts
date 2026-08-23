import { differenceInSeconds } from 'date-fns'

export function formatDuration(startDate: string | null, endDate: string | null): string | null {
  if (!startDate || !endDate) return null
  const seconds = Math.max(0, differenceInSeconds(new Date(endDate), new Date(startDate)))
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return `${h}h ${remM}m`
}
