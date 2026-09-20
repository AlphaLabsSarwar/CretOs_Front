import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookText, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface JournalRow {
  id: string
  number: string
  date: string
  ledger_name: string
  pay_amount: string | number
  trans_type: string | null
  status: string
}

const STATUS_OPTIONS = ['', 'DRAFT', 'ACTIVE', 'CANCELLED']

export default function JournalListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['journals', page, status],
    queryFn: () =>
      api.get('/finance/journals', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: JournalRow[]; total: number; page: number; limit: number }),
  })

  const columns: Column<JournalRow>[] = [
    {
      key: 'number',
      header: 'Entry No',
      render: j => <Link to={`/finance/journals/${j.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{j.number}</Link>,
    },
    { key: 'date', header: 'Date', render: j => new Date(j.date).toLocaleDateString('en-IN') },
    { key: 'ledger_name', header: 'Ledger' },
    { key: 'trans_type', header: 'Dr/Cr', render: j => j.trans_type === 'CREDIT' ? 'Credit' : 'Debit' },
    { key: 'pay_amount', header: 'Amount', align: 'right', render: j => <span className="font-semibold">₹{formatINR(Number(j.pay_amount))}</span> },
    { key: 'status', header: 'Status', render: j => <StatusBadge status={j.status} /> },
    {
      key: 'actions', header: '', align: 'right',
      render: j => (
        <Link to={`/finance/journals/${j.id}/edit`} title="Edit" aria-label="Edit" className="row-actions inline-flex rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <Pencil size={14} />
        </Link>
      ),
    },
  ]

  const journals = data?.data ?? []
  const showEmptyState = !isLoading && journals.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="Journal Entry"
        subtitle="General ledger adjustments not tied to a vendor or customer"
        onNew={() => navigate('/finance/journals/new')}
        newLabel="New Entry"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <BookText size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No journal entries yet.</p>
          <button onClick={() => navigate('/finance/journals/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New Entry
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={journals} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
