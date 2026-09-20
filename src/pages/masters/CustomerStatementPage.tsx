import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatINR } from '@/lib/utils'
import CompanyLogo from '@/components/shared/CompanyLogo'

interface StatementRow {
  date: string
  type: 'INVOICE' | 'RECEIPT'
  vchType: string
  particulars: string
  ref: string
  debit: number
  credit: number
  balance: number
}
interface Statement {
  branch: { name: string; address: string; gstin: string | null; company_id: string | null } | null
  customer: { id: string; name: string; gstin: string | null; address: string | null }
  openingBalance: number
  rows: StatementRow[]
  closingBalance: number
}

export default function CustomerStatementPage() {
  const { id } = useParams()

  const { data, isLoading } = useQuery({
    queryKey: ['customer-statement', id],
    queryFn: () => api.get(`/masters/customers/${id}/statement`).then(r => r.data.data as Statement),
    enabled: !!id,
  })

  // Column totals + the Tally-style balancing "Closing Balance" line: whichever
  // column (Debit/Credit) is smaller gets the closing balance added to it, so
  // the very last row reads the same total on both sides — a ledger, not just
  // a running list. Opening balance (if non-zero) is folded in as its own
  // first row so the totals include it, same as it would appear in Tally.
  const totals = useMemo(() => {
    if (!data) return null
    const opening = data.openingBalance
    const txnDebit = data.rows.reduce((s, r) => s + r.debit, 0)
    const txnCredit = data.rows.reduce((s, r) => s + r.credit, 0)
    const openingDebit = opening > 0 ? opening : 0
    const openingCredit = opening < 0 ? Math.abs(opening) : 0
    const totalDebit = txnDebit + openingDebit
    const totalCredit = txnCredit + openingCredit
    const closing = data.closingBalance
    const closingDebitSlot = closing < 0 ? Math.abs(closing) : 0
    const closingCreditSlot = closing > 0 ? closing : 0
    return {
      totalDebit, totalCredit,
      closingDebitSlot, closingCreditSlot,
      grandTotal: totalDebit + closingDebitSlot,
    }
  }, [data])

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Screen-only toolbar */}
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <Link to="/masters/customers" className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
          <ArrowLeft size={13} /> Back to Customers
        </Link>
        <button
          onClick={() => window.print()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover"
        >
          <Printer size={13} /> Print Statement
        </button>
      </div>

      {isLoading || !data || !totals ? (
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading statement...
        </div>
      ) : (
        <div className="mx-auto max-w-3xl border-2 border-gray-800 bg-white p-5 text-[11px] text-gray-800 shadow-sm print:max-w-none print:border print:shadow-none">
          {/* Company header */}
          <div className="flex items-start justify-between border-b-2 border-gray-800 pb-2">
            <CompanyLogo companyId={data.branch?.company_id} width={64} />
            <div className="flex-1 text-center">
              <h1 className="text-sm font-bold uppercase text-gray-900">{data.branch?.name ?? 'CretOS RMC Plant'}</h1>
              {data.branch?.address && <p className="text-gray-600">{data.branch.address}</p>}
              {data.branch?.gstin && <p className="font-mono text-gray-500">GSTIN: {data.branch.gstin}</p>}
            </div>
            <div style={{ width: 64 }} />
          </div>
          <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-600">Ledger Account</p>

          {/* Customer block */}
          <div className="mt-2 border-b border-gray-300 pb-2">
            <p className="text-sm font-bold text-gray-900">{data.customer.name}</p>
            {data.customer.address && <p className="text-gray-600">{data.customer.address}</p>}
            {data.customer.gstin && <p className="font-mono text-gray-500">GST No. : {data.customer.gstin}</p>}
            <p className="mt-1 text-gray-500">Statement as on {formatDate(new Date())}</p>
          </div>

          {/* Ledger table */}
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="py-1 pr-1 font-semibold text-gray-600">Date</th>
                <th className="py-1 pr-1 font-semibold text-gray-600">Particulars</th>
                <th className="py-1 pr-1 font-semibold text-gray-600">Vch. Type</th>
                <th className="py-1 pr-1 font-semibold text-gray-600">Voucher No.</th>
                <th className="py-1 pr-1 text-right font-semibold text-gray-600">Debit</th>
                <th className="py-1 text-right font-semibold text-gray-600">Credit</th>
              </tr>
            </thead>
            <tbody>
              {data.openingBalance !== 0 && (
                <tr className="border-b border-gray-200">
                  <td className="py-1 pr-1" />
                  <td className="py-1 pr-1 font-semibold">{data.openingBalance > 0 ? 'Dr' : 'Cr'} Opening Balance</td>
                  <td className="py-1 pr-1 text-gray-500">Opening Bal</td>
                  <td className="py-1 pr-1" />
                  <td className="py-1 pr-1 text-right font-mono">{data.openingBalance > 0 ? formatINR(data.openingBalance) : ''}</td>
                  <td className="py-1 text-right font-mono">{data.openingBalance < 0 ? formatINR(Math.abs(data.openingBalance)) : ''}</td>
                </tr>
              )}
              {data.rows.length === 0 && data.openingBalance === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400">No invoices or receipts recorded yet</td></tr>
              )}
              {data.rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-1 pr-1 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="py-1 pr-1">
                    <span className="text-gray-500">{r.type === 'INVOICE' ? 'Cr' : 'Dr'}</span>{' '}
                    <span className="font-semibold">{r.particulars}</span>
                  </td>
                  <td className="py-1 pr-1 text-gray-600">{r.vchType}</td>
                  <td className="py-1 pr-1 font-mono">{r.ref}</td>
                  <td className="py-1 pr-1 text-right font-mono">{r.debit ? formatINR(r.debit) : ''}</td>
                  <td className="py-1 text-right font-mono">{r.credit ? formatINR(r.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Balancing summary — Tally's 3-row closing block */}
          <div className="mt-1 border-t border-gray-800 pt-1">
            <div className="flex justify-end gap-6 py-0.5 font-mono">
              <span className="w-24 text-right">{formatINR(totals.totalDebit)}</span>
              <span className="w-24 text-right">{formatINR(totals.totalCredit)}</span>
            </div>
            <div className="flex justify-end gap-6 py-0.5 font-semibold">
              <span className="mr-auto">Closing Balance</span>
              <span className="w-24 text-right font-mono">{formatINR(totals.closingDebitSlot)}</span>
              <span className="w-24 text-right font-mono">{formatINR(totals.closingCreditSlot)}</span>
            </div>
            <div className="flex justify-end gap-6 border-t border-gray-400 py-0.5 font-mono font-semibold">
              <span className="w-24 text-right">{formatINR(totals.grandTotal)}</span>
              <span className="w-24 text-right">{formatINR(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
