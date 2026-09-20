import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column } from '@/components/shared/DataTable'

interface AuditRow {
  id: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  action: string
  summary: string | null
  performed_by: string | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-blue-50 text-blue-700 border-blue-200',
  UPDATE: 'bg-gray-100 text-gray-600 border-gray-200',
  POST: 'bg-green-50 text-green-700 border-green-200',
  CANCEL: 'bg-red-50 text-red-600 border-red-200',
  APPROVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECT: 'bg-red-50 text-red-600 border-red-200',
  DELETE: 'bg-red-50 text-red-600 border-red-200',
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const limit = 30

  const { data: filters } = useQuery({
    queryKey: ['audit-filters'],
    queryFn: () => api.get('/audit/filters').then(r => r.data.data as { entityTypes: string[]; performers: string[] }),
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log', page, entityType, action],
    queryFn: () => api.get('/audit', { params: { page, limit, entity_type: entityType || undefined, action: action || undefined } })
      .then(r => r.data.data as { data: AuditRow[]; total: number }),
  })

  const columns: Column<AuditRow>[] = [
    { key: 'created_at', header: 'When', render: r => <span className="text-xs">{formatDateTime(r.created_at)}</span> },
    { key: 'action', header: 'Action', render: r => (
      <span className={`status-badge border ${ACTION_COLORS[r.action] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{r.action}</span>
    ) },
    { key: 'entity_type', header: 'Entity', render: r => <span className="font-mono text-xs">{r.entity_type}</span> },
    { key: 'entity_label', header: 'Record', render: r => r.entity_label ?? '—' },
    { key: 'summary', header: 'Details', render: r => <span className="text-xs text-gray-500">{r.summary ?? '—'}</span> },
    { key: 'performed_by', header: 'By', render: r => r.performed_by ?? '—' },
  ]

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Who did what, when — admin only" />

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Could not load the audit log. This page is restricted to Admin users.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Entity</label>
          <select value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="">All</option>
            {(filters?.entityTypes ?? []).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Action</label>
          <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="">All</option>
            {Object.keys(ACTION_COLORS).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} total={data?.total} page={page} limit={limit} onPageChange={setPage} emptyMessage="No audit entries yet" />
    </div>
  )
}
