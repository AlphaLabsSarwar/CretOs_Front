import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, FlaskConical, History, Pencil, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface GradeRow {
  id: string
  grade_name: string
  grade_code: string | null
  comm_grade: string | null
  cement_qty: string | number
  mm20_qty: string | number
  mm10_qty: string | number | null
  water_qty: string | number | null
  water_ratio: string | number | null
  admix_qty: string | number | null
  total_weight: string | number | null
  is_active: boolean
  version: number
}

function num(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  return Number.isNaN(n) ? '—' : n.toString()
}

function RowActions({ grade, onToggleActive }: { grade: GradeRow; onToggleActive: (g: GradeRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/masters/grades/${grade.id}/versions`} title="Version History" aria-label="Version History" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <History size={14} />
      </Link>
      <Link to={`/masters/grades/${grade.id}/certificate`} title="Mix Design Certificate" aria-label="Mix Design Certificate" target="_blank" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <FileText size={14} />
      </Link>
      <Link to={`/masters/grades/${grade.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      <button type="button" onClick={() => onToggleActive(grade)} className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700">
        {grade.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function GradeListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['grades', page, search, user?.branch?.id],
    queryFn: () =>
      api
        .get('/masters/grades', { params: { page, limit: 25, search: search || undefined, branch_id: user?.branch?.id } })
        .then(r => r.data.data as { data: GradeRow[]; total: number; page: number; limit: number }),
  })

  const toggleActive = useMutation({
    mutationFn: (grade: GradeRow) =>
      grade.is_active
        ? api.delete(`/masters/grades/${grade.id}`)
        : api.put(`/masters/grades/${grade.id}`, { is_active: true }),
    onSuccess: (_res, grade) => {
      toast({ variant: 'success', title: grade.is_active ? 'Grade deactivated' : 'Grade activated' })
      queryClient.invalidateQueries({ queryKey: ['grades'] })
    },
    onError: (e: any) => {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' })
    },
  })

  const columns: Column<GradeRow>[] = [
    {
      key: 'grade_name',
      header: 'Grade',
      render: g => (
        <Link to={`/masters/grades/${g.id}/edit`} className="font-medium text-gray-800 hover:text-accent">
          {g.grade_name}
        </Link>
      ),
    },
    { key: 'grade_code', header: 'Code', render: g => <span className="font-mono text-xs text-gray-500">{g.grade_code ?? '—'}</span> },
    { key: 'version', header: 'Version', render: g => <span className="font-mono text-xs text-gray-500">v{g.version}</span> },
    { key: 'comm_grade', header: 'Commercial Grade', render: g => g.comm_grade ?? '—' },
    { key: 'cement_qty', header: 'Cement (kg)', align: 'right', render: g => num(g.cement_qty) },
    { key: 'mm20_qty', header: '20mm (kg)', align: 'right', render: g => num(g.mm20_qty) },
    { key: 'mm10_qty', header: '10mm (kg)', align: 'right', render: g => num(g.mm10_qty) },
    { key: 'water_qty', header: 'Water (L)', align: 'right', render: g => num(g.water_qty) },
    { key: 'water_ratio', header: 'W/C Ratio', align: 'right', render: g => num(g.water_ratio) },
    { key: 'admix_qty', header: 'Admix (L)', align: 'right', render: g => num(g.admix_qty) },
    { key: 'total_weight', header: 'Total Wt (kg)', align: 'right', render: g => num(g.total_weight) },
    { key: 'is_active', header: 'Status', render: g => <StatusBadge status={g.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', header: '', align: 'right', render: g => <RowActions grade={g} onToggleActive={row => toggleActive.mutate(row)} /> },
  ]

  const grades = data?.data ?? []
  const showEmptyState = !isLoading && grades.length === 0 && !search

  return (
    <div>
      <PageHeader
        title="Grade Master"
        subtitle="Concrete mix designs (recipes) — cement, aggregate, water and admixture ratios per grade"
        onNew={() => navigate('/masters/grades/new')}
        newLabel="New Recipe"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search grade name or code..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <FlaskConical size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No mix design recipes yet. Add your first concrete grade.</p>
          <button onClick={() => navigate('/masters/grades/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + Add Recipe
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={grades} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
