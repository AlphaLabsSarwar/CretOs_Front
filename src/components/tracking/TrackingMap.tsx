import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatAgo, isStale, type Trip } from '@/lib/tracking'
import { MAPPLS_KEY } from '@/lib/loadMappls'

// Mappls (MapmyIndia) is the primary map when VITE_MAPPLS_KEY is set; its
// component (and SDK) is only downloaded in that case.
const MapplsTrackingMap = lazy(() => import('./MapplsTrackingMap'))

export interface Plant { name: string; lat: number; lng: number }

// OpenStreetMap's public tiles need no API key, which keeps this working out of
// the box. They're meant for light use — for heavy production traffic point
// VITE_MAP_TILE_URL at a tile provider (Stadia, MapTiler, self-hosted, ...).
const TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined) ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
const DEFAULT_CENTER: L.LatLngTuple = [22.5, 79] // India, until there's something to centre on
const DEFAULT_ZOOM = 5

export const TRIP_COLORS = { ON_ROAD: '#E8630A', AT_SITE: '#16A34A', STALE: '#6B7280' } as const

// lucide "truck" and "factory" glyphs — static strings, no user data goes near innerHTML.
const TRUCK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>'
const FACTORY_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>'

function element(tag: string, opts: { text?: string; className?: string; style?: string; html?: string } = {}) {
  const el = document.createElement(tag)
  if (opts.className) el.className = opts.className
  if (opts.style) el.style.cssText = opts.style
  if (opts.html) el.innerHTML = opts.html // only ever the static SVG constants above
  if (opts.text != null) el.textContent = opts.text
  return el
}

function badgeIcon(svg: string, color: string, label: string, opts: { selected?: boolean; pulse?: boolean; kind: string }) {
  const root = element('div', { className: `trk-marker trk-${opts.kind}${opts.selected ? ' is-selected' : ''}` })
  if (opts.pulse) root.appendChild(element('span', { className: 'trk-pulse', style: `background:${color}` }))
  root.appendChild(element('span', { className: 'trk-badge', style: `background:${color}`, html: svg }))
  root.appendChild(element('span', { className: 'trk-label', text: label }))
  return L.divIcon({ html: root, className: 'trk-icon', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20] })
}

function popupContent(trip: Trip, stale: boolean, now: Date) {
  const root = element('div', { style: 'min-width:170px;font:12px/1.45 Inter,system-ui,sans-serif' })
  root.appendChild(element('div', { text: trip.vehicleNo, style: 'font:600 13px "JetBrains Mono",monospace' }))
  if (trip.driverName) root.appendChild(element('div', { text: trip.driverName, style: 'color:#6B7280' }))
  root.appendChild(element('div', { text: trip.customerName ?? '—', style: 'margin-top:4px;font-weight:500' }))
  if (trip.jobSite) root.appendChild(element('div', { text: trip.jobSite, style: 'color:#6B7280' }))
  const state = trip.status === 'AT_SITE' ? 'At site' : 'On the road'
  root.appendChild(element('div', { text: state + (trip.positionAt ? ` · GPS ${formatAgo(trip.positionAt, now)}` : ''), style: `margin-top:4px;font-weight:600;color:${stale ? TRIP_COLORS.STALE : trip.status === 'AT_SITE' ? TRIP_COLORS.AT_SITE : TRIP_COLORS.ON_ROAD}` }))
  return root
}

interface MarkerEntry { marker: L.Marker; key: string; raf?: number }

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Slides a truck to its newly reported position instead of teleporting it, so
// each 10-second poll reads as movement. Cancels any glide still in flight.
function glide(entry: MarkerEntry, to: L.LatLngTuple) {
  const from = entry.marker.getLatLng()
  if (from.lat === to[0] && from.lng === to[1]) return
  if (entry.raf) cancelAnimationFrame(entry.raf)
  if (reducedMotion()) { entry.marker.setLatLng(to); return }
  const start = performance.now(), DURATION = 900
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / DURATION), ease = 1 - Math.pow(1 - k, 3)
    entry.marker.setLatLng([from.lat + (to[0] - from.lat) * ease, from.lng + (to[1] - from.lng) * ease])
    entry.raf = k < 1 ? requestAnimationFrame(step) : undefined
  }
  entry.raf = requestAnimationFrame(step)
}

export interface TrackingMapProps {
  trips: Trip[]
  plant: Plant | null
  selectedId: string | null
  onSelect: (id: string) => void
  now: Date
  /** Bump to re-fit the view around every truck (the "Fit all" button). */
  fitSignal: number
  className?: string
}

// Leaflet is driven imperatively: the map and its markers are created once and
// then updated in place on every poll (a marker just slides to its new
// position) instead of being torn down and rebuilt — otherwise the view would
// flicker and reset every 10 seconds.
/** Mappls when a key is configured and its SDK loads; otherwise the OpenStreetMap (Leaflet) map below. */
export default function TrackingMap(props: TrackingMapProps) {
  const [mapplsFailed, setMapplsFailed] = useState(false)
  if (!MAPPLS_KEY || mapplsFailed) return <LeafletTrackingMap {...props} />
  return (
    <Suspense fallback={<div className={props.className} />}>
      <MapplsTrackingMap {...props} onUnavailable={() => setMapplsFailed(true)} />
    </Suspense>
  )
}

function LeafletTrackingMap({ trips, plant, selectedId, onSelect, now, fitSignal, className }: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef(new Map<string, MarkerEntry>())
  const plantRef = useRef<L.Marker | null>(null)
  const routeRef = useRef<L.LayerGroup | null>(null)
  const didFitRef = useRef(false)
  const didCenterPlantRef = useRef(false)
  // Latest props for handlers created once (marker click, camera effects).
  const latest = useRef({ trips, onSelect, plant })
  latest.current = { trips, onSelect, plant }

  const fitAll = () => {
    const map = mapRef.current
    if (!map) return
    const points: L.LatLngTuple[] = latest.current.trips.flatMap(t => (t.position ? [[t.position.lat, t.position.lng] as L.LatLngTuple] : []))
    const p = latest.current.plant
    if (p) points.push([p.lat, p.lng])
    if (!points.length) { map.setView(DEFAULT_CENTER, DEFAULT_ZOOM); return }
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 14 })
  }

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const map = L.map(el, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    routeRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    // The container's size changes with the page layout; Leaflet needs telling.
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    const markers = markersRef.current
    return () => {
      ro.disconnect()
      markers.forEach(e => e.raf && cancelAnimationFrame(e.raf))
      map.remove()
      mapRef.current = null
      plantRef.current = null
      routeRef.current = null
      markers.clear()
      didFitRef.current = false
      didCenterPlantRef.current = false
    }
  }, [])

  // Sync trucks, plant and the selected trip's route.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Plant
    if (plant) {
      const icon = badgeIcon(FACTORY_SVG, '#111318', plant.name, { kind: 'plant' })
      if (!plantRef.current) plantRef.current = L.marker([plant.lat, plant.lng], { icon, zIndexOffset: -500, keyboard: false }).addTo(map)
      else { plantRef.current.setLatLng([plant.lat, plant.lng]); plantRef.current.setIcon(icon) }
    } else if (plantRef.current) { plantRef.current.remove(); plantRef.current = null }

    // Trucks
    const live = new Set<string>()
    for (const trip of trips) {
      if (!trip.position) continue
      live.add(trip.id)
      const stale = isStale(trip, now)
      const selected = trip.id === selectedId
      const key = `${trip.status}|${stale}|${selected}|${trip.vehicleNo}`
      const latLng: L.LatLngTuple = [trip.position.lat, trip.position.lng]
      const color = stale ? TRIP_COLORS.STALE : trip.status === 'AT_SITE' ? TRIP_COLORS.AT_SITE : TRIP_COLORS.ON_ROAD
      const icon = () => badgeIcon(TRUCK_SVG, color, trip.vehicleNo, { kind: 'truck', selected, pulse: trip.status === 'ON_ROAD' && !stale })

      const existing = markersRef.current.get(trip.id)
      if (!existing) {
        const marker = L.marker(latLng, { icon: icon(), zIndexOffset: selected ? 1000 : 0, riseOnHover: true })
          .bindPopup(popupContent(trip, stale, now), { closeButton: false, offset: [0, -4] })
          .on('click', () => latest.current.onSelect(trip.id))
          .addTo(map)
        markersRef.current.set(trip.id, { marker, key })
      } else {
        glide(existing, latLng)
        existing.marker.setPopupContent(popupContent(trip, stale, now))
        if (existing.key !== key) {
          existing.marker.setIcon(icon())
          existing.marker.setZIndexOffset(selected ? 1000 : 0)
          existing.key = key
        }
      }
    }
    for (const [id, entry] of markersRef.current) {
      if (!live.has(id)) {
        if (entry.raf) cancelAnimationFrame(entry.raf)
        entry.marker.remove()
        markersRef.current.delete(id)
      }
    }

    // Selected trip: dashed line from the truck to its job site.
    routeRef.current?.clearLayers()
    const sel = trips.find(t => t.id === selectedId)
    if (sel?.destination) {
      routeRef.current?.addLayer(L.marker([sel.destination.lat, sel.destination.lng], {
        icon: badgeIcon('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>', '#2563EB', sel.jobSite ?? 'Job site', { kind: 'site' }),
        interactive: false, keyboard: false,
      }))
      if (sel.position) {
        routeRef.current?.addLayer(L.polyline([[sel.position.lat, sel.position.lng], [sel.destination.lat, sel.destination.lng]], { color: '#2563EB', weight: 2.5, opacity: 0.7, dashArray: '6 8' }))
      }
    }

    // Camera: frame everything once the first truck appears (later polls must not
    // yank the view away from wherever the user has panned); until then, if there's
    // only the plant, centre on it.
    if (!didFitRef.current && live.size > 0) { fitAll(); didFitRef.current = true }
    else if (!didFitRef.current && plant && !didCenterPlantRef.current) { map.setView([plant.lat, plant.lng], 11); didCenterPlantRef.current = true }
  }, [trips, plant, selectedId, now])

  // Selecting a trip (row click or marker click) flies to it and opens its card.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const trip = latest.current.trips.find(t => t.id === selectedId)
    const entry = markersRef.current.get(selectedId)
    if (!trip?.position || !entry) return
    map.flyTo([trip.position.lat, trip.position.lng], Math.max(map.getZoom(), 13), { duration: 0.6 })
    entry.marker.openPopup()
  }, [selectedId])

  // "Fit all" button.
  useEffect(() => { if (fitSignal > 0) fitAll() }, [fitSignal])

  return <div ref={containerRef} className={className} role="region" aria-label="Live truck map" />
}
