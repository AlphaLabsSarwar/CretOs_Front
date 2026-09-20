import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Truck } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

interface LookupCustomer { id: string; name: string; mobile: string | null; code: string | null }

interface PendingChallan {
  id: string
  challan_no: string
  date: string
  job_site: string
  grade_name: string | null
  qty: string | number
  rate: string | number | null
  invoice_total: string | number | null
  tax_type: string
  vehicle_no: string | null
}

export default function InvoiceFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [customerId, setCustomerId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: () => api.get('/masters/customers', { params: { limit: 200, is_active: true } }).then(r => r.data.data.data as LookupCustomer[]),
    staleTime: 5 * 60_000,
  })

  const { data: challans, isLoading: challansLoading } = useQuery({
    queryKey: ['pending-invoice-challans', customerId],
    queryFn: () => api.get('/finance/invoices/pending-challans', { params: { customer_id: customerId } }).then(r => r.data.data as PendingChallan[]),
    enabled: !!customerId,
  })

  const selectedChallans = useMemo(() => (challans ?? []).filter(c => selected[c.id]), [challans, selected])
  const subtotal = useMemo(
    () => selectedChallans.reduce((sum, c) => sum + Number(c.invoice_total ?? (Number(c.qty) * Number(c.rate ?? 0))), 0),
    [selectedChallans]
  )
  const taxType = selectedChallans[0]?.tax_type ?? 'GST'
  const taxAmount = taxType === 'GST' ? subtotal * 0.18 : 0
  const total = subtotal + taxAmount

  function toggleAll(checked: boolean) {
    if (!challans) return
    const next: Record<string, boolean> = {}
    if (checked) challans.forEach(c => { next[c.id] = true })
    setSelected(next)
  }

  const generate = useMutation({
    mutationFn: () => api.post('/finance/invoices', {
      customer_id: customerId,
      date,
      tax_type: taxType,
      challan_ids: selectedChallans.map(c => c.id),
    }),
    onSuccess: (res) => {
      toast({ variant: 'success', title: 'Invoice generated' })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      navigate(`/finance/invoices/${res.data?.data?.id}`)
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  return (
    <div>
      <PageHeader title="Generate Invoice" subtitle="Select a customer's dispatched (posted) challans to bill together" />

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2 pb-4">
        <SectionHeader label="Invoice Details" />
        <Field label="Customer" required>
          <SearchableSelect
            options={customers ?? []}
            value={customerId}
            onChange={v => { setCustomerId(v); setSelected({}) }}
            displayKey="name"
            valueKey="id"
            filterKeys={['name', 'mobile', 'code']}
            loading={customersLoading}
            placeholder="Search customer..."
            renderOption={c => (
              <div className="flex items-center justify-between gap-2">
                <span>{c.name}</span>
                <span className="font-mono text-[11px] text-gray-400">{c.mobile ?? c.code ?? ''}</span>
              </div>
            )}
          />
        </Field>
        <Field label="Invoice Date" required>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass(false)} />
        </Field>
      </div>

      <SectionHeader label="Dispatched Challans" />

      {!customerId && (
        <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-12">
          <Truck size={28} className="text-gray-300" />
          <p className="text-sm text-gray-400">Select a customer to see their un-invoiced dispatched challans.</p>
        </div>
      )}

      {customerId && challansLoading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading dispatched challans...
        </div>
      )}

      {customerId && !challansLoading && (challans ?? []).length === 0 && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
          No un-invoiced dispatched challans for this customer. Post a challan from Dispatch first.
        </div>
      )}

      {customerId && !challansLoading && (challans ?? []).length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-10 px-4 py-2.5">
                  <input type="checkbox" checked={selectedChallans.length === challans!.length} onChange={e => toggleAll(e.target.checked)} />
                </th>
                <th className="section-label px-4 py-2.5 text-left">Challan No</th>
                <th className="section-label px-4 py-2.5 text-left">Date</th>
                <th className="section-label px-4 py-2.5 text-left">Job Site</th>
                <th className="section-label px-4 py-2.5 text-left">Grade</th>
                <th className="section-label px-4 py-2.5 text-right">Qty</th>
                <th className="section-label px-4 py-2.5 text-right">Rate</th>
                <th className="section-label px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {challans!.map((c, i) => {
                const amount = Number(c.invoice_total ?? (Number(c.qty) * Number(c.rate ?? 0)))
                return (
                  <tr key={c.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={!!selected[c.id]} onChange={e => setSelected(s => ({ ...s, [c.id]: e.target.checked }))} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{c.challan_no}</td>
                    <td className="px-4 py-2.5">{new Date(c.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-2.5">{c.job_site}</td>
                    <td className="px-4 py-2.5">{c.grade_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right table-num">{Number(c.qty).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right table-num">₹{formatINR(Number(c.rate ?? 0))}</td>
                    <td className="px-4 py-2.5 text-right table-num font-medium">₹{formatINR(amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedChallans.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs">
          <span className="text-gray-500">Challans: <span className="font-mono text-gray-800">{selectedChallans.length}</span></span>
          <span className="text-gray-500">Subtotal: <span className="font-mono text-gray-800">₹{formatINR(subtotal)}</span></span>
          <span className="text-gray-500">GST (18%): <span className="font-mono text-gray-800">₹{formatINR(taxAmount)}</span></span>
          <span className="text-gray-500">Total: <span className="font-mono font-semibold text-gray-900">₹{formatINR(total)}</span></span>
        </div>
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
        <Link to="/finance/invoices" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
        <button
          type="button"
          disabled={selectedChallans.length === 0 || generate.isPending}
          onClick={() => generate.mutate()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generate.isPending && <Loader2 size={13} className="animate-spin" />}
          {generate.isPending ? 'Generating...' : `Generate Invoice (₹${formatINR(total)})`}
        </button>
      </div>
    </div>
  )
}
