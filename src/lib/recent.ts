import { authStore } from '@/store/auth'
import { describeScreen, type ScreenInfo } from '@/lib/workspaces'

// "Recently opened" on the home launcher. Stores only route paths, per user
// (a shared browser must not show one person's history to the next); labels,
// icons and permissions are resolved from NAV at read time, so a renamed
// screen or a revoked module is reflected immediately.
const MAX = 4

const key = () => `cretos_recent_${authStore.getUser()?.id ?? 'anon'}`

function read(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key()) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

/** Call on every route change; ignores anything that isn't a sidebar screen (edit forms, print views, ...). */
export function recordRecent(path: string) {
  if (!describeScreen(path)) return
  try {
    localStorage.setItem(key(), JSON.stringify([path, ...read().filter(p => p !== path)].slice(0, MAX)))
  } catch { /* storage full or blocked — history is a nicety, never worth an error */ }
}

export function getRecent(): ScreenInfo[] {
  return read().flatMap(p => describeScreen(p) ?? [])
}
