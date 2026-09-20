import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'

interface CreditRiskRow {
  customerId: string
  name: string
  creditLimit: number | null
  outstanding: number
  utilizationPct: number | null
  paymentTermDays: number
  weightedOverdueDays: number
  outstanding30dAgo: number
  trend: 'up' | 'down' | 'flat' | 'new'
  score: number
  tier: 'HIGH' | 'MEDIUM' | 'LOW'
  factors: { utilization: number; overdueSeverity: number; trend: number }
}
interface CreditRiskData {
  rows: CreditRiskRow[]
  summary: { high: number; medium: number; low: number; totalOutstanding: number }
}

const TIER_STYLES: Record<string, string> = {
  HIGH: 'border-red-200 bg-red-50/40',
  MEDIUM: 'border-amber-200 bg-amber-50/40',
  LOW: 'border-gray-200 bg-white',
}
const TIER_BADGE: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200',
  LOW: 'bg-green-50 text-green-700 border border-green-200',
}
const TREND_ICON: Record<string, React.ElementType> = { up: TrendingUp, down: TrendingDown, flat: Minus, new: Minus }

export default function CreditRiskPage() {
  const user = authStore.getUser()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['credit-risk', user?.branch?.id],
    queryFn: () => api.get('/reports/credit-risk', { params: { branch_id: user?.branch?.id } }).then(r => r.data.data as CreditRiskData),
    enabled: !!user?.branch?.id,
  })

  return (
    <div>
      <PageHeader title="Customer Credit Risk" subtitle="Heuristic 0-100 score from utilization, overdue severity, and 30-day trend — no external AI, fully explainable" />

      {isError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Could not load credit risk. This page is restricted to Admin/Manager users.
        </div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs">
            <span className="text-gray-500">Total outstanding: <span className="font-mono font-semibold text-gray-900">₹{formatINR(data.summary.totalOutstanding)}</span></span>
            <span className="status-badge border border-red-200 bg-red-50 text-red-700">{data.summary.high} high risk</span>
            <span className="status-badge border border-amber-200 bg-amber-50 text-amber-700">{data.summary.medium} medium</span>
            <span className="status-badge border border-green-200 bg-green-50 text-green-700">{data.summary.low} low</span>
          </div>

          {data.rows.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-xs text-gray-400">No customers with outstanding balances right now.</div>
          ) : (
            <div className="space-y-2">
              {data.rows.map(r => {
                const TrendIcon = TREND_ICON[r.trend]
                return (
                  <div key={r.customerId} className={`rounded-xl border px-4 py-3 card-lift ${TIER_STYLES[r.tier]}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        {r.tier === 'HIGH' && <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />}
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.name}</p>
                          <p className="text-xs text-gray-500">
                            Outstanding <span className="font-mono">₹{formatINR(r.outstanding)}</span>
                            {r.creditLimit != null && <> · Limit <span className="font-mono">₹{formatINR(r.creditLimit)}</span> ({r.utilizationPct}% used)</>}
                            {r.creditLimit == null && <> · No credit limit on file</>}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                            <TrendIcon size={11} />
                            {r.trend === 'up' && `Up from ₹${formatINR(r.outstanding30dAgo)} 30 days ago`}
                            {r.trend === 'down' && `Down from ₹${formatINR(r.outstanding30dAgo)} 30 days ago`}
                            {r.trend === 'flat' && 'Stable vs 30 days ago'}
                            {r.trend === 'new' && 'New outstanding balance (none 30 days ago)'}
                            {r.weightedOverdueDays > 0 && ` · avg ${r.weightedOverdueDays}d old (term: ${r.paymentTermDays}d)`}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`status-badge ${TIER_BADGE[r.tier]}`}>{r.tier} · {r.score}</span>
                        <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-gray-400">
                          <Sparkles size={10} />
                          {r.factors.utilization}+{r.factors.overdueSeverity}+{r.factors.trend}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
