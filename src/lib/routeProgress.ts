import { lazy, useSyncExternalStore, type ComponentType } from 'react'

// ─── Route loading progress ──────────────────────────────────────────────
// Every page is a lazy chunk (see App.tsx). With the router's v7_startTransition
// flag React keeps the current screen on-screen while the next one downloads —
// no full-page loader flash — and this module drives the slim top progress bar
// (components/shared/RouteProgress.tsx) for exactly that window: a counter of
// chunk imports in flight.

let inFlight = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

function track<T>(promise: Promise<T>): Promise<T> {
  inFlight += 1
  emit()
  return promise.finally(() => { inFlight -= 1; emit() })
}

export function useRouteLoading() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => inFlight > 0,
  )
}

type Loader<T> = () => Promise<{ default: T }>
const loaders: Loader<ComponentType<any>>[] = []

/** React.lazy that reports to the progress bar and can be preloaded. */
export function lazyPage<T extends ComponentType<any>>(load: Loader<T>) {
  let cached: Promise<{ default: T }> | null = null
  const once = () => (cached ??= load().catch(err => { cached = null; throw err }))
  loaders.push(once as Loader<ComponentType<any>>)
  return lazy(() => track(once()))
}

/**
 * Warm every page chunk in the background once the app is idle, a few at a
 * time, so later navigations are instant. Skipped on metered / slow
 * connections (Save-Data or 2G), where it would cost the user.
 */
export function preloadPagesWhenIdle() {
  const conn = (navigator as any).connection
  if (conn?.saveData || /2g/.test(conn?.effectiveType ?? '')) return
  const idle: (cb: () => void) => void = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300))
  const queue = [...loaders]
  const next = () => {
    const batch = queue.splice(0, 4)
    if (!batch.length) return
    Promise.allSettled(batch.map(l => l())).then(() => idle(next))
  }
  setTimeout(() => idle(next), 2500)
}
