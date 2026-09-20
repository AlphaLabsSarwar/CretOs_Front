import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Wrench, Fuel } from 'lucide-react'
import { SkeletonRow } from '@/components/shared/DataTable'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { formatDate, formatINR } from '@/lib/utils'
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

export default function FleetPage() {
  return (
    <div>
      <PageHeader title="Fleet" subtitle="Vehicle maintenance history and fuel log" />
      <Tabs defaultValue="maintenance">
        <TabsList>
          <TabsTrigger value="maintenance"><Wrench size={13} className="mr-1.5 inline" />Maintenance</TabsTrigger>
          <TabsTrigger value="fuel"><Fuel size={13} className="mr-1.5 inline" />Fuel Log</TabsTrigger>
        </TabsList>
        <TabsContent value="maintenance"><MaintenanceTab /></TabsContent>
        <TabsContent value="fuel"><FuelTab /></TabsContent>
      </Tabs>
    </div>
  )
}
