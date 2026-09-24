import { useEffect, useId, useRef, useState } from 'react'
import { loadMappls } from '@/lib/loadMappls'
import { isStale, type Trip } from '@/lib/tracking'
import { TRIP_COLORS, type TrackingMapProps } from './TrackingMap'

// Live Tracking on a Mappls (MapmyIndia) vector map. Same contract and
// behaviour as the Leaflet map in TrackingMap.tsx: markers are created once
// and updated in place on every poll, clicking one selects its trip,
// selecting a trip flies to it, and "Fit all" frames every truck.
// Markers reuse the .trk-* styles from index.css via the SDK's `html` option.
// If the SDK can't load, `onUnavailable` hands control back to the Leaflet map.

const DEFAULT_CENTER = { lat: 22.5, lng: 79 } // India, until there's something to centre on
const DEFAULT_ZOOM = 5

// lucide "truck", "factory" and "map-pin" glyphs — static strings.
const TRUCK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>'
const FACTORY_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>'
const PIN_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'

// Vehicle numbers, names and sites are user data going into an HTML string.
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function badgeHtml(svg: string, color: string, label: string, opts: { kind: string; selected?: boolean; pulse?: boolean }) {
  return `<div class="trk-marker trk-${opts.kind}${opts.selected ? ' is-selected' : ''}">`
    + (opts.pulse ? `<span class="trk-pulse" style="background:${color}"></span>` : '')
    + `<span class="trk-badge" style="background:${color}">${svg}</span>`
    + `<span class="trk-label">${esc(label)}</span></div>`
}

function popupHtml(trip: Trip, stale: boolean) {
  const color = stale ? TRIP_COLORS.STALE : trip.status === 'AT_SITE' ? TRIP_COLORS.AT_SITE : TRIP_COLORS.ON_ROAD
  const line = (text: string, style = '') => `<div style="${style}">${esc(text)}</div>`
  return `<div style="min-width:170px;font:12px/1.45 Inter,system-ui,sans-serif;color:#0F172A">`
    + line(trip.vehicleNo, 'font:600 13px "JetBrains Mono",monospace')
    + (trip.driverName ? line(trip.driverName, 'color:#6B7280') : '')
    + line(trip.customerName ?? '—', 'margin-top:4px;font-weight:500')
    + (trip.jobSite ? line(trip.jobSite, 'color:#6B7280') : '')
    + line(stale ? 'No recent GPS signal' : trip.status === 'AT_SITE' ? 'At site' : 'On the road', `margin-top:4px;font-weight:600;color:${color}`)
    + '</div>'
}

interface Entry { marker: any; key: string }

export default function MapplsTrackingMap({ trips, plant, selectedId, onSelect, now, fitSignal, className, onUnavailable }: TrackingMapProps & { onUnavailable: () => void }) {
  const containerId = `mappls-${useId().replace(/:/g, '')}`
  const containerRef = useRef<HTMLDivElement>(null)
  const sdkRef = useRef<any>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef(new Map<string, Entry>())
  const plantRef = useRef<Entry | null>(null)
  const siteRef = useRef<Entry | null>(null)
  const didFitRef = useRef(false)
  const didCenterPlantRef = useRef(false)
  const [ready, setReady] = useState(false)
  const latest = useRef({ trips, onSelect, plant, onUnavailable })
  latest.current = { trips, onSelect, plant, onUnavailable }

  const removeMarker = (entry: Entry | null) => {
    if (!entry) return
    try { sdkRef.current?.remove({ map: mapRef.current, layer: entry.marker }) } catch { entry.marker?.remove?.() }
  }

  const addMarker = (position: { lat: number; lng: number }, html: string, extra: Record<string, unknown> = {}) =>
    new sdkRef.current.Marker({ map: mapRef.current, position, html, width: 36, height: 36, offset: [0, 0], ...extra })

  const fitAll = () => {
    const map = mapRef.current
    if (!map) return
    const points = latest.current.trips.flatMap(t => (t.position ? [t.position] : []))
    if (latest.current.plant) points.push(latest.current.plant)
    try {
      if (!points.length) { map.setCenter(DEFAULT_CENTER); map.setZoom(DEFAULT_ZOOM); return }
      const lats = points.map(p => p.lat), lngs = points.map(p => p.lng)
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 56, maxZoom: 14 })
    } catch {
      // Older SDK builds without fitBounds: centre on the first point instead.
      const p = points[0] ?? DEFAULT_CENTER
      map.setCenter?.({ lat: p.lat, lng: p.lng }); map.setZoom?.(points.length ? 11 : DEFAULT_ZOOM)
    }
  }

  // Load the SDK and create the map once.
  useEffect(() => {
    let cancelled = false
    let ro: ResizeObserver | null = null
    const markers = markersRef.current
    loadMappls().then(sdk => {
      if (cancelled) return
      if (!sdk) { latest.current.onUnavailable(); return }
      try {
        sdkRef.current = sdk
        const map = new sdk.Map(containerId, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, zoomControl: true })
        mapRef.current = map
        if (typeof map.on === 'function') map.on('load', () => !cancelled && setReady(true))
        else setReady(true)
        if (containerRef.current) {
          ro = new ResizeObserver(() => map.resize?.())
          ro.observe(containerRef.current)
        }
      } catch {
        latest.current.onUnavailable()
      }
    })
    return () => {
      cancelled = true
      ro?.disconnect()
      try { mapRef.current?.remove?.() } catch { /* already gone */ }
      mapRef.current = null
      markers.clear()
      plantRef.current = null
      siteRef.current = null
      didFitRef.current = false
      didCenterPlantRef.current = false
    }
  }, [containerId])

  // Sync trucks, plant and the selected trip's job site.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return

    // Plant
    if (plant) {
      const key = `${plant.lat},${plant.lng},${plant.name}`
      if (plantRef.current?.key !== key) {
        removeMarker(plantRef.current)
        plantRef.current = { key, marker: addMarker({ lat: plant.lat, lng: plant.lng }, badgeHtml(FACTORY_SVG, '#111318', plant.name, { kind: 'plant' })) }
      }
    } else if (plantRef.current) { removeMarker(plantRef.current); plantRef.current = null }

    // Trucks — a marker is rebuilt only when its look changes; otherwise it just moves.
    const live = new Set<string>()
    for (const trip of trips) {
      if (!trip.position) continue
      live.add(trip.id)
      const stale = isStale(trip, now)
      const selected = trip.id === selectedId
      const key = `${trip.status}|${stale}|${selected}|${trip.vehicleNo}|${trip.customerName}|${trip.jobSite}`
      const color = stale ? TRIP_COLORS.STALE : trip.status === 'AT_SITE' ? TRIP_COLORS.AT_SITE : TRIP_COLORS.ON_ROAD
      const existing = markersRef.current.get(trip.id)
      if (existing && existing.key === key) {
        existing.marker.setPosition?.({ lat: trip.position.lat, lng: trip.position.lng })
        continue
      }
      removeMarker(existing ?? null)
      const marker = addMarker(
        { lat: trip.position.lat, lng: trip.position.lng },
        badgeHtml(TRUCK_SVG, color, trip.vehicleNo, { kind: 'truck', selected, pulse: trip.status === 'ON_ROAD' && !stale }),
        { popupHtml: popupHtml(trip, stale), popupOptions: { openPopup: false, autoClose: true, maxWidth: 260 } },
      )
      marker.addListener?.('click', () => latest.current.onSelect(trip.id))
      markersRef.current.set(trip.id, { marker, key })
    }
    for (const [id, entry] of markersRef.current) {
      if (!live.has(id)) { removeMarker(entry); markersRef.current.delete(id) }
    }

    // Selected trip's destination.
    const sel = trips.find(t => t.id === selectedId)
    const siteKey = sel?.destination ? `${sel.id}|${sel.destination.lat},${sel.destination.lng}` : null
    if (siteRef.current?.key !== siteKey) {
      removeMarker(siteRef.current)
      siteRef.current = sel?.destination && siteKey
        ? { key: siteKey, marker: addMarker(sel.destination, badgeHtml(PIN_SVG, '#2563EB', sel.jobSite ?? 'Job site', { kind: 'site' })) }
        : null
    }

    // Camera: frame everything once the first truck appears (later polls must not
    // yank the view away from wherever the user has panned).
    if (!didFitRef.current && live.size > 0) { fitAll(); didFitRef.current = true }
    else if (!didFitRef.current && plant && !didCenterPlantRef.current) {
      map.setCenter?.({ lat: plant.lat, lng: plant.lng }); map.setZoom?.(11); didCenterPlantRef.current = true
    }
  }, [ready, trips, plant, selectedId, now])

  // Selecting a trip (row or marker) flies to it.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !selectedId) return
    const trip = latest.current.trips.find(t => t.id === selectedId)
    if (!trip?.position) return
    const zoom = Math.max(map.getZoom?.() ?? 0, 13)
    try { map.flyTo({ center: [trip.position.lng, trip.position.lat], zoom, duration: 600 }) }
    catch { map.setCenter?.({ lat: trip.position.lat, lng: trip.position.lng }); map.setZoom?.(zoom) }
  }, [ready, selectedId])

  // "Fit all" button.
  useEffect(() => { if (ready && fitSignal > 0) fitAll() }, [ready, fitSignal])

  return <div id={containerId} ref={containerRef} className={className} role="region" aria-label="Live truck map (Mappls)" />
}
