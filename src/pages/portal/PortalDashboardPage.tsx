import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LogOut, Package } from 'lucide-react'
import { portalApi } from '@/lib/portalApi'
import { portalAuthStore } from '@/store/portalAuth'
import { formatDate, formatINR, formatQty } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/DataTable'
import RmcLoader from '@/components/shared/RmcLoader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface InvoiceRow { id: string; invoice_no: string; date: string; subtotal: number; tax_amount: number; total_amount: number; status: string }
interface StatementRow { date: string; type: 'INVOICE' | 'RECEIPT'; ref: string; debit: number; credit: number; balance: number }
interface Statement { openingBalance: number; rows: StatementRow[]; closingBalance: number }
interface DeliveryRow { id: string; challan_no: string; date: string; job_site: string; grade_name: string | null; qty: number; status: string; tracking_code: string | null }

function InvoicesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal-invoices'],
    queryFn: () => portalApi.get('/invoices').then(r => r.data.data.data as InvoiceRow[]),
  })
  if (isLoading) return <RmcLoader size="sm" />
  if (!data?.length) return <p className="text-xs text-gray-400">No invoices yet.</p>
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="section-label px-4 py-2.5 text-left">Invoice No</th>
            <th className="section-label px-4 py-2.5 text-left">Date</th>
            <th className="section-label px-4 py-2.5 text-right">Subtotal</th>
            <th className="section-label px-4 py-2.5 text-right">GST</th>
            <th className="section-label px-4 py-2.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((i, idx) => (
            <tr key={i.id} className={`border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
              <td className="px-4 py-2.5 font-mono text-xs">{i.invoice_no}</td>
              <td className="px-4 py-2.5 text-xs">{formatDate(i.date)}</td>
              <td className="px-4 py-2.5 text-right table-num">₹{formatINR(Number(i.subtotal))}</td>
              <td className="px-4 py-2.5 text-right table-num">₹{formatINR(Number(i.tax_amount))}</td>
              <td className="px-4 py-2.5 text-right table-num font-semibold">₹{formatINR(Number(i.total_amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatementTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal-statement'],
    queryFn: () => portalApi.get('/statement').then(r => r.data.data as Statement),
  })
  if (isLoading) return <RmcLoader size="sm" />
  if (!data) return null
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-400">Opening Balance</p>
          <p className="mt-1 font-mono text-lg font-semibold">₹{formatINR(data.openingBalance)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-400">Closing Balance</p>
          <p className={`mt-1 font-mono text-lg font-semibold ${data.closingBalance >= 0 ? 'text-red-600' : 'text-green-700'}`}>
            ₹{formatINR(Math.abs(data.closingBalance))} {data.closingBalance >= 0 ? 'Dr' : 'Cr'}
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="section-label px-4 py-2.5 text-left">Date</th>
              <th className="section-label px-4 py-2.5 text-left">Type</th>
              <th className="section-label px-4 py-2.5 text-left">Reference</th>
              <th className="section-label px-4 py-2.5 text-right">Debit</th>
              <th className="section-label px-4 py-2.5 text-right">Credit</th>
              <th className="section-label px-4 py-2.5 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">No transactions yet</td></tr>
            ) : data.rows.map((r, i) => (
              <tr key={i} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                <td className="px-4 py-2.5 text-xs">{formatDate(r.date)}</td>
                <td className="px-4 py-2.5">{r.type}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.ref}</td>
                <td className="px-4 py-2.5 text-right table-num">{r.debit ? `₹${formatINR(r.debit)}` : '—'}</td>
                <td className="px-4 py-2.5 text-right table-num">{r.credit ? `₹${formatINR(r.credit)}` : '—'}</td>
                <td className="px-4 py-2.5 text-right table-num font-semibold">₹{formatINR(Math.abs(r.balance))} {r.balance >= 0 ? 'Dr' : 'Cr'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DeliveriesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal-deliveries'],
    queryFn: () => portalApi.get('/deliveries').then(r => r.data.data as DeliveryRow[]),
  })
  if (isLoading) return <RmcLoader size="sm" />
  if (!data?.length) return <p className="text-xs text-gray-400">No deliveries yet.</p>
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <Package size={16} className="text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-800">{d.challan_no} — {d.grade_name ?? 'Concrete'}</p>
              <p className="text-xs text-gray-500">{formatDate(d.date)} · {d.job_site} · {formatQty(d.qty)} cum</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={d.status} />
            {d.tracking_code && (
              <a href={`/track/${d.tracking_code}`} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">Track</a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PortalDashboardPage() {
  const navigate = useNavigate()
  const customer = portalAuthStore.getCustomer()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="font-bold text-gray-900">CretOS Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{customer?.name}</span>
            <button
              onClick={() => { portalAuthStore.clear(); navigate('/portal/login') }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-6">
        <h1 className="page-title mb-1">Welcome, {customer?.name}</h1>
        <p className="mb-5 text-xs text-gray-500">Your invoices, running balance, and delivery history</p>

        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="statement">Statement</TabsTrigger>
            <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="statement"><StatementTab /></TabsContent>
          <TabsContent value="deliveries"><DeliveriesTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
