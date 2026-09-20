import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Plus, Waves, X } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Field, inputClass } from '@/components/shared/form-controls'

interface BoardBooking {
  id: string
  pump_id: string
  job_site: string
  scheduled_start: string
  scheduled_end: string
  status: string
  challan_no: string | null
}
interface BoardPump {
  id: string
  pump_no: string
  pump_type: string
  ownership: string
  bookings: BoardBooking[]
}
interface BoardData {
  date: string
  pumps: BoardPump[]
}

const STATUS_TONE: Record<string, BadgeTone> = {
  SCHEDULED: 'info', EN_ROUTE: 'warning', PUMPING: 'purple', COMPLETED: 'success', CANCELLED: 'neutral',
}
const NEXT_STATUS: Record<string, { label: string; next: string }[]> = {
  SCHEDULED: [{ label: 'Mark En Route', next: 'EN_ROUTE' }, { label: 'Cancel', next: 'CANCELLED' }],
  EN_ROUTE: [{ label: 'Start Pumping', next: 'PUMPING' }, { label: 'Cancel', next: 'CANCELLED' }],
  PUMPING: [{ label: 'Complete', next: 'COMPLETED' }],
  COMPLETED: [],
  CANCELLED: [],
}

function today() { return new Date().toISOString().slice(0, 10) }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }

export default function PumpScheduleBoardPage() {
  const user = authStore.getUser()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [date, setDate] = useState(today())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ pump_id: '', job_site: '', scheduled_start: '', scheduled_end: '', remarks: '' })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pump-board', user?.branch?.id, date],
    queryFn: () => api.get('/production/pump-bookings/board', { params: { branch_id: user?.branch?.id, date } }).then(r => r.data.data as BoardData),
    enabled: !!user?.branch?.id,
  })

  const createBooking = useMutation({
    mutationFn: () => api.post('/production/pump-bookings', {
      branch_id: user?.branch?.id,
      pump_id: form.pump_id,
      job_site: form.job_site,
      scheduled_start: new Date(form.scheduled_start).toISOString(),
      scheduled_end: new Date(form.scheduled_end).toISOString(),
      remarks: form.remarks || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Pump booked', variant: 'success' })
      setShowForm(false)
      setForm({ pump_id: '', job_site: '', scheduled_start: '', scheduled_end: '', remarks: '' })
      qc.invalidateQueries({ queryKey: ['pump-board'] })
    },
    onError: (e: any) => toast({ title: 'Could not create booking', description: e?.response?.data?.message, variant: 'error' }),
  })

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; status: string }) => api.post(`/production/pump-bookings/${vars.id}/status`, { status: vars.status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pump-board'] }) },
    onError: (e: any) => toast({ title: 'Could not update booking', description: e?.response?.data?.message, variant: 'error' }),
  })

  return (
    <div>
      <PageHeader
        title="Pump Schedule"
        subtitle="Day view of every boom/line pump and its job-site bookings"
        actions={
          <button onClick={() => setShowForm(v => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:opacity-90">
            <Plus size={14} /> New Booking
          </button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <CalendarDays size={14} className="text-gray-400" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        <Link to="/masters/pumps" className="ml-auto text-[11px] text-gray-400 hover:text-accent">Manage pump fleet →</Link>
      </div>

      {showForm && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">New Pump Booking</p>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Pump" required>
              <select value={form.pump_id} onChange={e => setForm(f => ({ ...f, pump_id: e.target.value }))} className={inputClass(false)}>
                <option value="">Select pump...</option>
                {data?.pumps.map(p => <option key={p.id} value={p.id}>{p.pump_no} ({p.pump_type})</option>)}
              </select>
            </Field>
            <Field label="Job Site" required>
              <input value={form.job_site} onChange={e => setForm(f => ({ ...f, job_site: e.target.value }))} className={inputClass(false)} placeholder="Site name / address" />
            </Field>
            <Field label="Remarks">
              <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={inputClass(false)} />
            </Field>
            <Field label="Start" required>
              <input type="datetime-local" value={form.scheduled_start} onChange={e => setForm(f => ({ ...f, scheduled_start: e.target.value }))} className={inputClass(false)} />
            </Field>
            <Field label="End" required>
              <input type="datetime-local" value={form.scheduled_end} onChange={e => setForm(f => ({ ...f, scheduled_end: e.target.value }))} className={inputClass(false)} />
            </Field>
            <div className="flex items-end">
              <button
                disabled={!form.pump_id || !form.job_site || !form.scheduled_start || !form.scheduled_end || createBooking.isPending}
                onClick={() => createBooking.mutate()}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createBooking.isPending ? 'Booking...' : 'Book Pump'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Could not load the schedule board.</div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data && data.pumps.length > 0 ? (
        <div className="space-y-3">
          {data.pumps.map(pump => (
            <div key={pump.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
                <Waves size={13} className="text-gray-400" />
                <p className="text-xs font-medium text-gray-700">{pump.pump_no}</p>
                <span className="text-[10px] text-gray-400">{pump.pump_type} · {pump.ownership}</span>
                <span className="ml-auto text-[10px] text-gray-400">{pump.bookings.length} booking{pump.bookings.length === 1 ? '' : 's'}</span>
              </div>
              {pump.bookings.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-300">Free all day</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pump.bookings.map(b => (
                    <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-xs">
                      <span className="font-mono text-gray-500">{fmtTime(b.scheduled_start)}–{fmtTime(b.scheduled_end)}</span>
                      <span className="font-medium text-gray-800">{b.job_site}</span>
                      {b.challan_no && <span className="text-gray-400">· {b.challan_no}</span>}
                      <Badge tone={STATUS_TONE[b.status] ?? 'neutral'}>{b.status.replace('_', ' ')}</Badge>
                      <div className="ml-auto flex gap-1.5">
                        {(NEXT_STATUS[b.status] ?? []).map(action => (
                          <button
                            key={action.next}
                            onClick={() => setStatus.mutate({ id: b.id, status: action.next })}
                            disabled={setStatus.isPending}
                            className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-10 text-center">
          <Waves size={22} className="text-gray-300" />
          <p className="text-xs text-gray-400">No active pumps yet. Add one under Pump Fleet.</p>
        </div>
      )}
    </div>
  )
}
