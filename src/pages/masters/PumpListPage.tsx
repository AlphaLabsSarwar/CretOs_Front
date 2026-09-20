import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Waves, Pencil, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface PumpRow {
  id: string
  pump_no: string
  pump_type: string
  capacity_cum_hr: string | number | null
  ownership: string
  operator_name: string | null
  mobile: string | null
  is_active: boolean
}

function RowActions({ pump, onToggleActive }: { pump: PumpRow; onToggleActive: (p: PumpRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/masters/pumps/${pump.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      <button type="button" onClick={() => onToggleActive(pump)} className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700">
        {pump.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function PumpListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['pumps', page, search],
    queryFn: () =>
      api.get('/masters/pumps', { params: { page, limit: 25, search: search || undefined } })
        .then(r => r.data.data as { data: PumpRow[]; total: number; page: number; limit: number }),
  })

  const toggleActive = useMutation({
    mutationFn: (pump: PumpRow) =>
      pump.is_active ? api.delete(`/masters/pumps/${pump.id}`) : api.put(`/masters/pumps/${pump.id}`, { is_active: true }),
    onSuccess: (_res, pump) => {
      toast({ variant: 'success', title: pump.is_active ? 'Pump deactivated' : 'Pump activated' })
      queryClient.invalidateQueries({ queryKey: ['pumps'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const columns: Column<PumpRow>[] = [
    { key: 'pump_no', header: 'Pump No', render: p => <Link to={`/masters/pumps/${p.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{p.pump_no}</Link> },
    { key: 'pump_type', header: 'Type', render: p => p.pump_type.replace('_', ' ') },
    { key: 'capacity_cum_hr', header: 'Capacity (Cum/hr)', align: 'right', render: p => p.capacity_cum_hr != null ? Number(p.capacity_cum_hr).toFixed(1) : '—' },
    { key: 'ownership', header: 'Ownership', render: p => p.ownership },
    { key: 'operator_name', header: 'Operator', render: p => p.operator_name ?? '—' },
    { key: 'mobile', header: 'Mobile', render: p => <span className="font-mono text-xs">{p.mobile ?? '—'}</span> },
    { key: 'is_active', header: 'Status', render: p => <StatusBadge status={p.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', header: '', align: 'right', render: p => <RowActions pump={p} onToggleActive={row => toggleActive.mutate(row)} /> },
  ]

  const pumps = data?.data ?? []
  const showEmptyState = !isLoading && pumps.length === 0 && !search

  return (
    <div>
      <PageHeader title="Pump Fleet" subtitle="Boom and line pumps — owned or hired — booked for job-site pours" onNew={() => navigate('/masters/pumps/new')} newLabel="New Pump" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search pump no, operator..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <Waves size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No pumps yet. Add your first boom or line pump.</p>
          <button onClick={() => navigate('/masters/pumps/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + Add Pump
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={pumps} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
