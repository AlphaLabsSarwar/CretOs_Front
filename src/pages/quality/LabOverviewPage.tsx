import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, Clock, Plus, X } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { permissionsStore } from '@/store/permissions'
import { cn, formatDate } from '@/lib/utils'

// Concrete Lab overview — the design's lab screen: a failed-test banner, the
// mix design library (Grade Master) on the left, and for the selected grade
// its recipe per m³, recent cube tests and a strength trend. Grades come from
// Grade Master, tests from Cube Test Results; both link through.

interface QualityRow {
  id: string
  cast_date: string
  age_days: number
  cube_id: string | null
  grade_name: string | null
  customer_name: string | null
  challan_no: string | null
  target_strength: string | number | null
  actual_strength: string | number | null
  result: 'PASS' | 'FAIL' | 'PENDING' | string
}
interface GradeRow { id: string; grade_name: string; grade_code: string | null; is_active: boolean; version: number }
interface GradeDetail {
  cement_qty: number | string | null; flyash_qty?: number | string | null; ggbs_qty?: number | string | null
  mm20_qty: number | string | null; mm10_qty?: number | string | null; mm40_qty?: number | string | null
  csand_qty?: number | string | null; fsand_qty?: number | string | null
  water_qty?: number | string | null; admix_qty?: number | string | null
}
interface QualitySummary { passRate: number | null; passed: number; failed: number; pending: number }

const n = (v: unknown) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v))
const fmt = (v: number, unit: string) => (v ? `${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${unit}` : '—')

function ResultPill({ result }: { result: string }) {
  if (result === 'PASS') return <span className="inline-flex items-center gap-[3px] rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-800"><Check size={9} />Pass</span>
  if (result === 'FAIL') return <span className="inline-flex items-center gap-[3px] rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800"><X size={9} />Fail</span>
  return <span className="inline-flex items-center gap-[3px] rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><Clock size={9} />Pending</span>
}

/** Actual strength per test against the target line; failures in red. */
function StrengthTrend({ tests }: { tests: QualityRow[] }) {
  const points = tests.filter(t => t.actual_strength != null).slice(0, 8).reverse()
  if (points.length < 2) return <p className="py-6 text-center text-[11px] text-slate-400">Not enough results for a trend yet</p>
  const target = n(points[points.length - 1].target_strength)
  const values = points.map(p => n(p.actual_strength))
  const lo = Math.min(...values, target) * 0.9
  const hi = Math.max(...values, target) * 1.05
  const y = (v: number) => 84 - ((v - lo) / (hi - lo || 1)) * 70
  const x = (i: number) => 10 + (i * 200) / (points.length - 1)
  return (
    <svg width="100%" height="90" viewBox="0 0 220 90" role="img" aria-label="Strength trend">
      {target > 0 && (
        <>
          <line x1="0" y1={y(target)} x2="220" y2={y(target)} stroke="#E5E7EB" strokeDasharray="3 4" />
          <text x="0" y={y(target) - 4} fontSize="8" fill="#94A3B8" fontFamily="JetBrains Mono">Target {target}</text>
        </>
      )}
      <polyline points={points.map((p, i) => `${x(i)},${y(n(p.actual_strength))}`).join(' ')} fill="none" stroke="#E8630A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.id} cx={x(i)} cy={y(n(p.actual_strength))} r={p.result === 'FAIL' ? 4 : 3} fill={p.result === 'FAIL' ? '#DC2626' : p.result === 'PASS' ? '#16A34A' : '#E8630A'}>
          <title>{`${p.cube_id ?? 'Cube'} · ${n(p.actual_strength)} MPa`}</title>
        </circle>
      ))}
    </svg>
  )
}

export default function LabOverviewPage() {
  const navigate = useNavigate()
  const user = authStore.getUser()
  const branchId = user?.branch?.id
  const canSeeGrades = permissionsStore.has('lab.grades')
  const [selected, setSelected] = useState<string | null>(null)

  const { data: tests } = useQuery({
    queryKey: ['lab-overview-tests', branchId],
    queryFn: () => api.get('/quality', { params: { page: 1, limit: 100, branch_id: branchId } }).then(r => r.data.data.data as QualityRow[]),
    enabled: !!branchId,
  })
  const { data: summary } = useQuery({
    queryKey: ['quality-summary', branchId],
    queryFn: () => api.get('/quality/summary', { params: { branch_id: branchId, days: 30 } }).then(r => r.data.data as QualitySummary),
    enabled: !!branchId,
  })
  const { data: grades } = useQuery({
    queryKey: ['lab-overview-grades', branchId],
    queryFn: () => api.get('/masters/grades', { params: { limit: 100, branch_id: branchId } }).then(r => r.data.data.data as GradeRow[]),
    enabled: canSeeGrades,
  })

  // The library: Grade Master when the user can read it, otherwise the grades
  // that appear in test results.
  const library = useMemo(() => {
    const names = canSeeGrades
      ? (grades ?? []).filter(g => g.is_active).map(g => ({ id: g.id, name: g.grade_name, sub: g.grade_code ? `${g.grade_code} · v${g.version}` : `v${g.version}` }))
      : [...new Set((tests ?? []).map(t => t.grade_name).filter(Boolean) as string[])].map(name => ({ id: null as string | null, name, sub: '' }))
    return names.map(g => {
      const mine = (tests ?? []).filter(t => t.grade_name === g.name)
      return { ...g, failed: mine.filter(t => t.result === 'FAIL').length, pending: mine.filter(t => t.result === 'PENDING').length, tested: mine.length }
    })
  }, [canSeeGrades, grades, tests])

  const current = library.find(g => g.name === selected) ?? library.find(g => g.failed > 0) ?? library[0]
  const gradeTests = (tests ?? []).filter(t => t.grade_name === current?.name)
  const latestFail = (tests ?? []).find(t => t.result === 'FAIL')

  const { data: recipe } = useQuery({
    queryKey: ['lab-overview-grade', current?.id],
    queryFn: () => api.get(`/masters/grades/${current!.id}`).then(r => r.data.data as GradeDetail),
    enabled: !!current?.id,
  })

  const recipeCells = recipe ? [
    { label: 'Cement', value: fmt(n(recipe.cement_qty), 'kg') },
    { label: 'Fly ash / GGBS', value: fmt(n(recipe.flyash_qty) + n(recipe.ggbs_qty), 'kg') },
    { label: 'Sand', value: fmt(n(recipe.csand_qty) + n(recipe.fsand_qty), 'kg') },
    { label: 'Aggregate', value: fmt(n(recipe.mm10_qty) + n(recipe.mm20_qty) + n(recipe.mm40_qty), 'kg') },
    { label: 'Water', value: fmt(n(recipe.water_qty), 'L') },
    { label: 'Admixture', value: fmt(n(recipe.admix_qty), 'L') },
  ] : []

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Concrete Lab</h1>
          <p className="mt-[3px] text-xs text-slate-400">Mix designs, cube tests and quality approvals</p>
        </div>
        {canSeeGrades && (
          <button
            onClick={() => navigate('/masters/grades/new')}
            className="flex h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Plus size={14} /> New Mix Design
          </button>
        )}
      </div>

      {latestFail && (
        <div role="alert" className="mt-3.5 flex items-center gap-2.5 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5">
          <AlertTriangle size={16} className="shrink-0 text-red-600" />
          <p className="flex-1 text-xs text-red-800">
            <strong>{latestFail.cube_id ?? 'A cube'}</strong>
            {latestFail.grade_name && ` (${latestFail.grade_name}, cast ${formatDate(latestFail.cast_date)})`} failed the {latestFail.age_days}-day test at{' '}
            {n(latestFail.actual_strength)} MPa against a target of {n(latestFail.target_strength)} MPa.
          </p>
          <Link to="/quality/ncr/new" className="shrink-0 text-[11px] font-semibold text-red-700 hover:underline">Raise NCR →</Link>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <section className="panel self-start overflow-hidden">
          <p className="border-b border-gray-200 px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">Mix design library</p>
          {library.length === 0 && <p className="px-3.5 py-6 text-center text-xs text-slate-400">No grades yet</p>}
          <div className="max-h-[520px] overflow-y-auto">
            {library.map(g => {
              const active = g.name === current?.name
              return (
                <button
                  key={g.name}
                  onClick={() => setSelected(g.name)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3.5 py-[11px] text-left transition-colors last:border-0',
                    active ? 'border-l-[3px] border-l-accent bg-accent-light pl-[11px]' : 'hover:bg-slate-50',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[13px] font-bold">{g.name}</span>
                    {g.sub && <span className="block truncate text-[10px] text-slate-400">{g.sub}</span>}
                  </span>
                  <span className={cn('shrink-0 font-mono text-[10px] font-semibold',
                    g.failed ? 'text-red-700' : g.pending ? 'text-amber-700' : g.tested ? 'text-green-600' : 'text-slate-300')}>
                    {g.failed ? `${g.failed} failed` : g.pending ? `${g.pending} pending` : g.tested ? 'All pass' : 'No tests'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-3.5">
          {current && (
            <section className="panel px-[18px] py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">{current.name} · recipe per m³</p>
                {current.id && canSeeGrades && (
                  <Link to={`/masters/grades/${current.id}/edit`} className="text-[11px] font-medium text-accent hover:underline">Edit mix →</Link>
                )}
              </div>
              {recipeCells.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
                  {recipeCells.map(c => (
                    <div key={c.label}>
                      <p className="text-[10px] text-slate-400">{c.label}</p>
                      <p className="mt-0.5 font-mono text-[13px] font-bold">{c.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-400">{canSeeGrades ? 'Loading recipe…' : 'Open Grade Master to see this recipe.'}</p>
              )}
            </section>
          )}

          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.3fr_1fr]">
            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-200 px-3.5 py-3">
                <h2 className="panel-title">Cube test results</h2>
                <Link to="/quality/tests" className="text-[11px] font-medium text-accent hover:underline">All tests →</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[10px] text-slate-400">
                      <th className="px-3.5 py-[7px] font-semibold">Sample</th>
                      <th className="px-2.5 py-[7px] font-semibold">Cast</th>
                      <th className="px-2.5 py-[7px] font-semibold">Age</th>
                      <th className="px-2.5 py-[7px] font-semibold">MPa</th>
                      <th className="px-3.5 py-[7px] font-semibold">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeTests.length === 0 && <tr><td colSpan={5} className="px-3.5 py-6 text-center text-xs text-slate-400">No cube tests for this grade</td></tr>}
                    {gradeTests.slice(0, 8).map(t => (
                      <tr
                        key={t.id}
                        onClick={() => navigate(`/quality/tests/${t.id}/edit`)}
                        className={cn('cursor-pointer border-t border-gray-200 transition-colors', t.result === 'FAIL' ? 'bg-red-50' : 'hover:bg-slate-50')}
                      >
                        <td className="px-3.5 py-2 font-mono">{t.cube_id ?? t.challan_no ?? '—'}</td>
                        <td className="px-2.5 py-2 font-mono text-slate-600">{formatDate(t.cast_date)}</td>
                        <td className="px-2.5 py-2 font-mono">{t.age_days}d</td>
                        <td className="px-2.5 py-2 font-mono font-bold">{t.actual_strength != null ? n(t.actual_strength) : '—'}</td>
                        <td className="px-3.5 py-2"><ResultPill result={t.result} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel p-3.5">
              <h2 className="panel-title mb-2.5">Strength trend (MPa)</h2>
              <StrengthTrend tests={gradeTests} />
              <div className="mt-2.5 border-t border-gray-200 pt-2.5">
                <p className="text-[10.5px] font-semibold text-slate-600">Last 30 days · all grades</p>
                <p className="mt-[3px] font-mono text-[11px]">
                  {summary
                    ? `${summary.passRate != null ? `${summary.passRate}% pass` : 'No results'} · ${summary.passed} pass · ${summary.failed} fail · ${summary.pending} pending`
                    : '—'}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
