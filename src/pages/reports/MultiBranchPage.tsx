import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import AnimatedNumber from '@/components/shared/AnimatedNumber'

interface BranchRow {
  branchId: string
  branchName: string
  city: string | null
  todayQty: number
  todayTrips: number
  monthQty: number
  monthRevenue: number
  outstanding: number
  qualityPassRate: number | null
}
interface MultiBranchData {
  branches: BranchRow[]
  totals: { todayQty: number; todayTrips: number; monthQty: number; monthRevenue: number; outstanding: number }
}

function Kpi({ label, value, format, delay }: { label: string; value: number; format: (n: number) => string; delay: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 card-lift">
      <p className="section-label mb-1">{label}</p>
      <AnimatedNumber value={value} format={format} className="text-xl font-semibold text-gray-900" />
    </div>
  )
}

export default function MultiBranchPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['multi-branch-overview'],
    queryFn: () => api.get('/reports/multi-branch').then(r => r.data.data as MultiBranchData),
  })

  return (
    <div>
      <PageHeader title="Multi-Branch Overview" subtitle="Today's dispatch, 30-day revenue, outstanding, and quality — across every active branch" />

      {isError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Could not load the multi-branch overview. This page is restricted to Admin users.
        </div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label="Today — Qty (cum)" value={data.totals.todayQty} format={n => n.toFixed(1)} delay={0} />
            <Kpi label="Today — Trips" value={data.totals.todayTrips} format={n => String(Math.round(n))} delay={60} />
            <Kpi label="30-Day Revenue" value={data.totals.monthRevenue} format={n => `₹${formatINR(n)}`} delay={120} />
            <Kpi label="Total Outstanding" value={data.totals.outstanding} format={n => `₹${formatINR(n)}`} delay={180} />
          </div>

          {data.branches.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-xs text-gray-400">No active branches found.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Branch</th>
                    <th className="px-4 py-2.5 text-right font-medium">Today Qty</th>
                    <th className="px-4 py-2.5 text-right font-medium">Today Trips</th>
                    <th className="px-4 py-2.5 text-right font-medium">30d Qty</th>
                    <th className="px-4 py-2.5 text-right font-medium">30d Revenue</th>
                    <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                    <th className="px-4 py-2.5 text-right font-medium">Quality Pass %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.branches.map(b => (
                    <tr key={b.branchId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 font-medium text-gray-800">
                          <Building2 size={12} className="text-gray-400" /> {b.branchName}
                        </div>
                        {b.city && <p className="ml-[18px] text-[11px] text-gray-400">{b.city}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{b.todayQty.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{b.todayTrips}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{b.monthQty.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">₹{formatINR(b.monthRevenue)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${b.outstanding > 0 ? 'text-amber-700' : 'text-gray-700'}`}>₹{formatINR(b.outstanding)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {b.qualityPassRate == null ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={`flex items-center justify-end gap-1 font-mono ${b.qualityPassRate < 90 ? 'text-red-600' : 'text-green-700'}`}>
                            {b.qualityPassRate < 90 && <TrendingUp size={11} className="rotate-180" />}
                            {b.qualityPassRate}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
