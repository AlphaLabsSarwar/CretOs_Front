import { useEffect, useState } from 'react'

/**
 * Keeps something mounted for a moment after it's closed, so it can animate
 * out (see .drawer-leave in index.css). Pass the thing to show, or null:
 * returns what to render — the live value, or the last one while it leaves —
 * and whether it's on its way out.
 *
 * `value` should be referentially stable between renders (state, a memo or a
 * lookup into one), since each new identity is recorded as a change.
 */
export function usePresence<T>(value: T | null, exitMs = 200): { item: T | null; leaving: boolean } {
  const [prev, setPrev] = useState<T | null>(value)
  const [exiting, setExiting] = useState<T | null>(null)

  // Close detected during render (React's "adjust state when a prop changes"
  // pattern), so the element is never unmounted for a frame before leaving.
  if (value !== prev) {
    setPrev(value)
    setExiting(value == null ? prev : null)
  }

  useEffect(() => {
    if (exiting == null) return
    const t = setTimeout(() => setExiting(null), exitMs)
    return () => clearTimeout(t)
  }, [exiting, exitMs])

  return { item: value ?? exiting, leaving: value == null && exiting != null }
}
