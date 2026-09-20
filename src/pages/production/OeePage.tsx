import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gauge, Plus, Power, X } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import { Field, inputClass } from '@/components/shared/form-controls'

interface OeeData {
  from: string; to: string; days: number
  plannedMinutes: number; downtimeMinutes: number; runTimeMinutes: number
  actualOutputCum: number; idealOutputCum: number
  availability: number; performance: number; quality: number; oee: number
  qualityIsProxy: boolean; testsTotal: number; testsPassed: number
  downtimeByType: Record<string, number>
  hasCapacityData: boolean
}
interface DowntimeRow {
  id: string; equipment: string; downtime_type: string; start_time: string; end_time: string | null; reason: string | null
}

const EQUIPMENT = ['BATCHING_PLANT', 'WEIGHBRIDGE', 'CONVEYOR', 'MIXER', 'AGGREGATE_BIN', 'OTHER']
const DOWNTIME_TYPES = ['BREAKDOWN', 'PLANNED_MAINTENANCE', 'MATERIAL_SHORTAGE', 'POWER_OUTAGE', 'OTHER']

function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
function today() { return new Date().toISOString().slice(0, 10) }
function pct(n: number) { return `${(n * 100).toFixed(1)}%` }
function fmtMin(m: number) { const h = Math.floor(m / 60); const mm = Math.round(m % 60); return h > 0 ? `${h}h ${mm}m` : `${mm}m` }

function Gauge3({ label, value, sub }: { label: string; value: number; sub: string }) {
  const tone = value >= 0.85 ? 'text-green-700' : value >= 0.6 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="section-label mb-1">{label}</p>
      <p className={`font-mono text-2xl font-semibold ${tone}`}>{pct(value)}</p>
      <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>
    </div>
  )
}

export default function OeePage() {
  const user = authStore.getUser()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ equipment: 'BATCHING_PLANT', downtime_type: 'BREAKDOWN', reason: '' })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['oee', user?.branch?.id, from, to],
    queryFn: () => api.get('/production/oee', { params: { branch_id: user?.branch?.id, from, to } }).then(r => r.data.data as OeeData),
    enabled: !!user?.branch?.id,
  })
  const { data: downtime } = useQuery({
    queryKey: ['oee-downtime', user?.branch?.id],
    queryFn: () => api.get('/production/oee/downtime', { params: { branch_id: user?.branch?.id } }).then(r => r.data.data as DowntimeRow[]),
    enabled: !!user?.branch?.id,
  })

  const logDowntime = useMutation({
    mutationFn: () => api.post('/production/oee/downtime', { branch_id: user?.branch?.id, ...form }),
    onSuccess: () => {
      toast({ title: 'Downtime logged', variant: 'success' })
      setShowForm(false)
      setForm({ equipment: 'BATCHING_PLANT', downtime_type: 'BREAKDOWN', reason: '' })
      qc.invalidateQueries({ queryKey: ['oee-downtime'] })
      qc.invalidateQueries({ queryKey: ['oee'] })
    },
    onError: (e: any) => toast({ title: 'Could not log downtime', description: e?.response?.data?.message, variant: 'error' }),
  })
  const endDowntime = useMutation({
    mutationFn: (id: string) => api.post(`/production/oee/downtime/${id}/end`),
    onSuccess: () => {
      toast({ title: 'Downtime closed', variant: 'success' })
      qc.invalidateQueries({ queryKey: ['oee-downtime'] })
      qc.invalidateQueries({ queryKey: ['oee'] })
    },
  })

  const openDowntime = (downtime ?? []).filter(d => !d.end_time)

  return (
    <div>
      <PageHeader
        title="OEE & Downtime"
        subtitle="Overall Equipment Effectiveness — Availability × Performance × Quality — for the batching plant"
        actions={
          <button onClick={() => setShowForm(v => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:opacity-90">
            <Plus size={14} /> Log Downtime
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
      </div>

      {showForm && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">Log Equipment Downtime (starts now)</p>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Equipment">
              <select value={form.equipment} onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))} className={inputClass(false)}>
                {EQUIPMENT.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select value={form.downtime_type} onChange={e => setForm(f => ({ ...f, downtime_type: e.target.value }))} className={inputClass(false)}>
                {DOWNTIME_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Reason">
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inputClass(false)} />
            </Field>
          </div>
          <button
            disabled={logDowntime.isPending}
            onClick={() => logDowntime.mutate()}
            className="mt-3 flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Start Downtime
          </button>
        </div>
      )}

      {isError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Could not load OEE data.</div>}

      {isLoading ? <RmcLoader size="sm" /> : data ? (
        <>
          {!data.hasCapacityData && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Set this branch's rated capacity and operating hours to get an accurate Performance figure — currently showing 0% without it.
            </div>
          )}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-accent/30 bg-white p-4">
              <p className="section-label mb-1">Overall OEE</p>
              <p className="font-mono text-3xl font-semibold text-gray-900">{pct(data.oee)}</p>
              <p className="mt-0.5 text-[11px] text-gray-400">{data.days} day{data.days === 1 ? '' : 's'}</p>
            </div>
            <Gauge3 label="Availability" value={data.availability} sub={`${fmtMin(data.runTimeMinutes)} run of ${fmtMin(data.plannedMinutes)} planned`} />
            <Gauge3 label="Performance" value={data.performance} sub={`${data.actualOutputCum} of ${data.idealOutputCum.toFixed(0)} m³ ideal`} />
            <Gauge3 label="Quality" value={data.quality} sub={data.testsTotal > 0 ? `${data.testsPassed}/${data.testsTotal} cube tests passed (proxy)` : 'No cube tests in period — assumed 100%'} />
          </div>

          {Object.keys(data.downtimeByType).length > 0 && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-2">Downtime by Cause ({fmtMin(data.downtimeMinutes)} total)</p>
              <div className="space-y-1.5">
                {Object.entries(data.downtimeByType).sort((a, b) => b[1] - a[1]).map(([type, mins]) => (
                  <div key={type} className="flex items-center gap-2 text-xs">
                    <span className="w-40 shrink-0 text-gray-600">{type.replace('_', ' ')}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (mins / data.downtimeMinutes) * 100)}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-gray-500">{fmtMin(mins)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {openDowntime.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40">
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-medium text-amber-700">Currently down</div>
              <div className="divide-y divide-amber-100">
                {openDowntime.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                    <Power size={12} className="text-amber-600" />
                    <span className="font-medium text-gray-800">{d.equipment.replace('_', ' ')}</span>
                    <span className="text-gray-500">{d.downtime_type.replace('_', ' ')}</span>
                    {d.reason && <span className="text-gray-400">· {d.reason}</span>}
                    <span className="text-gray-400">since {new Date(d.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <button onClick={() => endDowntime.mutate(d.id)} className="ml-auto rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50">
                      Mark Resolved
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!downtime || downtime.length === 0) && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-10 text-center">
              <Gauge size={22} className="text-gray-300" />
              <p className="text-xs text-gray-400">No downtime logged yet.</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
