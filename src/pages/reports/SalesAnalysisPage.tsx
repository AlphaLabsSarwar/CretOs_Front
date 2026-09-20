import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR, formatQty } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'

interface MonthRow { month: string; qty: number; revenue: number; trips: number }
interface GradeRow { grade: string; qty: number; revenue: number }
interface CustomerRow { customerId: string; customerName: string; qty: number; revenue: number }
interface SalesAnalysis { months: MonthRow[]; byGrade: GradeRow[]; byCustomer: CustomerRow[] }

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="section-label mb-3">{title}</p>
      <div style={{ width: '100%', height: 260 }}>{children}</div>
    </div>
  )
}

const tooltipStyle = { fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }

export default function SalesAnalysisPage() {
  const user = authStore.getUser()
  const [months, setMonths] = useState(6)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sales-analysis', user?.branch?.id, months],
    queryFn: () => api.get('/reports/sales-analysis', { params: { branch_id: user?.branch?.id, months } }).then(r => r.data.data as SalesAnalysis),
    enabled: !!user?.branch?.id,
  })

  return (
    <div>
      <PageHeader
        title="Sales Analysis"
        subtitle="Revenue and volume trends by month, grade, and customer"
        actions={
          <select value={months} onChange={e => setMonths(Number(e.target.value))} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
        }
      />

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Could not load sales analysis. This page requires Admin or Manager access.
        </div>
      )}

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        <div className="space-y-4">
          <ChartCard title="Monthly Revenue">
            <ResponsiveContainer>
              <BarChart data={data.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `₹${formatINR(v)}`} />
                <Bar dataKey="revenue" fill="#ea580c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Revenue by Grade">
              <ResponsiveContainer>
                <BarChart data={data.byGrade} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="grade" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `₹${formatINR(v)}`} />
                  <Bar dataKey="revenue" fill="#0ea5e9" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top 10 Customers by Volume">
              <ResponsiveContainer>
                <BarChart data={data.byCustomer} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="customerName" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${formatQty(v)} cum`} />
                  <Bar dataKey="qty" fill="#22c55e" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="section-label px-4 py-2.5 text-left">Month</th>
                  <th className="section-label px-4 py-2.5 text-right">Trips</th>
                  <th className="section-label px-4 py-2.5 text-right">Qty (Cum)</th>
                  <th className="section-label px-4 py-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.months.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">No dispatches in this period</td></tr>
                ) : data.months.map((m, i) => (
                  <tr key={m.month} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-2.5">{m.month}</td>
                    <td className="px-4 py-2.5 text-right table-num">{m.trips}</td>
                    <td className="px-4 py-2.5 text-right table-num">{formatQty(m.qty)}</td>
                    <td className="px-4 py-2.5 text-right table-num">₹{formatINR(m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
