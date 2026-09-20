import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, MessageCircle, Play, Plus, Trash2, Eye } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatDateTime } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'

interface Schedule {
  id: string
  report_type: 'DISPATCH_DIGEST' | 'VENDOR_ITEM'
  time_of_day: string
  recipient_mobile: string | null
  channels: string[]
  is_active: boolean
  last_run_date: string | null
}
interface LogRow {
  id: string
  report_type: string
  content: string
  channels_sent: string[] | null
  status: string
  error: string | null
  created_at: string
}

const REPORT_LABELS: Record<string, string> = {
  DISPATCH_DIGEST: 'Dispatch Digest',
  VENDOR_ITEM: 'Vendor Wise / Item Wise',
}

function NewScheduleForm({ branchId, onDone }: { branchId?: string; onDone: () => void }) {
  const [reportType, setReportType] = useState<'DISPATCH_DIGEST' | 'VENDOR_ITEM'>('DISPATCH_DIGEST')
  const [time, setTime] = useState('10:00')
  const [whatsapp, setWhatsapp] = useState(false)
  const [mobile, setMobile] = useState('')

  const create = useMutation({
    mutationFn: () => api.post('/admin/report-schedules', {
      branch_id: branchId,
      report_type: reportType,
      time_of_day: time,
      channels: whatsapp ? ['IN_APP', 'WHATSAPP'] : ['IN_APP'],
      recipient_mobile: whatsapp ? mobile : null,
    }),
    onSuccess: onDone,
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-3 text-sm font-medium text-gray-800">Add a schedule</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Report</label>
          <select value={reportType} onChange={e => setReportType(e.target.value as any)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="DISPATCH_DIGEST">Dispatch Digest</option>
            <option value="VENDOR_ITEM">Vendor Wise / Item Wise</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Time</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={whatsapp} onChange={e => setWhatsapp(e.target.checked)} />
          Also send on WhatsApp
        </label>
        {whatsapp && (
          <div>
            <label className="mb-1 block text-xs text-gray-500">WhatsApp number</label>
            <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="9198xxxxxxx" className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
        )}
        <button
          disabled={create.isPending || (whatsapp && !mobile)}
          onClick={() => create.mutate()}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          <Plus size={13} /> Add
        </button>
      </div>
      {create.isError && <p className="mt-2 text-xs text-red-600">{(create.error as any)?.response?.data?.message ?? 'Could not create schedule'}</p>}
    </div>
  )
}

function SchedulesTab({ branchId }: { branchId?: string }) {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [preview, setPreview] = useState<{ type: string; content: string } | null>(null)

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['report-schedules', branchId],
    queryFn: () => api.get('/admin/report-schedules', { params: { branch_id: branchId } }).then(r => r.data.data as Schedule[]),
    enabled: !!branchId,
  })

  const toggle = useMutation({
    mutationFn: (s: Schedule) => api.put(`/admin/report-schedules/${s.id}`, { is_active: !s.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-schedules'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/report-schedules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-schedules'] }),
  })
  const runNow = useMutation({
    mutationFn: (id: string) => api.post(`/admin/report-schedules/${id}/run-now`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-log'] }),
  })

  async function showPreview(type: string) {
    const r = await api.get('/admin/report-schedules/preview', { params: { report_type: type, branch_id: branchId } })
    setPreview({ type, content: r.data.data.content })
  }

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        Set how many times a day, and at what times, each report should generate — reports appear in the History tab, and also send over WhatsApp if configured below.
      </p>

      <div className="mb-4 flex gap-2">
        <button onClick={() => showPreview('DISPATCH_DIGEST')} className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
          <Eye size={13} /> Preview Dispatch Digest
        </button>
        <button onClick={() => showPreview('VENDOR_ITEM')} className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
          <Eye size={13} /> Preview Vendor/Item
        </button>
      </div>

      {preview && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-medium text-gray-600">{REPORT_LABELS[preview.type]} — as of right now</p>
          <pre className="whitespace-pre-wrap font-mono text-xs text-gray-800">{preview.content}</pre>
        </div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : (
        <div className="mb-4 space-y-2">
          {(schedules ?? []).length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">No schedules yet — add one below.</div>
          )}
          {(schedules ?? []).map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <Clock size={14} className="text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{REPORT_LABELS[s.report_type]} · {s.time_of_day}</p>
                  <p className="text-xs text-gray-500">
                    {s.channels.includes('WHATSAPP') ? `WhatsApp → ${s.recipient_mobile}` : 'In-app only'}
                    {s.last_run_date && ` · last ran ${s.last_run_date}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => runNow.mutate(s.id)} disabled={runNow.isPending} title="Run now" aria-label="Run now" className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50">
                  <Play size={12} />
                </button>
                <button onClick={() => toggle.mutate(s)} className={`status-badge border ${s.is_active ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-100 text-gray-500'}`}>
                  {s.is_active ? 'Active' : 'Paused'}
                </button>
                <button onClick={() => remove.mutate(s.id)} title="Delete" aria-label="Delete" className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew ? (
        <NewScheduleForm branchId={branchId} onDone={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ['report-schedules'] }) }} />
      ) : (
        <button onClick={() => setShowNew(true)} className="flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50">
          <Plus size={13} /> Add a schedule
        </button>
      )}
    </div>
  )
}

function HistoryTab({ branchId }: { branchId?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['report-log', branchId],
    queryFn: () => api.get('/admin/report-schedules/log', { params: { branch_id: branchId } }).then(r => r.data.data as LogRow[]),
    enabled: !!branchId,
  })

  if (isLoading) return <RmcLoader size="sm" />
  if (!data || data.length === 0) return <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">No reports generated yet.</div>

  return (
    <div className="space-y-2">
      {data.map(row => (
        <div key={row.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <button onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="flex w-full items-center justify-between text-left">
            <div>
              <p className="text-sm font-medium text-gray-800">{REPORT_LABELS[row.report_type] ?? row.report_type}</p>
              <p className="text-xs text-gray-500">{formatDateTime(row.created_at)} · {(row.channels_sent ?? []).join(', ') || '—'}</p>
            </div>
            <span className={`status-badge border ${row.status === 'SENT' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
              {row.status === 'SENT' && row.channels_sent?.includes('WHATSAPP') && <MessageCircle size={11} className="mr-1 inline" />}
              {row.status}
            </span>
          </button>
          {expanded === row.id && (
            <pre className="mt-3 whitespace-pre-wrap border-t border-gray-100 pt-3 font-mono text-xs text-gray-700">{row.content || row.error}</pre>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ReportSchedulesPage() {
  const user = authStore.getUser()
  const [tab, setTab] = useState<'schedules' | 'history'>('schedules')

  return (
    <div>
      <PageHeader title="Scheduled Reports" subtitle="Automated dispatch and inward-material digests, sent in-app and (optionally) over WhatsApp" />

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {(['schedules', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-medium capitalize ${tab === t ? 'border-b-2 border-accent text-accent' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'schedules' ? <SchedulesTab branchId={user?.branch?.id} /> : <HistoryTab branchId={user?.branch?.id} />}
    </div>
  )
}
