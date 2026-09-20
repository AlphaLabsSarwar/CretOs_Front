import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'

interface ForecastRow {
  material: string
  label: string
  uom: string
  qtyOnHand: number
  reorderLevel: number
  historicalDailyRate: number
  scheduledDailyRate: number
  projectedDailyRate: number
  daysUntilReorder: number | null
  suggestedOrderQty: number
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
}

const RISK_STYLES: Record<string, string> = {
  HIGH: 'border-red-200 bg-red-50/40',
  MEDIUM: 'border-amber-200 bg-amber-50/40',
  LOW: 'border-gray-200 bg-white',
  NONE: 'border-gray-100 bg-gray-50/40',
}
const RISK_BADGE: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200',
  LOW: 'bg-green-50 text-green-700 border border-green-200',
  NONE: 'bg-gray-100 text-gray-500 border border-gray-200',
}

export default function ReorderForecastPanel({ branchId }: { branchId?: string }) {
  const [expanded, setExpanded] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['reorder-forecast', branchId],
    queryFn: () => api.get('/stores/stock/reorder-forecast', { params: { branch_id: branchId } }).then(r => r.data.data as ForecastRow[]),
    enabled: !!branchId,
  })

  const rows = data ?? []
  const actionable = rows.filter(r => r.risk === 'HIGH' || r.risk === 'MEDIUM')
  if (!isLoading && actionable.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white">
      <button type="button" onClick={() => setExpanded(e => !e)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-accent" />
          <span className="text-sm font-medium text-gray-800">Reorder Forecast</span>
          {!isLoading && (
            <span className="text-xs text-gray-400">
              {actionable.length} to watch
              {rows.some(r => r.risk === 'HIGH') && <span className="ml-1 font-medium text-red-600">· {rows.filter(r => r.risk === 'HIGH').length} urgent</span>}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="mb-3 text-xs text-gray-500">
            Projects days until each material hits its reorder level, from the higher of the last 14 days' actual usage and the next 7 days' already-scheduled demand. Arithmetic only — no external AI.
          </p>
          <div className="space-y-2">
            {actionable.map(r => (
              <div key={r.material} className={`rounded-xl border px-4 py-3 ${RISK_STYLES[r.risk]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {r.risk === 'HIGH' && <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />}
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.label}</p>
                      <p className="text-xs text-gray-500">
                        On hand: <span className="font-mono">{r.qtyOnHand} {r.uom}</span> · Reorder at: <span className="font-mono">{r.reorderLevel} {r.uom}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        ~{r.projectedDailyRate} {r.uom}/day projected (historical {r.historicalDailyRate}, scheduled {r.scheduledDailyRate})
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`status-badge ${RISK_BADGE[r.risk]}`}>
                      {r.daysUntilReorder != null ? `${r.daysUntilReorder}d left` : r.risk}
                    </span>
                    {r.suggestedOrderQty > 0 && (
                      <p className="mt-1 text-xs text-gray-600">Suggest ordering <span className="font-mono font-semibold">{r.suggestedOrderQty} {r.uom}</span></p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
