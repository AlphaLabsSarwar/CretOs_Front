import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AgingEntry { ref: string; date: string | null; amount: number; days: number; bucket: '0-30' | '31-60' | '60+' }
interface AgingParty { partyId: string; partyName: string; entries: AgingEntry[]; total: number }
interface AgingSide { rows: AgingParty[]; summary: { buckets: Record<string, number>; total: number } }
interface AgingData { ar: AgingSide; ap: AgingSide }

function BucketBar({ summary }: { summary: AgingSide['summary'] }) {
  const total = summary.total || 1
  const segs: { key: string; color: string }[] = [
    { key: '0-30', color: 'bg-green-500' },
    { key: '31-60', color: 'bg-amber-500' },
    { key: '60+', color: 'bg-red-500' },
  ]
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {segs.map(s => (
          <div key={s.key} className={s.color} style={{ width: `${(summary.buckets[s.key] / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
        {segs.map(s => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.color}`} /> {s.key} days: ₹{formatINR(summary.buckets[s.key])}
          </span>
        ))}
      </div>
    </div>
  )
}

function AgingTable({ side, emptyLabel }: { side: AgingSide; emptyLabel: string }) {
  if (side.rows.length === 0) {
    return <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-xs text-gray-400">No outstanding {emptyLabel}</div>
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-1 text-xs text-gray-500">Total outstanding</p>
        <p className="text-xl font-bold font-mono text-gray-900">₹{formatINR(side.summary.total)}</p>
        <div className="mt-3">
          <BucketBar summary={side.summary} />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="section-label px-4 py-2.5 text-left">Party</th>
              <th className="section-label px-4 py-2.5 text-left">Reference(s)</th>
              <th className="section-label px-4 py-2.5 text-right">0-30 days</th>
              <th className="section-label px-4 py-2.5 text-right">31-60 days</th>
              <th className="section-label px-4 py-2.5 text-right">60+ days</th>
              <th className="section-label px-4 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {side.rows.map((r, i) => {
              const byBucket = { '0-30': 0, '31-60': 0, '60+': 0 } as Record<string, number>
              for (const e of r.entries) byBucket[e.bucket] += e.amount
              return (
                <tr key={r.partyId} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.partyName}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{r.entries.map(e => e.ref).join(', ')}</td>
                  <td className="px-4 py-2.5 text-right table-num">{byBucket['0-30'] ? `₹${formatINR(byBucket['0-30'])}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right table-num text-amber-700">{byBucket['31-60'] ? `₹${formatINR(byBucket['31-60'])}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right table-num text-red-600">{byBucket['60+'] ? `₹${formatINR(byBucket['60+'])}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right table-num font-semibold">₹{formatINR(r.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AgingReportPage() {
  const user = authStore.getUser()
  const [tab, setTab] = useState('ar')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['aging-report', user?.branch?.id],
    queryFn: () => api.get('/reports/aging', { params: { branch_id: user?.branch?.id } }).then(r => r.data.data as AgingData),
    enabled: !!user?.branch?.id,
  })

  return (
    <div>
      <PageHeader title="AR / AP Aging" subtitle="Outstanding receivables and payables, bucketed by age — admin only" />

      {isError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Could not load the aging report. This page is restricted to Admin users.
        </div>
      )}

      <p className="mb-4 text-xs text-gray-400">
        Receipts/payments are applied oldest-first against invoices/POs to estimate age — CretOS doesn't track invoice-to-receipt allocation directly.
      </p>

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : data ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="ar">Receivables (AR)</TabsTrigger>
            <TabsTrigger value="ap">Payables (AP)</TabsTrigger>
          </TabsList>
          <TabsContent value="ar"><AgingTable side={data.ar} emptyLabel="receivables" /></TabsContent>
          <TabsContent value="ap"><AgingTable side={data.ap} emptyLabel="payables" /></TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}
