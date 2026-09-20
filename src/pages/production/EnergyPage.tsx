import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Zap, Fuel, Save } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import { Field, inputClass } from '@/components/shared/form-controls'

interface EnergySummary {
  from: string; to: string
  totalKwh: number; totalDiesel: number; totalGenHours: number
  electricityCost: number; dieselCost: number; totalCost: number
  outputCum: number
  perCum: { kwhPerCum: number; dieselPerCum: number; costPerCum: number } | null
  daily: { date: string; electricity_kwh: number | null; diesel_liters: number | null; generator_hours: number | null; cost: number }[]
}

function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
function today() { return new Date().toISOString().slice(0, 10) }

export default function EnergyPage() {
  const user = authStore.getUser()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [entry, setEntry] = useState({
    reading_date: today(), electricity_kwh: '', electricity_rate: '', diesel_liters: '', diesel_rate: '', generator_hours: '', remarks: '',
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['energy-summary', user?.branch?.id, from, to],
    queryFn: () => api.get('/production/energy/summary', { params: { branch_id: user?.branch?.id, from, to } }).then(r => r.data.data as EnergySummary),
    enabled: !!user?.branch?.id,
  })

  const saveReading = useMutation({
    mutationFn: () => api.post('/production/energy', {
      branch_id: user?.branch?.id,
      reading_date: entry.reading_date,
      electricity_kwh: entry.electricity_kwh ? Number(entry.electricity_kwh) : undefined,
      electricity_rate: entry.electricity_rate ? Number(entry.electricity_rate) : undefined,
      diesel_liters: entry.diesel_liters ? Number(entry.diesel_liters) : undefined,
      diesel_rate: entry.diesel_rate ? Number(entry.diesel_rate) : undefined,
      generator_hours: entry.generator_hours ? Number(entry.generator_hours) : undefined,
      remarks: entry.remarks || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Reading saved', variant: 'success' })
      qc.invalidateQueries({ queryKey: ['energy-summary'] })
    },
    onError: (e: any) => toast({ title: 'Could not save reading', description: e?.response?.data?.message, variant: 'error' }),
  })

  return (
    <div>
      <PageHeader title="Energy Management" subtitle="Daily electricity and diesel consumption, and cost per cubic metre of concrete produced" />

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-3 text-xs font-medium text-gray-700">Log Today's Reading</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Date">
            <input type="date" value={entry.reading_date} onChange={e => setEntry(f => ({ ...f, reading_date: e.target.value }))} className={inputClass(false)} />
          </Field>
          <Field label="Electricity (kWh)">
            <input type="number" step="0.1" value={entry.electricity_kwh} onChange={e => setEntry(f => ({ ...f, electricity_kwh: e.target.value }))} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <Field label="Rate (₹/kWh)">
            <input type="number" step="0.01" value={entry.electricity_rate} onChange={e => setEntry(f => ({ ...f, electricity_rate: e.target.value }))} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <Field label="Diesel (L)">
            <input type="number" step="0.1" value={entry.diesel_liters} onChange={e => setEntry(f => ({ ...f, diesel_liters: e.target.value }))} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <Field label="Rate (₹/L)">
            <input type="number" step="0.01" value={entry.diesel_rate} onChange={e => setEntry(f => ({ ...f, diesel_rate: e.target.value }))} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <Field label="Genset Hours">
            <input type="number" step="0.1" value={entry.generator_hours} onChange={e => setEntry(f => ({ ...f, generator_hours: e.target.value }))} className={inputClass(false, 'text-right font-mono')} />
          </Field>
        </div>
        <button
          disabled={saveReading.isPending}
          onClick={() => saveReading.mutate()}
          className="mt-3 flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          <Save size={13} /> Save Reading
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
      </div>

      {isError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Could not load energy data.</div>}

      {isLoading ? <RmcLoader size="sm" /> : data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1 flex items-center gap-1"><Zap size={11} /> Electricity</p>
              <p className="font-mono text-xl font-semibold text-gray-900">{data.totalKwh.toLocaleString('en-IN')} kWh</p>
              <p className="mt-0.5 text-[11px] text-gray-400">₹{formatINR(data.electricityCost)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1 flex items-center gap-1"><Fuel size={11} /> Diesel</p>
              <p className="font-mono text-xl font-semibold text-gray-900">{data.totalDiesel.toLocaleString('en-IN')} L</p>
              <p className="mt-0.5 text-[11px] text-gray-400">₹{formatINR(data.dieselCost)} · {data.totalGenHours}h genset</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1">Total Energy Cost</p>
              <p className="font-mono text-xl font-semibold text-gray-900">₹{formatINR(data.totalCost)}</p>
            </div>
            <div className="rounded-xl border border-accent/30 bg-white p-4">
              <p className="section-label mb-1">Cost per m³</p>
              <p className="font-mono text-xl font-semibold text-gray-900">{data.perCum ? `₹${formatINR(data.perCum.costPerCum)}` : '—'}</p>
              <p className="mt-0.5 text-[11px] text-gray-400">{data.outputCum} m³ produced</p>
            </div>
          </div>

          {data.perCum && (
            <div className="mb-4 flex flex-wrap gap-4 rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-600">
              <span>{data.perCum.kwhPerCum} kWh / m³</span>
              <span>{data.perCum.dieselPerCum} L diesel / m³</span>
            </div>
          )}

          {data.daily.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-10 text-center">
              <Zap size={22} className="text-gray-300" />
              <p className="text-xs text-gray-400">No readings logged in this period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 text-right font-medium">Electricity (kWh)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Diesel (L)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Genset (hr)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.slice().reverse().map(d => (
                    <tr key={d.date} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600">{new Date(d.date).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{d.electricity_kwh ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{d.diesel_liters ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{d.generator_hours ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-gray-800">₹{formatINR(d.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
