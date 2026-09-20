import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Truck, Phone } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'

interface DriverRow {
  driverId: string
  driverName: string
  mobile: string | null
  driverType: string
  trips: number
  totalQtyCum: number
  totalDistanceKm: number
  distanceSampleSize: number
  avgQtyPerTrip: number
  avgDistancePerTrip: number | null
  avgTurnaroundMinutes: number | null
  turnaroundSampleSize: number
}
interface DriverScorecardData {
  from: string
  to: string
  rows: DriverRow[]
}

function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function DriverScorecardPage() {
  const user = authStore.getUser()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [driverType, setDriverType] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['driver-scorecard', user?.branch?.id, from, to, driverType],
    queryFn: () => api.get('/reports/driver-scorecard', { params: { branch_id: user?.branch?.id, from, to, driver_type: driverType || undefined } }).then(r => r.data.data as DriverScorecardData),
    enabled: !!user?.branch?.id,
  })

  const maxQty = Math.max(1, ...(data?.rows.map(r => r.totalQtyCum) ?? [1]))

  return (
    <div>
      <PageHeader title="Driver Scorecard" subtitle="Trips, cum delivered, distance run, and turnaround time per driver — built from dispatch challans, ranked by total quantity moved" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">Driver Type</label>
          <select value={driverType} onChange={e => setDriverType(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="">All Types</option>
            <option value="PERMANENT">Permanent</option>
            <option value="CASUAL">Casual (Daily Wage)</option>
          </select>
        </div>
      </div>

      {isError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Could not load the driver scorecard. This page is restricted to Admin/Manager users.
        </div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        data.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-10 text-center">
            <Truck size={22} className="text-gray-300" />
            <p className="text-xs text-gray-400">No dispatched trips with a driver assigned in this period.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Driver</th>
                  <th className="px-4 py-2.5 text-right font-medium">Trips</th>
                  <th className="px-4 py-2.5 font-medium">Qty Moved (cum)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg Qty/Trip</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total Distance (km)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg Distance/Trip</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg Turnaround</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.driverId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <p className="flex items-center gap-1.5 font-medium text-gray-800">
                        {r.driverName}
                        {r.driverType === 'CASUAL' && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Casual</span>
                        )}
                      </p>
                      {r.mobile && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                          <Phone size={10} /> {r.mobile}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{r.trips}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-800">{r.totalQtyCum.toFixed(1)}</span>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (r.totalQtyCum / maxQty) * 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600">{r.avgQtyPerTrip.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                      {r.distanceSampleSize > 0 ? r.totalDistanceKm.toFixed(1) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600">
                      {r.avgDistancePerTrip != null ? r.avgDistancePerTrip.toFixed(1) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600">
                      {r.avgTurnaroundMinutes != null ? `${r.avgTurnaroundMinutes} min` : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  )
}
