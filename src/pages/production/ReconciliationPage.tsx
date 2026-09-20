import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Save } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import { Badge } from '@/components/ui/badge'

interface ReconRow {
  material: string
  label: string
  uom: string
  opening: number
  inward: number
  outward: number
  adjustments: number
  expectedClosing: number
  countedQty: number | null
  countDate: string | null
  countStale: boolean | null
  variance: number | null
  varianceCost: number | null
  avgCost: number
}
interface ReconData {
  from: string
  to: string
  rows: ReconRow[]
}

function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function today() {
  return new Date().toISOString().slice(0, 10)
}
function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export default function ReconciliationPage() {
  const user = authStore.getUser()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [draft, setDraft] = useState<Record<string, string>>({})

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reconciliation', user?.branch?.id, from, to],
    queryFn: () => api.get('/production/reconciliation', { params: { branch_id: user?.branch?.id, from, to } }).then(r => r.data.data as ReconData),
    enabled: !!user?.branch?.id,
  })

  const recordCount = useMutation({
    mutationFn: (vars: { material: string; counted_qty: number }) =>
      api.post('/production/reconciliation/count', { branch_id: user?.branch?.id, count_date: to, ...vars }),
    onSuccess: (_res, vars) => {
      toast({ title: 'Physical count recorded', variant: 'success' })
      setDraft(d => { const next = { ...d }; delete next[vars.material]; return next })
      qc.invalidateQueries({ queryKey: ['reconciliation'] })
    },
    onError: (e: any) => toast({ title: 'Could not save count', description: e?.response?.data?.message, variant: 'error' }),
  })

  const totals = useMemo(() => {
    if (!data) return null
    return data.rows.reduce((acc, r) => {
      acc.expected += r.expectedClosing
      if (r.varianceCost != null) acc.varianceCost += r.varianceCost
      return acc
    }, { expected: 0, varianceCost: 0 })
  }, [data])

  return (
    <div>
      <PageHeader
        title="Material Reconciliation"
        subtitle="System ledger balance vs. a physical stock-take, per material — enter today's count to see variance and its cost impact"
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">Period from</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">To (count date)</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        {totals && (
          <div className="ml-auto rounded-xl border border-gray-200 bg-white px-4 py-2">
            <p className="section-label mb-0.5">Net Variance Cost (period)</p>
            <p className={`font-mono text-sm font-semibold ${totals.varianceCost < 0 ? 'text-red-600' : totals.varianceCost > 0 ? 'text-green-700' : 'text-gray-800'}`}>
              ₹{fmt(Math.abs(totals.varianceCost))} {totals.varianceCost < 0 ? 'shortage' : totals.varianceCost > 0 ? 'surplus' : ''}
            </p>
          </div>
        )}
      </div>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Could not load the reconciliation report. Please try again.</div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        data.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-10 text-center">
            <ClipboardCheck size={22} className="text-gray-300" />
            <p className="text-xs text-gray-400">No material roles are mapped to items yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Material</th>
                  <th className="px-4 py-2.5 text-right font-medium">Opening</th>
                  <th className="px-4 py-2.5 text-right font-medium">Inward</th>
                  <th className="px-4 py-2.5 text-right font-medium">Outward</th>
                  <th className="px-4 py-2.5 text-right font-medium">Adjustments</th>
                  <th className="px-4 py-2.5 text-right font-medium">Expected Closing</th>
                  <th className="px-4 py-2.5 text-right font-medium">Physical Count</th>
                  <th className="px-4 py-2.5 text-right font-medium">Variance</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cost Impact</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.material} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800">{r.label}</p>
                      <p className="text-[10px] text-gray-400">{r.uom}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fmt(r.opening)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-green-700">{r.inward ? `+${fmt(r.inward)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600">{r.outward ? `-${fmt(r.outward)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-500">{r.adjustments ? fmt(r.adjustments) : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-gray-900">{fmt(r.expectedClosing)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        placeholder={r.countedQty != null ? fmt(r.countedQty) : 'Enter count'}
                        value={draft[r.material] ?? ''}
                        onChange={e => setDraft(d => ({ ...d, [r.material]: e.target.value }))}
                        className="h-7 w-24 rounded-md border border-gray-300 px-2 text-right text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      {r.countStale && r.countedQty != null && (
                        <p className="mt-0.5 text-[10px] text-amber-600">from {r.countDate ? new Date(r.countDate).toLocaleDateString('en-IN') : ''}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {r.variance == null ? (
                        <span className="text-gray-300">—</span>
                      ) : r.variance === 0 ? (
                        <Badge tone="success">Matched</Badge>
                      ) : (
                        <span className={r.variance < 0 ? 'text-red-600' : 'text-green-700'}>{r.variance > 0 ? '+' : ''}{fmt(r.variance)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {r.varianceCost == null ? <span className="text-gray-300">—</span> : (
                        <span className={r.varianceCost < 0 ? 'text-red-600' : r.varianceCost > 0 ? 'text-green-700' : 'text-gray-500'}>₹{fmt(Math.abs(r.varianceCost))}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={!draft[r.material] || recordCount.isPending}
                        onClick={() => recordCount.mutate({ material: r.material, counted_qty: Number(draft[r.material]) })}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 px-2 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <Save size={12} /> Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      <p className="mt-3 text-[11px] text-gray-400">
        Consumption in the ledger is theoretical (recipe × dispatched quantity) until batch-level actual-material capture is reconciled here in a later phase — variance therefore also reflects that gap, not only physical loss.
      </p>
    </div>
  )
}
