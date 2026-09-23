import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Crosshair, MapPinOff, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatQty } from '@/lib/utils'
import { authStore } from '@/store/auth'
import {
  buildTrips, formatAgo, formatStepTime, isStale, tripDuration,
  type ChallanRow, type LiveRow, type Trip, type TripStatus,
} from '@/lib/tracking'
import PageHeader from '@/components/shared/PageHeader'
import AnimatedNumber from '@/components/shared/AnimatedNumber'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import TrackingMap, { TRIP_COLORS, type Plant } from '@/components/tracking/TrackingMap'

const LIVE_POLL_MS = 10_000

const STATUS_META: Record<TripStatus, { label: string; tone: BadgeTone }> = {
  ON_ROAD: { label: 'On the road', tone: 'warning' },
  AT_SITE: { label: 'At site', tone: 'success' },
  RETURNED: { label: 'Returned', tone: 'neutral' },
}

type Filter = 'ALL' | TripStatus
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ON_ROAD', label: 'On the road' },
  { value: 'AT_SITE', label: 'At site' },
  { value: 'RETURNED', label: 'Returned' },
]

// Re-render on a timer so "1h 12m so far" and "GPS 3 min ago" keep moving
// between polls.
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

/** Three dots joined by lines: dispatched -> at site -> returned. Filled up to the step the trip has reached. */
function TripProgress({ trip }: { trip: Trip }) {
  const done = trip.status === 'RETURNED'
  const fill = done ? 'bg-green-500' : 'bg-accent'
  const steps = [
    { on: true, title: `Dispatched ${formatStepTime(trip.dispatchedAt, new Date())}` },
    { on: !!trip.arrivedAt || done, title: trip.arrivedAt ? `At site ${formatStepTime(trip.arrivedAt, new Date())}` : 'Not at site yet' },
    { on: done, title: trip.returnedAt ? `Returned ${formatStepTime(trip.returnedAt, new Date())}` : 'Not returned yet' },
  ]
  return (
    <div className="flex items-center" aria-label={STATUS_META[trip.status].label}>
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && <span className={cn('h-0.5 w-6 transition-colors duration-300', s.on ? fill : 'bg-gray-200')} />}
          <span title={s.title} className={cn('h-2.5 w-2.5 rounded-full transition-colors duration-300', s.on ? fill : 'bg-gray-200')} />
        </div>
      ))}
    </div>
  )
}

function StatTile({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <span className="h-10 w-1 rounded-full" style={{ background: color }} />
      <div>
        <p className="section-label">{label}</p>
        <p className="text-2xl font-semibold leading-tight text-gray-900"><AnimatedNumber value={value} /></p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </Card>
  )
}

export default function LiveTrackingPage() {
  const user = authStore.getUser()
  const branchId = user?.branch?.id
  const now = useNow(15_000)

  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fitSignal, setFitSignal] = useState(0)
  const mapCardRef = useRef<HTMLDivElement>(null)

  const live = useQuery({
    queryKey: ['tracking-live', branchId],
    queryFn: () => api.get('/fleet/live', { params: { branch_id: branchId } }).then(r => r.data.data as LiveRow[]),
    enabled: !!branchId,
    refetchInterval: LIVE_POLL_MS,
  })
  // A user with the Fleet module but not Sales can't read challans (403) — the
  // page then falls back to /fleet/live alone (see buildTrips).
  const challans = useQuery({
    queryKey: ['tracking-challans', branchId],
    queryFn: () => api.get('/sales/challans', { params: { branch_id: branchId, limit: 200 } }).then(r => r.data.data.data as ChallanRow[]),
    enabled: !!branchId,
    refetchInterval: LIVE_POLL_MS * 2,
    retry: false,
  })
  const branch = useQuery({
    queryKey: ['tracking-branch', branchId],
    queryFn: () => api.get(`/masters/branches/${branchId}`).then(r => r.data.data as { name?: string; lat?: unknown; lng?: unknown }),
    enabled: !!branchId,
    staleTime: 10 * 60_000,
  })

  const trips = useMemo(
    () => buildTrips(challans.data, live.data, now),
    [challans.data, live.data, now],
  )
  const plant: Plant | null = useMemo(() => {
    const lat = num(branch.data?.lat), lng = num(branch.data?.lng)
    return lat != null && lng != null ? { name: branch.data?.name ?? user?.branch?.name ?? 'Plant', lat, lng } : null
  }, [branch.data, user?.branch?.name])

  const counts = useMemo(() => ({
    ALL: trips.length,
    ON_ROAD: trips.filter(t => t.status === 'ON_ROAD').length,
    AT_SITE: trips.filter(t => t.status === 'AT_SITE').length,
    RETURNED: trips.filter(t => t.status === 'RETURNED').length,
  }), [trips])
  const dispatchedQty = useMemo(() => trips.reduce((s, t) => s + t.qty, 0), [trips])
  const open = counts.ON_ROAD + counts.AT_SITE
  const onMap = trips.filter(t => t.position).length
  const noGps = trips.filter(t => t.status !== 'RETURNED' && !t.position).length

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return trips.filter(t =>
      (filter === 'ALL' || t.status === filter) &&
      (!q || [t.vehicleNo, t.driverName, t.customerName, t.jobSite, t.challanNo].some(v => v?.toLowerCase().includes(q))))
  }, [trips, filter, search])

  const isLoading = live.isLoading || challans.isLoading
  const bothFailed = live.isError && challans.isError
  const connectionTrouble = live.isError || challans.isError
  const lastUpdate = Math.max(live.dataUpdatedAt, challans.dataUpdatedAt)

  const select = (trip: Trip) => {
    setSelectedId(trip.id)
    if (trip.position) mapCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <div>
      <PageHeader
        title="Live Tracking"
        subtitle="Trucks on the road, dispatch status and trip times — refreshes every 10 seconds"
        actions={
          <span
            className={cn('inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium',
              connectionTrouble ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700')}
          >
            <span className={cn('h-2 w-2 rounded-full', connectionTrouble ? 'bg-amber-500' : 'animate-pulse bg-green-500')} />
            {connectionTrouble ? <>Connection problem<span className="hidden sm:inline"> — retrying</span></>
              : lastUpdate ? <>Live<span className="hidden sm:inline"> · updated {new Date(lastUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase()}</span></>
              : 'Connecting…'}
          </span>
        }
      />

      {bothFailed && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} /> Couldn't load tracking data. Check your connection — this page keeps retrying.
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="On the road" value={counts.ON_ROAD} color={TRIP_COLORS.ON_ROAD} sub="dispatched, heading to site" />
        <StatTile label="At site" value={counts.AT_SITE} color={TRIP_COLORS.AT_SITE} sub="unloading" />
        <StatTile label="Returned today" value={counts.RETURNED} color={TRIP_COLORS.STALE} sub="trip finished" />
        <StatTile label="Dispatches today" value={counts.ALL} color="#2563EB" sub={`${formatQty(dispatchedQty)} cum`} />
      </div>

      {/* Map */}
      <Card ref={mapCardRef} padding="none" className="relative isolate mb-4 overflow-hidden">
        <TrackingMap
          trips={trips}
          plant={plant}
          selectedId={selectedId}
          onSelect={id => setSelectedId(id)}
          now={now}
          fitSignal={fitSignal}
          className="h-[300px] w-full sm:h-[440px]"
        />
        <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
          <button
            onClick={() => setFitSignal(n => n + 1)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Crosshair size={13} /> Fit all
          </button>
        </div>
        <div className="absolute bottom-6 left-3 z-[1000] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-gray-600 shadow-sm">
          {[['On the road', TRIP_COLORS.ON_ROAD], ['At site', TRIP_COLORS.AT_SITE], ['No recent signal', TRIP_COLORS.STALE]].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>
          ))}
        </div>
        {!isLoading && onMap === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center p-4">
            <div className="max-w-sm rounded-xl border border-gray-200 bg-white/95 px-5 py-4 text-center shadow-md">
              <MapPinOff size={20} className="mx-auto mb-1.5 text-gray-400" />
              <p className="text-sm font-medium text-gray-800">{open > 0 ? 'No live GPS positions yet' : 'No trucks on the road right now'}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {open > 0
                  ? `${open} ${open === 1 ? 'truck is' : 'trucks are'} dispatched, but the driver app hasn't reported a location. They'll appear here as soon as it does.`
                  : 'Trucks appear on the map once they are dispatched and the driver app is sending its location.'}
              </p>
            </div>
          </div>
        )}
      </Card>
      {noGps > 0 && onMap > 0 && (
        <p className="-mt-2 mb-4 flex items-center gap-1.5 text-xs text-amber-700">
          <MapPinOff size={13} /> {noGps} dispatched {noGps === 1 ? 'truck isn\'t' : 'trucks aren\'t'} sharing a GPS location yet — listed below, but not on the map.
        </p>
      )}

      {/* Dispatch status */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by status">
            {FILTERS.map(f => (
              <button
                key={f.value}
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  filter === f.value ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {f.label} <span className={cn('ml-0.5', filter === f.value ? 'text-white/80' : 'text-gray-400')}>{counts[f.value]}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Truck, driver, customer, site…"
              aria-label="Search trips"
              className="h-8 w-56 rounded-lg border border-gray-300 pl-8 pr-2 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Truck', 'Customer / Site', 'Status', 'Progress', 'Dispatched', 'At site', 'Returned', 'Trip time'].map(h => (
                  <th key={h} className="section-label whitespace-nowrap px-4 py-2.5 text-left">
                    {h === 'Returned'
                      ? <span title="When the driver marked the trip finished (site-out). Arrival back at the plant isn't recorded.">Returned</span>
                      : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-gray-400">Loading trips…</td></tr>
              )}
              {!isLoading && visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-gray-400">
                    {trips.length === 0 ? 'No trucks have been dispatched today.' : 'No trips match this filter.'}
                  </td>
                </tr>
              )}
              {visible.map(t => {
                const stale = isStale(t, now)
                const selected = t.id === selectedId
                return (
                  <tr
                    key={t.id}
                    tabIndex={0}
                    aria-selected={selected}
                    onClick={() => select(t)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(t) } }}
                    className={cn(
                      'cursor-pointer border-b border-gray-100 outline-none transition-colors duration-200 last:border-0 focus-visible:bg-gray-50',
                      selected ? 'bg-orange-50' : 'hover:bg-gray-50',
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-mono text-xs font-medium text-gray-900">{t.vehicleNo}</p>
                      <p className="text-[11px] text-gray-400">{t.driverName ?? 'No driver'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[220px] truncate text-xs font-medium text-gray-800">{t.customerName ?? '—'}</p>
                      <p className="max-w-[220px] truncate text-[11px] text-gray-400">
                        {t.jobSite ?? '—'} ·{' '}
                        <Link to={`/sales/challans/${t.id}/edit`} onClick={e => e.stopPropagation()} className="font-mono hover:text-accent hover:underline">{t.challanNo}</Link>
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={STATUS_META[t.status].tone}>{STATUS_META[t.status].label}</Badge>
                      {t.status !== 'RETURNED' && (
                        <p className={cn('mt-1 text-[11px]', !t.positionAt ? 'text-gray-400' : stale ? 'text-amber-600' : 'text-green-600')}>
                          {t.positionAt ? `GPS ${formatAgo(t.positionAt, now)}` : 'No GPS yet'}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3"><TripProgress trip={t} /></td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-700">{formatStepTime(t.dispatchedAt, now)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-700">{formatStepTime(t.arrivedAt, now)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-700">{formatStepTime(t.returnedAt, now)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-mono text-xs font-medium text-gray-900">{tripDuration(t, now)}</p>
                      {t.status !== 'RETURNED' && <p className="text-[11px] text-gray-400">so far</p>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-400">
          Trip time runs from dispatch to return. “Returned” is when the driver marks the trip finished (site-out); arrival back at the plant isn’t recorded yet.
        </p>
      </Card>
    </div>
  )
}
