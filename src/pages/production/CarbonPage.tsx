import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Leaf, Info } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'

interface MaterialRow { material: string; label: string; qty: number; factor: number; kgco2e: number }
interface CarbonData {
  from: string; to: string
  materialRows: MaterialRow[]
  materialKgCO2e: number; electricityKgCO2e: number; dieselKgCO2e: number
  totalKgCO2e: number; totalTonnesCO2e: number
  outputCum: number; kgco2ePerCum: number | null
  scmReplacementPct: number
  scopeNote: string
  factorsAreApproximate: boolean
}

function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
function today() { return new Date().toISOString().slice(0, 10) }

export default function CarbonPage() {
  const user = authStore.getUser()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['carbon', user?.branch?.id, from, to],
    queryFn: () => api.get('/production/carbon', { params: { branch_id: user?.branch?.id, from, to } }).then(r => r.data.data as CarbonData),
    enabled: !!user?.branch?.id,
  })

  const total = data ? data.materialKgCO2e + data.electricityKgCO2e + data.dieselKgCO2e : 0

  return (
    <div>
      <PageHeader title="Carbon & Sustainability" subtitle="Cradle-to-gate CO₂e footprint of concrete produced — materials, plant electricity and generator diesel" />

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

      {isError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Could not load carbon data.</div>}

      {isLoading ? <RmcLoader size="sm" /> : data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="section-label mb-1 flex items-center gap-1 text-green-700"><Leaf size={11} /> Total Footprint</p>
              <p className="font-mono text-2xl font-semibold text-green-800">{data.totalTonnesCO2e} t</p>
              <p className="mt-0.5 text-[11px] text-green-700/70">CO₂e</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1">Per m³ Produced</p>
              <p className="font-mono text-2xl font-semibold text-gray-900">{data.kgco2ePerCum ?? '—'}</p>
              <p className="mt-0.5 text-[11px] text-gray-400">kg CO₂e / m³ · {data.outputCum} m³ total</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1">SCM Replacement</p>
              <p className="font-mono text-2xl font-semibold text-gray-900">{data.scmReplacementPct}%</p>
              <p className="mt-0.5 text-[11px] text-gray-400">Flyash + GGBS of cementitious mass</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1">Sources</p>
              <p className="text-[11px] leading-relaxed text-gray-500">
                Materials {total > 0 ? Math.round((data.materialKgCO2e / total) * 100) : 0}% · Electricity {total > 0 ? Math.round((data.electricityKgCO2e / total) * 100) : 0}% · Diesel {total > 0 ? Math.round((data.dieselKgCO2e / total) * 100) : 0}%
              </p>
            </div>
          </div>

          {data.materialRows.length > 0 && (
            <div className="mb-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Material</th>
                    <th className="px-4 py-2.5 text-right font-medium">Consumed (kg/L)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Factor (kgCO₂e/unit)</th>
                    <th className="px-4 py-2.5 text-right font-medium">CO₂e (kg)</th>
                    <th className="px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.materialRows.map(r => (
                    <tr key={r.material} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{r.label}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-600">{r.qty.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-400">{r.factor}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-gray-900">{r.kgco2e.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2.5">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${data.materialKgCO2e > 0 ? Math.min(100, (r.kgco2e / data.materialKgCO2e) * 100) : 0}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[11px] text-gray-500">
            <Info size={13} className="mt-0.5 shrink-0" />
            <p>{data.scopeNote} Emission factors are typical industry approximations, not a certified plant-specific LCA — replace them with verified figures when available for compliance-grade reporting.</p>
          </div>
        </>
      ) : null}
    </div>
  )
}
