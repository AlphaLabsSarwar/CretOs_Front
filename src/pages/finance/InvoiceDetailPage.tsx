import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/DataTable'
import GstCompliancePanel from '@/components/shared/GstCompliancePanel'
import NotifyButtons from '@/components/shared/NotifyButtons'

interface InvoiceItem {
  id: string
  description: string | null
  qty: string | number | null
  rate: string | number | null
  amount: string | number | null
  challan_no: string | null
  challan_date: string | null
  grade_name: string | null
}

interface InvoiceDetail {
  id: string
  invoice_no: string
  date: string
  tax_type: string
  subtotal: string | number
  cgst: string | number
  sgst: string | number
  igst: string | number
  tax_amount: string | number
  total_amount: string | number
  status: string
  remarks: string | null
  customer_name: string | null
  customer_gstin: string | null
  customer_address: string | null
  customer_city: string | null
  customer_state: string | null
  branch_name: string | null
  branch_code: string | null
  irn: string | null
  ack_no: string | null
  ack_date: string | null
  eway_bill_no: string | null
  eway_bill_date: string | null
  items: InvoiceItem[]
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/finance/invoices/${id}`).then(r => r.data.data as InvoiceDetail),
    enabled: !!id,
  })

  const user = authStore.getUser()
  const canApprove = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const post = useMutation({
    mutationFn: () => api.post(`/finance/invoices/${id}/post`),
    onSuccess: (res) => {
      const pending = res.data.data.status === 'PENDING_APPROVAL'
      toast({ variant: 'success', title: pending ? 'Submitted for approval' : 'Invoice posted', description: pending ? 'This invoice is over the auto-approval limit and needs Admin/Manager sign-off.' : undefined })
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const approve = useMutation({
    mutationFn: () => api.post(`/finance/invoices/${id}/approve`),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Invoice approved and posted' })
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not approve', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const reject = useMutation({
    mutationFn: () => api.post(`/finance/invoices/${id}/reject`),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Invoice rejected' })
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not reject', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  if (isLoading || !invoice) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Loader2 size={13} className="animate-spin" /> Loading invoice...
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoice_no}`}
        subtitle={`${invoice.branch_name ?? ''} · ${new Date(invoice.date).toLocaleDateString('en-IN')}`}
        actions={<StatusBadge status={invoice.status} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="section-label mb-2">Bill To</p>
          <p className="text-sm font-medium text-gray-800">{invoice.customer_name ?? '—'}</p>
          {invoice.customer_address && <p className="text-xs text-gray-500 mt-0.5">{invoice.customer_address}</p>}
          <p className="text-xs text-gray-500">{[invoice.customer_city, invoice.customer_state].filter(Boolean).join(', ')}</p>
          {invoice.customer_gstin && <p className="mt-1 font-mono text-xs text-gray-600">GSTIN: {invoice.customer_gstin}</p>}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="section-label mb-2">Summary</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-mono text-gray-800">₹{formatINR(Number(invoice.subtotal))}</span></div>
            {invoice.tax_type === 'GST' && (
              <>
                <div className="flex justify-between"><span className="text-gray-500">CGST (9%)</span><span className="font-mono text-gray-800">₹{formatINR(Number(invoice.cgst))}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">SGST (9%)</span><span className="font-mono text-gray-800">₹{formatINR(Number(invoice.sgst))}</span></div>
              </>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-1 font-semibold"><span className="text-gray-700">Total</span><span className="font-mono text-gray-900">₹{formatINR(Number(invoice.total_amount))}</span></div>
          </div>
        </div>
      </div>

      <p className="section-label mb-2">Dispatch Challans Billed</p>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="section-label px-4 py-2.5 text-left">Challan No</th>
              <th className="section-label px-4 py-2.5 text-left">Date</th>
              <th className="section-label px-4 py-2.5 text-left">Grade</th>
              <th className="section-label px-4 py-2.5 text-right">Qty</th>
              <th className="section-label px-4 py-2.5 text-right">Rate</th>
              <th className="section-label px-4 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={it.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                <td className="px-4 py-2.5 font-mono text-xs">{it.challan_no ?? '—'}</td>
                <td className="px-4 py-2.5">{it.challan_date ? new Date(it.challan_date).toLocaleDateString('en-IN') : '—'}</td>
                <td className="px-4 py-2.5">{it.grade_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-right table-num">{it.qty != null ? Number(it.qty).toFixed(2) : '—'}</td>
                <td className="px-4 py-2.5 text-right table-num">₹{formatINR(Number(it.rate ?? 0))}</td>
                <td className="px-4 py-2.5 text-right table-num font-medium">₹{formatINR(Number(it.amount ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoice.status === 'POSTED' && (
        <GstCompliancePanel
          invoiceId={invoice.id}
          irn={invoice.irn}
          ackNo={invoice.ack_no}
          ewayBillNo={invoice.eway_bill_no}
          onRecorded={() => queryClient.invalidateQueries({ queryKey: ['invoice', id] })}
        />
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
        <Link to="/finance/invoices" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
        <div className="flex items-center gap-2">
          {invoice.status === 'POSTED' && (
            <NotifyButtons entityType="INVOICE" entityId={invoice.id} linksUrl={`/finance/invoices/${id}/notify-links`} />
          )}
          <Link
            to={`/finance/invoices/${id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer size={13} /> Print
          </Link>
          {invoice.status === 'DRAFT' && (
            <button
              type="button"
              disabled={post.isPending}
              onClick={() => post.mutate()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {post.isPending && <Loader2 size={13} className="animate-spin" />}
              {post.isPending ? 'Posting...' : 'Post Invoice'}
            </button>
          )}
          {invoice.status === 'PENDING_APPROVAL' && canApprove && (
            <>
              <button
                type="button"
                disabled={reject.isPending}
                onClick={() => reject.mutate()}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-red-300 px-4 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={approve.isPending}
                onClick={() => approve.mutate()}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {approve.isPending && <Loader2 size={13} className="animate-spin" />}
                Approve & Post
              </button>
            </>
          )}
          {invoice.status === 'PENDING_APPROVAL' && !canApprove && (
            <span className="text-xs text-purple-600">Awaiting Admin/Manager approval</span>
          )}
        </div>
      </div>
    </div>
  )
}
