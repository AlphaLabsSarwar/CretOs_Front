import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Crosshair, MapPinOff, Search, Truck, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatQty } from '@/lib/utils'
import { authStore } from '@/store/auth'
import { usePresence } from '@/lib/usePresence'
import {
  buildTrips, formatAgo, formatStepTime, isStale, tripDuration,
  type ChallanRow, type LiveRow, type Trip, type TripStatus,
} from '@/lib/tracking'
import AnimatedNumber from '@/components/shared/AnimatedNumber'
import TrackingMap, { TRIP_COLORS, type Plant } from '@/components/tracking/TrackingMap'

// Live Tracking — the design's dark "command center". AppLayout paints the
// page background dark for this route (DARK_ROUTES); everything here uses the
// command-* surfaces and white/opacity lines instead of the light greys.

const LIVE_POLL_MS = 10_000

const STATUS_META: Record<TripStatus, { label: string; badge: string }> = {
  ON_ROAD: { label: 'On the road', badge: 'bg-amber-500/[0.16] text-amber-400' },
  AT_SITE: { label: 'At site', badge: 'bg-green-500/[0.16] text-green-400' },
  RETURNED: { label: 'Returned', badge: 'bg-white/[0.08] text-[#AEB4BF]' },
}

type Filter = 'ALL' | TripStatus
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ON_ROAD', label: 'On road' },
  { value: 'AT_SITE', label: 'At site' },
  { value: 'RETURNED', label: 'Returned' },
]

const LINE = 'border-white/[0.09]'
const SURFACE = 'bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02))]'
const MUTED = 'text-[#8B93A3]'

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

/** Dispatched → at site → returned, as dots joined by lines. */
function steps(trip: Trip) {
  const done = trip.status === 'RETURNED'
  return [true, !!trip.arrivedAt || done, done]
}

function TripProgress({ trip }: { trip: Trip }) {
  return (
    <div className="flex items-center" aria-label={STATUS_META[trip.status].label}>
      {steps(trip).map((on, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && <span className={cn('h-0.5 w-3.5 transition-colors duration-300', on ? 'bg-green-500' : 'bg-white/[0.14]')} />}
          <span className={cn('h-[7px] w-[7px] rounded-full transition-colors duration-300', on ? 'bg-green-500' : 'bg-white/[0.14]')} />
        </div>
      ))}
    </div>
  )
}

function StatTile({ label, value, color, alert }: { label: string; value: number; color: string; alert?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-3.5', alert
      ? 'border-red-600/35 bg-[linear-gradient(180deg,rgba(220,38,38,.10),rgba(220,38,38,.02))]'
      : cn(LINE, SURFACE))}
    >
      <span className="mb-2.5 block h-1 w-9 rounded-sm" style={{ background: color }} />
      <p className={cn('text-[10px] font-semibold uppercase tracking-[0.05em]', alert ? 'text-red-300' : MUTED)}>{label}</p>
      <p className="mt-[3px] font-mono text-[22px] font-semibold text-white"><AnimatedNumber value={value} /></p>
    </div>
  )
}

/** Right-hand drawer for the selected trip: timeline, elapsed time, where it's going. */
function TripDrawer({ trip, now, onClose, leaving }: { trip: Trip; now: Date; onClose: () => void; leaving: boolean }) {
  const timeline = [
    { label: 'Dispatched', at: trip.dispatchedAt },
    { label: 'At site', at: trip.arrivedAt },
    { label: 'Returned', at: trip.returnedAt },
  ]
  const on = steps(trip)
  const stale = isStale(trip, now)
  return (
    <>
      <div className={cn('fixed inset-0 z-30 bg-black/30 md:hidden', leaving && 'backdrop-leave pointer-events-none')} onClick={onClose} aria-hidden="true" />
      <aside
        aria-label={`${trip.vehicleNo} trip`}
        className={cn('fixed inset-y-0 right-0 z-40 w-full max-w-[340px] overflow-y-auto border-l bg-command-panel p-[22px] text-[#E7E9EE] shadow-[-16px_0_40px_rgba(0,0,0,.5)]', leaving ? 'drawer-leave pointer-events-none' : 'animate-in slide-in-from-right duration-200', LINE)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-accent/[0.16]"><Truck size={16} className="text-accent-soft" /></span>
            <div>
              <p className="font-mono text-[17px] font-bold text-white">{trip.vehicleNo}</p>
              <p className={cn('mt-[3px] text-[11.5px]', MUTED)}>{trip.driverName ?? 'No driver recorded'}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className={cn('rounded-lg p-1.5 transition-colors hover:bg-white/10', MUTED)}><X size={15} /></button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-1 text-[10.5px] font-semibold', STATUS_META[trip.status].badge)}>{STATUS_META[trip.status].label}</span>
          {trip.status !== 'RETURNED' && (
            <span className={cn('text-[11px]', !trip.positionAt ? MUTED : stale ? 'text-amber-400' : 'text-green-400')}>
              {trip.positionAt ? `GPS ${formatAgo(trip.positionAt, now)}` : 'No GPS yet'}
            </span>
          )}
        </div>

        <p className={cn('mb-2.5 mt-[18px] text-[10.5px] font-semibold uppercase tracking-[0.05em]', MUTED)}>Trip timeline</p>
        <div className="flex flex-col">
          {timeline.map((s, i) => (
            <div key={s.label} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <span className={cn('h-[9px] w-[9px] rounded-full', on[i] ? 'bg-green-500' : 'bg-white/[0.14]')} />
                {i < timeline.length - 1 && <span className={cn('min-h-5 w-0.5 flex-1', on[i + 1] ? 'bg-green-500' : 'bg-white/[0.14]')} />}
              </div>
              <div className={i < timeline.length - 1 ? 'pb-3.5' : ''}>
                <p className="text-xs font-semibold text-white">{s.label}</p>
                <p className={cn('mt-px font-mono text-[11px]', MUTED)}>{formatStepTime(s.at, now)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={cn('mt-[18px] rounded-[10px] border bg-white/[0.04] p-3 text-center', LINE)}>
          <p className={cn('text-[10px] font-semibold uppercase tracking-[0.05em]', MUTED)}>Elapsed trip time</p>
          <p className="mt-1 font-mono text-[22px] font-bold text-white">{tripDuration(trip, now)}</p>
        </div>

        <div className="mt-3.5 flex flex-col gap-2 text-[11.5px]">
          {[
            ['Customer', trip.customerName ?? '—'],
            ['Site', trip.jobSite ?? '—'],
            ['Grade · Qty', `${trip.gradeName ?? '—'} · ${formatQty(trip.qty)} cum`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><span className={MUTED}>{k}</span><span className="text-right">{v}</span></div>
          ))}
          <div className="flex justify-between gap-3">
            <span className={MUTED}>Challan</span>
            <Link to={`/sales/challans/${trip.id}/edit`} className="font-mono text-[11px] text-accent-soft hover:underline">{trip.challanNo}</Link>
          </div>
        </div>
      </aside>
    </>
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
  const open = counts.ON_ROAD + counts.AT_SITE
  const onMap = trips.filter(t => t.position).length
  const noGps = trips.filter(t => t.status !== 'RETURNED' && !t.position).length
  const staleCount = trips.filter(t => t.status !== 'RETURNED' && t.position && isStale(t, now)).length

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return trips.filter(t =>
      (filter === 'ALL' || t.status === filter) &&
      (!q || [t.vehicleNo, t.driverName, t.customerName, t.jobSite, t.challanNo].some(v => v?.toLowerCase().includes(q))))
  }, [trips, filter, search])
  const selected = trips.find(t => t.id === selectedId) ?? null
  // Keeps the drawer mounted while it slides closed.
  const drawer = usePresence(selected)

  const isLoading = live.isLoading || challans.isLoading
  const bothFailed = live.isError && challans.isError
  const connectionTrouble = live.isError || challans.isError
  const lastUpdate = Math.max(live.dataUpdatedAt, challans.dataUpdatedAt)

  const select = (trip: Trip) => {
    setSelectedId(trip.id)
    if (trip.position) mapCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <div className="text-[#F5F6F8]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Live Tracking</h1>
          <p className={cn('mt-1 text-xs', MUTED)}>GPS vehicles, dispatch progress and site status</p>
        </div>
        <span
          className={cn('inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] font-medium',
            connectionTrouble ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-green-500/30 bg-green-500/10 text-green-400')}
        >
          <span className={cn('h-[7px] w-[7px] rounded-full', connectionTrouble ? 'bg-amber-500' : 'animate-soft-pulse bg-green-500')} />
          {connectionTrouble ? <>Connection problem<span className="hidden sm:inline"> — retrying</span></>
            : lastUpdate ? <>Updates every 10 seconds<span className="hidden sm:inline"> · {new Date(lastUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase()}</span></>
            : 'Connecting…'}
        </span>
      </div>

      {bothFailed && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-600/35 bg-red-600/10 px-3 py-2 text-xs text-red-300">
          <AlertTriangle size={14} /> Couldn't load tracking data. Check your connection — this page keeps retrying.
        </div>
      )}

      <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="On the road" value={counts.ON_ROAD} color="#F59E0B" />
        <StatTile label="At site" value={counts.AT_SITE} color="#22C55E" />
        <StatTile label="Returned today" value={counts.RETURNED} color="#8B93A3" />
        <StatTile label="No recent GPS" value={staleCount + noGps} color="#EF4444" alert={staleCount + noGps > 0} />
      </div>

      {/* Map */}
      <div ref={mapCardRef} className={cn('relative isolate mb-3.5 overflow-hidden rounded-xl border bg-command-map', LINE)}>
        <TrackingMap
          trips={trips}
          plant={plant}
          selectedId={selectedId}
          onSelect={id => setSelectedId(id)}
          now={now}
          fitSignal={fitSignal}
          className="trk-dark h-[300px] w-full sm:h-[360px]"
        />
        <button
          onClick={() => setFitSignal(n => n + 1)}
          className={cn('absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg border bg-[rgba(20,22,27,.9)] px-[11px] py-1.5 text-[11.5px] font-medium text-[#F5F6F8] transition-colors hover:bg-white/10', LINE)}
        >
          <Crosshair size={13} /> Fit all
        </button>
        <div className={cn('absolute bottom-6 left-3 z-[1000] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-[rgba(20,22,27,.9)] px-[11px] py-1.5 text-[10.5px]', LINE, MUTED)}>
          {[['On road', TRIP_COLORS.ON_ROAD], ['At site', TRIP_COLORS.AT_SITE], ['No recent signal', TRIP_COLORS.STALE]].map(([label, color]) => (
            <span key={label} className="flex items-center gap-[5px]"><span className="h-[9px] w-[9px] rounded-full" style={{ background: color }} />{label}</span>
          ))}
        </div>
        {!isLoading && onMap === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center p-4">
            <div className={cn('max-w-sm rounded-xl border bg-[rgba(16,18,22,.94)] px-5 py-4 text-center shadow-md', LINE)}>
              <MapPinOff size={20} className={cn('mx-auto mb-1.5', MUTED)} />
              <p className="text-sm font-medium text-white">{open > 0 ? 'No live GPS positions yet' : 'No trucks on the road right now'}</p>
              <p className={cn('mt-0.5 text-xs', MUTED)}>
                {open > 0
                  ? `${open} ${open === 1 ? 'truck is' : 'trucks are'} dispatched, but the driver app hasn't reported a location. They'll appear here as soon as it does.`
                  : 'Trucks appear on the map once they are dispatched and the driver app is sending its location.'}
              </p>
            </div>
          </div>
        )}
      </div>
      {noGps > 0 && onMap > 0 && (
        <p className="-mt-1.5 mb-3.5 flex items-center gap-1.5 text-xs text-amber-400">
          <MapPinOff size={13} /> {noGps} dispatched {noGps === 1 ? 'truck isn\'t' : 'trucks aren\'t'} sharing a GPS location yet — listed below, but not on the map.
        </p>
      )}

      {/* Dispatch status */}
      <div className={cn('overflow-hidden rounded-xl border', LINE, SURFACE)}>
        <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b px-3.5 py-2.5', LINE)}>
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by status">
            {FILTERS.map(f => (
              <button
                key={f.value}
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-full border px-[13px] py-1.5 text-[11.5px] font-medium transition-colors',
                  filter === f.value ? 'border-accent bg-accent text-white' : cn('bg-white/5 hover:bg-white/10', LINE, MUTED),
                )}
              >
                {f.label} {counts[f.value]}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={12} className={cn('pointer-events-none absolute left-[9px] top-1/2 -translate-y-1/2', MUTED)} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Truck, driver, customer, site…"
              aria-label="Search trips"
              className={cn('h-[30px] w-[210px] rounded-lg border bg-white/[0.04] pl-7 pr-2 text-[11.5px] text-[#F5F6F8] outline-none placeholder:text-[#8B93A3] focus:border-accent', LINE)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/[0.03]">
                {['Truck', 'Customer / Site', 'Status', 'Progress', 'Elapsed'].map(h => (
                  <th key={h} className={cn('whitespace-nowrap px-3.5 py-2 text-left text-[10px] font-semibold uppercase', MUTED)}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className={cn('px-4 py-10 text-center text-xs', MUTED)}>Loading trips…</td></tr>
              )}
              {!isLoading && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className={cn('px-4 py-10 text-center text-xs', MUTED)}>
                    {trips.length === 0 ? 'No trucks have been dispatched today.' : 'No trips match this filter.'}
                  </td>
                </tr>
              )}
              {visible.map(t => {
                const stale = isStale(t, now)
                const isSel = t.id === selectedId
                return (
                  <tr
                    key={t.id}
                    tabIndex={0}
                    aria-selected={isSel}
                    onClick={() => select(t)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(t) } }}
                    className={cn(
                      'cursor-pointer border-b outline-none transition-colors duration-150 last:border-0 focus-visible:bg-white/[0.04]',
                      LINE,
                      isSel ? 'bg-accent/[0.08]' : 'hover:bg-white/[0.04]',
                    )}
                  >
                    <td className="whitespace-nowrap px-3.5 py-2.5">
                      <div className="flex items-center gap-[7px]">
                        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] bg-accent/[0.16]"><Truck size={11} className="text-accent-soft" /></span>
                        <div>
                          <p className="font-mono text-[11.5px] font-semibold text-white">{t.vehicleNo}</p>
                          <p className={cn('text-[10.5px]', MUTED)}>{t.driverName ?? 'No driver'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5">
                      <p className="max-w-[240px] truncate text-[11.5px]">{t.customerName ?? '—'}</p>
                      <p className={cn('max-w-[240px] truncate text-[10.5px]', MUTED)}>{t.jobSite ?? '—'} · <span className="font-mono">{t.challanNo}</span></p>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2.5">
                      <span className={cn('rounded-full px-[9px] py-[3px] text-[10px] font-semibold', STATUS_META[t.status].badge)}>{STATUS_META[t.status].label}</span>
                      {t.status !== 'RETURNED' && (
                        <p className={cn('mt-1 text-[10.5px]', !t.positionAt ? MUTED : stale ? 'text-amber-400' : 'text-green-400')}>
                          {t.positionAt ? `GPS ${formatAgo(t.positionAt, now)}` : 'No GPS yet'}
                        </p>
                      )}
                    </td>
                    <td className="px-2.5 py-2.5"><TripProgress trip={t} /></td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-[11.5px] text-[#AEB4BF]">
                      {tripDuration(t, now)}{t.status !== 'RETURNED' && <span className={cn('ml-1 font-sans text-[10.5px]', MUTED)}>so far</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className={cn('border-t bg-white/[0.02] px-3.5 py-2 text-[11px]', LINE, MUTED)}>
          Trip time runs from dispatch to return. “Returned” is when the driver marks the trip finished (site-out); arrival back at the plant isn’t recorded yet.
        </p>
      </div>

      {drawer.item && <TripDrawer trip={drawer.item} now={now} leaving={drawer.leaving} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
