import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import AnimatedNumber from '@/components/shared/AnimatedNumber'

interface CashbookEntry {
  id: string
  number: string
  date: string
  direction: 'IN' | 'OUT'
  party: string | null
  remarks: string | null
  amount: number
  balance: number
}
interface CashbookData {
  from: string
  to: string
  openingBalance: number
  entries: CashbookEntry[]
  totalIn: number
  totalOut: number
  closingBalance: number
}

function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function CashbookPage() {
  const user = authStore.getUser()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cashbook', user?.branch?.id, from, to],
    queryFn: () => api.get('/finance/cashbook', { params: { branch_id: user?.branch?.id, from, to } }).then(r => r.data.data as CashbookData),
    enabled: !!user?.branch?.id,
  })

  return (
    <div>
      <PageHeader title="Petty Cash Register" subtitle="Day-to-day cash payments and receipts — vendor settlements, labour wages, site expenses — pulled from your Payment and Receipt Vouchers" />

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

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Could not load the register. Please try again.</div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="section-label mb-1">Opening Balance</p>
              <AnimatedNumber value={data.openingBalance} format={n => `₹${formatINR(n)}`} className="text-base font-semibold text-gray-800" />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="section-label mb-1">Received</p>
              <AnimatedNumber value={data.totalIn} format={n => `₹${formatINR(n)}`} className="text-base font-semibold text-gray-800" />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="section-label mb-1">Paid</p>
              <AnimatedNumber value={data.totalOut} format={n => `₹${formatINR(n)}`} className="text-base font-semibold text-gray-800" />
            </div>
            <div className="rounded-xl border border-accent/30 bg-white p-3">
              <p className="section-label mb-1">Closing Balance</p>
              <AnimatedNumber value={data.closingBalance} format={n => `₹${formatINR(n)}`} className="text-base font-semibold text-gray-900" />
            </div>
          </div>

          {data.entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-10 text-center">
              <Wallet size={22} className="text-gray-300" />
              <p className="text-xs text-gray-400">No cash entries in this period.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Voucher</th>
                    <th className="px-4 py-2.5 font-medium">Party</th>
                    <th className="px-4 py-2.5 font-medium">Remarks</th>
                    <th className="px-4 py-2.5 text-right font-medium">Received</th>
                    <th className="px-4 py-2.5 text-right font-medium">Paid</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map(e => (
                    <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-500">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-700">{e.number}</td>
                      <td className="px-4 py-2.5 text-gray-800">{e.party ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400">{e.remarks ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-700">{e.direction === 'IN' ? `₹${formatINR(e.amount)}` : ''}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-700">{e.direction === 'OUT' ? `₹${formatINR(e.amount)}` : ''}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-gray-900">₹{formatINR(e.balance)}</td>
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
