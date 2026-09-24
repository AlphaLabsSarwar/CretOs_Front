import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Clock, MapPin, Truck } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatQty, formatQtyShort, formatINR, formatINRCompact, formatTime, formatMinutes } from '@/lib/utils'
import { authStore } from '@/store/auth'
import AnimatedNumber from '@/components/shared/AnimatedNumber'

// ─── Owner/manager dashboard ─────────────────────────────────────────────
// Reading order is deliberate and answers three questions in sequence:
//   1. "How did we do today?"      -> the six-tile KPI row
//   2. "Is anything wrong?"        -> Needs Attention strip (only when it is)
//   3. "Where is it heading?"      -> weekly volume, customers, quality, money
// Live ops (trucks in transit, today's challans) sit below as reference.

interface TrendPoint { date: string; qty: number; revenue: number }
interface DashboardSummary {
  today: {
    totalQty: number; totalTrips: number; wastagePct: number | null
    totalRevenue: number; utilizationPct: number | null; capacityCum: number | null
  }
  yesterday: { totalQty: number; totalTrips: number; totalRevenue: number }
  change: { qtyPct: number | null; tripsPct: number | null; revenuePct: number | null }
  trend: TrendPoint[]
  actionItems: { draftChallans: number; unbilledChallans: number }
  topCustomers: { customerId: string | null; name: string | null; totalQty: number; totalRevenue: number }[]
  vehicleUtilization: { vehicleId: string | null; vehicleNo: string | null; trips: number; totalQty: number }[]
  lowStock: { material: string; qty_on_hand: number; reorder_level: number }[]
  finance: { outstanding: number; overdueCount: number; overdueAmount: number }
  quality: { passRate: number | null; passed: number; failed: number }
}

interface AgingBuckets { '0-30': number; '31-60': number; '60+': number }
interface AgingSummary { ar: { buckets: AgingBuckets; total: number }; ap: { buckets: AgingBuckets; total: number } }

/** "▲ 12% vs yesterday", or a neutral line when there's no comparable baseline. */
function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-slate-400">no data yesterday</span>
  if (pct === 0) return <span className="text-slate-400">same as yesterday</span>
  return (
    <span className={pct > 0 ? 'text-green-600' : 'text-red-600'}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct)}% vs yesterday
    </span>
  )
}

function Kpi({ label, children, sub, onClick }: { label: string; children: React.ReactNode; sub: React.ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={cn('kpi-tile text-left', onClick && 'cursor-pointer')}>
      <p className="kpi-label">{label}</p>
      <div className="kpi-value">{children}</div>
      <p className="mt-0.5 text-[10.5px]">{sub}</p>
    </Tag>
  )
}

function Panel({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('panel p-[18px]', className)}>
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <h2 className="panel-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="reveal flex h-[120px] items-center justify-center text-xs text-slate-400">{children}</p>
)

/** Panel placeholder while the summary loads: the table skeleton's shimmer,
 *  easing in after the same grace delay as the loaders. */
function PanelLoading() {
  return (
    <div role="status" aria-label="Loading" className="loader-enter flex h-[120px] flex-col justify-center gap-3">
      {[92, 74, 84, 58].map(w => (
        <div
          key={w}
          className="h-3 animate-pour-sweep rounded"
          style={{ width: `${w}%`, backgroundImage: 'linear-gradient(90deg, #E5E7EB 25%, #FDF0E8 50%, #E5E7EB 75%)', backgroundSize: '200% 100%' }}
        />
      ))}
    </div>
  )
}

/** Single consolidated exception strip. Deliberately renders nothing at all
 *  when there's nothing wrong — a permanently-present "0 issues" panel trains
 *  people to stop looking at it. */
function NeedsAttention({ summary }: { summary: DashboardSummary }) {
  const navigate = useNavigate()
  const items: { label: string; detail: string; to: string; severity: 'high' | 'medium' }[] = []

  if (summary.finance.overdueCount > 0) {
    items.push({
      label: `${summary.finance.overdueCount} overdue invoice${summary.finance.overdueCount > 1 ? 's' : ''}`,
      detail: `₹${formatINR(summary.finance.overdueAmount)} unpaid past 30 days`,
      to: '/reports/aging', severity: 'high',
    })
  }
  if (summary.lowStock.length > 0) {
    items.push({
      label: `${summary.lowStock.length} material${summary.lowStock.length > 1 ? 's' : ''} below reorder level`,
      detail: summary.lowStock.map(l => l.material).join(', '),
      to: '/stores/stock', severity: 'high',
    })
  }
  if (summary.actionItems.unbilledChallans > 0) {
    items.push({
      label: `${summary.actionItems.unbilledChallans} delivered challan${summary.actionItems.unbilledChallans > 1 ? 's' : ''} not billed`,
      detail: 'Revenue delivered but not yet invoiced',
      to: '/finance/invoices/new', severity: 'medium',
    })
  }
  if (summary.actionItems.draftChallans > 0) {
    items.push({
      label: `${summary.actionItems.draftChallans} draft challan${summary.actionItems.draftChallans > 1 ? 's' : ''}`,
      detail: 'Created but never dispatched',
      to: '/sales/challans?status=DRAFT', severity: 'medium',
    })
  }
  if (summary.quality.failed > 0) {
    items.push({
      label: `${summary.quality.failed} failed cube test${summary.quality.failed > 1 ? 's' : ''}`,
      detail: 'In the last 30 days',
      to: '/quality/tests', severity: 'high',
    })
  }

  if (items.length === 0) return null

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-amber-900">
        <AlertTriangle size={14} /> Needs attention
      </h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items.map(item => (
          <button
            key={item.label}
            onClick={() => navigate(item.to)}
            className="group flex items-start justify-between gap-2 rounded-lg border border-amber-200/70 bg-white px-3 py-2 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
          >
            <span className="min-w-0">
              <span className={cn('block text-xs font-medium', item.severity === 'high' ? 'text-red-700' : 'text-slate-800')}>{item.label}</span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-500">{item.detail}</span>
            </span>
            <ArrowRight size={13} className="mt-0.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
          </button>
        ))}
      </div>
    </section>
  )
}

/** Last seven days of dispatched volume as columns; today in solid accent. */
function WeeklyVolume({ trend }: { trend: TrendPoint[] }) {
  const week = trend.slice(-7)
  if (!week.length) return <Empty>No dispatch history yet</Empty>
  const max = Math.max(...week.map(d => d.qty), 1)
  const todayKey = new Date().toDateString()
  return (
    <div className="reveal flex h-[140px] items-end gap-3">
      {week.map(d => {
        const date = new Date(d.date)
        const isToday = date.toDateString() === todayKey
        return (
          <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${formatQty(d.qty)} cum · ₹${formatINR(d.revenue)}`}>
            <span className="font-mono text-[9.5px] text-slate-400">{formatQtyShort(d.qty)}</span>
            <span
              className={cn('w-full rounded-t-[5px] transition-[height] duration-500', isToday ? 'bg-accent' : 'bg-accent-light')}
              style={{ height: `${Math.max((d.qty / max) * 100, 3)}px` }}
            />
            <span className={cn('text-[10px]', isToday ? 'font-semibold text-slate-900' : 'text-slate-400')}>
              {date.toLocaleDateString('en-IN', { weekday: 'short' })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const BAR_TINTS = [
  ['bg-blue-50', 'bg-blue-200'], ['bg-blue-50', 'bg-blue-300'], ['bg-accent-light', 'bg-[#F3AA79]'],
  ['bg-accent-light', 'bg-accent'], ['bg-green-50', 'bg-green-600'],
] as const

/** Top customers as the design's horizontal "pipeline" bars. */
function TopCustomers({ rows }: { rows: DashboardSummary['topCustomers'] }) {
  if (!rows.length) return <Empty>No dispatches in the last 30 days</Empty>
  const max = Math.max(...rows.map(r => r.totalQty), 1)
  return (
    <div className="reveal flex flex-col gap-[9px]">
      {rows.slice(0, 5).map((r, i) => {
        const [track, fill] = BAR_TINTS[i % BAR_TINTS.length]
        return (
          <div key={r.customerId ?? r.name ?? i} className="flex items-center gap-2.5" title={`₹${formatINR(r.totalRevenue)}`}>
            <span className="w-28 shrink-0 truncate text-[11px] text-slate-500">{r.name ?? 'Unknown'}</span>
            <span className={cn('h-4 flex-1 rounded', track)}>
              <span className={cn('block h-full rounded transition-[width] duration-500', fill)} style={{ width: `${(r.totalQty / max) * 100}%` }} />
            </span>
            <span className="w-12 shrink-0 text-right font-mono text-[11px]">{formatQtyShort(r.totalQty)}</span>
          </div>
        )
      })}
    </div>
  )
}

function QualityDonut({ quality }: { quality: DashboardSummary['quality'] }) {
  if (quality.passRate == null) return <Empty>No cube tests recorded</Empty>
  const total = quality.passed + quality.failed
  return (
    <div className="reveal flex items-center gap-[22px]">
      <div
        className="relative h-[120px] w-[120px] shrink-0 rounded-full"
        style={{ background: `conic-gradient(#16A34A 0% ${quality.passRate}%, #DC2626 ${quality.passRate}% 100%)` }}
      >
        <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white">
          <span className="font-mono text-[15px] font-bold">{quality.passRate}%</span>
          <span className="text-[9px] text-slate-400">pass rate</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-green-600" />Passed · <span className="font-mono text-slate-400">{quality.passed}</span></span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-600" />Failed · <span className="font-mono text-slate-400">{quality.failed}</span></span>
        <span className="mt-1 text-slate-400">{total} cube test{total === 1 ? '' : 's'} in the last 30 days</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const user = authStore.getUser()
  const branchId = user?.branch?.id
  const navigate = useNavigate()
  const isAdmin = user?.role === 'ADMIN'

  const { data: dashData, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard-challans', branchId],
    queryFn: () => api.get('/sales/challans/dashboard', { params: { branch_id: branchId } }).then(r => r.data.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  })

  const { data: summary, isError: summaryFailed } = useQuery({
    queryKey: ['dashboard-summary', branchId],
    queryFn: () => api.get('/dashboard/summary', { params: { branch_id: branchId } }).then(r => r.data.data as DashboardSummary),
    enabled: !!branchId,
    refetchInterval: 60_000,
  })

  const { data: aging } = useQuery({
    queryKey: ['dashboard-aging-summary', branchId],
    queryFn: () => api.get('/reports/aging-summary', { params: { branch_id: branchId } }).then(r => r.data.data as AgingSummary),
    enabled: !!branchId && isAdmin,
    refetchInterval: 60_000,
  })

  const inTransit: any[] = dashData?.inTransit ?? []
  const util = summary?.today.utilizationPct ?? null
  const updated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-xs text-slate-400">
            Business overview · {user?.branch?.name ?? 'Branch'}{updated && ` · updated ${updated}`}
          </p>
        </div>
        <button
          onClick={() => navigate('/quick-dispatch')}
          className="flex h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <Truck size={14} /> Quick Dispatch
        </button>
      </div>

      {/* 1 — How did we do today? */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Revenue today" sub={<Delta pct={summary?.change.revenuePct} />}>
          ₹<AnimatedNumber value={summary?.today.totalRevenue ?? 0} format={formatINRCompact} />
        </Kpi>
        <Kpi label="Production volume" sub={<span className="text-slate-400">{summary?.today.totalTrips ?? 0} trips today{summary?.today.wastagePct != null && ` · ${summary.today.wastagePct}% wastage`}</span>}>
          <AnimatedNumber value={summary?.today.totalQty ?? 0} format={formatQtyShort} /> m³
        </Kpi>
        <Kpi
          label="Plant utilisation"
          onClick={() => navigate('/reports/capacity')}
          sub={<span className="text-slate-400">{util == null ? 'Set capacity to track' : `of ${summary?.today.capacityCum != null ? formatQtyShort(summary.today.capacityCum) : '—'} m³ capacity`}</span>}
        >
          <span className={cn(util == null ? 'text-slate-300' : util > 100 ? 'text-red-600' : util < 50 ? 'text-amber-600' : 'text-green-600')}>
            {util == null ? '—' : `${util}%`}
          </span>
        </Kpi>
        <Kpi
          label="Quality pass rate"
          onClick={() => navigate('/quality/tests')}
          sub={<span className="text-slate-400">{summary ? `${summary.quality.passed + summary.quality.failed} tests · 30 days` : '—'}</span>}
        >
          <span className={cn(summary?.quality.passRate == null ? 'text-slate-300' : summary.quality.passRate >= 95 ? 'text-green-600' : summary.quality.passRate >= 85 ? 'text-amber-600' : 'text-red-600')}>
            {summary?.quality.passRate == null ? '—' : `${summary.quality.passRate}%`}
          </span>
        </Kpi>
        <Kpi
          label="Outstanding receivables"
          onClick={() => navigate('/reports/aging')}
          sub={summary && summary.finance.overdueCount > 0
            ? <span className="text-red-600">₹{formatINRCompact(summary.finance.overdueAmount)} overdue</span>
            : <span className="text-green-600">Nothing overdue</span>}
        >
          <span className="text-amber-700">₹<AnimatedNumber value={summary?.finance.outstanding ?? 0} format={formatINRCompact} /></span>
        </Kpi>
        <Kpi label="Fleet status" onClick={() => navigate('/tracking')} sub={<span className="text-slate-400">{summary?.vehicleUtilization.length ?? 0} trucks used today</span>}>
          {inTransit.length}<span className="text-[13px] text-slate-400"> on road</span>
        </Kpi>
      </div>

      {/* 2 — Is anything wrong? */}
      {summary && <NeedsAttention summary={summary} />}

      {/* 3 — Where is it heading? */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Panel title="Weekly dispatch volume (m³)">
          {summary ? <WeeklyVolume trend={summary.trend} /> : summaryFailed ? <Empty>Couldn’t load this — retrying</Empty> : <PanelLoading />}
        </Panel>

        <Panel title="Top customers · 30 days (m³)">
          {summary ? <TopCustomers rows={summary.topCustomers} /> : summaryFailed ? <Empty>Couldn’t load this — retrying</Empty> : <PanelLoading />}
        </Panel>

        <Panel title="Quality · last 30 days">
          {summary ? <QualityDonut quality={summary.quality} /> : summaryFailed ? <Empty>Couldn’t load this — retrying</Empty> : <PanelLoading />}
        </Panel>

        {isAdmin && aging ? (
          <Panel title="Payments" action={<button onClick={() => navigate('/reports/aging')} className="text-[11px] font-medium text-accent hover:underline">Aging report →</button>}>
            <div className="reveal flex flex-col gap-2.5">
              {([
                ['Receivable 0–30 days', aging.ar.buckets['0-30'], 'text-slate-700'],
                ['Receivable 31–60 days', aging.ar.buckets['31-60'], 'text-amber-700'],
                ['Receivable 60+ days', aging.ar.buckets['60+'], 'text-red-700'],
                ['Payable (all)', aging.ap.total, 'text-slate-700'],
              ] as const).map(([label, amount, tone]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs">{label}</span>
                  <span className={cn('font-mono text-xs font-semibold', tone)}>₹{formatINRCompact(amount)}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Low stock">
            {!summary ? (summaryFailed ? <Empty>Couldn’t load this — retrying</Empty> : <PanelLoading />) : !summary.lowStock.length ? <Empty>All materials above reorder level</Empty> : (
              <div className="reveal flex flex-col gap-2.5">
                {summary.lowStock.map(l => (
                  <div key={l.material} className="flex items-center justify-between">
                    <span className="text-xs">{l.material}</span>
                    <span className="font-mono text-xs font-semibold text-red-700">{formatQtyShort(l.qty_on_hand)} / {formatQtyShort(l.reorder_level)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* Live ops */}
        <Panel
          title="Trucks in transit"
          action={inTransit.length > 0 && <span className="tint-pill bg-accent-light text-accent">{inTransit.length}</span>}
        >
          {!inTransit.length ? (
            <div className="flex h-[120px] flex-col items-center justify-center gap-2 text-center">
              <MapPin size={20} className="text-slate-200" />
              <p className="text-xs text-slate-400">No trucks on the road right now</p>
            </div>
          ) : (
            <div className="reveal max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
              {inTransit.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-page px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-medium">{c.vehicle_no ?? c.challan_no}</p>
                    <p className="truncate text-[11px] text-slate-400">{c.customer_name ?? '—'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {c.site_in ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-green-600"><MapPin size={10} /> At site</span>
                    ) : c.eta?.etaAt ? (
                      <>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-accent"><Clock size={10} /> {formatTime(c.eta.etaAt)}</span>
                        {c.eta.travelMinutes != null && <p className="text-[10px] text-slate-400">{formatMinutes(c.eta.travelMinutes)} to go</p>}
                      </>
                    ) : <span className="text-[11px] text-slate-300">—</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent challans" action={<button onClick={() => navigate('/sales/challans')} className="text-[11px] font-medium text-accent hover:underline">View all →</button>}>
          {!dashData?.challans?.length ? <Empty>No challans today</Empty> : (
            <div className="reveal divide-y divide-gray-100">
              {dashData.challans.slice(0, 6).map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/sales/challans/${c.id}/edit`)}
                  className="flex w-full items-center justify-between gap-2 py-2 text-left transition-colors hover:bg-page"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-medium">{c.challan_no}</p>
                    <p className="truncate text-[11px] text-slate-400">{c.customer_name ?? '—'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs font-medium text-slate-700">{formatQtyShort(Number(c.qty))} m³</p>
                    <p className="text-[11px] text-slate-400">{c.grade_name ?? '—'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Vehicle utilization */}
      {!!summary?.vehicleUtilization.length && (
        <Panel title="Vehicle utilisation · today">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {summary.vehicleUtilization.map(v => (
              <div key={v.vehicleId ?? v.vehicleNo} className="rounded-lg border border-gray-100 bg-page px-3 py-2">
                <p className="font-mono text-xs font-medium">{v.vehicleNo ?? '—'}</p>
                <p className="text-[11px] text-slate-500">{v.trips} trips · {formatQtyShort(v.totalQty)} m³</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
