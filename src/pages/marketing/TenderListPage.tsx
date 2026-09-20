import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface TenderRow {
  id: string
  tender_no: string
  date: string
  customer_name: string
  project_site: string
  source: string | null
  estimated_value: string | number | null
  submission_deadline: string | null
  status: string
}

const STATUS_OPTIONS = ['', 'NEW', 'IN_REVIEW', 'QUOTED', 'WON', 'LOST', 'CANCELLED']

export default function TenderListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['tenders', page, status],
    queryFn: () =>
      api.get('/marketing/tenders', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: TenderRow[]; total: number; page: number; limit: number }),
  })

  const columns: Column<TenderRow>[] = [
    {
      key: 'tender_no',
      header: 'RFQ No',
      render: t => <Link to={`/marketing/tenders/${t.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{t.tender_no}</Link>,
    },
    { key: 'date', header: 'Date', render: t => new Date(t.date).toLocaleDateString('en-IN') },
    { key: 'customer_name', header: 'Prospect / Customer' },
    { key: 'project_site', header: 'Project Site' },
    { key: 'source', header: 'Source', render: t => t.source ?? '—' },
    {
      key: 'estimated_value',
      header: 'Est. Value',
      align: 'right',
      render: t => (t.estimated_value != null ? `₹${formatINR(Number(t.estimated_value))}` : '—'),
    },
    {
      key: 'submission_deadline',
      header: 'Deadline',
      render: t => t.submission_deadline ? new Date(t.submission_deadline).toLocaleDateString('en-IN') : '—',
    },
    { key: 'status', header: 'Status', render: t => <StatusBadge status={t.status} /> },
    {
      key: 'actions', header: '', align: 'right',
      render: t => (
        <Link to={`/marketing/tenders/${t.id}/edit`} title="Edit" aria-label="Edit" className="row-actions rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <Pencil size={14} />
        </Link>
      ),
    },
  ]

  const tenders = data?.data ?? []
  const showEmptyState = !isLoading && tenders.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="Tenders / RFQ"
        subtitle="Inquiries and bid invitations, tracked before they're worth pricing as a Quotation"
        onNew={() => navigate('/marketing/tenders/new')}
        newLabel="Log RFQ"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <ClipboardList size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No RFQs logged yet. Track an inquiry before it's worth a full quotation.</p>
          <button onClick={() => navigate('/marketing/tenders/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + Log RFQ
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={tenders} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
