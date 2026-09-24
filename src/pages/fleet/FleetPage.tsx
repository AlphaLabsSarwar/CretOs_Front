import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Container, Fuel, Loader2, Plus, Search, Truck, Wrench, X } from 'lucide-react'
import { SkeletonRow } from '@/components/shared/DataTable'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import { cn, formatDate, formatINR } from '@/lib/utils'
import { authStore } from '@/store/auth'
import { usePresence } from '@/lib/usePresence'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MaintenanceForecastPanel from './MaintenanceForecastPanel'

interface LookupVehicle { id: string; vehicle_no: string }
interface MaintenanceRow { id: string; vehicle_id: string; vehicle_no: string; service_type: string; service_date: string; odometer: number | null; cost: number | null; vendor_name: string | null; next_due_date: string | null }
interface FuelRow { id: string; vehicle_id: string; vehicle_no: string; fill_date: string; odometer: number | null; litres: number; rate: number | null; amount: number | null; filled_by: string | null }

function useVehicles() {
  return useQuery({
    queryKey: ['vehicles-lookup-fleet'],
    queryFn: () => api.get('/masters/vehicles', { params: { limit: 200, is_active: true } }).then(r => r.data.data.data as LookupVehicle[]),
    staleTime: 5 * 60_000,
  })
}

function MaintenanceTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: vehicles } = useVehicles()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ vehicle_id: '', service_type: '', service_date: new Date().toISOString().slice(0, 10), odometer: '', cost: '', vendor_name: '', next_due_date: '', remarks: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-maintenance'],
    queryFn: () => api.get('/fleet/maintenance', { params: { limit: 50 } }).then(r => r.data.data.data as MaintenanceRow[]),
  })

  const add = useMutation({
    mutationFn: () => api.post('/fleet/maintenance', {
      ...form,
      odometer: form.odometer || undefined,
      cost: form.cost || undefined,
      next_due_date: form.next_due_date || undefined,
    }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Service record added' })
      setOpen(false)
      setForm({ vehicle_id: '', service_type: '', service_date: new Date().toISOString().slice(0, 10), odometer: '', cost: '', vendor_name: '', next_due_date: '', remarks: '' })
      queryClient.invalidateQueries({ queryKey: ['fleet-maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-forecast'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not add record', description: e?.response?.data?.error }),
  })

  return (
    <div>
      <MaintenanceForecastPanel />

      <div className="mb-3 flex justify-end">
        <button onClick={() => setOpen(o => !o)} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
          <Plus size={13} /> Add Service Record
        </button>
      </div>

      {open && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Vehicle</label>
              <select value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))} className="h-9 w-40 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="">Select...</option>
                {(vehicles ?? []).map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Service Type</label>
              <input value={form.service_type} onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))} placeholder="e.g. Oil Change" className="h-9 w-40 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Service Date</label>
              <input type="date" value={form.service_date} onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))} className="h-9 w-36 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Odometer</label>
              <input type="number" value={form.odometer} onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))} className="h-9 w-28 rounded-lg border border-gray-300 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Cost (₹)</label>
              <input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} className="h-9 w-28 rounded-lg border border-gray-300 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Vendor</label>
              <input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} className="h-9 w-36 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Next Due</label>
              <input type="date" value={form.next_due_date} onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))} className="h-9 w-36 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <button
              disabled={!form.vehicle_id || !form.service_type || add.isPending}
              onClick={() => add.mutate()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {add.isPending && <Loader2 size={13} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="section-label px-4 py-2.5 text-left">Vehicle</th>
              <th className="section-label px-4 py-2.5 text-left">Service</th>
              <th className="section-label px-4 py-2.5 text-left">Date</th>
              <th className="section-label px-4 py-2.5 text-right">Odometer</th>
              <th className="section-label px-4 py-2.5 text-right">Cost</th>
              <th className="section-label px-4 py-2.5 text-left">Vendor</th>
              <th className="section-label px-4 py-2.5 text-left">Next Due</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
            ) : !data?.length ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">No service records yet</td></tr>
            ) : data.map((r, i) => (
              <tr key={r.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                <td className="px-4 py-2.5 font-mono text-xs">{r.vehicle_no}</td>
                <td className="px-4 py-2.5">{r.service_type}</td>
                <td className="px-4 py-2.5 text-xs">{formatDate(r.service_date)}</td>
                <td className="px-4 py-2.5 text-right table-num">{r.odometer ?? '—'}</td>
                <td className="px-4 py-2.5 text-right table-num">{r.cost ? `₹${formatINR(r.cost)}` : '—'}</td>
                <td className="px-4 py-2.5">{r.vendor_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs">{r.next_due_date ? formatDate(r.next_due_date) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FuelTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: vehicles } = useVehicles()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ vehicle_id: '', fill_date: new Date().toISOString().slice(0, 10), odometer: '', litres: '', rate: '', filled_by: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-fuel'],
    queryFn: () => api.get('/fleet/fuel', { params: { limit: 50 } }).then(r => r.data.data.data as FuelRow[]),
  })
  const { data: summary } = useQuery({
    queryKey: ['fleet-fuel-summary'],
    queryFn: () => api.get('/fleet/fuel/summary').then(r => r.data.data as { vehicleId: string; vehicleNo: string; litres: number; amount: number; fills: number }[]),
  })

  const add = useMutation({
    mutationFn: () => api.post('/fleet/fuel', { ...form, odometer: form.odometer || undefined, rate: form.rate || undefined }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Fuel entry added' })
      setOpen(false)
      setForm({ vehicle_id: '', fill_date: new Date().toISOString().slice(0, 10), odometer: '', litres: '', rate: '', filled_by: '' })
      queryClient.invalidateQueries({ queryKey: ['fleet-fuel'] })
      queryClient.invalidateQueries({ queryKey: ['fleet-fuel-summary'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not add entry', description: e?.response?.data?.error }),
  })

  return (
    <div>
      {summary && summary.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summary.map(s => (
            <div key={s.vehicleId} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <p className="font-mono text-xs text-gray-500">{s.vehicleNo}</p>
              <p className="text-sm font-semibold">{s.litres.toFixed(1)} L</p>
              <p className="text-xs text-gray-400">₹{formatINR(s.amount)} · {s.fills} fills</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex justify-end">
        <button onClick={() => setOpen(o => !o)} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
          <Plus size={13} /> Add Fuel Entry
        </button>
      </div>

      {open && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Vehicle</label>
              <select value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))} className="h-9 w-40 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="">Select...</option>
                {(vehicles ?? []).map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Fill Date</label>
              <input type="date" value={form.fill_date} onChange={e => setForm(f => ({ ...f, fill_date: e.target.value }))} className="h-9 w-36 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Odometer</label>
              <input type="number" value={form.odometer} onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))} className="h-9 w-28 rounded-lg border border-gray-300 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Litres</label>
              <input type="number" value={form.litres} onChange={e => setForm(f => ({ ...f, litres: e.target.value }))} className="h-9 w-28 rounded-lg border border-gray-300 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Rate (₹/L)</label>
              <input type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} className="h-9 w-28 rounded-lg border border-gray-300 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Filled By</label>
              <input value={form.filled_by} onChange={e => setForm(f => ({ ...f, filled_by: e.target.value }))} className="h-9 w-32 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <button
              disabled={!form.vehicle_id || !form.litres || add.isPending}
              onClick={() => add.mutate()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {add.isPending && <Loader2 size={13} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="section-label px-4 py-2.5 text-left">Vehicle</th>
              <th className="section-label px-4 py-2.5 text-left">Date</th>
              <th className="section-label px-4 py-2.5 text-right">Odometer</th>
              <th className="section-label px-4 py-2.5 text-right">Litres</th>
              <th className="section-label px-4 py-2.5 text-right">Rate</th>
              <th className="section-label px-4 py-2.5 text-right">Amount</th>
              <th className="section-label px-4 py-2.5 text-left">Filled By</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
            ) : !data?.length ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">No fuel entries yet</td></tr>
            ) : data.map((r, i) => (
              <tr key={r.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                <td className="px-4 py-2.5 font-mono text-xs">{r.vehicle_no}</td>
                <td className="px-4 py-2.5 text-xs">{formatDate(r.fill_date)}</td>
                <td className="px-4 py-2.5 text-right table-num">{r.odometer ?? '—'}</td>
                <td className="px-4 py-2.5 text-right table-num">{r.litres}</td>
                <td className="px-4 py-2.5 text-right table-num">{r.rate ? `₹${r.rate}` : '—'}</td>
                <td className="px-4 py-2.5 text-right table-num">{r.amount ? `₹${formatINR(r.amount)}` : '—'}</td>
                <td className="px-4 py-2.5">{r.filled_by ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Vehicles roster ─────────────────────────────────────────────────────
// The design's main Fleet view: every vehicle with who's driving it, whether
// it's free, where it is and its service status, plus a detail drawer.
// Availability is derived — on the road / at site from GET /fleet/live, service
// due from the maintenance log's next-due dates — since vehicles themselves
// carry no status.

interface VehicleRow { id: string; vehicle_no: string; vehicle_type: string | null; capacity: string | number | null; owner_name: string | null; mobile: string | null }
interface LiveRow { vehicleNo: string | null; driverName: string | null; jobSite: string | null; customerName: string | null; siteIn: string | null; challanNo: string }
interface FuelSummary { vehicleId: string; vehicleNo: string; litres: number; amount: number; fills: number }

type Availability = 'ON_ROAD' | 'AT_SITE' | 'SERVICE_DUE' | 'AVAILABLE'
const AVAIL: Record<Availability, { label: string; cls: string }> = {
  ON_ROAD: { label: 'On the road', cls: 'bg-amber-100 text-amber-800' },
  AT_SITE: { label: 'At site', cls: 'bg-green-50 text-green-800' },
  SERVICE_DUE: { label: 'Service due', cls: 'bg-red-100 text-red-800' },
  AVAILABLE: { label: 'Available', cls: 'bg-green-50 text-green-800' },
}
const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'OUT', label: 'On the road' },
  { value: 'SERVICE_DUE', label: 'Service due' },
] as const
type Filter = (typeof FILTERS)[number]['value']

const typeLabel = (t: string | null) => (t ? t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ') : 'Vehicle')
const TypeIcon = ({ type, size }: { type: string | null; size: number }) =>
  type === 'TIPPER' ? <Container size={size} className="text-accent" /> : <Truck size={size} className="text-accent" />

function useRoster() {
  return useQuery({
    queryKey: ['fleet-roster'],
    queryFn: () => api.get('/masters/vehicles', { params: { limit: 200, is_active: true } }).then(r => r.data.data.data as VehicleRow[]),
  })
}

function VehiclesTab({ onAddService }: { onAddService: () => void }) {
  const branchId = authStore.getUser()?.branch?.id
  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const vehicles = useRoster()
  const live = useQuery({
    queryKey: ['tracking-live', branchId],
    queryFn: () => api.get('/fleet/live', { params: { branch_id: branchId } }).then(r => r.data.data as LiveRow[]),
    enabled: !!branchId,
    refetchInterval: 30_000,
  })
  const maintenance = useQuery({
    queryKey: ['fleet-maintenance'],
    queryFn: () => api.get('/fleet/maintenance', { params: { limit: 50 } }).then(r => r.data.data.data as MaintenanceRow[]),
  })
  const fuel = useQuery({
    queryKey: ['fleet-fuel-summary'],
    queryFn: () => api.get('/fleet/fuel/summary').then(r => r.data.data as FuelSummary[]),
  })

  const rows = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    return (vehicles.data ?? []).map(v => {
      const trip = (live.data ?? []).find(l => l.vehicleNo === v.vehicle_no)
      const services = (maintenance.data ?? []).filter(m => m.vehicle_id === v.id)
      const nextDue = services.map(s => s.next_due_date).filter((d): d is string => !!d).sort()[0] ?? null
      const overdue = !!nextDue && nextDue.slice(0, 10) <= todayIso
      const availability: Availability = trip ? (trip.siteIn ? 'AT_SITE' : 'ON_ROAD') : overdue ? 'SERVICE_DUE' : 'AVAILABLE'
      return { ...v, trip, services, nextDue, overdue, availability, fuel: (fuel.data ?? []).find(f => f.vehicleId === v.id) }
    })
  }, [vehicles.data, live.data, maintenance.data, fuel.data])

  const isOut = (a: Availability) => a === 'ON_ROAD' || a === 'AT_SITE'
  const counts: Record<Filter, number> = {
    ALL: rows.length,
    AVAILABLE: rows.filter(r => r.availability === 'AVAILABLE').length,
    OUT: rows.filter(r => isOut(r.availability)).length,
    SERVICE_DUE: rows.filter(r => r.availability === 'SERVICE_DUE').length,
  }
  const q = search.trim().toLowerCase()
  const visible = rows.filter(r =>
    (filter === 'ALL' || (filter === 'OUT' ? isOut(r.availability) : r.availability === filter)) &&
    (!q || [r.vehicle_no, r.owner_name, r.trip?.driverName, r.trip?.jobSite].some(v => v?.toLowerCase().includes(q))))
  const selected = rows.find(r => r.id === selectedId) ?? null
  // Keeps the drawer mounted while it slides closed.
  const { item: shown, leaving } = usePresence(selected)
  const last = shown?.services[0]

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter vehicles">
          {FILTERS.map(f => (
            <button key={f.value} role="tab" aria-selected={filter === f.value} onClick={() => setFilter(f.value)} className={cn('pill', filter === f.value && 'active')}>
              {f.label} {counts[f.value]}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search truck no., driver…"
            aria-label="Search vehicles"
            className="h-[34px] w-56 rounded-lg border border-gray-200 pl-[30px] pr-2 text-xs outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="mt-3.5 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-[10.5px] text-slate-400">
                <th className="px-4 py-[9px] font-semibold">Truck</th>
                <th className="px-2.5 py-[9px] font-semibold">Type</th>
                <th className="px-2.5 py-[9px] font-semibold">Driver / Owner</th>
                <th className="px-2.5 py-[9px] font-semibold">Availability</th>
                <th className="px-2.5 py-[9px] font-semibold">Location</th>
                <th className="px-4 py-[9px] font-semibold">Service</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
              {!vehicles.isLoading && visible.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">{rows.length ? 'No vehicles match this filter' : 'No vehicles yet — add them under Masters → Vehicles'}</td></tr>
              )}
              {visible.map(r => (
                <tr
                  key={r.id}
                  tabIndex={0}
                  aria-selected={r.id === selectedId}
                  onClick={() => setSelectedId(r.id)}
                  onKeyDown={e => { if (e.key === 'Enter') setSelectedId(r.id) }}
                  className={cn('cursor-pointer border-t border-gray-200 outline-none transition-colors focus-visible:bg-slate-50', r.id === selectedId ? 'bg-accent-light' : 'hover:bg-slate-50')}
                >
                  <td className="px-4 py-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-accent-light"><TypeIcon type={r.vehicle_type} size={13} /></span>
                      <span className="font-mono font-semibold">{r.vehicle_no}</span>
                    </div>
                  </td>
                  <td className="px-2.5 py-[11px]">{typeLabel(r.vehicle_type)}{r.capacity ? ` ${Number(r.capacity)}m³` : ''}</td>
                  <td className="px-2.5 py-[11px]">
                    <div>{r.trip?.driverName ?? r.owner_name ?? '—'}</div>
                    {r.mobile && <div className="mt-px text-[10.5px] text-slate-400">{r.mobile}</div>}
                  </td>
                  <td className="px-2.5 py-[11px]"><span className={cn('rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold', AVAIL[r.availability].cls)}>{AVAIL[r.availability].label}</span></td>
                  <td className="px-2.5 py-[11px] text-slate-600">{r.trip?.jobSite ?? 'Plant'}</td>
                  <td className="px-4 py-[11px]">
                    <span className={cn('text-[10.5px] font-semibold', r.overdue ? 'text-red-700' : r.nextDue ? 'text-green-800' : 'text-slate-400')}>
                      {r.nextDue ? `${r.overdue ? 'Overdue' : 'Due'} ${formatDate(r.nextDue)}` : 'No schedule'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {shown && (
        <>
          <div className={cn('fixed inset-0 z-30 bg-slate-900/10', leaving && 'backdrop-leave pointer-events-none')} onClick={() => setSelectedId(null)} aria-hidden="true" />
          <aside
            aria-label={`${shown.vehicle_no} details`}
            className={cn('fixed inset-y-0 right-0 z-40 w-full max-w-[380px] overflow-y-auto border-l border-gray-200 bg-white p-[22px] shadow-[-14px_0_32px_rgba(15,23,42,.12)]', leaving ? 'drawer-leave pointer-events-none' : 'animate-in slide-in-from-right duration-200')}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-light"><TypeIcon type={shown.vehicle_type} size={18} /></span>
                <div>
                  <p className="font-mono text-[17px] font-bold">{shown.vehicle_no}</p>
                  <p className="mt-[3px] text-xs text-slate-400">
                    {typeLabel(shown.vehicle_type)}{shown.capacity ? ` · ${Number(shown.capacity)} m³` : ''}{shown.owner_name ? ` · ${shown.owner_name}` : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedId(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100"><X size={16} /></button>
            </div>

            <span className={cn('mt-3.5 inline-block rounded-full px-2.5 py-1 text-[10.5px] font-semibold', AVAIL[shown.availability].cls)}>{AVAIL[shown.availability].label}</span>
            {shown.trip && (
              <p className="mt-2 text-xs text-slate-600">
                {shown.trip.driverName ?? 'Driver'} · {shown.trip.customerName ?? '—'} · {shown.trip.jobSite ?? '—'} · <span className="font-mono">{shown.trip.challanNo}</span>
              </p>
            )}

            <p className="mb-2 mt-[18px] text-[11px] font-bold uppercase tracking-[0.05em] text-slate-400">Service</p>
            {[
              { label: 'Next service', value: shown.nextDue ? formatDate(shown.nextDue) : 'Not scheduled', tone: shown.overdue ? 'text-red-700' : 'text-green-800' },
              { label: 'Last service', value: last ? `${formatDate(last.service_date)} · ${last.service_type}` : '—', tone: 'text-slate-600' },
              { label: 'Odometer', value: last?.odometer != null ? `${Number(last.odometer).toLocaleString('en-IN')} km` : '—', tone: 'text-slate-600' },
              { label: 'Owner mobile', value: shown.mobile ?? '—', tone: 'text-slate-600' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between border-b border-gray-200 py-[9px] last:border-0">
                <span className="text-xs">{row.label}</span>
                <span className={cn('font-mono text-[11px] font-semibold', row.tone)}>{row.value}</span>
              </div>
            ))}

            {shown.services.length > 1 && (
              <>
                <p className="mb-2 mt-[18px] text-[11px] font-bold uppercase tracking-[0.05em] text-slate-400">Service history</p>
                {shown.services.slice(1, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 text-xs">
                    <span>{s.service_type}</span>
                    <span className="font-mono text-[11px] text-slate-400">{formatDate(s.service_date)}{s.cost ? ` · ₹${formatINR(s.cost)}` : ''}</span>
                  </div>
                ))}
              </>
            )}

            <p className="mb-2 mt-[18px] text-[11px] font-bold uppercase tracking-[0.05em] text-slate-400">Usage</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[10px] bg-slate-50 p-2.5">
                <p className="text-[10px] text-slate-400">Fuel logged</p>
                <p className="mt-0.5 font-mono text-sm font-bold">{shown.fuel ? `${shown.fuel.litres.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L` : '—'}</p>
              </div>
              <div className="rounded-[10px] bg-slate-50 p-2.5">
                <p className="text-[10px] text-slate-400">Fuel spend</p>
                <p className="mt-0.5 font-mono text-sm font-bold">{shown.fuel ? `₹${formatINR(shown.fuel.amount)}` : '—'}</p>
              </div>
            </div>

            <button onClick={onAddService} className="mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-slate-600 transition-colors hover:border-accent/50 hover:text-accent">
              <Wrench size={13} /> Add service record
            </button>
          </aside>
        </>
      )}
    </div>
  )
}

export default function FleetPage() {
  const [tab, setTab] = useState('vehicles')
  const { data: vehicles } = useRoster()
  return (
    <div>
      <div className="mb-3.5">
        <h1 className="text-xl font-bold text-slate-900">Fleet</h1>
        <p className="mt-[3px] text-xs text-slate-400">{vehicles ? `${vehicles.length} vehicles · ` : ''}availability, service & fuel</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="vehicles"><Truck size={13} className="mr-1.5 inline" />Vehicles</TabsTrigger>
          <TabsTrigger value="maintenance"><Wrench size={13} className="mr-1.5 inline" />Maintenance</TabsTrigger>
          <TabsTrigger value="fuel"><Fuel size={13} className="mr-1.5 inline" />Fuel Log</TabsTrigger>
        </TabsList>
        <TabsContent value="vehicles"><VehiclesTab onAddService={() => setTab('maintenance')} /></TabsContent>
        <TabsContent value="maintenance"><MaintenanceTab /></TabsContent>
        <TabsContent value="fuel"><FuelTab /></TabsContent>
      </Tabs>
    </div>
  )
}
