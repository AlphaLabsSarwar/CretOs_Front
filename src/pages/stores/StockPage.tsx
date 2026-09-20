import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Package, Plus } from 'lucide-react'
import { SkeletonRow } from '@/components/shared/DataTable'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils'
import ReorderForecastPanel from './ReorderForecastPanel'

interface BalanceRow {
  material: string
  label: string
  uom: string
  itemId: string | null
  unassigned: boolean
  qty_on_hand: number
  reorder_level: number
  avg_cost: number
  low: boolean
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

interface MovementRow {
  id: string
  material: string
  movement_type: string
  qty: string | number
  ref_type: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export default function StockPage() {
  const user = authStore.getUser()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptMaterial, setReceiptMaterial] = useState('')
  const [receiptQty, setReceiptQty] = useState('')
  const [receiptRate, setReceiptRate] = useState('')
  const [receiptNote, setReceiptNote] = useState('')
  const [editingReorder, setEditingReorder] = useState<string | null>(null)
  const [reorderValue, setReorderValue] = useState('')

  const { data: balance, isLoading } = useQuery({
    queryKey: ['stock-balance', user?.branch?.id],
    queryFn: () => api.get('/stores/stock/balance', { params: { branch_id: user?.branch?.id } }).then(r => r.data.data as BalanceRow[]),
  })

  const { data: movements } = useQuery({
    queryKey: ['stock-movements', user?.branch?.id],
    queryFn: () => api.get('/stores/stock/movements', { params: { branch_id: user?.branch?.id, limit: 15 } }).then(r => r.data.data as MovementRow[]),
  })

  const recordInward = useMutation({
    mutationFn: () => api.post('/stores/stock/inward', {
      branch_id: user?.branch?.id, material: receiptMaterial, qty: Number(receiptQty),
      rate: receiptRate ? Number(receiptRate) : undefined, note: receiptNote || undefined,
    }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Stock received' })
      setReceiptOpen(false); setReceiptMaterial(''); setReceiptQty(''); setReceiptRate(''); setReceiptNote('')
      queryClient.invalidateQueries({ queryKey: ['stock-balance'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not record receipt', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const setReorder = useMutation({
    mutationFn: (vars: { material: string; reorder_level: number }) =>
      api.put('/stores/stock/reorder-level', { branch_id: user?.branch?.id, ...vars }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Reorder level updated' })
      setEditingReorder(null)
      queryClient.invalidateQueries({ queryKey: ['stock-balance'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not update', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const lowStock = (balance ?? []).filter(b => b.low)
  const unassigned = (balance ?? []).filter(b => b.unassigned)

  return (
    <div>
      <PageHeader
        title="Raw Material Stock"
        subtitle="On-hand quantities, auto-deducted when a challan is dispatched based on the grade recipe"
        actions={
          <button
            onClick={() => setReceiptOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover"
          >
            <Plus size={13} /> Record Receipt
          </button>
        }
      />

      {unassigned.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            No item assigned yet for: {unassigned.map(u => u.label).join(', ')}. Stock still tracks by role, but assigning a real item from{' '}
            <Link to="/masters/items" className="font-medium underline">Masters &gt; Materials</Link> shows the actual name/brand here.
          </span>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Low stock: {lowStock.map(l => l.label).join(', ')} — below reorder level.</span>
        </div>
      )}

      <ReorderForecastPanel branchId={user?.branch?.id} />

      {receiptOpen && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="section-label mb-3">Record Stock Receipt</p>
          <p className="mb-3 text-xs text-gray-400">
            Manual entry — GRNs don't currently break down by material, so purchase receipts against a vendor GRN are recorded here separately.
            Rate feeds the Profitability Report's material cost — leave blank if you just want to log quantity.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Material</label>
              <select value={receiptMaterial} onChange={e => setReceiptMaterial(e.target.value)} className="h-9 w-48 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="">Select...</option>
                {(balance ?? []).map(b => <option key={b.material} value={b.material}>{b.label} ({b.uom})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Quantity</label>
              <input type="number" step="0.01" value={receiptQty} onChange={e => setReceiptQty(e.target.value)} className="h-9 w-32 rounded-lg border border-gray-300 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Rate (₹ / unit)</label>
              <input type="number" step="0.01" value={receiptRate} onChange={e => setReceiptRate(e.target.value)} placeholder="Optional" className="h-9 w-32 rounded-lg border border-gray-300 px-3 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs text-gray-500">Note</label>
              <input value={receiptNote} onChange={e => setReceiptNote(e.target.value)} placeholder="e.g. Against GRN/00123" className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <button
              disabled={!receiptMaterial || !receiptQty || recordInward.isPending}
              onClick={() => recordInward.mutate()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {recordInward.isPending && <Loader2 size={13} className="animate-spin" />}
              Save
            </button>
            <button onClick={() => setReceiptOpen(false)} className="flex h-9 items-center rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="section-label px-4 py-2.5 text-left">Material</th>
                <th className="section-label px-4 py-2.5 text-right">On Hand</th>
                <th className="section-label px-4 py-2.5 text-right">Avg Cost</th>
                <th className="section-label px-4 py-2.5 text-right">Reorder Level</th>
                <th className="section-label px-4 py-2.5 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
              ) : (balance ?? []).map((b, i) => (
                <tr key={b.material} className={cn('border-b border-gray-100 last:border-0', i % 2 === 1 && 'bg-gray-50/50', b.low && 'bg-amber-50/40')}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-800">{b.label}</span>
                    {b.low && <AlertTriangle size={12} className="ml-1.5 inline text-amber-500" />}
                    {b.unassigned && <span className="ml-1.5 text-[10px] text-blue-600">(no item assigned)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(b.qty_on_hand)} {b.uom}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-600">{b.avg_cost > 0 ? `₹${fmtMoney(b.avg_cost)}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    {editingReorder === b.material ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number" autoFocus value={reorderValue} onChange={e => setReorderValue(e.target.value)}
                          className="h-7 w-24 rounded border border-gray-300 px-2 text-right font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <button onClick={() => setReorder.mutate({ material: b.material, reorder_level: Number(reorderValue) })} className="text-xs text-accent hover:underline">Save</button>
                      </div>
                    ) : (
                      <span className="font-mono text-gray-600">{fmt(b.reorder_level)} {b.uom}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {editingReorder !== b.material && (
                      <button onClick={() => { setEditingReorder(b.material); setReorderValue(String(b.reorder_level)) }} className="text-xs text-gray-400 hover:text-gray-700">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="section-label mb-3">Recent Movements</p>
          {!movements?.length ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Package size={24} className="text-gray-300" />
              <p className="text-xs text-gray-400">No movements yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {movements.map(m => (
                <div key={m.id} className="flex items-center justify-between border-b border-gray-50 py-1.5 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{m.material}</p>
                    <p className="text-[11px] text-gray-400">{new Date(m.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{m.note ? ` · ${m.note}` : ''}</p>
                  </div>
                  <span className={cn('font-mono text-xs font-medium', m.movement_type === 'OUTWARD' ? 'text-red-600' : 'text-green-600')}>
                    {m.movement_type === 'OUTWARD' ? '−' : '+'}{fmt(Math.abs(Number(m.qty)))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
