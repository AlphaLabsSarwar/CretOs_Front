import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface PaymentRow {
  id: string
  number: string
  date: string
  ledger_name: string
  vendor_name: string | null
  pay_amount: string | number
  trans_type: string | null
  status: string
}

const STATUS_OPTIONS = ['', 'DRAFT', 'ACTIVE', 'CANCELLED']

export default function PaymentListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, status],
    queryFn: () =>
      api.get('/finance/payments', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: PaymentRow[]; total: number; page: number; limit: number }),
  })

  const columns: Column<PaymentRow>[] = [
    {
      key: 'number',
      header: 'Voucher No',
      render: p => <Link to={`/finance/payments/${p.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{p.number}</Link>,
    },
    { key: 'date', header: 'Date', render: p => new Date(p.date).toLocaleDateString('en-IN') },
    { key: 'vendor_name', header: 'Paid To', render: p => p.vendor_name ?? p.ledger_name },
    { key: 'trans_type', header: 'Mode', render: p => p.trans_type ?? '—' },
    { key: 'pay_amount', header: 'Amount', align: 'right', render: p => <span className="font-semibold">₹{formatINR(Number(p.pay_amount))}</span> },
    { key: 'status', header: 'Status', render: p => <StatusBadge status={p.status} /> },
    {
      key: 'actions', header: '', align: 'right',
      render: p => (
        <Link to={`/finance/payments/${p.id}/edit`} title="Edit" aria-label="Edit" className="row-actions inline-flex rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <Pencil size={14} />
        </Link>
      ),
    },
  ]

  const payments = data?.data ?? []
  const showEmptyState = !isLoading && payments.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="Payment Voucher"
        subtitle="Money paid out to vendors and suppliers"
        onNew={() => navigate('/finance/payments/new')}
        newLabel="New Payment"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <CreditCard size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No payment vouchers yet.</p>
          <button onClick={() => navigate('/finance/payments/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New Payment
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={payments} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
