import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import RmcLoader from '@/components/shared/RmcLoader'

interface Prediction {
  testId: string
  challanId: string
  challanNo: string | null
  customerName: string | null
  jobSite: string | null
  gradeName: string | null
  cubeId: string | null
  castDate: string
  sevenDayActual: number
  sevenDayTestDate: string | null
  targetStrength: number | null
  predicted: number
  marginLow: number
  marginHigh: number
  method: 'grade-regression' | 'branch-regression' | 'fallback-ratio'
  sampleSize: number
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
}

interface ModelInfo {
  gradesWithOwnModel: string[]
  branchWideSampleSize: number
  minPairsRequired: number
  fallbackRatio: number
  fallbackMargin: number
}

const RISK_STYLES: Record<string, string> = {
  HIGH: 'border-red-200 bg-red-50/40',
  MEDIUM: 'border-amber-200 bg-amber-50/40',
  LOW: 'border-green-200 bg-green-50/30',
}
const RISK_BADGE: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200',
  LOW: 'bg-green-50 text-green-700 border border-green-200',
}
const RISK_LABEL: Record<string, string> = {
  HIGH: 'Likely to fail',
  MEDIUM: 'Borderline',
  LOW: 'On track',
}

function methodLabel(p: Prediction, info: ModelInfo | undefined): string {
  if (p.method === 'grade-regression') return `Based on ${p.sampleSize} past ${p.gradeName ?? ''} results at this plant`
  if (p.method === 'branch-regression') return `Based on ${p.sampleSize} past results across all grades at this plant`
  return `Using the standard 7-day ≈ ${Math.round((info?.fallbackRatio ?? 0.67) * 100)}% of 28-day rule — will switch to this plant's own data once ${info?.minPairsRequired ?? 5}+ paired results are in`
}

export default function StrengthForecastPanel({ branchId }: { branchId?: string }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['quality-predictions', branchId],
    queryFn: () => api.get('/quality/predictions', { params: { branch_id: branchId } })
      .then(r => r.data.data as { predictions: Prediction[]; modelInfo: ModelInfo }),
    enabled: !!branchId,
  })

  const predictions = data?.predictions ?? []
  if (!isLoading && predictions.length === 0) return null

  const highCount = predictions.filter(p => p.risk === 'HIGH').length

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-accent" />
          <span className="text-sm font-medium text-gray-800">28-Day Strength Forecast</span>
          {!isLoading && (
            <span className="text-xs text-gray-400">
              {predictions.length} cube{predictions.length !== 1 ? 's' : ''} awaiting test
              {highCount > 0 && <span className="ml-1 font-medium text-red-600">· {highCount} likely to fail</span>}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          {isLoading ? (
            <RmcLoader size="sm" />
          ) : (
            <div className="reveal">
              <p className="mb-3 text-xs text-gray-500">
                Predicts each cube's 28-day break from its own 7-day result, so a likely failure surfaces about three weeks early instead of at the real test. Not a substitute for the actual 28-day break — a forecast, not a lab result.
              </p>
              <div className="space-y-2">
                {predictions.map(p => (
                  <div
                    key={p.testId}
                    onClick={() => navigate(`/quality/tests/${p.testId}/edit`)}
                    className={`cursor-pointer rounded-xl border px-4 py-3 hover:opacity-90 ${RISK_STYLES[p.risk]}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        {p.risk === 'HIGH' && <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />}
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {p.cubeId ?? p.challanNo ?? 'Cube'} — {p.gradeName ?? 'Grade —'} {p.customerName ? `· ${p.customerName}` : ''}
                          </p>
                          <p className="text-xs text-gray-500">
                            Cast {formatDate(p.castDate)} · 7-day: <span className="font-mono">{p.sevenDayActual} MPa</span>
                            {p.targetStrength != null && <> · Target: <span className="font-mono">{p.targetStrength} MPa</span></>}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-400">{methodLabel(p, data?.modelInfo)}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`status-badge ${RISK_BADGE[p.risk]}`}>{RISK_LABEL[p.risk]}</span>
                        <p className="mt-1 text-xs text-gray-600">
                          Predicted <span className="font-mono font-semibold">{p.predicted} MPa</span>
                        </p>
                        <p className="text-[11px] text-gray-400">range {p.marginLow}–{p.marginHigh} MPa</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
