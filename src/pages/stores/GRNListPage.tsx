import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Warehouse, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface GRNRow {
  id: string
  number: string
  date: string
  vendor_name: string | null
  party_challan_no: string
  total_qty: string | number
  total_amount: string | number
  status: string
}

const STATUS_OPTIONS = ['', 'DRAFT', 'ACTIVE', 'CANCELLED']

export default function GRNListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['grns', page, status],
    queryFn: () =>
      api.get('/stores/grn', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: GRNRow[]; total: number; page: number; limit: number }),
  })

  const columns: Column<GRNRow>[] = [
    {
      key: 'number',
      header: 'GRN No',
      render: g => <Link to={`/stores/grn/${g.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{g.number}</Link>,
    },
    { key: 'date', header: 'Date', render: g => new Date(g.date).toLocaleDateString('en-IN') },
    { key: 'vendor_name', header: 'Vendor', render: g => g.vendor_name ?? '—' },
    { key: 'party_challan_no', header: 'Party Challan No' },
    { key: 'total_qty', header: 'Qty', align: 'right', render: g => g.total_qty != null ? Number(g.total_qty).toFixed(2) : '—' },
    { key: 'total_amount', header: 'Amount', align: 'right', render: g => <span className="font-semibold">₹{formatINR(Number(g.total_amount || 0))}</span> },
    { key: 'status', header: 'Status', render: g => <StatusBadge status={g.status} /> },
    {
      key: 'actions', header: '', align: 'right',
      render: g => (
        <Link to={`/stores/grn/${g.id}/edit`} title="Edit" aria-label="Edit" className="row-actions inline-flex rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <Pencil size={14} />
        </Link>
      ),
    },
  ]

  const grns = data?.data ?? []
  const showEmptyState = !isLoading && grns.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="GRN"
        subtitle="Goods receipt notes — material physically received from a vendor at the plant"
        onNew={() => navigate('/stores/grn/new')}
        newLabel="New GRN"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <Warehouse size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No GRNs yet. Record material received from a vendor.</p>
          <button onClick={() => navigate('/stores/grn/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New GRN
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={grns} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
