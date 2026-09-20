import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Receipt as ReceiptIcon, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface ReceiptRow {
  id: string
  number: string
  date: string
  ledger_name: string
  customer_name: string | null
  pay_amount: string | number
  trans_type: string | null
  ref_no: string | null
  status: string
}

const STATUS_OPTIONS = ['', 'DRAFT', 'ACTIVE', 'CANCELLED']

export default function ReceiptListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', page, status],
    queryFn: () =>
      api.get('/finance/receipts', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: ReceiptRow[]; total: number; page: number; limit: number }),
  })

  const columns: Column<ReceiptRow>[] = [
    {
      key: 'number',
      header: 'Receipt No',
      render: r => <Link to={`/finance/receipts/${r.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{r.number}</Link>,
    },
    { key: 'date', header: 'Date', render: r => new Date(r.date).toLocaleDateString('en-IN') },
    { key: 'customer_name', header: 'Received From', render: r => r.customer_name ?? r.ledger_name },
    { key: 'ref_no', header: 'Against', render: r => r.ref_no ?? '—' },
    { key: 'trans_type', header: 'Mode', render: r => r.trans_type ?? '—' },
    { key: 'pay_amount', header: 'Amount', align: 'right', render: r => <span className="font-semibold">₹{formatINR(Number(r.pay_amount))}</span> },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '', align: 'right',
      render: r => (
        <Link to={`/finance/receipts/${r.id}/edit`} title="Edit" aria-label="Edit" className="row-actions inline-flex rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <Pencil size={14} />
        </Link>
      ),
    },
  ]

  const receipts = data?.data ?? []
  const showEmptyState = !isLoading && receipts.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="Receipt Voucher"
        subtitle="Money received from customers, typically against a posted invoice"
        onNew={() => navigate('/finance/receipts/new')}
        newLabel="New Receipt"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <ReceiptIcon size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No receipt vouchers yet.</p>
          <button onClick={() => navigate('/finance/receipts/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New Receipt
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={receipts} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
