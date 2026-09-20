import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Wrench, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'

interface ForecastRow {
  vehicleId: string
  vehicleNo: string
  lastServiceType: string | null
  lastServiceDate: string | null
  nextDueDate: string | null
  nextDueOdometer: number | null
  currentOdometer: number | null
  kmPerDay: number | null
  effectiveDays: number | null
  risk: 'OVERDUE' | 'DUE_SOON' | 'OK' | 'UNKNOWN'
  reason: string
}

const RISK_STYLES: Record<string, string> = {
  OVERDUE: 'border-red-200 bg-red-50/40',
  DUE_SOON: 'border-amber-200 bg-amber-50/40',
  OK: 'border-gray-200 bg-white',
  UNKNOWN: 'border-gray-100 bg-gray-50/40',
}
const RISK_BADGE: Record<string, string> = {
  OVERDUE: 'bg-red-50 text-red-700 border border-red-200',
  DUE_SOON: 'bg-amber-50 text-amber-700 border border-amber-200',
  OK: 'bg-green-50 text-green-700 border border-green-200',
  UNKNOWN: 'bg-gray-100 text-gray-500 border border-gray-200',
}

export default function MaintenanceForecastPanel() {
  const [expanded, setExpanded] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-forecast'],
    queryFn: () => api.get('/fleet/maintenance/forecast').then(r => r.data.data as ForecastRow[]),
  })

  const rows = data ?? []
  const actionable = rows.filter(r => r.risk === 'OVERDUE' || r.risk === 'DUE_SOON')
  if (!isLoading && actionable.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white">
      <button type="button" onClick={() => setExpanded(e => !e)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <Wrench size={15} className="text-accent" />
          <span className="text-sm font-medium text-gray-800">Predictive Maintenance</span>
          {!isLoading && (
            <span className="text-xs text-gray-400">
              {actionable.length} to watch
              {rows.some(r => r.risk === 'OVERDUE') && <span className="ml-1 font-medium text-red-600">· {rows.filter(r => r.risk === 'OVERDUE').length} overdue</span>}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="mb-3 text-xs text-gray-500">
            Projects each vehicle's daily running from its fuel-log odometer history, then checks whether the odometer limit or the date limit hits first — whichever is sooner. Arithmetic only, no external AI.
          </p>
          <div className="space-y-2">
            {actionable.map(r => (
              <div key={r.vehicleId} className={`rounded-xl border px-4 py-3 ${RISK_STYLES[r.risk]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {r.risk === 'OVERDUE' && <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />}
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.vehicleNo}</p>
                      <p className="text-xs text-gray-500">
                        {r.lastServiceType ? `Last: ${r.lastServiceType}` : 'No service history'}
                        {r.kmPerDay != null && ` · ~${r.kmPerDay} km/day`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400">{r.reason}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`status-badge ${RISK_BADGE[r.risk]}`}>
                      {r.effectiveDays != null ? `${r.effectiveDays}d` : r.risk}
                    </span>
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
