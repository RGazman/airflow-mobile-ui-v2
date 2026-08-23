import { formatDistanceToNow, parseISO } from 'date-fns'

export function formatRelativeTime(dateString: string | null | undefined): string | null {
  if (!dateString) return null
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true })
  } catch {
    return null
  }
}
