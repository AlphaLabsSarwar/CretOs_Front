import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bell, ChevronDown, HelpCircle, LogOut, Moon, Search, Sun } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { permissionsStore } from '@/store/permissions'
import { SHOW_TOUR_EVENT } from '@/lib/tourEvent'
import { getAdminLinks } from '@/lib/workspaces'
import type { Theme } from '@/lib/theme'
import BrandMark from '@/components/shared/BrandMark'
import LiveClock from '@/components/shared/LiveClock'

interface AlertsData { creditBreaches: unknown[]; lowStock: unknown[] }

const MENU_ITEM = 'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-gray-700 outline-none data-[highlighted]:bg-gray-100 dark:text-slate-200 dark:data-[highlighted]:bg-slate-800'
const ICON_BUTTON = 'relative rounded-full p-2 text-slate-900 transition-colors hover:bg-gray-100 dark:text-slate-100 dark:hover:bg-slate-800'

function initials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

// Top bar for the workspace launcher: brand + live clock, global search,
// theme, alerts, account. Module screens keep their own sidebar layout
// (AppLayout) — this is only the home screen's chrome.
export default function TopBar({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const user = authStore.getUser()
  const canSeeAlerts = permissionsStore.has('reports.alerts')
  const adminLinks = getAdminLinks()

  // Same query key + endpoint as pages/reports/AlertsPage.tsx, so opening the
  // bell right after reuses the cached result instead of refetching.
  const { data: alerts } = useQuery({
    queryKey: ['alerts', user?.branch?.id],
    queryFn: () => api.get('/dashboard/alerts', { params: { branch_id: user?.branch?.id } }).then(r => r.data.data as AlertsData),
    enabled: canSeeAlerts && !!user?.branch?.id,
  })
  const alertCount = (alerts?.creditBreaches?.length ?? 0) + (alerts?.lowStock?.length ?? 0)

  const logout = () => {
    authStore.clear()
    permissionsStore.clear()
    window.location.href = '/login'
  }

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 sm:h-[74px] sm:gap-6 sm:px-9 dark:border-slate-800 dark:bg-slate-900">
      {/* Brand, then the clock — same size and weight as the wordmark. That is
          ~355px wide, so it only shows from xl up; the search box takes
          whatever room is left and is capped smaller there to make space. */}
      <BrandMark tone="light" size="lg" />
      <LiveClock className="hidden shrink-0 whitespace-nowrap text-2xl font-bold tabular-nums tracking-tight text-slate-600 xl:block sm:text-[26px] dark:text-slate-300" />

      <div className="flex min-w-0 flex-1 justify-center">
        {/* Opens the same ⌘K command palette the module screens use. */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          aria-label="Search"
          className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 text-left text-sm text-slate-500 transition-colors hover:border-gray-300 hover:bg-white sm:h-[50px] sm:max-w-[38rem] sm:text-base xl:max-w-[26rem] dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          <Search size={22} className="shrink-0 text-slate-700 dark:text-slate-300" />
          <span className="truncate sm:hidden">Search</span>
          <span className="hidden truncate sm:inline">Search (e.g., customer, order no., site)</span>
          <kbd className="ml-auto hidden rounded border border-gray-300 bg-white px-1.5 text-[10px] text-gray-400 md:inline dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">⌘K</kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
        <button
          onClick={onToggleTheme}
          aria-label={`Switch to ${nextTheme} theme`}
          title={`Switch to ${nextTheme} theme`}
          className={ICON_BUTTON}
        >
          {theme === 'dark' ? <Sun size={26} strokeWidth={1.75} /> : <Moon size={26} strokeWidth={1.75} />}
        </button>

        {canSeeAlerts && (
          <Link
            to="/reports/alerts"
            aria-label={alertCount ? `Alerts (${alertCount})` : 'Alerts'}
            title="Alerts"
            className={ICON_BUTTON}
          >
            <Bell size={28} strokeWidth={1.75} />
            {alertCount > 0 && <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-accent ring-2 ring-white dark:ring-slate-900" />}
          </Link>
        )}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label="Account menu"
            className="flex items-center gap-1.5 rounded-full p-1 outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-slate-800"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white sm:h-[52px] sm:w-[52px] sm:text-base dark:bg-slate-600">
              {initials(user?.name)}
            </span>
            <ChevronDown size={20} className="text-slate-500 dark:text-slate-400" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-gray-100 px-2.5 pb-2.5 pt-1.5 dark:border-slate-800">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{user?.name}</p>
                <p className="truncate text-xs text-gray-500 dark:text-slate-400">{user?.email}</p>
                <p className="mt-1.5 text-[11px] font-medium text-gray-500 dark:text-slate-400">{[user?.role, user?.branch?.name].filter(Boolean).join(' · ')}</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">{user?.company?.name}</p>
              </div>

              {adminLinks.length > 0 && (
                <div className="border-b border-gray-100 py-1 dark:border-slate-800">
                  <p className="section-label px-2.5 pb-1 pt-1.5">Admin</p>
                  {adminLinks.map(l => (
                    <DropdownMenu.Item key={l.path} asChild>
                      <Link to={l.path} className={MENU_ITEM}>{l.label}</Link>
                    </DropdownMenu.Item>
                  ))}
                </div>
              )}

              <div className="pt-1">
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => window.dispatchEvent(new Event(SHOW_TOUR_EVENT))}>
                  <HelpCircle size={15} className="text-gray-400" /> Take a tour
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={logout}>
                  <LogOut size={15} className="text-gray-400" /> Log out
                </DropdownMenu.Item>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
