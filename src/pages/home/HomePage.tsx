import { Link } from 'react-router-dom'
import { ChevronRight, Truck } from 'lucide-react'
import { authStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import { getWorkspaces, getQuickAccess } from '@/lib/workspaces'
import { getRecent } from '@/lib/recent'
import { useTheme } from '@/lib/theme'
import TopBar from '@/components/layout/TopBar'
import CommandPalette from '@/components/shared/CommandPalette'
import ChatWidget from '@/components/shared/ChatWidget'
import CompanyLogoSlot from '@/components/branding/CompanyLogoSlot'

// Workspace launcher — where a user lands after login. One tile per sidebar
// group they can open, each going to that group's first permitted screen;
// inside a workspace the usual sidebar layout takes over (its logo links back
// here). Tiles and "Recently opened" are both resolved from NAV + the cached
// permission set, so nothing here needs updating when a screen is added.
export default function HomePage() {
  const user = authStore.getUser()
  const { theme, toggle } = useTheme()
  const workspaces = getWorkspaces()
  // Until a user has opened anything, show a default shortcut set instead of an
  // empty gap — labelled honestly, since it isn't their history yet.
  const history = getRecent()
  const shortcuts = history.length ? history : getQuickAccess()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.trim().split(/\s+/)[0]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <CommandPalette />
      <ChatWidget />
      <TopBar theme={theme} onToggleTheme={toggle} />

      <main className="mx-auto max-w-[1524px] animate-fade-slide-up px-4 pb-24 pt-10 sm:px-8 sm:pt-14 lg:px-10">
        <div className="relative">
          {/* Company logo: beside the greeting on wide screens, above it on narrower ones.
              `empty:hidden` drops the wrapper (and its margin) for a viewer with no logo to show. */}
          <div className="mb-6 flex justify-center empty:hidden xl:absolute xl:left-0 xl:top-1/2 xl:mb-0 xl:-translate-y-1/2">
            <CompanyLogoSlot />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[52px] dark:text-white">
              {greeting}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-2 text-base text-slate-500 sm:text-[22px] dark:text-slate-400">Choose a workspace to continue</p>
          </div>
        </div>

        {workspaces.length > 0 ? (
          <div className={cn('mt-8 grid grid-cols-2 gap-3 sm:mt-[41px] sm:grid-cols-3 sm:gap-4', workspaces.length > 10 ? 'lg:grid-cols-4 xl:grid-cols-6' : 'lg:grid-cols-5')}>
            {workspaces.map(w => (
              <Link
                key={w.label}
                to={w.path}
                className="workspace-tile group flex flex-col items-center gap-5 rounded-xl border px-4 pb-7 pt-8 text-center shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-accent sm:pb-8 sm:pt-10"
              >
                {/* The glow is a sibling behind the icon, revealed by the tile's hover/focus state (see .workspace-tile in index.css). */}
                <span className="relative flex h-[54px] w-[54px] items-center justify-center">
                  <span aria-hidden="true" className="tile-glow pointer-events-none absolute -inset-5 rounded-full" />
                  <w.icon size={54} strokeWidth={1.9} className="relative text-accent" />
                </span>
                <div>
                  <p className="text-lg font-bold text-slate-900 sm:text-[22px] sm:leading-7 dark:text-slate-100">{w.label}</p>
                  <p className="mt-1.5 text-sm text-slate-400 sm:text-lg">{w.description}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          // Zero granted modules (a fresh OPERATOR) — the same case that used to
          // land on Quick Dispatch, which is always allowed.
          <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-gray-700 dark:text-slate-200">No workspaces are available to you yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-400">Ask an admin to grant access from Admin → Permissions.</p>
            <Link to="/quick-dispatch" className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover">
              <Truck size={14} /> Open Quick Dispatch
            </Link>
          </div>
        )}

        {shortcuts.length > 0 && (
          <section className="mt-10 sm:mt-9 lg:px-8">
            <h2 className="mb-3 text-xl font-semibold text-slate-900 sm:text-2xl dark:text-slate-100">{history.length ? 'Recently opened' : 'Quick access'}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shortcuts.map(r => (
                <Link
                  key={r.path}
                  to={r.path}
                  className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm outline-none transition duration-200 ease-out hover:border-accent/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent sm:p-[19px] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-accent/50"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-light dark:bg-accent/15">
                    <r.icon size={30} strokeWidth={1.9} className="text-accent" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold text-slate-900 sm:text-xl dark:text-slate-100">{r.label}</span>
                    <span className="block truncate text-sm text-slate-500 sm:text-[17px] dark:text-slate-400">{r.group}</span>
                  </span>
                  <ChevronRight size={22} className="shrink-0 text-slate-600 transition-transform duration-200 ease-out group-hover:translate-x-0.5 dark:text-slate-400" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
