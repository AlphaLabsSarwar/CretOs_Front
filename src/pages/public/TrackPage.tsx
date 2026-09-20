import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { CheckCircle2, Circle, Clock, Loader2, MapPin, Navigation, Package, Phone, Truck, XCircle } from 'lucide-react'
import { cn, formatMinutes } from '@/lib/utils'

interface TrackEta {
  distanceKm: number
  travelMinutes: number
  source: 'live' | 'plant'
}

interface TrackData {
  challan_no: string
  date: string
  job_site: string
  grade_name: string | null
  qty: string | number
  dispatch_time: string
  site_in: string | null
  site_out: string | null
  customer_name: string | null
  vehicle_no: string | null
  driver_name: string | null
  branch_name: string | null
  branch_phone: string | null
  branch_city: string | null
  step: 'CANCELLED' | 'PREPARING' | 'DISPATCHED' | 'ARRIVED' | 'COMPLETED'
  eta: TrackEta | null
}

const STEPS: { key: TrackData['step']; label: string }[] = [
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'ARRIVED', label: 'Arrived at Site' },
  { key: 'COMPLETED', label: 'Delivered' },
]

function fmtTime(v: string | null) {
  if (!v) return null
  return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Note: live map/navigation was tried here and then deliberately moved to be
// app-only (see apps/driver_app's trip_map_screen.dart) — this public page
// stays a plain step timeline, no map. The API still returns
// job_site_lat/lng and driver_lat/lng on /track/:code if a future need for
// them here comes back up, they're just unused by this page for now.
export default function TrackPage() {
  const { code } = useParams()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['track', code],
    queryFn: () => axios.get(`/api/v1/public/track/${code}`).then(r => r.data.data as TrackData),
    enabled: !!code,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-400">
        <Loader2 size={16} className="mr-2 animate-spin" /> Loading tracking info...
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-gray-50 px-6 text-center">
        <XCircle size={32} className="text-gray-300" />
        <p className="text-sm font-medium text-gray-700">Tracking link not found</p>
        <p className="text-xs text-gray-400">Double-check the link, or contact the plant for help.</p>
      </div>
    )
  }

  const activeIndex = STEPS.findIndex(s => s.key === data.step)
  const cancelled = data.step === 'CANCELLED'

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{data.branch_name ?? 'CretOS RMC'}</p>
          <h1 className="mt-1 text-lg font-bold text-gray-900">Delivery Tracking</h1>
          <p className="mt-0.5 font-mono text-xs text-gray-500">{data.challan_no}</p>
        </div>

        {data.eta && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Clock size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Arriving in ~{formatMinutes(data.eta.travelMinutes)}</p>
              <p className="flex items-center gap-1 text-[11px] text-gray-400">
                <Navigation size={10} />
                {data.eta.distanceKm} km away
                {data.eta.source === 'live' ? ' · based on the truck\'s live location' : ' · estimated'}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {cancelled ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <XCircle size={28} className="text-red-400" />
              <p className="text-sm font-medium text-gray-700">This order was cancelled</p>
              <p className="text-xs text-gray-400">Contact the plant if you have questions.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {STEPS.map((s, i) => {
                const done = i <= activeIndex
                const current = i === activeIndex
                const time = s.key === 'DISPATCHED' ? data.dispatch_time : s.key === 'ARRIVED' ? data.site_in : s.key === 'COMPLETED' ? data.site_out : null
                return (
                  <div key={s.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {done ? (
                        <CheckCircle2 size={20} className={cn(current ? 'text-accent' : 'text-green-500')} />
                      ) : (
                        <Circle size={20} className="text-gray-300" />
                      )}
                      {i < STEPS.length - 1 && <div className={cn('my-0.5 h-8 w-0.5', done && i < activeIndex ? 'bg-green-500' : 'bg-gray-200')} />}
                    </div>
                    <div className="pb-6 pt-0.5">
                      <p className={cn('text-sm font-medium', done ? 'text-gray-800' : 'text-gray-400')}>{s.label}</p>
                      {time && <p className="text-xs text-gray-400">{fmtTime(time)}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Order Details</p>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin size={14} className="shrink-0 text-gray-400" /> {data.job_site}
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Package size={14} className="shrink-0 text-gray-400" /> {data.grade_name ?? '—'} · {data.qty} Cum
            </div>
            {data.vehicle_no && (
              <div className="flex items-center gap-2 text-gray-700">
                <Truck size={14} className="shrink-0 text-gray-400" /> {data.vehicle_no}{data.driver_name ? ` · ${data.driver_name}` : ''}
              </div>
            )}
            {data.branch_phone && (
              <div className="flex items-center gap-2 text-gray-700">
                <Phone size={14} className="shrink-0 text-gray-400" /> {data.branch_phone}
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-400">Powered by CretOS</p>
      </div>
    </div>
  )
}
