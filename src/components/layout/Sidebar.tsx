import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, LogOut, HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { authStore } from '@/store/auth'
import { permissionsStore } from '@/store/permissions'
import { SHOW_TOUR_EVENT } from '@/lib/tourEvent'
import { NAV, findWorkspace, type NavItem } from '@/lib/nav'
import { workspaceIcon } from '@/lib/workspaces'
import BrandMark from '@/components/shared/BrandMark'

interface SidebarProps {
  // Below the md breakpoint the sidebar is an off-canvas drawer owned by
  // AppLayout (which also renders the hamburger toggle + backdrop); above
  // md it's always visible and these props are simply unused.
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation()
  const user = authStore.getUser()
  const [expanded, setExpanded] = useState<string[]>([])

  const toggle = (label: string) => {
    setExpanded(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  const isExpanded = (label: string) => expanded.includes(label)

  const isChildActive = (item: NavItem) =>
    item.children?.some(c => location.pathname.startsWith(c.path)) ?? false

  // Resolve each item against the cached module set from GET /me/permissions
  // (refreshed on login) — a leaf item needs its own moduleKey; a group
  // needs at least one visible child, and only shows those children.
  const visibleNav = NAV
    .map(item => {
      if (item.path) {
        return item.moduleKey && permissionsStore.has(item.moduleKey) ? item : null
      }
      const children = (item.children ?? []).filter(c => permissionsStore.has(c.moduleKey))
      return children.length ? { ...item, children } : null
    })
    .filter((item): item is NavItem => item !== null)

  // Inside a workspace (Sales, Production, ...) the sidebar shows only that
  // workspace's screens — you pick a different one from the home launcher. A
  // route that isn't under any workspace falls back to the full menu.
  const workspace = findWorkspace(location.pathname)
  const scoped = workspace ? visibleNav.find(i => i.label === workspace.label) : undefined
  const WorkspaceIcon = workspace ? workspaceIcon(workspace.label) : undefined

  return (
    <>
      {/* Backdrop — mobile only, taps outside the drawer to dismiss it */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'w-60 flex-shrink-0 bg-sidebar-bg flex flex-col h-screen',
          // Desktop: static column, always visible. Mobile: fixed off-canvas
          // drawer that slides in from the left over the content.
          'fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out',
          'md:sticky md:top-0 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
        <BrandMark tone="dark" onClick={onClose} />
        {/* Close button — mobile drawer only */}
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="text-sidebar-text hover:text-white md:hidden"
        >
          <X size={18} />
        </button>
      </div>

      {/* Company + branch indicator */}
      <div className="px-4 py-2.5 border-b border-white/10">
        {user?.company?.name && (
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-accent">{user.company.name}</p>
        )}
        <p className="text-xs text-sidebar-text">{user?.branch?.name ?? 'Branch'}</p>
        <p className="text-white text-xs font-medium">{user?.name ?? 'User'}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-none">
        {scoped ? (
          <>
            <Link
              to="/home"
              onClick={onClose}
              className="mb-1 flex items-center gap-1.5 px-4 py-2 text-xs text-sidebar-text transition-colors hover:text-white"
            >
              <ArrowLeft size={13} /> All workspaces
            </Link>
            {scoped.path ? (
              // A workspace that is a single screen (Dashboard, Fleet, Live Tracking, Alerts).
              <NavLink to={scoped.path} onClick={onClose} className={({ isActive }) => cn('sidebar-item', isActive && 'active')}>
                <scoped.icon size={15} />
                <span>{scoped.label}</span>
              </NavLink>
            ) : (
              <>
                <p className="flex items-center gap-2 px-4 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  {WorkspaceIcon && <WorkspaceIcon size={13} />} {scoped.label}
                </p>
                {scoped.children?.map(child => (
                  <NavLink key={child.path} to={child.path} onClick={onClose} className={({ isActive }) => cn('sidebar-item', isActive && 'active')}>
                    {child.label}
                  </NavLink>
                ))}
              </>
            )}
          </>
        ) : visibleNav.map(item => (
          <div key={item.label}>
            {item.path ? (
              <NavLink
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  cn('sidebar-item', isActive && 'active')
                }
              >
                <item.icon size={15} />
                <span>{item.label}</span>
              </NavLink>
            ) : (
              <>
                <button
                  onClick={() => toggle(item.label)}
                  className={cn(
                    'sidebar-item w-full justify-between',
                    isChildActive(item) && 'text-white'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon size={15} />
                    <span>{item.label}</span>
                  </div>
                  {isExpanded(item.label)
                    ? <ChevronDown size={13} />
                    : <ChevronRight size={13} />
                  }
                </button>
                {isExpanded(item.label) && item.children?.map(child => (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn('sidebar-subitem', isActive && 'active')
                    }
                  >
                    {child.label}
                  </NavLink>
                ))}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Take a tour — replays ProductTour (see components/layout/AppLayout.tsx),
          which otherwise only shows itself automatically once, on a user's
          very first login on this browser. */}
      <button
        onClick={() => window.dispatchEvent(new Event(SHOW_TOUR_EVENT))}
        className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5 text-xs text-sidebar-text hover:text-white transition-colors"
      >
        <HelpCircle size={14} /> Take a tour
      </button>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
          <span className="text-accent text-xs font-semibold">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate">{user?.name}</p>
          <p className="text-sidebar-text text-xs truncate">{user?.role}</p>
        </div>
        <button
          onClick={() => { authStore.clear(); permissionsStore.clear(); window.location.href = '/login' }}
          aria-label="Log out"
          className="text-sidebar-text hover:text-white transition-colors"
        >
          <LogOut size={14} />
        </button>
      </div>
      </aside>
    </>
  )
}
