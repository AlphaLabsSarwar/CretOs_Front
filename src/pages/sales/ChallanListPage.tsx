import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatDate, formatDateTime, formatQty, formatTime } from '@/lib/utils'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'
import PageHeader from '@/components/shared/PageHeader'
import { Search, Clock } from 'lucide-react'

export default function ChallanListPage() {
  const user = authStore.getUser()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['challans', page, search, user?.branch?.id],
    queryFn: () => api.get('/sales/challans', {
      params: { page, limit: 25, search, branch_id: user?.branch?.id }
    }).then(r => r.data.data),
  })

  const columns: Column<any>[] = [
    { key: 'challan_no', header: 'Challan No', render: r => (
      <span className="font-mono text-xs font-medium text-gray-800">{r.challan_no}</span>
    )},
    { key: 'date', header: 'Date', render: r => formatDate(r.date) },
    { key: 'customer_name', header: 'Party', render: r => r.customer_name ?? '—' },
    { key: 'job_site', header: 'Job Site' },
    { key: 'grade_name', header: 'Grade', render: r => (
      <span className="font-medium text-gray-700">{r.grade_name ?? '—'}</span>
    )},
    { key: 'qty', header: 'Qty (Cum)', align: 'right', render: r => formatQty(Number(r.qty)) },
    { key: 'vehicle_no', header: 'Vehicle', render: r => r.vehicle_no ?? '—' },
    { key: 'driver_name', header: 'Driver', render: r => r.driver_name ?? '—' },
    { key: 'dispatch_time', header: 'Dispatch Time', render: r => r.dispatch_time ? formatDateTime(r.dispatch_time) : '—' },
    { key: 'eta', header: 'ETA', render: r => {
      if (r.site_out) return <span className="text-xs text-gray-300">Delivered</span>
      if (r.site_in) return <span className="text-xs text-gray-400">At site</span>
      if (!r.eta?.etaAt) return <span className="text-xs text-gray-300">—</span>
      return (
        <span className="flex items-center gap-1 text-xs text-gray-600" title={r.eta.distanceKm != null ? `${r.eta.distanceKm} km` : undefined}>
          <Clock size={11} className="text-gray-400" /> {formatTime(r.eta.etaAt)}
        </span>
      )
    }},
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Dispatch Challan"
        subtitle="All dispatch challans"
        onNew={() => navigate('/sales/challans/new')}
        newLabel="New Challan"
      />

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search challan, party..."
            className="w-full h-8 pl-8 pr-3 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        total={data?.total}
        page={page}
        limit={25}
        onPageChange={setPage}
        onRowClick={row => navigate(`/sales/challans/${row.id}/edit`)}
      />
    </div>
  )
}
