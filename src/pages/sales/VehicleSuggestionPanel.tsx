import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Truck, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'

interface Suggestion {
  scheduleId: string
  schNo: string
  jobSite: string
  gradeName: string | null
  qty: number
  startTime: string | null
  suggestedVehicleId: string | null
  suggestedVehicleNo: string | null
  reason: string
  warning: string | null
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function VehicleSuggestionPanel({ branchId }: { branchId?: string }) {
  const [expanded, setExpanded] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['suggest-vehicles', branchId],
    queryFn: () => api.get('/sales/schedules/suggest-vehicles', { params: { branch_id: branchId, date: todayStr() } })
      .then(r => r.data.data as Suggestion[]),
    enabled: !!branchId,
  })

  const suggestions = data ?? []
  if (!isLoading && suggestions.length === 0) return null

  const unassignedCount = suggestions.filter(s => !s.suggestedVehicleId).length

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Truck size={15} className="text-accent" />
          <span className="text-sm font-medium text-gray-800">Suggested Vehicle Assignments — Today</span>
          {!isLoading && (
            <span className="text-xs text-gray-400">
              {suggestions.length} pending
              {unassignedCount > 0 && <span className="ml-1 font-medium text-red-600">· {unassignedCount} unassigned</span>}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="mb-3 text-xs text-gray-500">
            Greedy suggestion for today's still-pending schedule entries — skips any vehicle already out on an undelivered trip, and load-balances by fewest trips so far today. A suggestion, not an assignment — pick it (or another vehicle) when you actually create the challan.
          </p>
          <div className="space-y-2">
            {suggestions.map(s => (
              <div key={s.scheduleId} className={`rounded-xl border px-4 py-3 ${s.suggestedVehicleId ? 'border-gray-200' : 'border-red-200 bg-red-50/40'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {!s.suggestedVehicleId && <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />}
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {s.schNo} — {s.jobSite} {s.gradeName ? `· ${s.gradeName}` : ''}
                      </p>
                      <p className="text-xs text-gray-500">
                        Qty: <span className="font-mono">{s.qty} Cum</span>
                        {s.startTime && ` · ${new Date(s.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {s.suggestedVehicleId ? (
                      <span className="status-badge border border-green-200 bg-green-50 text-green-700">{s.suggestedVehicleNo}</span>
                    ) : (
                      <span className="status-badge border border-red-200 bg-red-50 text-red-600">No vehicle</span>
                    )}
                    <p className="mt-1 text-[11px] text-gray-400">{s.reason}</p>
                  </div>
                </div>
                {s.warning && <p className="mt-2 text-[11px] text-amber-700">{s.warning}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
