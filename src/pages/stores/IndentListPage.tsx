import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface IndentRow {
  id: string
  indent_no: string
  date: string
  dept_name: string
  doc_close: boolean
  total: string | number | null
  status: string
}

const STATUS_OPTIONS = ['', 'DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED']

export default function IndentListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['indents', page, status],
    queryFn: () =>
      api.get('/stores/indents', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: IndentRow[]; total: number; page: number; limit: number }),
  })

  const columns: Column<IndentRow>[] = [
    {
      key: 'indent_no',
      header: 'Indent No',
      render: i => <Link to={`/stores/indents/${i.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{i.indent_no}</Link>,
    },
    { key: 'date', header: 'Date', render: i => new Date(i.date).toLocaleDateString('en-IN') },
    { key: 'dept_name', header: 'Department' },
    { key: 'total', header: 'Est. Value', align: 'right', render: i => i.total != null ? `₹${formatINR(Number(i.total))}` : '—' },
    { key: 'doc_close', header: 'Closed', render: i => i.doc_close ? 'Yes' : 'No' },
    { key: 'status', header: 'Status', render: i => <StatusBadge status={i.status} /> },
    {
      key: 'actions', header: '', align: 'right',
      render: i => (
        <Link to={`/stores/indents/${i.id}/edit`} title="Edit" aria-label="Edit" className="row-actions inline-flex rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <Pencil size={14} />
        </Link>
      ),
    },
  ]

  const indents = data?.data ?? []
  const showEmptyState = !isLoading && indents.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="Indent"
        subtitle="Internal material requests raised by a department, ahead of a purchase order"
        onNew={() => navigate('/stores/indents/new')}
        newLabel="New Indent"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <ClipboardList size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No indents yet.</p>
          <button onClick={() => navigate('/stores/indents/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New Indent
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={indents} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
