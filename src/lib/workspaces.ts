import { LayoutGrid, UserPlus, Megaphone, BarChart3, Box, FlaskConical, Factory, Layers, Truck, FileText, Bell, ShieldCheck, MapPinned } from 'lucide-react'
import { NAV } from '@/lib/nav'
import { permissionsStore } from '@/store/permissions'

// The workspace launcher (pages/home/HomePage.tsx) is built from the same NAV
// the sidebar uses, so a tile can never point at a screen the sidebar doesn't
// know about, and permission filtering is identical (permissionsStore, i.e.
// GET /me/permissions). This file only adds what NAV lacks: a launcher icon
// and a one-line description per top-level group.
const META: Record<string, { icon: React.ElementType; description: string }> = {
  Dashboard: { icon: LayoutGrid, description: 'Overview' },
  Sales: { icon: UserPlus, description: 'Orders & dispatch' },
  Marketing: { icon: Megaphone, description: 'Tenders & quotations' },
  Finance: { icon: BarChart3, description: 'Payments & accounts' },
  Stores: { icon: Box, description: 'Inventory & purchases' },
  'Concrete Lab': { icon: FlaskConical, description: 'Tests & mix designs' },
  Production: { icon: Factory, description: 'Batching & output' },
  Masters: { icon: Layers, description: 'Master data' },
  Fleet: { icon: Truck, description: 'Maintenance & fuel' },
  'Live Tracking': { icon: MapPinned, description: 'Live map & status' },
  Reports: { icon: FileText, description: 'Insights & analytics' },
  // Not tiles — Alerts lives on the header bell and Admin in the avatar menu —
  // but "Recently opened" still needs an icon for pages under them.
  Alerts: { icon: Bell, description: 'Credit & stock alerts' },
  Admin: { icon: ShieldCheck, description: 'Audit & permissions' },
}

/** The launcher icon for a top-level NAV group (Sales, Production, ...). */
export const workspaceIcon = (label: string) => META[label]?.icon

const TILE_ORDER = ['Dashboard', 'Sales', 'Marketing', 'Finance', 'Stores', 'Concrete Lab', 'Production', 'Masters', 'Fleet', 'Live Tracking', 'Reports']

// The handful of screens people open all day get their own icon and a
// plain-language hint on the launcher (instead of the group icon + group name).
// Also the "Quick access" set shown until a user has any history of their own.
const SCREEN_META: Record<string, { icon: React.ElementType; hint: string }> = {
  '/sales/challans': { icon: Truck, hint: 'Track ongoing deliveries' },
  '/stores/stock': { icon: Box, hint: 'Check inventory status' },
  '/quality/tests': { icon: FlaskConical, hint: 'View recent test results' },
}
const QUICK_ACCESS = ['/sales/challans', '/stores/stock', '/quality/tests']

export interface Workspace {
  label: string
  description: string
  icon: React.ElementType
  /** Where the tile opens: the group's first screen this user is allowed to see. */
  path: string
}

export function getWorkspaces(): Workspace[] {
  return TILE_ORDER.flatMap(label => {
    const item = NAV.find(n => n.label === label)
    if (!item) return []
    const path = item.path
      ? (item.moduleKey && permissionsStore.has(item.moduleKey) ? item.path : undefined)
      : item.children?.find(c => permissionsStore.has(c.moduleKey))?.path
    return path ? [{ label, path, ...META[label] }] : []
  })
}

export interface ScreenInfo {
  path: string
  label: string
  /** Parent group for a nested screen, otherwise the group's description. */
  group: string
  icon: React.ElementType
}

/** Resolves a route to its sidebar label/group — or null if it isn't a sidebar screen the user may open. */
export function describeScreen(path: string): ScreenInfo | null {
  const info = resolveScreen(path)
  const override = SCREEN_META[path]
  return info && override ? { ...info, icon: override.icon, group: override.hint } : info
}

/** Default launcher shortcuts for a user with no history yet, limited to what they may open. */
export function getQuickAccess(): ScreenInfo[] {
  return QUICK_ACCESS.flatMap(p => describeScreen(p) ?? [])
}

function resolveScreen(path: string): ScreenInfo | null {
  for (const item of NAV) {
    const meta = META[item.label]
    if (item.path === path) {
      return item.moduleKey && permissionsStore.has(item.moduleKey)
        ? { path, label: item.label, group: meta.description, icon: meta.icon }
        : null
    }
    const child = item.children?.find(c => c.path === path)
    if (child) {
      return permissionsStore.has(child.moduleKey)
        ? { path, label: child.label, group: item.label, icon: meta.icon }
        : null
    }
  }
  return null
}

/** Sidebar's Admin group, filtered to what this user may open (for the avatar menu). */
export function getAdminLinks() {
  return (NAV.find(n => n.label === 'Admin')?.children ?? []).filter(c => permissionsStore.has(c.moduleKey))
}
