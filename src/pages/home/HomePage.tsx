import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ClipboardList, FileText, Layers, MessageCircle, Truck, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { permissionsStore } from '@/store/permissions'
import { cn, formatINRCompact, formatQtyShort } from '@/lib/utils'
import { getWorkspaces, getQuickAccess, getRecipeWorkspace, type Tint } from '@/lib/workspaces'
import { getRecent } from '@/lib/recent'
import { RECIPE_STATS } from '@/lib/recipes'
import { useTheme } from '@/lib/theme'
import { OPEN_CHAT_EVENT } from '@/lib/tourEvent'
import TopBar from '@/components/layout/TopBar'
import CommandPalette from '@/components/shared/CommandPalette'
import ChatWidget from '@/components/shared/ChatWidget'
import CompanyLogoSlot from '@/components/branding/CompanyLogoSlot'

// Only the slice of GET /dashboard/summary the launcher shows.
interface Snapshot {
  today: { totalQty: number; totalTrips: number; utilizationPct: number | null }
  finance: { overdueCount: number; overdueAmount: number }
  lowStock: unknown[]
  quality: { failed: number }
  actionItems: { draftChallans: number; unbilledChallans: number }
}

type BadgeTone = 'green' | 'accent' | 'blue' | 'amber' | 'red' | 'slate'
const BADGE: Record<BadgeTone, string> = {
  green: 'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-400',
  accent: 'bg-accent-light text-accent-hover dark:bg-accent/15 dark:text-accent-soft',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}
const TINT: Record<Tint, string> = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  accent: 'bg-accent-light text-accent dark:bg-accent/15',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  green: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

const TILE = 'workspace-tile group relative flex flex-col gap-2.5 overflow-hidden rounded-[14px] border px-3.5 py-[18px] text-left outline-none focus-visible:ring-2 focus-visible:ring-accent'
const CARD = 'rounded-[14px] border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900'

function Badge({ tone, live, children }: { tone: BadgeTone; live?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold', BADGE[tone])}>
      {live && <span className="h-[5px] w-[5px] rounded-full bg-green-600" />}
      {children}
    </span>
  )
}

function TileIcon({ icon: Icon, size = 38 }: { icon: React.ElementType; size?: number }) {
  return (
    <span className="relative flex shrink-0 items-center justify-center rounded-[11px] bg-accent-light dark:bg-accent/15" style={{ width: size, height: size }}>
      {/* Glow revealed on hover/focus (see .workspace-tile in index.css). */}
      <span aria-hidden="true" className="tile-glow pointer-events-none absolute -inset-3 rounded-full" />
      <Icon size={size > 40 ? 24 : 18} strokeWidth={1.75} className="relative text-accent" />
    </span>
  )
}

// Workspace launcher — where a user lands after login. One tile per sidebar
// group they can open, each going to that group's first permitted screen;
// inside a workspace the usual sidebar layout takes over (its logo links back
// here). Tiles and "Recently opened" are both resolved from NAV + the cached
// permission set, so nothing here needs updating when a screen is added.
export default function HomePage() {
  const user = authStore.getUser()
  const branchId = user?.branch?.id
  const { theme, toggle } = useTheme()
  const workspaces = getWorkspaces()
  const recipes = getRecipeWorkspace()
  // Until a user has opened anything, show a default shortcut set instead of an
  // empty gap — labelled honestly, since it isn't their history yet.
  const history = getRecent()
  const shortcuts = history.length ? history : getQuickAccess()

  // Live numbers for the banner, tile badges and "Today at a glance". Only
  // fetched for users who can see the dashboard; everyone else gets the
  // launcher without numbers rather than a wall of 403s.
  const canSeeDashboard = permissionsStore.has('dashboard')
  const { data: snap } = useQuery({
    queryKey: ['dashboard-summary', branchId],
    queryFn: () => api.get('/dashboard/summary', { params: { branch_id: branchId } }).then(r => r.data.data as Snapshot),
    enabled: canSeeDashboard && !!branchId,
    refetchInterval: 60_000,
  })
  const { data: live } = useQuery({
    queryKey: ['dashboard-challans', branchId],
    queryFn: () => api.get('/sales/challans/dashboard', { params: { branch_id: branchId } }).then(r => r.data.data as { inTransit?: unknown[] }),
    enabled: canSeeDashboard && !!branchId,
    refetchInterval: 30_000,
  })
  const onRoad = live?.inTransit?.length

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const dateLine = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const badges: Record<string, React.ReactNode> = snap ? {
    Dashboard: <Badge tone="green">Live</Badge>,
    Sales: snap.actionItems.draftChallans > 0 ? <Badge tone="accent">{snap.actionItems.draftChallans} draft</Badge> : null,
    Finance: snap.finance.overdueCount > 0 ? <Badge tone="amber">₹{formatINRCompact(snap.finance.overdueAmount)} due</Badge> : null,
    Stores: snap.lowStock.length > 0 ? <Badge tone="red">{snap.lowStock.length} low stock</Badge> : null,
    'Concrete Lab': snap.quality.failed > 0 ? <Badge tone="red">{snap.quality.failed} failed</Badge> : null,
    Production: snap.today.utilizationPct != null ? <Badge tone="green">{snap.today.utilizationPct}% utilised</Badge> : null,
    Fleet: onRoad ? <Badge tone="amber">{onRoad} on road</Badge> : null,
    'Live Tracking': onRoad ? <Badge tone="green" live>{onRoad} live</Badge> : null,
  } : {}

  const quickActions = [
    { label: 'Create Quote', icon: FileText, to: '/marketing/quotations/new', module: 'marketing.quotations' },
    { label: 'New Order', icon: ClipboardList, to: '/sales/orders/new', module: 'sales.orders' },
    { label: 'Start Batch', icon: Layers, to: '/production/batches/new', module: 'production.batching' },
    { label: 'New Dispatch', icon: Truck, to: '/quick-dispatch', module: 'sales.challans' },
    { label: 'Add Expense', icon: Wallet, to: '/finance/payments/new', module: 'finance.payments' },
  ].filter(a => permissionsStore.has(a.module))

  const glance = snap ? [
    { label: 'Dispatches today', value: String(snap.today.totalTrips) },
    { label: 'Volume today (cum)', value: formatQtyShort(snap.today.totalQty) },
    { label: 'Trucks on road', value: onRoad != null ? String(onRoad) : '—', cls: 'text-amber-700' },
    { label: 'Overdue payments', value: String(snap.finance.overdueCount), cls: 'text-red-700' },
    { label: 'Failed tests (30d)', value: String(snap.quality.failed), cls: 'text-accent' },
  ] : []

  return (
    <div className="min-h-screen bg-page text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <CommandPalette />
      <ChatWidget />
      <TopBar theme={theme} onToggleTheme={toggle} />

      <main className="route-stagger mx-auto max-w-[1440px] px-4 pb-24 pt-6 sm:px-10">
        {/* Greeting banner */}
        <section className="relative flex flex-col gap-6 overflow-hidden rounded-[20px] bg-accent px-6 py-7 sm:px-10 sm:py-8 lg:flex-row lg:items-center lg:justify-between">
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-[46px] -right-[30px] h-[150px] w-[260px]">
            <span className="absolute bottom-0 right-[70px] h-16 w-[70px] rounded-t-lg bg-white/[0.14]" />
            <span className="absolute bottom-10 right-[82px] h-[46px] w-[46px] animate-[drum-spin_6s_linear_infinite] rounded-full bg-[conic-gradient(rgba(255,255,255,.22)_0_12%,transparent_12%_25%,rgba(255,255,255,.22)_25%_37%,transparent_37%_50%,rgba(255,255,255,.22)_50%_62%,transparent_62%_75%,rgba(255,255,255,.22)_75%_87%,transparent_87%_100%)] motion-reduce:animate-none" />
            <span className="absolute bottom-0 right-5 h-[34px] w-[52px] rounded-[5px_10px_4px_4px] bg-white/[0.14]" />
            <span className="absolute -bottom-1.5 right-[76px] h-3.5 w-3.5 rounded-full bg-[rgba(30,19,5,.35)]" />
            <span className="absolute -bottom-1.5 right-[34px] h-3.5 w-3.5 rounded-full bg-[rgba(30,19,5,.35)]" />
          </div>
          <div className="relative flex items-center gap-6">
            <div className="hidden empty:hidden xl:block"><CompanyLogoSlot /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[rgba(30,19,5,.62)]">{dateLine}</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.02em] text-[#1E1305] sm:text-[38px]">
                {greeting}{firstName ? `, ${firstName}` : ''}
              </h1>
              <p className="mt-1.5 text-[15px] text-[rgba(30,19,5,.72)]">Here&rsquo;s what&rsquo;s moving across your plants right now.</p>
            </div>
          </div>
          {snap && (
            <div className="relative flex gap-6">
              {[
                { value: String(snap.today.totalTrips), label: 'Dispatches today' },
                { value: onRoad != null ? String(onRoad) : '—', label: 'Trucks on road' },
                { value: snap.today.utilizationPct != null ? `${snap.today.utilizationPct}%` : '—', label: 'Plant utilisation' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="font-mono text-2xl font-bold text-[#1E1305]">{s.value}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.05em] text-[rgba(30,19,5,.6)]">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {workspaces.length > 0 ? (
          <div className="route-stagger mt-7 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {workspaces.map(w => (
              <Link key={w.label} to={w.path} className={TILE}>
                <TileIcon icon={w.icon} />
                <div>
                  <p className="text-sm font-bold">{w.label}</p>
                  <p className="mt-[3px] text-[11px] leading-[1.35] text-slate-400">{w.description}</p>
                </div>
                {badges[w.label]}
              </Link>
            ))}
            {/* The assistant is available to everyone — it opens the chat panel. */}
            <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))} className={TILE}>
              <TileIcon icon={MessageCircle} />
              <div>
                <p className="text-sm font-bold">CretOS Assistant</p>
                <p className="mt-[3px] text-[11px] leading-[1.35] text-slate-400">Ask about today&rsquo;s numbers</p>
              </div>
              <Badge tone="green" live>Online</Badge>
            </button>
          </div>
        ) : (
          // Zero granted modules (a fresh OPERATOR) — the same case that used to
          // land on Quick Dispatch, which is always allowed.
          <div className={cn(CARD, 'mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-8 text-center')}>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-200">No workspaces are available to you yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-400">Ask an admin to grant access from Admin → Permissions.</p>
            <Link to="/quick-dispatch" className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover">
              <Truck size={14} /> Open Quick Dispatch
            </Link>
          </div>
        )}

        {recipes && (
          <Link to={recipes.path} className={cn(TILE, 'mt-3.5 flex-row items-center gap-[18px] rounded-2xl px-6 py-5')}>
            <TileIcon icon={recipes.icon} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[17px] font-bold">Recipe Store &amp; Mix Combinations</p>
                <Badge tone="accent">New</Badge>
              </div>
              <p className="mt-[3px] text-[12.5px] text-slate-400">Create, test, and approve concrete mix designs — then send them straight to the batching plant.</p>
            </div>
            <div className="hidden shrink-0 gap-5 px-2 sm:flex">
              {[
                { v: RECIPE_STATS.approved, l: 'Approved', c: '' },
                { v: RECIPE_STATS.inTrial, l: 'In trial', c: 'text-accent' },
                { v: RECIPE_STATS.pendingApproval, l: 'Pending', c: 'text-amber-600' },
              ].map(s => (
                <div key={s.l} className="text-center">
                  <p className={cn('font-mono text-[17px] font-bold', s.c)}>{s.v}</p>
                  <p className="mt-px text-[9.5px] uppercase text-slate-400">{s.l}</p>
                </div>
              ))}
            </div>
            <ArrowRight size={18} className="shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        )}

        {shortcuts.length > 0 && (
          <section className="mt-[26px]">
            <h2 className="mb-3 text-base font-bold">{history.length ? 'Recently opened' : 'Quick access'}</h2>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {shortcuts.map(r => (
                <Link
                  key={r.path}
                  to={r.path}
                  className={cn(CARD, 'kpi-tile block rounded-[14px] p-4 outline-none focus-visible:ring-2 focus-visible:ring-accent')}
                >
                  <span className={cn('inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px]', TINT[r.tint])}>
                    <r.icon size={16} strokeWidth={1.75} />
                  </span>
                  <p className="mt-2.5 truncate text-[13px] font-semibold">{r.label}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{r.group}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {(glance.length > 0 || quickActions.length > 0) && (
          <div className="mt-6 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.3fr_1fr]">
            {glance.length > 0 && (
              <section className={cn(CARD, 'px-[22px] py-[18px]')}>
                <h2 className="mb-3.5 text-[15px] font-bold">Today at a glance</h2>
                <div className="grid grid-cols-2 gap-4 sm:flex sm:justify-between">
                  {glance.map(g => (
                    <div key={g.label}>
                      <p className={cn('font-mono text-xl font-bold', g.cls)}>{g.value}</p>
                      <p className="mt-0.5 text-[10.5px] text-slate-400">{g.label}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {quickActions.length > 0 && (
              <section className={cn(CARD, 'px-[22px] py-[18px]')}>
                <h2 className="mb-3 text-[15px] font-bold">Quick actions</h2>
                <div className="flex flex-wrap gap-2">
                  {quickActions.map(a => (
                    <Link
                      key={a.label}
                      to={a.to}
                      className="flex h-[34px] items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-[11.5px] font-medium transition-colors hover:border-accent/50 hover:text-accent dark:border-slate-700 dark:bg-slate-900"
                    >
                      <a.icon size={13} strokeWidth={1.75} /> {a.label}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
