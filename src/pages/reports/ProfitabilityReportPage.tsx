import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, IndianRupee, Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { SkeletonRow } from '@/components/shared/DataTable'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatDate, formatINR, formatQty } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'

interface ReportRow {
  id: string
  challanNo: string
  date: string
  jobSite: string
  gradeName: string | null
  qty: number
  customerName: string | null
  vehicleNo: string | null
  revenue: number
  cogs: number
  profit: number
  marginPct: number | null
}

interface ReportData {
  rows: ReportRow[]
  summary: { count: number; totalRevenue: number; totalCogs: number; totalProfit: number; marginPct: number | null }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function monthAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function KPICard({ label, value, sub, icon: Icon, tone = 'default' }:
  { label: string; value: string; sub?: string; icon: React.ElementType; tone?: 'default' | 'good' | 'bad' }) {
  const toneColor = tone === 'good' ? 'text-green-600' : tone === 'bad' ? 'text-red-600' : 'text-gray-900'
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-1.5 text-gray-400">
        <Icon size={13} />
        <span className="section-label">{label}</span>
      </div>
      <p className={`text-xl font-bold font-mono ${toneColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function toCsv(rows: ReportRow[]): string {
  const header = ['Challan No', 'Date', 'Customer', 'Job Site', 'Grade', 'Qty (Cum)', 'Revenue', 'Material Cost', 'Profit', 'Margin %']
  const lines = rows.map(r => [
    r.challanNo, r.date.slice(0, 10), r.customerName ?? '', r.jobSite, r.gradeName ?? '',
    r.qty, r.revenue.toFixed(2), r.cogs.toFixed(2), r.profit.toFixed(2), r.marginPct ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  return [header.join(','), ...lines].join('\n')
}

export default function ProfitabilityReportPage() {
  const user = authStore.getUser()
  const [fromDate, setFromDate] = useState(monthAgoISO())
  const [toDate, setToDate] = useState(todayISO())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['profitability-report', user?.branch?.id, fromDate, toDate],
    queryFn: () => api.get('/reports/profitability', {
      params: { branch_id: user?.branch?.id, from_date: fromDate, to_date: toDate },
    }).then(r => r.data.data as ReportData),
    enabled: !!user?.branch?.id,
  })

  function exportCsv() {
    if (!data?.rows.length) return
    const blob = new Blob([toCsv(data.rows)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `profitability_${fromDate}_to_${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="Profitability Report"
        subtitle="Selling revenue vs raw material cost per dispatched challan — admin only"
        actions={
          <button
            onClick={exportCsv}
            disabled={!data?.rows.length}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={13} /> Export CSV
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
      </div>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Could not load the report. This page is restricted to Admin users.
        </div>
      )}

      {data && (
        <>
          <div className="mb-4 grid grid-cols-4 gap-4">
            <KPICard label="Revenue" value={`₹${formatINR(data.summary.totalRevenue)}`} sub={`${data.summary.count} dispatches`} icon={IndianRupee} />
            <KPICard label="Material Cost (COGS)" value={`₹${formatINR(data.summary.totalCogs)}`} icon={TrendingDown} />
            <KPICard
              label="Gross Profit"
              value={`₹${formatINR(data.summary.totalProfit)}`}
              icon={TrendingUp}
              tone={data.summary.totalProfit >= 0 ? 'good' : 'bad'}
            />
            <KPICard
              label="Margin"
              value={data.summary.marginPct != null ? `${data.summary.marginPct}%` : '—'}
              icon={TrendingUp}
              tone={data.summary.marginPct != null ? (data.summary.marginPct >= 0 ? 'good' : 'bad') : 'default'}
            />
          </div>

          <p className="mb-2 text-xs text-gray-400">
            Material cost is ₹0 for any material never received with a rate attached (Stores &gt; Raw Material Stock &gt; Record Receipt) — not a data error, just no cost recorded yet.
          </p>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="section-label px-4 py-2.5 text-left">Challan No</th>
                  <th className="section-label px-4 py-2.5 text-left">Date</th>
                  <th className="section-label px-4 py-2.5 text-left">Customer</th>
                  <th className="section-label px-4 py-2.5 text-left">Grade</th>
                  <th className="section-label px-4 py-2.5 text-right">Qty</th>
                  <th className="section-label px-4 py-2.5 text-right">Revenue</th>
                  <th className="section-label px-4 py-2.5 text-right">Material Cost</th>
                  <th className="section-label px-4 py-2.5 text-right">Profit</th>
                  <th className="section-label px-4 py-2.5 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                ) : data.rows.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-gray-400">No dispatched challans in this period</td></tr>
                ) : data.rows.map((r, i) => (
                  <tr key={r.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.challanNo}</td>
                    <td className="px-4 py-2.5 text-xs">{formatDate(r.date)}</td>
                    <td className="px-4 py-2.5">{r.customerName ?? '—'}</td>
                    <td className="px-4 py-2.5">{r.gradeName ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right table-num">{formatQty(r.qty)}</td>
                    <td className="px-4 py-2.5 text-right table-num">₹{formatINR(r.revenue)}</td>
                    <td className="px-4 py-2.5 text-right table-num text-gray-600">₹{formatINR(r.cogs)}</td>
                    <td className={`px-4 py-2.5 text-right table-num font-medium ${r.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>₹{formatINR(r.profit)}</td>
                    <td className={`px-4 py-2.5 text-right table-num ${r.marginPct != null && r.marginPct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {r.marginPct != null ? `${r.marginPct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
