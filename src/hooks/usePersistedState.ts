import { useState, useEffect } from 'react'

/**
 * State persisted to sessionStorage so it survives component remounts
 * (e.g. navigating to DAG detail and back — the list keeps its filters).
 */
export function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state))
    } catch {
      // storage may be unavailable; ignore
    }
  }, [key, state])

  return [state, setState] as const
}
