import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Clock, FileText,
  FlaskConical, Gauge, IndianRupee, MapPin, Package, Scale, Truck,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatQty, formatINR, formatINRCompact, formatTime, formatMinutes } from '@/lib/utils'
import { authStore } from '@/store/auth'
import AnimatedNumber from '@/components/shared/AnimatedNumber'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// ─── Owner/manager dashboard ─────────────────────────────────────────────
// Reading order is deliberate and answers three questions in sequence:
//   1. "How did we do today?"      -> hero row: revenue, volume, utilization
//   2. "Is anything wrong?"        -> Needs Attention strip (only when it is)
//   3. "Where is it heading?"      -> 14-day trend, then live ops + breakdowns
// Everything above the fold is a number an owner can act on. Detail tables
// (top customers, vehicle utilization) sit below, since they're reference,
// not decisions.

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

const CHART_TOOLTIP = {
  contentStyle: { fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 10px' },
  labelStyle: { color: '#6B7280', fontSize: 11, marginBottom: 2 },
}

/** Coloured up/down arrow + percentage, or a neutral dash when there's no
 *  comparable baseline (yesterday was zero). Direction is not always good
 *  news — `invert` flags metrics where down is better. */
function Delta({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return <span className="text-[11px] text-gray-300">no data yesterday</span>
  if (pct === 0) return <span className="text-[11px] text-gray-400">same as yesterday</span>
  const up = pct > 0
  const good = invert ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-medium ${good ? 'text-green-600' : 'text-red-600'}`}>
      <Icon size={11} strokeWidth={2.5} />
      {Math.abs(pct)}% <span className="font-normal text-gray-400">vs yesterday</span>
    </span>
  )
}

function HeroCard({
  label, value, prefix, suffix, delta, icon: Icon, tone = 'default', footer, onClick,
}: {
  label: string
  value: number | null | undefined
  prefix?: string
  suffix?: string
  delta?: React.ReactNode
  icon: React.ElementType
  tone?: 'default' | 'accent'
  footer?: React.ReactNode
  onClick?: () => void
}) {
  const accent = tone === 'accent'
  return (
    <Card
      padding="sm"
      onClick={onClick}
      className={`transition-shadow ${accent ? 'border-accent/30' : ''} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="section-label">{label}</p>
        <div className={`rounded-lg p-1.5 ${accent ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-gray-400'}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        {prefix && <span className="text-lg font-semibold text-gray-400">{prefix}</span>}
        <AnimatedNumber
          value={value ?? 0}
          format={n => (label === "Today's Revenue" ? formatINRCompact(n) : formatQty(n))}
          className="font-mono text-[26px] font-bold leading-none tracking-tight text-gray-900"
        />
        {suffix && <span className="text-sm font-medium text-gray-400">{suffix}</span>}
      </div>
      <div className="mt-2">{delta}</div>
      {footer}
    </Card>
  )
}

/** Horizontal capacity meter. Amber under 50% (plant is idling), red over
 *  100% (running past rated capacity — worth knowing, not celebrating). */
function UtilizationCard({ pct, capacity, actual }: { pct: number | null; capacity: number | null; actual: number }) {
  const navigate = useNavigate()
  const bar = pct == null ? 0 : Math.min(pct, 100)
  const tone = pct == null ? 'bg-gray-200'
    : pct > 100 ? 'bg-red-500' : pct < 50 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <Card
      padding="sm"
      onClick={() => navigate('/reports/capacity')}
      className="cursor-pointer transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="section-label">Plant Utilization</p>
        <div className="rounded-lg bg-gray-100 p-1.5 text-gray-400"><Gauge size={14} /></div>
      </div>
      {pct == null ? (
        <>
          <p className="font-mono text-[26px] font-bold leading-none text-gray-300">—</p>
          <p className="mt-2 text-[11px] text-accent hover:underline">Set plant capacity to track this →</p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <AnimatedNumber value={pct} format={n => `${n}`} className="font-mono text-[26px] font-bold leading-none tracking-tight text-gray-900" />
            <span className="text-sm font-medium text-gray-400">%</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${bar}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">
            {formatQty(actual)} of {capacity != null ? formatQty(capacity) : '—'} cum capacity
          </p>
        </>
      )}
    </Card>
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
    <Card padding="sm" className="border-amber-200 bg-amber-50/60">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
        <AlertTriangle size={14} /> Needs Attention
      </h3>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items.map(item => (
          <button
            key={item.label}
            onClick={() => navigate(item.to)}
            className="group flex items-start justify-between gap-2 rounded-lg border border-amber-200/70 bg-white px-3 py-2 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
          >
            <span className="min-w-0">
              <span className={`block text-xs font-medium ${item.severity === 'high' ? 'text-red-700' : 'text-gray-800'}`}>
                {item.label}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-gray-500">{item.detail}</span>
            </span>
            <ArrowRight size={13} className="mt-0.5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
          </button>
        ))}
      </div>
    </Card>
  )
}

function AgingBar({ label, buckets, total, tint }: { label: string; buckets: AgingBuckets; total: number; tint: string }) {
  const b30 = buckets['0-30'], b60 = buckets['31-60'], b60p = buckets['60+']
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-mono text-gray-500">₹{formatINR(total)}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
        {total > 0 && (
          <>
            <div className={`${tint} opacity-40`} style={{ width: `${pct(b30)}%` }} />
            <div className={`${tint} opacity-70`} style={{ width: `${pct(b60)}%` }} />
            <div className={tint} style={{ width: `${pct(b60p)}%` }} />
          </>
        )}
      </div>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-400">
        <span>0-30d ₹{formatINR(b30)}</span>
        <span>31-60d ₹{formatINR(b60)}</span>
        <span className={b60p > 0 ? 'font-medium text-red-600' : ''}>60d+ ₹{formatINR(b60p)}</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const user = authStore.getUser()
  const branchId = user?.branch?.id
  const navigate = useNavigate()
  const isAdmin = user?.role === 'ADMIN'

  const { data: dashData } = useQuery({
    queryKey: ['dashboard-challans', branchId],
    queryFn: () => api.get('/sales/challans/dashboard', { params: { branch_id: branchId } }).then(r => r.data.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  })

  const { data: summary } = useQuery({
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

  const trendChart = (summary?.trend ?? []).map(t => ({
    label: new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    qty: Number(t.qty.toFixed(1)),
    revenue: Math.round(t.revenue),
  }))
  const topCustomersChart = (summary?.topCustomers ?? []).map(c => ({
    name: c.name ?? 'Unknown', qty: Number(c.totalQty.toFixed(1)),
  }))
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-5">
      {/* Greeting anchors the numbers to a person and a date — this screen is
          checked daily, so "which day am I looking at" should never be a
          question. */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-xs text-gray-400">
            {user?.branch?.name ?? 'Branch'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button onClick={() => navigate('/quick-dispatch')} size="md">
          <Truck size={14} /> Quick Dispatch
        </Button>
      </div>

      {/* 1 — How did we do today? */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HeroCard
          label="Today's Revenue"
          value={summary?.today.totalRevenue}
          prefix="₹"
          icon={IndianRupee}
          tone="accent"
          delta={<Delta pct={summary?.change.revenuePct ?? null} />}
        />
        <HeroCard
          label="Concrete Dispatched"
          value={summary?.today.totalQty}
          suffix="cum"
          icon={Truck}
          delta={<Delta pct={summary?.change.qtyPct ?? null} />}
          footer={
            <p className="mt-1 text-[11px] text-gray-400">
              {summary?.today.totalTrips ?? 0} trip{(summary?.today.totalTrips ?? 0) === 1 ? '' : 's'}
              {summary?.today.wastagePct != null && ` · ${summary.today.wastagePct}% wastage`}
            </p>
          }
        />
        <UtilizationCard
          pct={summary?.today.utilizationPct ?? null}
          capacity={summary?.today.capacityCum ?? null}
          actual={summary?.today.totalQty ?? 0}
        />
        <HeroCard
          label="Outstanding"
          value={summary?.finance.outstanding}
          prefix="₹"
          icon={Scale}
          onClick={() => navigate('/reports/aging')}
          delta={
            summary && summary.finance.overdueCount > 0 ? (
              <span className="text-[11px] font-medium text-red-600">
                ₹{formatINR(summary.finance.overdueAmount)} overdue
              </span>
            ) : <span className="text-[11px] text-green-600">Nothing overdue</span>
          }
        />
      </div>

      {/* 2 — Is anything wrong? */}
      {summary && <NeedsAttention summary={summary} />}

      {/* 3 — Where is it heading? */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card padding="sm" className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Last 14 Days</h3>
            <span className="flex items-center gap-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" /> Revenue</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300" /> Volume</span>
            </span>
          </div>
          {trendChart.length === 0 ? (
            <p className="flex h-[220px] items-center justify-center text-xs text-gray-400">No dispatch history yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendChart} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E8630A" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#E8630A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => formatINRCompact(v)} />
                <YAxis yAxisId="qty" orientation="right" hide />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(v: number, name: string) =>
                    name === 'Revenue' ? [`₹${formatINR(v)}`, 'Revenue'] : [`${formatQty(v)} cum`, 'Volume']
                  }
                />
                <Area yAxisId="qty" type="monotone" dataKey="qty" name="Volume" stroke="#D1D5DB" strokeWidth={1.5} fill="none" dot={false} />
                <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue" stroke="#E8630A" strokeWidth={2} fill="url(#revFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Live ops — the one genuinely time-sensitive block on an owner's
            screen, so it stays above the reference tables. */}
        <Card padding="sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            <Truck size={14} className="text-gray-400" />
            Trucks in Transit
            {dashData?.inTransit?.length > 0 && (
              <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                {dashData.inTransit.length}
              </span>
            )}
          </h3>
          {!dashData?.inTransit?.length ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <MapPin size={20} className="text-gray-200" />
              <p className="text-xs text-gray-400">No trucks on the road right now</p>
            </div>
          ) : (
            <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
              {dashData.inTransit.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-medium text-gray-800">{c.vehicle_no ?? c.challan_no}</p>
                    <p className="truncate text-[11px] text-gray-400">{c.customer_name ?? '—'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {c.site_in ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-green-600"><MapPin size={10} /> At site</span>
                    ) : c.eta?.etaAt ? (
                      <>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-accent"><Clock size={10} /> {formatTime(c.eta.etaAt)}</span>
                        {c.eta.travelMinutes != null && (
                          <p className="text-[10px] text-gray-400">{formatMinutes(c.eta.travelMinutes)} to go</p>
                        )}
                      </>
                    ) : <span className="text-[11px] text-gray-300">—</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* AR/AP aging — admin only, same as before */}
      {isAdmin && aging && (aging.ar.total > 0 || aging.ap.total > 0) && (
        <Card padding="sm" onClick={() => navigate('/reports/aging')} className="cursor-pointer transition-shadow hover:shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              <Scale size={14} className="text-gray-400" /> AR/AP Aging
            </h3>
            <span className="text-[11px] text-accent hover:underline">View full report →</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AgingBar label="Receivable (AR)" buckets={aging.ar.buckets} total={aging.ar.total} tint="bg-amber-500" />
            <AgingBar label="Payable (AP)" buckets={aging.ap.buckets} total={aging.ap.total} tint="bg-sky-500" />
          </div>
        </Card>
      )}

      {/* 4 — Reference detail */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card padding="sm" className="xl:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Top Customers — Last 30 Days (cum)</h3>
          {topCustomersChart.length === 0 ? (
            <p className="flex h-[200px] items-center justify-center text-xs text-gray-400">No dispatches in the last 30 days</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topCustomersChart} barSize={24} margin={{ left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip {...CHART_TOOLTIP} formatter={(v: number) => [`${formatQty(v)} cum`, 'Volume']} cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="qty" fill="#E8630A" radius={[3, 3, 0, 0]} name="Cum" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card padding="sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            <FlaskConical size={14} className="text-gray-400" /> Quality — Last 30 Days
          </h3>
          {summary?.quality.passRate == null ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FlaskConical size={20} className="text-gray-200" />
              <p className="text-xs text-gray-400">No cube tests recorded</p>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-1">
                <span className={`font-mono text-[26px] font-bold leading-none ${summary.quality.passRate >= 95 ? 'text-green-600' : summary.quality.passRate >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
                  {summary.quality.passRate}
                </span>
                <span className="text-sm font-medium text-gray-400">% pass</span>
              </div>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="bg-green-500" style={{ width: `${summary.quality.passRate}%` }} />
                <div className="bg-red-400" style={{ width: `${100 - summary.quality.passRate}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                {summary.quality.passed} passed · {summary.quality.failed} failed
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Vehicle utilization */}
      <Card padding="sm">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <Package size={14} className="text-gray-400" /> Vehicle Utilization — Today
        </h3>
        {!summary?.vehicleUtilization.length ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Package size={22} className="text-gray-200" />
            <p className="text-xs text-gray-400">No trips dispatched today yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {summary.vehicleUtilization.map(v => (
              <div key={v.vehicleId ?? v.vehicleNo} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="font-mono text-xs font-medium text-gray-800">{v.vehicleNo ?? '—'}</p>
                <p className="text-[11px] text-gray-500">{v.trips} trips · {formatQty(v.totalQty)} cum</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent challans — reference tail, lowest priority */}
      <Card padding="sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            <FileText size={14} className="text-gray-400" /> Recent Challans
          </h3>
          <button onClick={() => navigate('/sales/challans')} className="text-[11px] text-accent hover:underline">
            View all →
          </button>
        </div>
        {!dashData?.challans?.length ? (
          <p className="py-6 text-center text-xs text-gray-400">No challans today</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {dashData.challans.slice(0, 6).map((c: any) => (
              <button
                key={c.id}
                onClick={() => navigate(`/sales/challans/${c.id}/edit`)}
                className="flex w-full items-center justify-between gap-2 py-2 text-left transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-medium text-gray-800">{c.challan_no}</p>
                  <p className="truncate text-[11px] text-gray-400">{c.customer_name ?? '—'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs font-medium text-gray-700">{formatQty(c.qty)} cum</p>
                  <p className="text-[11px] text-gray-400">{c.grade_name ?? '—'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
