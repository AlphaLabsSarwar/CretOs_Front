import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertOctagon, Search } from 'lucide-react'
import { api } from '@/lib/api'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Badge, type BadgeTone } from '@/components/ui/badge'

interface NcrRow {
  id: string
  ncr_no: string
  source_type: string
  severity: string
  description: string
  status: string
  target_close_date: string | null
  created_at: string
}

const SEVERITY_TONE: Record<string, BadgeTone> = { MINOR: 'info', MAJOR: 'warning', CRITICAL: 'error' }
const STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: 'error', ROOT_CAUSE: 'warning', ACTION_PLANNED: 'info', IMPLEMENTED: 'purple', VERIFIED: 'purple', CLOSED: 'success',
}

export default function NcrListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ncr', page, status, search],
    queryFn: () => api.get('/quality/ncr', { params: { page, limit: 25, status: status || undefined, search: search || undefined } })
      .then(r => r.data.data as { data: NcrRow[]; total: number }),
  })

  const columns: Column<NcrRow>[] = [
    { key: 'ncr_no', header: 'NCR No', render: r => <Link to={`/quality/ncr/${r.id}`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{r.ncr_no}</Link> },
    { key: 'source_type', header: 'Source', render: r => r.source_type.replace('_', ' ') },
    { key: 'description', header: 'Description', render: r => <span className="line-clamp-1 max-w-xs text-gray-600">{r.description}</span> },
    { key: 'severity', header: 'Severity', render: r => <Badge tone={SEVERITY_TONE[r.severity] ?? 'neutral'}>{r.severity}</Badge> },
    { key: 'status', header: 'Status', render: r => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status.replace('_', ' ')}</Badge> },
    { key: 'target_close_date', header: 'Target Close', render: r => r.target_close_date ? new Date(r.target_close_date).toLocaleDateString('en-IN') : '—' },
    { key: 'created_at', header: 'Raised', render: r => new Date(r.created_at).toLocaleDateString('en-IN') },
  ]

  const rows = data?.data ?? []

  return (
    <div>
      <PageHeader title="NCR / CAPA" subtitle="Non-conformance reports and their corrective/preventive action trail" onNew={() => navigate('/quality/ncr/new')} newLabel="Raise NCR" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search NCR no..." className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">All statuses</option>
          {['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IMPLEMENTED', 'VERIFIED', 'CLOSED'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {!isLoading && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <AlertOctagon size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No non-conformances raised yet.</p>
        </div>
      ) : (
        <DataTable columns={columns} data={rows} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
