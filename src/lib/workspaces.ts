import { LayoutGrid, TrendingUp, Megaphone, Wallet, Package, FlaskConical, Layers, Database, Truck, MapPin, PieChart, Bell, ShieldCheck, Blend } from 'lucide-react'
import { NAV } from '@/lib/nav'
import { permissionsStore } from '@/store/permissions'

// The workspace launcher (pages/home/HomePage.tsx) is built from the same NAV
// the sidebar uses, so a tile can never point at a screen the sidebar doesn't
// know about, and permission filtering is identical (permissionsStore, i.e.
// GET /me/permissions). This file only adds what NAV lacks: a launcher icon
// and a one-line description per top-level group.
const META: Record<string, { icon: React.ElementType; description: string }> = {
  Dashboard: { icon: LayoutGrid, description: 'Business overview' },
  Sales: { icon: TrendingUp, description: 'Pipeline, orders & dispatch' },
  Marketing: { icon: Megaphone, description: 'Tenders & quotations' },
  Finance: { icon: Wallet, description: 'Invoices & payments' },
  Stores: { icon: Package, description: 'Inventory & purchase' },
  'Concrete Lab': { icon: FlaskConical, description: 'Mix design & QC' },
  Production: { icon: Layers, description: 'Batching & schedule' },
  // Shown as the wide banner under the tiles, not as a tile.
  'Recipe Store': { icon: Blend, description: 'Mix designs & trial mixes' },
  Masters: { icon: Database, description: 'Customers, sites & more' },
  Fleet: { icon: Truck, description: 'Vehicles, service & fuel' },
  'Live Tracking': { icon: MapPin, description: 'GPS & dispatch progress' },
  Reports: { icon: PieChart, description: 'Ops, sales & finance' },
  // Not tiles — Alerts lives on the header bell and Admin in the avatar menu —
  // but "Recently opened" still needs an icon for pages under them.
  Alerts: { icon: Bell, description: 'Credit & stock alerts' },
  Admin: { icon: ShieldCheck, description: 'Audit & permissions' },
}

/** The launcher icon for a top-level NAV group (Sales, Production, ...). */
export const workspaceIcon = (label: string) => META[label]?.icon

const TILE_ORDER = ['Dashboard', 'Sales', 'Marketing', 'Finance', 'Stores', 'Concrete Lab', 'Production', 'Masters', 'Fleet', 'Live Tracking', 'Reports']

// The handful of screens people open all day get their own icon, tint and a
// plain-language hint on the launcher (instead of the group icon + group name).
// Also the "Quick access" set shown until a user has any history of their own.
export type Tint = 'blue' | 'red' | 'accent' | 'amber' | 'green' | 'slate'
const SCREEN_META: Record<string, { icon: React.ElementType; hint: string; tint: Tint }> = {
  '/tracking': { icon: MapPin, hint: 'Trucks currently moving', tint: 'blue' },
  '/sales/challans': { icon: Truck, hint: 'Track ongoing deliveries', tint: 'blue' },
  '/stores/stock': { icon: Package, hint: 'Check inventory status', tint: 'red' },
  '/quality/tests': { icon: FlaskConical, hint: 'View recent test results', tint: 'accent' },
  '/reports/aging': { icon: Wallet, hint: 'Pending payments', tint: 'amber' },
}
const QUICK_ACCESS = ['/tracking', '/stores/stock', '/quality/tests', '/reports/aging']

export interface Workspace {
  label: string
  description: string
  icon: React.ElementType
  /** Where the tile opens: the group's first screen this user is allowed to see. */
  path: string
}

function firstPath(label: string): string | undefined {
  const item = NAV.find(n => n.label === label)
  if (!item) return undefined
  return item.path
    ? (item.moduleKey && permissionsStore.has(item.moduleKey) ? item.path : undefined)
    : item.children?.find(c => permissionsStore.has(c.moduleKey))?.path
}

export function getWorkspaces(): Workspace[] {
  return TILE_ORDER.flatMap(label => {
    const path = firstPath(label)
    return path ? [{ label, path, ...META[label] }] : []
  })
}

/** The Recipe Store banner on the launcher, or null if this user can't open it. */
export function getRecipeWorkspace(): Workspace | null {
  const path = firstPath('Recipe Store')
  return path ? { label: 'Recipe Store', path, ...META['Recipe Store'] } : null
}

export interface ScreenInfo {
  path: string
  label: string
  /** Parent group for a nested screen, otherwise the group's description. */
  group: string
  icon: React.ElementType
  tint: Tint
}

/** Resolves a route to its sidebar label/group — or null if it isn't a sidebar screen the user may open. */
export function describeScreen(path: string): ScreenInfo | null {
  const info = resolveScreen(path)
  const override = SCREEN_META[path]
  return info && override ? { ...info, icon: override.icon, group: override.hint, tint: override.tint } : info
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
        ? { path, label: item.label, group: meta.description, icon: meta.icon, tint: 'accent' }
        : null
    }
    const child = item.children?.find(c => c.path === path)
    if (child) {
      return permissionsStore.has(child.moduleKey)
        ? { path, label: child.label, group: item.label, icon: meta.icon, tint: 'accent' }
        : null
    }
  }
  return null
}

/** Sidebar's Admin group, filtered to what this user may open (for the avatar menu). */
export function getAdminLinks() {
  return (NAV.find(n => n.label === 'Admin')?.children ?? []).filter(c => permissionsStore.has(c.moduleKey))
}
