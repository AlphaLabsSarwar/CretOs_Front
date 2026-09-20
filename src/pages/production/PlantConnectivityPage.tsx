import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Wifi, WifiOff, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import { Badge } from '@/components/ui/badge'

interface ConnectivityData {
  bySyncStatus: { SYNCED: number; PENDING: number; FAILED: number }
  worker: { lastCycleAt: string | null; lastCycleResult: { attempted: number; recovered: number } | null }
}
interface QueuedBatch {
  id: string
  batch_no: string
  status: string
  sync_status: string
  created_at: string
  challan_no: string | null
  job_site: string | null
}

function timeAgo(iso: string | null) {
  if (!iso) return 'never'
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`
  return `${Math.round(secs / 3600)}h ago`
}

export default function PlantConnectivityPage() {
  const user = authStore.getUser()
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['plant-connectivity', user?.branch?.id],
    queryFn: () => api.get('/production/batches/connectivity', { params: { branch_id: user?.branch?.id } }).then(r => r.data.data as ConnectivityData),
    enabled: !!user?.branch?.id,
    refetchInterval: 15_000,
  })

  const { data: queued } = useQuery({
    queryKey: ['plant-connectivity-queued', user?.branch?.id],
    queryFn: () => api.get('/production/batches', { params: { branch_id: user?.branch?.id, sync_status: 'PENDING', limit: 50 } })
      .then(r => r.data.data.data as QueuedBatch[]),
    enabled: !!user?.branch?.id,
    refetchInterval: 15_000,
  })

  const retrySync = useMutation({
    mutationFn: (id: string) => api.post(`/production/batches/${id}/sync`),
    onSuccess: () => {
      toast({ title: 'Retry sent to the plant', variant: 'success' })
      qc.invalidateQueries({ queryKey: ['plant-connectivity'] })
      qc.invalidateQueries({ queryKey: ['plant-connectivity-queued'] })
    },
    onError: (e: any) => toast({ title: 'Retry failed', description: e?.response?.data?.message, variant: 'error' }),
  })

  const retryAll = async () => {
    if (!queued || queued.length === 0) return
    for (const b of queued) {
      await api.post(`/production/batches/${b.id}/sync`).catch(() => {})
    }
    toast({ title: `Retried ${queued.length} queued batch(es)`, variant: 'success' })
    qc.invalidateQueries({ queryKey: ['plant-connectivity'] })
    qc.invalidateQueries({ queryKey: ['plant-connectivity-queued'] })
  }

  const total = data ? data.bySyncStatus.SYNCED + data.bySyncStatus.PENDING + data.bySyncStatus.FAILED : 0
  const healthy = data ? data.bySyncStatus.PENDING === 0 && data.bySyncStatus.FAILED === 0 : true

  return (
    <div>
      <PageHeader
        title="Plant Connectivity"
        subtitle="Live status of the link between this ERP and the batching plant's PLC/SCADA — a background worker auto-retries anything queued while the link was down"
        actions={
          queued && queued.length > 0 ? (
            <button onClick={retryAll} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:opacity-90">
              <RefreshCw size={14} /> Retry all queued
            </button>
          ) : undefined
        }
      />

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Could not load plant connectivity status.</div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={`rounded-xl border p-4 ${healthy ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="mb-2 flex items-center gap-2">
                {healthy ? <Wifi size={16} className="text-green-700" /> : <WifiOff size={16} className="text-amber-700" />}
                <p className={`text-sm font-semibold ${healthy ? 'text-green-800' : 'text-amber-800'}`}>{healthy ? 'Plant link healthy' : 'Batches queued at the edge'}</p>
              </div>
              <p className="text-[11px] text-gray-500">{total} open batch{total === 1 ? '' : 'es'} tracked · auto-retry every 60s</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1">Synced</p>
              <p className="font-mono text-2xl font-semibold text-gray-900">{data.bySyncStatus.SYNCED}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1">Pending / Failed</p>
              <p className="font-mono text-2xl font-semibold text-gray-900">
                {data.bySyncStatus.PENDING} <span className="text-sm font-normal text-gray-400">pending</span>
                {data.bySyncStatus.FAILED > 0 && <span className="ml-2 text-red-600">{data.bySyncStatus.FAILED} failed</span>}
              </p>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
            <Clock size={13} />
            Auto-resync worker last ran {timeAgo(data.worker.lastCycleAt)}
            {data.worker.lastCycleResult && (
              <span>— retried {data.worker.lastCycleResult.attempted}, recovered {data.worker.lastCycleResult.recovered}</span>
            )}
          </div>

          {queued && queued.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-[11px] font-medium text-gray-500">Queued batches (sync_status = PENDING)</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-400">
                    <th className="px-4 py-2 font-medium">Batch</th>
                    <th className="px-4 py-2 font-medium">Job Site / Challan</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Queued</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {queued.map(b => (
                    <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5"><Link to={`/production/batches/${b.id}`} className="font-mono text-accent hover:underline">{b.batch_no}</Link></td>
                      <td className="px-4 py-2.5 text-gray-600">{b.challan_no ?? '—'} {b.job_site ? `· ${b.job_site}` : ''}</td>
                      <td className="px-4 py-2.5"><Badge tone="warning">{b.status}</Badge></td>
                      <td className="px-4 py-2.5 text-gray-400">{timeAgo(b.created_at)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => retrySync.mutate(b.id)}
                          disabled={retrySync.isPending}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 px-2 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        >
                          <RefreshCw size={12} /> Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      <p className="mt-3 text-[11px] text-gray-400">
        This reflects the cloud side of offline resilience — a batch queues here when the plant rejects or times out, and is retried automatically. True local batching during an actual network outage needs an on-prem edge gateway running independently of this API, which is a separate deployment outside this module's scope.
      </p>
    </div>
  )
}
