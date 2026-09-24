import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { cn, formatQtyShort, formatTime } from '@/lib/utils'

// Production overview — the design's "Batching schedule" screen: today's
// output KPIs, the batch running right now (dark card), plant OEE, today's
// batch sequence and downtime. Built from the same endpoints as the Batching,
// Batch detail and OEE screens; each block links through to its full screen.

interface BatchRow {
  id: string
  batch_no: string
  grade_name: string | null
  batch_qty_cum: number | string
  status: string
  challan_no: string | null
  job_site: string | null
  customer_name: string | null
  created_at: string
}
interface BatchDetail extends BatchRow {
  mixer_no: string | null
  materials: { material_key: string; label: string; uom: string; target_qty: string | number; actual_qty: string | number | null }[]
}
interface OeeData {
  plannedMinutes: number; downtimeMinutes: number
  actualOutputCum: number; idealOutputCum: number
  availability: number; performance: number; quality: number; oee: number
  hasCapacityData: boolean
}
interface DowntimeRow { id: string; equipment: string; downtime_type: string; start_time: string; end_time: string | null; reason: string | null }

const STATUS_PILL: Record<string, string> = {
  COMPLETED: 'bg-green-50 text-green-800',
  BATCHING: 'bg-white text-accent-hover',
  REQUESTED: 'bg-slate-100 text-slate-400',
  ABORTED: 'bg-red-50 text-red-700',
}
const STATUS_LABEL: Record<string, string> = { COMPLETED: 'Completed', BATCHING: 'Batching', REQUESTED: 'Scheduled', ABORTED: 'Aborted' }

const today = () => new Date().toISOString().slice(0, 10)
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
const humanize = (s: string) => s.toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
const minutesBetween = (a: string, b: string | null) => Math.max(0, Math.round(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 60000))

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="kpi-tile p-[13px]">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className={cn('mt-1 font-mono text-lg font-bold', tone)}>{value}</p>
    </div>
  )
}

/** The batch on the mixer right now, with its material weigh-up. */
function BatchingNow({ batch }: { batch: BatchRow }) {
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['production-batch', batch.id],
    queryFn: () => api.get(`/production/batches/${batch.id}`).then(r => r.data.data as BatchDetail),
    refetchInterval: 15_000,
  })
  const materials = data?.materials ?? []
  const target = materials.reduce((s, m) => s + Number(m.target_qty), 0)
  const actual = materials.reduce((s, m) => s + Number(m.actual_qty ?? 0), 0)
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0

  return (
    <button onClick={() => navigate(`/production/batches/${batch.id}`)} className="relative overflow-hidden rounded-xl bg-sidebar-bg p-5 text-left text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/[0.14] px-[9px] py-[3px] text-[10px] font-semibold text-green-400">
            <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-green-500" />Batching now
          </span>
          <p className="mt-2.5 font-mono text-[22px] font-bold">Batch {batch.batch_no}{batch.grade_name && ` · ${batch.grade_name}`}</p>
          <p className="mt-1 text-xs text-sidebar-text">
            {[data?.mixer_no && `Mixer ${data.mixer_no}`, batch.customer_name, `Started ${formatTime(batch.created_at)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[26px] font-bold">{formatQtyShort(Number(batch.batch_qty_cum))}<span className="text-sm text-sidebar-text"> m³</span></p>
          <p className="mt-0.5 text-[10px] text-sidebar-text">{materials.length ? `${pct}% weighed` : 'target this batch'}</p>
        </div>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-sidebar-item">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {materials.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {materials.slice(0, 4).map(m => (
            <div key={m.material_key}>
              <p className="text-[10px] text-sidebar-text">{m.label}</p>
              <p className="mt-0.5 font-mono text-[13px]">
                {Number(m.actual_qty ?? 0).toLocaleString('en-IN')} / {Number(m.target_qty).toLocaleString('en-IN')} {m.uom}
              </p>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}

export default function ProductionOverviewPage() {
  const navigate = useNavigate()
  const user = authStore.getUser()
  const branchId = user?.branch?.id

  const { data: batches, isLoading } = useQuery({
    queryKey: ['production-overview-batches', branchId],
    queryFn: () => api.get('/production/batches', { params: { page: 1, limit: 25, branch_id: branchId } })
      .then(r => r.data.data as { data: BatchRow[]; total: number }),
    enabled: !!branchId,
    refetchInterval: 15_000,
  })
  const { data: oee } = useQuery({
    queryKey: ['production-overview-oee', branchId, today()],
    queryFn: () => api.get('/production/oee', { params: { branch_id: branchId, from: today(), to: today() } }).then(r => r.data.data as OeeData),
    enabled: !!branchId,
    refetchInterval: 60_000,
  })
  const { data: downtime } = useQuery({
    queryKey: ['production-overview-downtime', branchId],
    queryFn: () => api.get('/production/oee/downtime', { params: { branch_id: branchId } }).then(r => r.data.data as DowntimeRow[]),
    enabled: !!branchId,
  })

  const todays = (batches?.data ?? []).filter(b => isToday(b.created_at))
  const running = todays.find(b => b.status === 'BATCHING') ?? (batches?.data ?? []).find(b => b.status === 'BATCHING')
  const completed = todays.filter(b => b.status === 'COMPLETED').length
  const downtimeToday = (downtime ?? []).filter(d => isToday(d.start_time))
  const oeePct = oee ? Math.round(oee.oee * 100) : null

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Production</h1>
          <p className="mt-[3px] text-xs text-slate-400">Batching schedule · {user?.branch?.name ?? 'Plant'}</p>
        </div>
        <button
          onClick={() => navigate('/production/batches/new')}
          className="flex h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <Plus size={14} /> Start Batch
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Capacity today" value={oee?.hasCapacityData ? `${formatQtyShort(oee.idealOutputCum)} m³` : '—'} />
        <Kpi label="Actual output" value={oee ? `${formatQtyShort(oee.actualOutputCum)} m³` : '—'} tone="text-green-600" />
        <Kpi label="Batches completed" value={`${completed} / ${todays.length}`} />
        <Kpi label="Downtime today" value={oee ? `${Math.round(oee.downtimeMinutes)} min` : '—'} tone="text-amber-700" />
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        {running ? <BatchingNow batch={running} /> : (
          <div className="flex flex-col justify-center rounded-xl bg-sidebar-bg p-5 text-white">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/[0.08] px-[9px] py-[3px] text-[10px] font-semibold text-sidebar-text">Mixer idle</span>
            <p className="mt-2.5 text-lg font-bold">No batch is running right now</p>
            <p className="mt-1 text-xs text-sidebar-text">The next requested batch appears here as soon as the plant starts it.</p>
          </div>
        )}

        <button onClick={() => navigate('/production/oee')} className="panel flex flex-col items-center justify-center p-[18px] text-center">
          <div
            className="relative h-[130px] w-[130px] rounded-full"
            style={{ background: `conic-gradient(#E8630A 0% ${oeePct ?? 0}%, #E5E7EB ${oeePct ?? 0}% 100%)` }}
          >
            <div className="absolute inset-3.5 flex flex-col items-center justify-center rounded-full bg-white">
              <span className="font-mono text-2xl font-bold">{oeePct != null ? `${oeePct}%` : '—'}</span>
              <span className="text-[9px] text-slate-400">OEE today</span>
            </div>
          </div>
          <p className="mt-3.5 text-[11px] text-slate-400">
            {oee ? `Availability ${Math.round(oee.availability * 100)}% · Performance ${Math.round(oee.performance * 100)}%` : 'No OEE data yet'}
          </p>
        </button>
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="panel-title">Batch sequence · today</h2>
            <button onClick={() => navigate('/production/batches')} className="text-[11px] font-medium text-accent hover:underline">All batches →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] text-slate-400">
                  <th className="px-4 py-[7px] font-semibold">Time</th>
                  <th className="px-2.5 py-[7px] font-semibold">Batch</th>
                  <th className="px-2.5 py-[7px] font-semibold">Grade</th>
                  <th className="px-2.5 py-[7px] font-semibold">Qty</th>
                  <th className="px-2.5 py-[7px] font-semibold">Customer / Site</th>
                  <th className="px-4 py-[7px] font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Loading…</td></tr>}
                {!isLoading && todays.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">No batches today yet</td></tr>}
                {todays.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/production/batches/${b.id}`)}
                    className={cn('cursor-pointer border-t border-gray-200 transition-colors', b.status === 'BATCHING' ? 'bg-accent-light' : 'hover:bg-slate-50')}
                  >
                    <td className="px-4 py-[7px] font-mono text-slate-600">{formatTime(b.created_at)}</td>
                    <td className={cn('px-2.5 py-[7px] font-mono', b.status === 'BATCHING' && 'font-bold')}>{b.batch_no}</td>
                    <td className="px-2.5 py-[7px] font-mono">{b.grade_name ?? '—'}</td>
                    <td className="px-2.5 py-[7px] font-mono">{formatQtyShort(Number(b.batch_qty_cum))} m³</td>
                    <td className="max-w-[200px] truncate px-2.5 py-[7px] text-slate-600">{b.customer_name ?? b.job_site ?? '—'}</td>
                    <td className="px-4 py-[7px]">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_PILL[b.status] ?? 'bg-slate-100 text-slate-500')}>{STATUS_LABEL[b.status] ?? b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="panel-title">Downtime today</h2>
            <button onClick={() => navigate('/production/oee')} className="text-[11px] font-medium text-accent hover:underline">Log →</button>
          </div>
          {downtimeToday.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No downtime logged today</p>
          ) : downtimeToday.map((d, i) => (
            <div key={d.id} className={cn('flex items-center justify-between gap-2 py-2', i < downtimeToday.length - 1 && 'border-b border-gray-200')}>
              <span className="min-w-0 truncate text-[11.5px]">{d.reason || humanize(d.downtime_type)} <span className="text-slate-400">· {humanize(d.equipment)}</span></span>
              <span className="shrink-0 font-mono text-[11.5px] text-slate-400">{d.end_time ? `${minutesBetween(d.start_time, d.end_time)} min` : 'ongoing'}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
