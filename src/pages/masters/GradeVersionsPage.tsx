import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import InlineLoader from '@/components/shared/InlineLoader'

interface VersionRow {
  id: string
  grade_name: string
  version: number
  is_current: boolean
  cement_qty: string | number
  mm20_qty: string | number
  water_qty: string | number | null
  water_ratio: string | number | null
  created_at: string
  superseded_at: string | null
}

function num(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  return Number.isNaN(n) ? '—' : n.toString()
}

export default function GradeVersionsPage() {
  const { id } = useParams()

  const { data: versions, isLoading } = useQuery({
    queryKey: ['grade-versions', id],
    queryFn: () => api.get(`/masters/grades/${id}/versions`).then(r => r.data.data as VersionRow[]),
    enabled: Boolean(id),
  })

  const columns: Column<VersionRow>[] = [
    { key: 'version', header: 'Version', render: r => <span className="font-mono text-xs font-semibold">v{r.version}</span> },
    { key: 'is_current', header: 'Status', render: r => r.is_current ? <Badge tone="success">Current</Badge> : <Badge tone="neutral">Superseded</Badge> },
    { key: 'cement_qty', header: 'Cement (kg)', align: 'right', render: r => num(r.cement_qty) },
    { key: 'mm20_qty', header: '20mm (kg)', align: 'right', render: r => num(r.mm20_qty) },
    { key: 'water_qty', header: 'Water (L)', align: 'right', render: r => num(r.water_qty) },
    { key: 'water_ratio', header: 'W/C Ratio', align: 'right', render: r => num(r.water_ratio) },
    { key: 'created_at', header: 'Created', render: r => new Date(r.created_at).toLocaleDateString() },
    { key: 'superseded_at', header: 'Superseded', render: r => r.superseded_at ? new Date(r.superseded_at).toLocaleDateString() : '—' },
    { key: 'actions', header: '', align: 'right', render: r => <Link to={`/masters/grades/${r.id}/edit`} className="text-xs text-accent hover:underline">View</Link> },
  ]

  return (
    <div>
      <PageHeader
        title={versions?.[0]?.grade_name ? `Version History — ${versions[0].grade_name}` : 'Version History'}
        subtitle="Every recipe revision is kept permanently — a batch always records the exact version it used"
      />
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400"><InlineLoader /> Loading...</div>
      ) : (
        <DataTable columns={columns} data={versions ?? []} />
      )}
      <div className="mt-6">
        <Link to="/masters/grades" className="text-xs text-gray-500 hover:text-gray-800">← Back to Grade Master</Link>
      </div>
    </div>
  )
}
