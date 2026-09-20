import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw } from 'lucide-react'
import InlineLoader from '@/components/shared/InlineLoader'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column } from '@/components/shared/DataTable'
import { SectionHeader } from '@/components/shared/form-controls'
import { Badge, type BadgeTone } from '@/components/ui/badge'

interface MaterialRow {
  id: string
  material_key: string
  label: string
  uom: string
  target_qty: string | number
  actual_qty: string | number | null
  variance_qty: string | number | null
  unit_cost: number
  variance_cost: number | null
}

interface BatchDetail {
  id: string
  batch_no: string
  grade_name: string | null
  grade_version: number | null
  batch_qty_cum: string | number
  status: string
  source: string
  sync_status: string
  plc_batch_ref: string | null
  mixer_no: string | null
  operator: string | null
  remarks: string | null
  challan_no: string | null
  job_site: string | null
  customer_name: string | null
  materials: MaterialRow[]
  totalVarianceCost: number
  timeline: { batchCompletedAt: string | null; dispatchTime: string | null; siteIn: string | null; siteOut: string | null }
}

const STATUS_TONES: Record<string, BadgeTone> = { REQUESTED: 'warning', BATCHING: 'info', COMPLETED: 'success', ABORTED: 'error' }
const SYNC_TONES: Record<string, BadgeTone> = { SYNCED: 'success', PENDING: 'warning', FAILED: 'error' }

function num(v: string | number | null | undefined, digits = 3): string {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  return Number.isNaN(n) ? '—' : n.toFixed(digits)
}

export default function BatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [manualMode, setManualMode] = useState(false)
  const [manualActuals, setManualActuals] = useState<Record<string, string>>({})

  const { data: batch, isLoading } = useQuery({
    queryKey: ['production-batch', id],
    queryFn: () => api.get(`/production/batches/${id}`).then(r => r.data.data as BatchDetail),
    enabled: Boolean(id),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['production-batch', id] })
    queryClient.invalidateQueries({ queryKey: ['production-batches'] })
  }

  const syncMutation = useMutation({
    mutationFn: () => api.post(`/production/batches/${id}/sync`),
    onSuccess: res => { toast({ variant: 'success', title: res.data.message ?? 'Synced' }); invalidate() },
    onError: (e: any) => toast({ variant: 'error', title: 'Sync failed', description: e?.response?.data?.error }),
  })

  const abortMutation = useMutation({
    mutationFn: () => api.delete(`/production/batches/${id}`),
    onSuccess: () => { toast({ variant: 'success', title: 'Batch aborted' }); navigate('/production/batches') },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not abort', description: e?.response?.data?.error }),
  })

  const completeMutation = useMutation({
    mutationFn: (body: any) => api.post(`/production/batches/${id}/complete`, body),
    onSuccess: () => { toast({ variant: 'success', title: 'Batch completed' }); setManualMode(false); invalidate() },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not complete batch', description: e?.response?.data?.error }),
  })

  function startManualEntry() {
    const seed: Record<string, string> = {}
    for (const m of batch?.materials ?? []) seed[m.material_key] = m.actual_qty != null ? String(m.actual_qty) : String(m.target_qty)
    setManualActuals(seed)
    setManualMode(true)
  }

  function submitManual() {
    completeMutation.mutate({
      materials: Object.entries(manualActuals).map(([material_key, v]) => ({ material_key, actual_qty: Number(v) })),
    })
  }

  const columns: Column<MaterialRow>[] = [
    { key: 'label', header: 'Material' },
    { key: 'target_qty', header: 'Target', align: 'right', render: r => `${num(r.target_qty)} ${r.uom}` },
    {
      key: 'actual_qty', header: 'Actual', align: 'right',
      render: r => manualMode
        ? <input value={manualActuals[r.material_key] ?? ''} onChange={e => setManualActuals(s => ({ ...s, [r.material_key]: e.target.value }))}
            className="h-7 w-24 rounded border border-gray-300 px-2 text-right font-mono text-xs" />
        : `${num(r.actual_qty)} ${r.actual_qty != null ? r.uom : ''}`,
    },
    { key: 'variance_qty', header: 'Variance', align: 'right', render: r => r.variance_qty != null ? (
      <span className={Number(r.variance_qty) === 0 ? 'text-gray-500' : Number(r.variance_qty) > 0 ? 'text-red-600' : 'text-blue-600'}>
        {Number(r.variance_qty) > 0 ? '+' : ''}{num(r.variance_qty)}
      </span>
    ) : '—' },
    { key: 'unit_cost', header: 'Unit Cost', align: 'right', render: r => `₹${num(r.unit_cost, 2)}` },
    { key: 'variance_cost', header: 'Variance ₹', align: 'right', render: r => r.variance_cost != null ? (
      <span className={Number(r.variance_cost) > 0 ? 'text-red-600 font-medium' : Number(r.variance_cost) < 0 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
        {Number(r.variance_cost) > 0 ? '+' : ''}₹{num(r.variance_cost, 2)}
      </span>
    ) : '—' },
  ]

  if (isLoading) return <div className="flex items-center gap-2 text-xs text-gray-400"><InlineLoader /> Loading...</div>
  if (!batch) return <p className="text-sm text-gray-400">Batch not found.</p>

  return (
    <div>
      <PageHeader
        title={`Batch ${batch.batch_no}`}
        subtitle={`${batch.grade_name ?? '—'}${batch.grade_version ? ` (v${batch.grade_version})` : ''} · ${Number(batch.batch_qty_cum).toFixed(2)} cum`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONES[batch.status] ?? 'neutral'}>{batch.status}</Badge>
            <Badge tone={SYNC_TONES[batch.sync_status] ?? 'neutral'}>Plant: {batch.sync_status}</Badge>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-2 rounded-xl border border-gray-200 bg-white p-4 text-sm md:grid-cols-4">
        <div><span className="text-xs text-gray-400">Challan</span><div className="font-mono">{batch.challan_no ?? '—'}</div></div>
        <div><span className="text-xs text-gray-400">Customer</span><div>{batch.customer_name ?? '—'}</div></div>
        <div><span className="text-xs text-gray-400">Job Site</span><div>{batch.job_site ?? '—'}</div></div>
        <div><span className="text-xs text-gray-400">Mixer / Operator</span><div>{batch.mixer_no ?? '—'} / {batch.operator ?? '—'}</div></div>
        <div><span className="text-xs text-gray-400">Source</span><div>{batch.source}{batch.plc_batch_ref ? ` · ${batch.plc_batch_ref}` : ''}</div></div>
        <div><span className="text-xs text-gray-400">Batch Completed</span><div>{batch.timeline.batchCompletedAt ? new Date(batch.timeline.batchCompletedAt).toLocaleString() : '—'}</div></div>
        <div><span className="text-xs text-gray-400">Challan Dispatch</span><div>{batch.timeline.dispatchTime ? new Date(batch.timeline.dispatchTime).toLocaleString() : '—'}</div></div>
        <div><span className="text-xs text-gray-400">Site In / Out</span><div>{batch.timeline.siteIn ? new Date(batch.timeline.siteIn).toLocaleTimeString() : '—'} / {batch.timeline.siteOut ? new Date(batch.timeline.siteOut).toLocaleTimeString() : '—'}</div></div>
      </div>

      {batch.sync_status === 'PENDING' && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs">
          <span className="text-amber-800">This batch is queued — the plant link hasn't accepted it yet (edge-gateway offline simulation).</span>
          <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-800 hover:bg-amber-100">
            {syncMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Retry Sync
          </button>
        </div>
      )}

      <SectionHeader label="Materials — Target vs Actual" />
      <div className="mt-3">
        <DataTable columns={columns} data={batch.materials} />
      </div>

      {batch.status === 'COMPLETED' && (
        <div className="mt-4 flex items-center gap-x-8 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs">
          <span className="text-gray-500">Total variance cost:</span>
          <span className={`font-mono font-semibold ${batch.totalVarianceCost > 0 ? 'text-red-600' : batch.totalVarianceCost < 0 ? 'text-blue-600' : 'text-gray-900'}`}>
            {batch.totalVarianceCost > 0 ? '+' : ''}₹{batch.totalVarianceCost.toFixed(2)}
          </span>
        </div>
      )}

      {(batch.status === 'REQUESTED' || batch.status === 'BATCHING') && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {batch.status === 'REQUESTED' && (
            <button onClick={() => abortMutation.mutate()} disabled={abortMutation.isPending} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Abort Batch
            </button>
          )}
          {!manualMode ? (
            <>
              {batch.source === 'PLC_SIM' && batch.status === 'BATCHING' && (
                <button onClick={() => completeMutation.mutate({})} disabled={completeMutation.isPending} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50">
                  {completeMutation.isPending && <Loader2 size={13} className="animate-spin" />} Fetch Actuals from Plant & Complete
                </button>
              )}
              <button onClick={startManualEntry} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
                Enter Actuals Manually
              </button>
            </>
          ) : (
            <>
              <button onClick={submitManual} disabled={completeMutation.isPending} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50">
                {completeMutation.isPending && <Loader2 size={13} className="animate-spin" />} Save Actuals & Complete
              </button>
              <button onClick={() => setManualMode(false)} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      <div className="mt-6">
        <Link to="/production/batches" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
      </div>
    </div>
  )
}
