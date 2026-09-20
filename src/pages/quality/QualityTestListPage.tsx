import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FlaskConical, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatDate } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'
import StrengthForecastPanel from './StrengthForecastPanel'

interface QualityRow {
  id: string
  cast_date: string
  test_date: string | null
  age_days: number
  cube_id: string | null
  grade_name: string | null
  customer_name: string | null
  challan_no: string | null
  target_strength: string | number | null
  actual_strength: string | number | null
  result: string
}

const RESULT_STYLES: Record<string, string> = {
  PASS: 'bg-green-50 text-green-700 border border-green-200',
  FAIL: 'bg-red-50 text-red-600 border border-red-200',
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
}

export default function QualityTestListPage() {
  const navigate = useNavigate()
  const user = authStore.getUser()
  const [page, setPage] = useState(1)
  const [result, setResult] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['quality-tests', page, result, user?.branch?.id],
    queryFn: () => api.get('/quality', {
      params: { page, limit: 25, result: result || undefined, branch_id: user?.branch?.id },
    }).then(r => r.data.data as { data: QualityRow[]; total: number }),
  })

  const { data: summary } = useQuery({
    queryKey: ['quality-summary', user?.branch?.id],
    queryFn: () => api.get('/quality/summary', { params: { branch_id: user?.branch?.id, days: 30 } }).then(r => r.data.data),
  })

  const columns: Column<QualityRow>[] = [
    { key: 'cube_id', header: 'Cube ID', render: r => <span className="font-mono text-xs">{r.cube_id ?? '—'}</span> },
    { key: 'cast_date', header: 'Cast Date', render: r => formatDate(r.cast_date) },
    { key: 'age_days', header: 'Age', align: 'right', render: r => `${r.age_days}d` },
    { key: 'grade_name', header: 'Grade', render: r => r.grade_name ?? '—' },
    { key: 'customer_name', header: 'Customer', render: r => r.customer_name ?? '—' },
    { key: 'challan_no', header: 'Challan', render: r => <span className="font-mono text-xs">{r.challan_no ?? '—'}</span> },
    { key: 'target_strength', header: 'Target (MPa)', align: 'right', render: r => r.target_strength ?? '—' },
    { key: 'actual_strength', header: 'Actual (MPa)', align: 'right', render: r => r.actual_strength ?? '—' },
    { key: 'result', header: 'Result', render: r => (
      <span className={`status-badge ${RESULT_STYLES[r.result] ?? 'bg-gray-100 text-gray-600'}`}>{r.result}</span>
    )},
  ]

  const rows = data?.data ?? []
  const showEmptyState = !isLoading && rows.length === 0 && !result

  return (
    <div>
      <PageHeader
        title="Cube Test Results"
        subtitle="Compressive strength test log linked back to the dispatch challan"
        onNew={() => navigate('/quality/tests/new')}
        newLabel="New Test"
      />

      {summary && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs">
          <span className="text-gray-500">Last 30 days pass rate: <span className="font-mono font-semibold text-gray-900">{summary.passRate != null ? `${summary.passRate}%` : '—'}</span></span>
          <span className="text-gray-500">Passed: <span className="font-mono text-green-700">{summary.passed}</span></span>
          <span className="text-gray-500">Failed: <span className="font-mono text-red-600">{summary.failed}</span></span>
          <span className="text-gray-500">Pending: <span className="font-mono text-amber-700">{summary.pending}</span></span>
        </div>
      )}

      <StrengthForecastPanel branchId={user?.branch?.id} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={result}
            onChange={e => { setResult(e.target.value); setPage(1) }}
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All results</option>
            <option value="PENDING">Pending</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
          </select>
        </div>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <FlaskConical size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No cube tests recorded yet.</p>
          <button onClick={() => navigate('/quality/tests/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + Record Test
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          total={data?.total}
          page={page}
          limit={25}
          onPageChange={setPage}
          onRowClick={row => navigate(`/quality/tests/${row.id}/edit`)}
        />
      )}
    </div>
  )
}
