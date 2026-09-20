import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Factory, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatDate } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Badge, type BadgeTone } from '@/components/ui/badge'

interface BatchRow {
  id: string
  batch_no: string
  grade_name: string | null
  batch_qty_cum: number | string
  status: string
  sync_status: string
  challan_no: string | null
  job_site: string | null
  customer_name: string | null
  created_at: string
}

const STATUS_TONES: Record<string, BadgeTone> = {
  REQUESTED: 'warning',
  BATCHING: 'info',
  COMPLETED: 'success',
  ABORTED: 'error',
}
const SYNC_TONES: Record<string, BadgeTone> = {
  SYNCED: 'success',
  PENDING: 'warning',
  FAILED: 'error',
}

export default function BatchingListPage() {
  const navigate = useNavigate()
  const user = authStore.getUser()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['production-batches', page, status, search, user?.branch?.id],
    queryFn: () => api.get('/production/batches', {
      params: { page, limit: 25, status: status || undefined, search: search || undefined, branch_id: user?.branch?.id },
    }).then(r => r.data.data as { data: BatchRow[]; total: number }),
  })

  const columns: Column<BatchRow>[] = [
    { key: 'batch_no', header: 'Batch No', render: r => <span className="font-mono text-xs">{r.batch_no}</span> },
    { key: 'grade_name', header: 'Grade', render: r => r.grade_name ?? '—' },
    { key: 'batch_qty_cum', header: 'Qty (cum)', align: 'right', render: r => Number(r.batch_qty_cum).toFixed(2) },
    { key: 'challan_no', header: 'Challan', render: r => r.challan_no ? <span className="font-mono text-xs">{r.challan_no}</span> : '—' },
    { key: 'customer_name', header: 'Customer', render: r => r.customer_name ?? '—' },
    { key: 'status', header: 'Status', render: r => <Badge tone={STATUS_TONES[r.status] ?? 'neutral'}>{r.status}</Badge> },
    { key: 'sync_status', header: 'Plant Sync', render: r => <Badge tone={SYNC_TONES[r.sync_status] ?? 'neutral'}>{r.sync_status}</Badge> },
    { key: 'created_at', header: 'Date', render: r => formatDate(r.created_at) },
  ]

  const rows = data?.data ?? []
  const showEmptyState = !isLoading && rows.length === 0 && !status && !search

  return (
    <div>
      <PageHeader
        title="Batching / MES"
        subtitle="Production batches — target vs actual material quantities, pinned to the exact mix design version used"
        onNew={() => navigate('/production/batches/new')}
        newLabel="New Batch"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search batch no..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="h-8 rounded-lg border border-gray-300 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All statuses</option>
          <option value="REQUESTED">Requested</option>
          <option value="BATCHING">Batching</option>
          <option value="COMPLETED">Completed</option>
          <option value="ABORTED">Aborted</option>
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <Factory size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No production batches yet.</p>
          <button onClick={() => navigate('/production/batches/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New Batch
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          total={data?.total}
          page={page}
          limit={25}
          onPageChange={setPage}
          onRowClick={row => navigate(`/production/batches/${row.id}`)}
        />
      )}
    </div>
  )
}
