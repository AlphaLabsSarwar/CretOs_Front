import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { api } from '@/lib/api'
import RmcLoader from '@/components/shared/RmcLoader'

interface GradeCert {
  id: string
  grade_name: string
  grade_code: string | null
  comm_grade: string | null
  cement_qty: string | number
  flyash_qty: string | number | null
  ggbs_qty: string | number | null
  mm20_qty: string | number
  mm10_qty: string | number | null
  mm40_qty: string | number | null
  csand_qty: string | number | null
  fsand_qty: string | number | null
  water_qty: string | number | null
  admix_qty: string | number | null
  water_ratio: string | number | null
  total_weight: string | number | null
  cement_grade: string | null
  admix_type: string | null
  admix_name: string | null
  msa: string | null
  remarks: string | null
}

function num(v: string | number | null | undefined, unit = ''): string {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  return Number.isNaN(n) || n === 0 ? '—' : `${n}${unit}`
}

const ROWS: { label: string; key: keyof GradeCert; unit: string }[] = [
  { label: 'Cement', key: 'cement_qty', unit: ' kg' },
  { label: 'Fly Ash', key: 'flyash_qty', unit: ' kg' },
  { label: 'GGBS', key: 'ggbs_qty', unit: ' kg' },
  { label: '20mm Aggregate', key: 'mm20_qty', unit: ' kg' },
  { label: '10mm Aggregate', key: 'mm10_qty', unit: ' kg' },
  { label: '40mm Aggregate', key: 'mm40_qty', unit: ' kg' },
  { label: 'Crushed Sand', key: 'csand_qty', unit: ' kg' },
  { label: 'Natural Sand', key: 'fsand_qty', unit: ' kg' },
  { label: 'Water', key: 'water_qty', unit: ' L' },
  { label: 'Admixture', key: 'admix_qty', unit: ' L' },
]

export default function GradeCertificatePage() {
  const { id } = useParams()
  const { data: grade, isLoading } = useQuery({
    queryKey: ['grade-cert', id],
    queryFn: () => api.get(`/masters/grades/${id}`).then(r => r.data.data as GradeCert),
    enabled: !!id,
  })

  if (isLoading) {
    return <RmcLoader size="sm" />
  }
  if (!grade) {
    return <div className="p-8 text-center text-sm text-gray-400">Grade not found. <Link to="/masters/grades" className="text-accent hover:underline">Back to Grade Master</Link></div>
  }

  return (
    <div className="mx-auto max-w-2xl p-8 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to="/masters/grades" className="text-xs text-gray-500 hover:text-gray-800">← Back to Grade Master</Link>
        <button onClick={() => window.print()} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
          <Printer size={13} /> Print Certificate
        </button>
      </div>

      <div className="rounded-xl border border-gray-300 p-8">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">Mix Design Certificate</h1>
          <p className="text-xs text-gray-500">Concrete Mix Design — Materials & Proportions per m³</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Grade: </span><span className="font-semibold">{grade.grade_name}</span></div>
          <div><span className="text-gray-500">Grade Code: </span>{grade.grade_code ?? '—'}</div>
          <div><span className="text-gray-500">Commercial Grade: </span>{grade.comm_grade ?? '—'}</div>
          <div><span className="text-gray-500">Cement Type: </span>{grade.cement_grade ?? '—'}</div>
          <div><span className="text-gray-500">Max Size of Aggregate: </span>{grade.msa ?? '—'}</div>
          <div><span className="text-gray-500">Water/Cement Ratio: </span>{num(grade.water_ratio)}</div>
          <div><span className="text-gray-500">Admixture Type: </span>{grade.admix_type ?? '—'}</div>
          <div><span className="text-gray-500">Admixture Brand: </span>{grade.admix_name ?? '—'}</div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-50">
              <th className="px-3 py-2 text-left font-semibold">Material</th>
              <th className="px-3 py-2 text-right font-semibold">Quantity per m³</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(r => (
              <tr key={r.key} className="border-b border-gray-100">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 text-right font-mono">{num(grade[r.key], r.unit)}</td>
              </tr>
            ))}
            <tr className="border-t border-gray-300 font-semibold">
              <td className="px-3 py-2">Total Weight</td>
              <td className="px-3 py-2 text-right font-mono">{num(grade.total_weight, ' kg')}</td>
            </tr>
          </tbody>
        </table>

        {grade.remarks && (
          <p className="mt-4 text-xs text-gray-500"><span className="font-medium">Remarks:</span> {grade.remarks}</p>
        )}

        <p className="mt-8 text-center text-[10px] text-gray-400">
          This mix design is generated from CretOS batching records for quality reference / client submission purposes.
        </p>
      </div>
    </div>
  )
}
