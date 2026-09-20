import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import { formatMinutes } from '@/lib/utils'

interface EtaPreview {
  batchReadyMinutes: number | null
  standardTruckMinutes: number | null
  distanceKm: number | null
  travelMinutes: number | null
  totalMinutes: number | null
}

function fmtMinutes(m: number | null): string {
  return m == null ? '—' : formatMinutes(m)
}

// Debounced ETA preview — fetches GET /sales/challans/eta-preview as the
// dispatcher fills in job site + qty, before the challan is saved (see
// routes/sales/challans.ts). Two independent numbers, either of which can
// be missing without blocking the other:
//   - batch-ready time, from the branch's rated capacity (utils/eta.ts)
//   - plant→customer travel time, a straight-line-distance approximation
//     from the branch's location to the geocoded job site — no routing API
// job_site is geocoded ad hoc server-side on every debounced call, so this
// waits for the address to look reasonably complete (>6 chars) before
// firing, same threshold the backend preview route itself uses.
export default function DispatchEtaPanel({ jobSite, qty }: { jobSite: string; qty: number | undefined }) {
  const [debounced, setDebounced] = useState({ jobSite, qty })

  useEffect(() => {
    const t = setTimeout(() => setDebounced({ jobSite, qty }), 700)
    return () => clearTimeout(t)
  }, [jobSite, qty])

  const hasQty = typeof debounced.qty === 'number' && !Number.isNaN(debounced.qty) && debounced.qty > 0
  const { data, isFetching } = useQuery({
    queryKey: ['challan-eta-preview', debounced.jobSite, debounced.qty],
    queryFn: () => api.get('/sales/challans/eta-preview', { params: { job_site: debounced.jobSite, qty: debounced.qty } }).then(r => r.data.data as EtaPreview),
    enabled: hasQty,
    staleTime: 10_000,
  })

  if (!hasQty || !data) return null
  if (data.batchReadyMinutes == null && data.travelMinutes == null) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
      {data.batchReadyMinutes != null && (
        <span className="flex items-center gap-1.5">
          <Clock size={13} className="shrink-0 text-blue-500" />
          Batch ready in <span className="font-mono font-semibold">{fmtMinutes(data.batchReadyMinutes)}</span>
          {data.standardTruckMinutes != null && (
            <span className="text-blue-500">(full 9m³ truck: {fmtMinutes(data.standardTruckMinutes)})</span>
          )}
        </span>
      )}
      {data.travelMinutes != null && (
        <span className="flex items-center gap-1.5">
          <MapPin size={13} className="shrink-0 text-blue-500" />
          ~<span className="font-mono font-semibold">{data.distanceKm} km</span> to site · <span className="font-mono font-semibold">{fmtMinutes(data.travelMinutes)}</span> drive
        </span>
      )}
      {data.totalMinutes != null && (
        <span className="text-blue-500">Est. arrival in {fmtMinutes(data.totalMinutes)} total</span>
      )}
      {isFetching && <span className="text-blue-300">Updating...</span>}
    </div>
  )
}
