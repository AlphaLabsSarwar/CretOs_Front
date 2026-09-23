import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Timer, AlertTriangle, Settings2, Truck } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import { Badge, type BadgeTone } from '@/components/ui/badge'

interface AgeRow {
  id: string
  challan_no: string
  job_site: string
  grade_name: string | null
  qty: number
  customer_name: string | null
  vehicle_no: string | null
  driver_name: string | null
  arrived: boolean
  ageSource: 'BATCH' | 'DISPATCH'
  ageMinutes: number
  status: 'GREEN' | 'YELLOW' | 'RED'
  minutesToYellow: number
  minutesToRed: number
}
interface LiveData {
  branch: { id: string; name: string; greenMin: number; yellowMin: number }
  rows: AgeRow[]
  summary: { total: number; green: number; yellow: number; red: number }
}

const STATUS_TONE: Record<AgeRow['status'], BadgeTone> = { GREEN: 'success', YELLOW: 'warning', RED: 'error' }

export default function ConcreteAgePage() {
  const user = authStore.getUser()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [editingThresholds, setEditingThresholds] = useState(false)
  const [greenDraft, setGreenDraft] = useState('')
  const [yellowDraft, setYellowDraft] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['concrete-age-live', user?.branch?.id],
    queryFn: () => api.get('/production/concrete-age/live', { params: { branch_id: user?.branch?.id } }).then(r => r.data.data as LiveData),
    enabled: !!user?.branch?.id,
    refetchInterval: 30_000,
  })

  const saveThresholds = useMutation({
    mutationFn: () => api.put(`/masters/branches/${user?.branch?.id}`, {
      concrete_age_green_min: Number(greenDraft),
      concrete_age_yellow_min: Number(yellowDraft),
    }),
    onSuccess: () => {
      toast({ title: 'Age thresholds updated', variant: 'success' })
      setEditingThresholds(false)
      qc.invalidateQueries({ queryKey: ['concrete-age-live'] })
    },
    onError: (e: any) => toast({ title: 'Could not save thresholds', description: e?.response?.data?.message, variant: 'error' }),
  })

  const openThresholdEditor = () => {
    if (data) { setGreenDraft(String(data.branch.greenMin)); setYellowDraft(String(data.branch.yellowMin)) }
    setEditingThresholds(true)
  }

  return (
    <div>
      <PageHeader
        title="Concrete Age Monitor"
        subtitle="Every load currently in transit, timed from batching to discharge, against your plant's green/yellow/red thresholds"
        actions={
          <button onClick={openThresholdEditor} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50">
            <Settings2 size={14} /> Thresholds
          </button>
        }
      />

      {editingThresholds && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">Green until (min)</label>
            <input type="number" min={1} value={greenDraft} onChange={e => setGreenDraft(e.target.value)} className="h-8 w-24 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">Yellow until (min) — red beyond</label>
            <input type="number" min={1} value={yellowDraft} onChange={e => setYellowDraft(e.target.value)} className="h-8 w-24 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <button
            onClick={() => saveThresholds.mutate()}
            disabled={saveThresholds.isPending}
            className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
          <button onClick={() => setEditingThresholds(false)} className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Could not load concrete age status.</div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1">In Transit</p>
              <p className="font-mono text-2xl font-semibold text-gray-900">{data.summary.total}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="section-label mb-1 text-green-700">Green</p>
              <p className="font-mono text-2xl font-semibold text-green-800">{data.summary.green}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="section-label mb-1 text-amber-700">Yellow</p>
              <p className="font-mono text-2xl font-semibold text-amber-800">{data.summary.yellow}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="section-label mb-1 text-red-700">Red</p>
              <p className="font-mono text-2xl font-semibold text-red-800">{data.summary.red}</p>
            </div>
          </div>

          <p className="mb-3 text-[11px] text-gray-400">Green under {data.branch.greenMin} min · Yellow under {data.branch.yellowMin} min · Red at or beyond {data.branch.yellowMin} min</p>

          {data.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-10 text-center">
              <Truck size={22} className="text-gray-300" />
              <p className="text-xs text-gray-400">No loads currently in transit.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[820px] text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Challan</th>
                    <th className="px-4 py-2.5 font-medium">Job Site / Customer</th>
                    <th className="px-4 py-2.5 font-medium">Grade / Qty</th>
                    <th className="px-4 py-2.5 font-medium">Vehicle / Driver</th>
                    <th className="px-4 py-2.5 font-medium">Age</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(r => (
                    <tr key={r.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${r.status === 'RED' ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-2.5 font-mono text-gray-700">{r.challan_no}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-gray-800">{r.job_site}</p>
                        <p className="text-[10px] text-gray-400">{r.customer_name ?? '—'}</p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{r.grade_name ?? '—'} · {r.qty} m³</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.vehicle_no ?? '—'} {r.driver_name ? `· ${r.driver_name}` : ''}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Timer size={12} className={r.status === 'RED' ? 'text-red-600' : r.status === 'YELLOW' ? 'text-amber-600' : 'text-gray-400'} />
                          <span className="font-mono font-medium text-gray-800">{r.ageMinutes} min</span>
                        </div>
                        <p className="text-[10px] text-gray-400">from {r.ageSource === 'BATCH' ? 'batching' : 'dispatch'}{r.arrived ? ' · arrived on site' : ''}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={STATUS_TONE[r.status]}>
                          {r.status === 'RED' && <AlertTriangle size={11} className="mr-1 inline" />}
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
