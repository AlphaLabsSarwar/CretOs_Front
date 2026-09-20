import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Scale, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatDate } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Badge, type BadgeTone } from '@/components/ui/badge'

interface TicketRow {
  id: string
  ticket_no: string
  ticket_type: string
  status: string
  vehicle_no: string | null
  vehicle_no_manual: string | null
  driver_name: string | null
  challan_no: string | null
  gross_weight: number | string | null
  tare_weight: number | string | null
  net_weight: number | string | null
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  OUTWARD_RMC: 'Outward — RMC',
  INWARD_MATERIAL: 'Inward — Material',
  OUTWARD_OTHER: 'Outward — Other',
}

const STATUS_TONES: Record<string, BadgeTone> = {
  GROSS_DONE: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
}

function num(v: number | string | null): string {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  return Number.isNaN(n) ? '—' : n.toLocaleString()
}

export default function WeighbridgeListPage() {
  const navigate = useNavigate()
  const user = authStore.getUser()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['weighbridge-tickets', page, status, search, user?.branch?.id],
    queryFn: () => api.get('/production/weighbridge', {
      params: { page, limit: 25, status: status || undefined, search: search || undefined, branch_id: user?.branch?.id },
    }).then(r => r.data.data as { data: TicketRow[]; total: number }),
  })

  const columns: Column<TicketRow>[] = [
    { key: 'ticket_no', header: 'Ticket No', render: r => <span className="font-mono text-xs">{r.ticket_no}</span> },
    { key: 'ticket_type', header: 'Type', render: r => TYPE_LABELS[r.ticket_type] ?? r.ticket_type },
    { key: 'vehicle', header: 'Vehicle', render: r => r.vehicle_no ?? r.vehicle_no_manual ?? '—' },
    { key: 'driver_name', header: 'Driver', render: r => r.driver_name ?? '—' },
    { key: 'challan_no', header: 'Challan', render: r => r.challan_no ? <span className="font-mono text-xs">{r.challan_no}</span> : '—' },
    { key: 'gross_weight', header: 'Gross (kg)', align: 'right', render: r => num(r.gross_weight) },
    { key: 'tare_weight', header: 'Tare (kg)', align: 'right', render: r => num(r.tare_weight) },
    { key: 'net_weight', header: 'Net (kg)', align: 'right', render: r => <span className="font-semibold">{num(r.net_weight)}</span> },
    { key: 'status', header: 'Status', render: r => <Badge tone={STATUS_TONES[r.status] ?? 'neutral'}>{r.status.replace('_', ' ')}</Badge> },
    { key: 'created_at', header: 'Date', render: r => formatDate(r.created_at) },
  ]

  const rows = data?.data ?? []
  const showEmptyState = !isLoading && rows.length === 0 && !status && !search

  return (
    <div>
      <PageHeader
        title="Weighbridge"
        subtitle="Gate ticket workflow — gross weighment on arrival, tare on return, net computed between the two"
        onNew={() => navigate('/production/weighbridge/new')}
        newLabel="New Ticket"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search ticket no..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="h-8 rounded-lg border border-gray-300 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All statuses</option>
          <option value="GROSS_DONE">Gross Done — awaiting tare</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <Scale size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No weighbridge tickets yet.</p>
          <button onClick={() => navigate('/production/weighbridge/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New Ticket
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
          onRowClick={row => navigate(`/production/weighbridge/${row.id}/edit`)}
        />
      )}
    </div>
  )
}
