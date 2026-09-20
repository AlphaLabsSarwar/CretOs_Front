import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Receipt as ReceiptIcon, Eye } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface InvoiceRow {
  id: string
  invoice_no: string
  date: string
  customer_name: string | null
  subtotal: string | number
  tax_amount: string | number
  total_amount: string | number
  status: string
  tax_type: string
}

const STATUS_OPTIONS = ['', 'DRAFT', 'PENDING_APPROVAL', 'POSTED', 'CANCELLED']

export default function InvoiceListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, status],
    queryFn: () =>
      api.get('/finance/invoices', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: InvoiceRow[]; total: number; page: number; limit: number }),
  })

  const columns: Column<InvoiceRow>[] = [
    {
      key: 'invoice_no',
      header: 'Invoice No',
      render: i => <Link to={`/finance/invoices/${i.id}`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{i.invoice_no}</Link>,
    },
    { key: 'date', header: 'Date', render: i => new Date(i.date).toLocaleDateString('en-IN') },
    { key: 'customer_name', header: 'Customer', render: i => i.customer_name ?? '—' },
    { key: 'tax_type', header: 'Tax', render: i => i.tax_type },
    { key: 'subtotal', header: 'Subtotal', align: 'right', render: i => `₹${formatINR(Number(i.subtotal))}` },
    { key: 'tax_amount', header: 'GST', align: 'right', render: i => `₹${formatINR(Number(i.tax_amount))}` },
    { key: 'total_amount', header: 'Total', align: 'right', render: i => <span className="font-semibold">₹{formatINR(Number(i.total_amount))}</span> },
    { key: 'status', header: 'Status', render: i => <StatusBadge status={i.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: i => (
        <Link to={`/finance/invoices/${i.id}`} title="View" aria-label="View" className="row-actions inline-flex rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <Eye size={14} />
        </Link>
      ),
    },
  ]

  const invoices = data?.data ?? []
  const showEmptyState = !isLoading && invoices.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Bill customers for dispatched (posted) challans — GST is applied automatically"
        onNew={() => navigate('/finance/invoices/new')}
        newLabel="Generate Invoice"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <ReceiptIcon size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No invoices yet. Generate one from posted dispatch challans.</p>
          <button onClick={() => navigate('/finance/invoices/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + Generate Invoice
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={invoices} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
