// Live-tracking data model. Two endpoints feed the Live Tracking screen:
//   GET /sales/challans  — every dispatch with its status + dispatch/site-in/site-out times
//   GET /fleet/live      — last-known driver position for each trip still on the road
// They're merged here into one Trip per dispatch.
//
// About "return time": the backend records three timestamps per trip —
// dispatch_time, site_in (truck arrived) and site_out (driver marked the trip
// finished / left the site). It does NOT record the truck arriving back at the
// plant, so site_out is the trip's end ("Returned" in the UI).

export type TripStatus = 'ON_ROAD' | 'AT_SITE' | 'RETURNED'

export interface ChallanRow {
  id: string
  challan_no: string
  job_site: string | null
  grade_name: string | null
  qty: string | number
  dispatch_time: string
  status: string
  site_in: string | null
  site_out: string | null
  job_site_lat: string | number | null
  job_site_lng: string | number | null
  customer_name: string | null
  vehicle_no: string | null
  driver_name: string | null
}

export interface LiveRow {
  id: string
  challanNo: string
  jobSite: string | null
  gradeName: string | null
  qty: string | number
  dispatchTime: string
  siteIn: string | null
  jobSiteLat: string | number | null
  jobSiteLng: string | number | null
  driverLat: string | number | null
  driverLng: string | number | null
  driverLocationAt: string | null
  customerName: string | null
  vehicleNo: string | null
  driverName: string | null
}

export interface Trip {
  id: string
  challanNo: string
  vehicleNo: string
  driverName: string | null
  customerName: string | null
  jobSite: string | null
  gradeName: string | null
  qty: number
  status: TripStatus
  dispatchedAt: Date
  arrivedAt: Date | null
  returnedAt: Date | null
  /** Last-known truck position — null until the driver app has reported one. */
  position: { lat: number; lng: number } | null
  positionAt: Date | null
  destination: { lat: number; lng: number } | null
}

/** A position older than this on a trip that's still open is shown as "no recent signal". */
export const STALE_GPS_MS = 5 * 60_000

const num = (v: string | number | null | undefined) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const point = (lat: string | number | null | undefined, lng: string | number | null | undefined) => {
  const la = num(lat), lo = num(lng)
  return la != null && lo != null ? { lat: la, lng: lo } : null
}
const date = (v: string | null | undefined) => (v ? new Date(v) : null)

export function statusOf(siteIn: unknown, siteOut: unknown): TripStatus {
  return siteOut ? 'RETURNED' : siteIn ? 'AT_SITE' : 'ON_ROAD'
}

const RANK: Record<TripStatus, number> = { ON_ROAD: 0, AT_SITE: 1, RETURNED: 2 }

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * One Trip per dispatched challan that is either dispatched today or still open.
 *
 * Only ACTIVE challans count as dispatched: /fleet/live also returns DRAFT and
 * cancelled challans that simply have no site_out yet, so the challan list is
 * the source of truth for "did this truck really leave", and /fleet/live only
 * contributes positions. If the challan list isn't available to this user
 * (no sales module access), fall back to the live rows alone.
 */
export function buildTrips(challans: ChallanRow[] | undefined, live: LiveRow[] | undefined, now: Date): Trip[] {
  const liveById = new Map((live ?? []).map(l => [l.id, l]))
  const today = startOfDay(now).getTime()

  let trips: Trip[]
  if (challans) {
    trips = challans
      .filter(c => c.status === 'ACTIVE' && (!c.site_out || new Date(c.dispatch_time).getTime() >= today))
      .map(c => {
        const l = liveById.get(c.id)
        const open = !c.site_out
        return {
          id: c.id,
          challanNo: c.challan_no,
          vehicleNo: c.vehicle_no ?? '—',
          driverName: c.driver_name,
          customerName: c.customer_name,
          jobSite: c.job_site,
          gradeName: c.grade_name,
          qty: num(c.qty) ?? 0,
          status: statusOf(c.site_in, c.site_out),
          dispatchedAt: new Date(c.dispatch_time),
          arrivedAt: date(c.site_in),
          returnedAt: date(c.site_out),
          // A position only means something while the trip is open — the backend
          // stops reporting it at site-out, so never plot a finished trip.
          position: open ? point(l?.driverLat, l?.driverLng) : null,
          positionAt: open ? date(l?.driverLocationAt) : null,
          destination: open ? point(l?.jobSiteLat ?? c.job_site_lat, l?.jobSiteLng ?? c.job_site_lng) : null,
        }
      })
  } else {
    trips = (live ?? []).map(l => ({
      id: l.id,
      challanNo: l.challanNo,
      vehicleNo: l.vehicleNo ?? '—',
      driverName: l.driverName,
      customerName: l.customerName,
      jobSite: l.jobSite,
      gradeName: l.gradeName,
      qty: num(l.qty) ?? 0,
      status: statusOf(l.siteIn, null),
      dispatchedAt: new Date(l.dispatchTime),
      arrivedAt: date(l.siteIn),
      returnedAt: null,
      position: point(l.driverLat, l.driverLng),
      positionAt: date(l.driverLocationAt),
      destination: point(l.jobSiteLat, l.jobSiteLng),
    }))
  }

  return trips.sort((a, b) => RANK[a.status] - RANK[b.status] || b.dispatchedAt.getTime() - a.dispatchedAt.getTime())
}

/** True when an open trip has a position but hasn't reported in a while. */
export function isStale(trip: Trip, now: Date) {
  return trip.status !== 'RETURNED' && !!trip.positionAt && now.getTime() - trip.positionAt.getTime() > STALE_GPS_MS
}

/** 75 min -> "1h 15m"; under a minute -> "<1m". */
export function formatDuration(ms: number) {
  const mins = Math.floor(Math.max(0, ms) / 60_000)
  if (mins < 1) return '<1m'
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

/** Trip length: dispatch -> return, or elapsed-so-far for a trip that's still open. */
export function tripDuration(trip: Trip, now: Date) {
  return formatDuration((trip.returnedAt ?? now).getTime() - trip.dispatchedAt.getTime())
}

/** "10:32 AM" for today, "20 Sep, 10:32 AM" for another day, "—" when the step hasn't happened. */
export function formatStepTime(d: Date | null, now: Date) {
  if (!d) return '—'
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
  return startOfDay(d).getTime() === startOfDay(now).getTime()
    ? time
    : `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${time}`
}

/** "just now", "3 min ago", "2h 05m ago". */
export function formatAgo(d: Date, now: Date) {
  const s = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min ago` : `${formatDuration(s * 1000)} ago`
}
