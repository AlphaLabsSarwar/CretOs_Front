import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface QuotationRow {
  id: string
  quot_no: string
  date: string
  valid_date: string
  project_site: string
  heading: string | null
  status: string
}

const STATUS_OPTIONS = ['', 'DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED']

function RowActions({ quotation, onActivate }: { quotation: QuotationRow; onActivate: (q: QuotationRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/marketing/quotations/${quotation.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      {quotation.status === 'DRAFT' && (
        <button type="button" onClick={() => onActivate(quotation)} className="rounded px-1.5 py-1 text-[11px] text-accent hover:bg-orange-50">
          Send
        </button>
      )}
    </div>
  )
}

export default function QuotationListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', page, status],
    queryFn: () =>
      api.get('/marketing/quotations', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: QuotationRow[]; total: number; page: number; limit: number }),
  })

  const activate = useMutation({
    mutationFn: (quotation: QuotationRow) => api.put(`/marketing/quotations/${quotation.id}`, { status: 'ACTIVE' }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Quotation marked as sent (active)' })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const columns: Column<QuotationRow>[] = [
    {
      key: 'quot_no',
      header: 'Quotation No',
      render: q => <Link to={`/marketing/quotations/${q.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{q.quot_no}</Link>,
    },
    { key: 'date', header: 'Date', render: q => new Date(q.date).toLocaleDateString('en-IN') },
    { key: 'project_site', header: 'Project Site' },
    { key: 'heading', header: 'Subject', render: q => q.heading ?? '—' },
    { key: 'valid_date', header: 'Valid Until', render: q => new Date(q.valid_date).toLocaleDateString('en-IN') },
    { key: 'status', header: 'Status', render: q => <StatusBadge status={q.status} /> },
    { key: 'actions', header: '', align: 'right', render: q => <RowActions quotation={q} onActivate={row => activate.mutate(row)} /> },
  ]

  const quotations = data?.data ?? []
  const showEmptyState = !isLoading && quotations.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Sales quotations sent to prospective customers ahead of an order"
        onNew={() => navigate('/marketing/quotations/new')}
        newLabel="New Quotation"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <FileText size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No quotations yet. Draft one for a prospective job site.</p>
          <button onClick={() => navigate('/marketing/quotations/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New Quotation
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={quotations} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
