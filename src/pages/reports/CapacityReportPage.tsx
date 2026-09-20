import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { Factory, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import AnimatedNumber from '@/components/shared/AnimatedNumber'

interface UtilizationDay { date: string; actualQtyCum: number; theoreticalCapacityCum: number | null; utilizationPct: number | null }
interface CapacityReport {
  branchId: string
  ratedCapacityCumHr: number | null
  operatingHoursPerDay: number | null
  address: string | null
  avgDeliverySpeedKmph: number
  days: UtilizationDay[]
  totalActualQtyCum: number
  totalTheoreticalCapacityCum: number | null
  avgUtilizationPct: number | null
}

function monthStart() {
  const d = new Date(); d.setDate(d.getDate() - 13)
  return d.toISOString().slice(0, 10)
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

const tooltipStyle = { fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }

export default function CapacityReportPage() {
  const user = authStore.getUser()
  const queryClient = useQueryClient()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [editing, setEditing] = useState(false)
  const [ratedCapacity, setRatedCapacity] = useState('')
  const [operatingHours, setOperatingHours] = useState('')
  const [address, setAddress] = useState('')
  const [avgSpeed, setAvgSpeed] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['capacity-report', user?.branch?.id, from, to],
    queryFn: () => api.get('/reports/capacity', { params: { branch_id: user?.branch?.id, from, to } }).then(r => r.data.data as CapacityReport),
    enabled: !!user?.branch?.id,
  })

  const saveCapacity = useMutation({
    mutationFn: () => api.put(`/masters/branches/${user?.branch?.id}`, {
      rated_capacity_cum_hr: ratedCapacity === '' ? null : Number(ratedCapacity),
      operating_hours_per_day: operatingHours === '' ? null : Number(operatingHours),
      address: address === '' ? null : address,
      avg_delivery_speed_kmph: avgSpeed === '' ? 25 : Number(avgSpeed),
      // Address may have changed — clear the cached geocode so the next
      // dispatch ETA re-resolves it instead of using a stale plant location
      // (see utils/eta.ts's getBranchLocation, which geocodes+caches lazily).
      lat: null,
      lng: null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capacity-report'] })
      setEditing(false)
    },
  })

  const startEditing = () => {
    setRatedCapacity(data?.ratedCapacityCumHr != null ? String(data.ratedCapacityCumHr) : '')
    setOperatingHours(data?.operatingHoursPerDay != null ? String(data.operatingHoursPerDay) : '')
    setAddress(data?.address ?? '')
    setAvgSpeed(data?.avgDeliverySpeedKmph != null ? String(data.avgDeliverySpeedKmph) : '')
    setEditing(true)
  }

  const chartData = data?.days.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    actual: d.actualQtyCum,
    capacity: d.theoreticalCapacityCum,
  }))

  return (
    <div>
      <PageHeader title="Plant Capacity / Utilization" subtitle="Actual daily dispatch output against the plant's rated capacity" />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
        </div>

        {data && !editing && (
          <button onClick={startEditing} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
            <Pencil size={12} /> Edit plant capacity
          </button>
        )}
      </div>

      {editing && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">Rated Capacity (cum/hr)</label>
            <input
              type="number" step="0.1" autoFocus value={ratedCapacity} onChange={e => setRatedCapacity(e.target.value)}
              placeholder="e.g. 30"
              className="h-8 w-32 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">Operating Hours / Day</label>
            <input
              type="number" step="0.5" value={operatingHours} onChange={e => setOperatingHours(e.target.value)}
              placeholder="e.g. 10"
              className="h-8 w-32 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="w-64">
            <label className="mb-1 block text-[11px] text-gray-500">Plant Address (for dispatch ETA)</label>
            <input
              type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Used to estimate travel time to customer sites"
              className="h-8 w-full rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">Avg Delivery Speed (km/hr)</label>
            <input
              type="number" step="1" value={avgSpeed} onChange={e => setAvgSpeed(e.target.value)}
              placeholder="e.g. 25"
              className="h-8 w-32 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            onClick={() => saveCapacity.mutate()}
            disabled={saveCapacity.isPending}
            className="h-8 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {saveCapacity.isPending ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} className="h-8 rounded-lg px-3 text-xs text-gray-500 hover:bg-gray-100">Cancel</button>
          <p className="w-full text-[11px] text-gray-400">
            Rated capacity + operating hours drive the batch-ready ETA on dispatch. Plant address + avg speed (a straight-line estimate, not turn-by-turn) drive the plant→customer travel ETA — no maps API required.
          </p>
        </div>
      )}

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Could not load the capacity report. This page requires Admin or Manager access.
        </div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        <>
          {data.ratedCapacityCumHr == null || data.operatingHoursPerDay == null ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <Factory size={14} className="mt-0.5 shrink-0" />
              No rated capacity set for this branch yet — utilization % can't be computed. Actual daily output below is still accurate.
              {' '}<button onClick={startEditing} className="font-medium underline underline-offset-2">Set it now</button>.
            </div>
          ) : null}

          <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 card-lift">
              <p className="section-label mb-1">Total Output (cum)</p>
              <AnimatedNumber value={data.totalActualQtyCum} format={n => n.toFixed(1)} className="text-xl font-semibold text-gray-900" />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 card-lift">
              <p className="section-label mb-1">Theoretical Capacity (cum)</p>
              {data.totalTheoreticalCapacityCum != null ? (
                <AnimatedNumber value={data.totalTheoreticalCapacityCum} format={n => n.toFixed(1)} className="text-xl font-semibold text-gray-900" />
              ) : (
                <p className="text-xl font-semibold text-gray-300">—</p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 card-lift">
              <p className="section-label mb-1">Avg Utilization</p>
              {data.avgUtilizationPct != null ? (
                <p className={`text-xl font-semibold ${data.avgUtilizationPct < 50 ? 'text-amber-600' : data.avgUtilizationPct > 100 ? 'text-red-600' : 'text-gray-900'}`}>
                  {data.avgUtilizationPct}%
                </p>
              ) : (
                <p className="text-xl font-semibold text-gray-300">—</p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 card-lift">
              <p className="section-label mb-1">Rated Capacity</p>
              <p className="text-xl font-semibold text-gray-900">
                {data.ratedCapacityCumHr != null ? `${data.ratedCapacityCumHr} cum/hr` : '—'}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                {data.operatingHoursPerDay != null ? `× ${data.operatingHoursPerDay} hrs/day` : 'not set'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="section-label mb-3">Daily Output vs. Theoretical Capacity</p>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(1)} />
                  <Bar dataKey="actual" name="Actual (cum)" fill="#ea580c" radius={[3, 3, 0, 0]} />
                  {data.ratedCapacityCumHr != null && data.operatingHoursPerDay != null && (
                    <ReferenceLine
                      y={data.ratedCapacityCumHr * data.operatingHoursPerDay}
                      stroke="#6b7280" strokeDasharray="4 4"
                      label={{ value: 'Capacity', position: 'right', fontSize: 11, fill: '#6b7280' }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
