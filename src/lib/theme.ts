import { useCallback, useEffect, useState } from 'react'

// Light/dark preference for the home launcher. Only the launcher has dark
// styles so far (no other screen has any `dark:` variants), so the `dark`
// class is added to <html> while the launcher is mounted and removed when the
// user leaves it — module screens are never half-themed. The preference itself
// is remembered per browser.
export type Theme = 'light' | 'dark'

const KEY = 'cretos_theme'

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme // native scrollbars / form controls follow
    return () => {
      root.classList.remove('dark')
      root.style.colorScheme = ''
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(KEY, next) } catch { /* private mode — the toggle still works for this visit */ }
      return next
    })
  }, [])

  return { theme, toggle }
}
