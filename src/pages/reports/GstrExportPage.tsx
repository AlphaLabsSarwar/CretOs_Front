import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatDate, formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'

interface GstrRow { invoiceNo: string; date: string; customerName: string | null; gstin?: string | null; placeOfSupply?: string | null; taxableValue: number; taxAmount: number; total: number }
interface GstrBucket { rows: GstrRow[]; taxableValue: number; taxAmount: number; total: number }
interface GstrSummary { month: string; b2b: GstrBucket; b2cs: GstrBucket; grandTotal: { taxableValue: number; taxAmount: number; total: number } }

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function toCsv(b2b: GstrRow[], b2cs: GstrRow[]): string {
  const header = ['Category', 'Invoice No', 'Date', 'Customer', 'GSTIN', 'Place of Supply', 'Taxable Value', 'Tax Amount', 'Total']
  const lines = [
    ...b2b.map(r => ['B2B', r.invoiceNo, r.date.slice(0, 10), r.customerName ?? '', r.gstin ?? '', r.placeOfSupply ?? '', r.taxableValue.toFixed(2), r.taxAmount.toFixed(2), r.total.toFixed(2)]),
    ...b2cs.map(r => ['B2CS', r.invoiceNo, r.date.slice(0, 10), r.customerName ?? '', '', '', r.taxableValue.toFixed(2), r.taxAmount.toFixed(2), r.total.toFixed(2)]),
  ].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  return [header.join(','), ...lines].join('\n')
}

export default function GstrExportPage() {
  const user = authStore.getUser()
  const [month, setMonth] = useState(currentMonth())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gstr-summary', user?.branch?.id, month],
    queryFn: () => api.get('/reports/gstr-summary', { params: { branch_id: user?.branch?.id, month } }).then(r => r.data.data as GstrSummary),
    enabled: !!user?.branch?.id,
  })

  function exportCsv() {
    if (!data) return
    const blob = new Blob([toCsv(data.b2b.rows, data.b2cs.rows)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gstr1_${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="GSTR Export"
        subtitle="Monthly B2B/B2CS summary from posted invoices — a filing aid, not a filing (no government API is called)"
        actions={
          <button onClick={exportCsv} disabled={!data} className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={13} /> Export CSV
          </button>
        }
      />

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Could not load the GSTR summary. This page is restricted to Admin users.
        </div>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-xs text-gray-500">Month</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
      </div>

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1">Taxable Value</p>
              <p className="text-lg font-bold font-mono">₹{formatINR(data.grandTotal.taxableValue)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1">Tax Amount</p>
              <p className="text-lg font-bold font-mono">₹{formatINR(data.grandTotal.taxAmount)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="section-label mb-1">Total</p>
              <p className="text-lg font-bold font-mono">₹{formatINR(data.grandTotal.total)}</p>
            </div>
          </div>

          {([['B2B — GSTIN-registered customers', data.b2b], ['B2CS — no GSTIN on file', data.b2cs]] as const).map(([title, bucket]) => (
            <div key={title}>
              <p className="section-label mb-2">{title} ({bucket.rows.length})</p>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="section-label px-4 py-2.5 text-left">Invoice No</th>
                      <th className="section-label px-4 py-2.5 text-left">Date</th>
                      <th className="section-label px-4 py-2.5 text-left">Customer</th>
                      {title.startsWith('B2B') && <th className="section-label px-4 py-2.5 text-left">GSTIN</th>}
                      <th className="section-label px-4 py-2.5 text-right">Taxable Value</th>
                      <th className="section-label px-4 py-2.5 text-right">Tax</th>
                      <th className="section-label px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bucket.rows.length === 0 ? (
                      <tr><td colSpan={title.startsWith('B2B') ? 7 : 6} className="px-4 py-6 text-center text-xs text-gray-400">No invoices in this category for {month}</td></tr>
                    ) : bucket.rows.map((r, i) => (
                      <tr key={r.invoiceNo} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="px-4 py-2.5 font-mono text-xs">{r.invoiceNo}</td>
                        <td className="px-4 py-2.5 text-xs">{formatDate(r.date)}</td>
                        <td className="px-4 py-2.5">{r.customerName ?? '—'}</td>
                        {title.startsWith('B2B') && <td className="px-4 py-2.5 font-mono text-xs uppercase">{r.gstin ?? '—'}</td>}
                        <td className="px-4 py-2.5 text-right table-num">₹{formatINR(r.taxableValue)}</td>
                        <td className="px-4 py-2.5 text-right table-num">₹{formatINR(r.taxAmount)}</td>
                        <td className="px-4 py-2.5 text-right table-num font-medium">₹{formatINR(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
