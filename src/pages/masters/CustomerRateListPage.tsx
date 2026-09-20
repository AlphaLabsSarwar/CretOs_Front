import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Tag, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface RateRow {
  id: string
  customer_id: string
  customer_name: string | null
  grade_name: string
  rate: string | number
  is_active: boolean
  remarks: string | null
}

function RowActions({ rate, onToggleActive }: { rate: RateRow; onToggleActive: (r: RateRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/masters/customer-rates/${rate.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      <button type="button" onClick={() => onToggleActive(rate)} className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700">
        {rate.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function CustomerRateListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['customer-rates', page, search, user?.branch?.id],
    queryFn: () => api.get('/masters/customer-rates', {
      params: { page, limit: 25, search: search || undefined, branch_id: user?.branch?.id },
    }).then(r => r.data.data as { data: RateRow[]; total: number }),
  })

  const toggleActive = useMutation({
    mutationFn: (rate: RateRow) =>
      rate.is_active
        ? api.delete(`/masters/customer-rates/${rate.id}`)
        : api.put(`/masters/customer-rates/${rate.id}`, { is_active: true }),
    onSuccess: (_res, rate) => {
      toast({ variant: 'success', title: rate.is_active ? 'Rate contract deactivated' : 'Rate contract activated' })
      queryClient.invalidateQueries({ queryKey: ['customer-rates'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const columns: Column<RateRow>[] = [
    { key: 'customer_name', header: 'Customer', render: r => (
      <Link to={`/masters/customer-rates/${r.id}/edit`} className="font-medium text-gray-800 hover:text-accent">{r.customer_name ?? '—'}</Link>
    )},
    { key: 'grade_name', header: 'Grade', render: r => <span className="font-mono text-xs">{r.grade_name}</span> },
    { key: 'rate', header: 'Rate (₹ / Cum)', align: 'right', render: r => `₹${formatINR(Number(r.rate))}` },
    { key: 'remarks', header: 'Remarks', render: r => r.remarks ?? '—' },
    { key: 'is_active', header: 'Status', render: r => <StatusBadge status={r.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', header: '', align: 'right', render: r => <RowActions rate={r} onToggleActive={row => toggleActive.mutate(row)} /> },
  ]

  const rates = data?.data ?? []
  const showEmptyState = !isLoading && rates.length === 0 && !search

  return (
    <div>
      <PageHeader
        title="Rate Contracts"
        subtitle="Agreed ₹/Cum rate per customer and grade — auto-fills on the dispatch challan"
        onNew={() => navigate('/masters/customer-rates/new')}
        newLabel="New Rate Contract"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search customer or grade..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <Tag size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No rate contracts yet. Add one to auto-fill rates on dispatch.</p>
          <button onClick={() => navigate('/masters/customer-rates/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + Add Rate Contract
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={rates} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
