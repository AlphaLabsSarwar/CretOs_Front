import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import CompanyLogo from '@/components/shared/CompanyLogo'

interface POPrintData {
  id: string
  po_no: string
  date: string
  po_type: string | null
  tax_type: string
  ref_no: string | null
  valid_date: string
  payment_term: string | null
  currency: string
  del_address: string | null
  sub_total: string | number
  total_amount: string | number
  remarks: string | null
  status: string
  vendor_name: string | null
  vendor_gstin: string | null
  vendor_pan_no: string | null
  vendor_address: string | null
  vendor_city: string | null
  vendor_state: string | null
  vendor_mobile: string | null
  vendor_email: string | null
  branch_name: string | null
  branch_code: string | null
  branch_gstin: string | null
  branch_pan_no: string | null
  branch_address: string | null
  branch_city: string | null
  branch_state: string | null
  branch_pin_code: string | null
  branch_email: string | null
  branch_company_id: string | null
}

function fmtDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function GridCell({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2 border-b border-gray-300 px-2 py-1 last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-semibold text-gray-900' : 'font-mono text-gray-800'}>{value}</span>
    </div>
  )
}

export default function POPrintPage() {
  const { id } = useParams()

  const { data: po, isLoading } = useQuery({
    queryKey: ['po-print', id],
    queryFn: () => api.get(`/stores/po/${id}`).then(r => r.data.data as POPrintData),
    enabled: !!id,
  })

  useEffect(() => {
    document.title = po ? `PO ${po.po_no}` : 'Purchase Order'
  }, [po])

  if (isLoading || !po) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xs text-gray-400">
        <Loader2 size={14} className="mr-2 animate-spin" /> Loading purchase order...
      </div>
    )
  }

  const subTotal = Number(po.sub_total)
  const totalAmount = Number(po.total_amount)
  const taxAmount = totalAmount - subTotal
  const isGst = po.tax_type === 'GST'

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <Link to={`/stores/po/${id}/edit`} className="text-xs text-gray-500 hover:text-gray-800">← Back to Purchase Order</Link>
        <button
          onClick={() => window.print()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover"
        >
          <Printer size={13} /> Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto max-w-3xl border-2 border-gray-800 bg-white p-5 text-[11px] text-gray-800 shadow-sm print:max-w-none print:border print:shadow-none">
        <div className="mb-3 flex justify-center">
          <div className="border-2 border-gray-800 px-6 py-1 text-sm font-bold tracking-wide">PURCHASE ORDER</div>
        </div>

        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-2">
          <div>
            <h1 className="text-base font-bold uppercase text-gray-900">{po.branch_name ?? 'CretOS RMC Plant'}</h1>
            <p className="mt-0.5 text-gray-600">
              {[po.branch_address, po.branch_city, po.branch_state].filter(Boolean).join(', ')}
              {po.branch_pin_code ? `- ${po.branch_pin_code}` : ''}
            </p>
            {po.branch_gstin && <p className="font-mono text-gray-600">GSTIN: {po.branch_gstin}</p>}
          </div>
          <CompanyLogo companyId={po.branch_company_id} width={80} />
        </div>

        <div className="grid grid-cols-2 border-b border-gray-300">
          <div className="border-r border-gray-300 pr-2">
            <p className="border-b border-gray-300 px-2 py-1 font-semibold text-gray-600">Company Tax Details</p>
            <GridCell label="GST NO" value={po.branch_gstin ?? '—'} bold />
            <GridCell label="PAN NO" value={po.branch_pan_no ?? '—'} bold />
            <GridCell label="Status" value={po.status} />
          </div>
          <div className="pl-2">
            <GridCell label="PO No" value={po.po_no} bold />
            <GridCell label="PO Date" value={fmtDate(po.date)} bold />
            <GridCell label="Ref No" value={po.ref_no ?? '—'} />
            <GridCell label="Valid Till" value={fmtDate(po.valid_date)} />
          </div>
        </div>

        {/* Vendor + delivery */}
        <div className="flex border-b border-gray-300">
          <div className="w-1/2 border-r border-gray-300 p-2">
            <p className="mb-1 font-semibold text-gray-600">Vendor:</p>
            <p className="font-medium text-gray-900">{po.vendor_name ?? '—'}</p>
            {po.vendor_address && <p className="text-gray-600">{po.vendor_address}</p>}
            <p className="text-gray-600">{[po.vendor_city, po.vendor_state].filter(Boolean).join(', ')}</p>
            {po.vendor_gstin && <p className="mt-0.5"><span className="font-semibold">GST No.: </span><span className="font-mono">{po.vendor_gstin}</span></p>}
            {po.vendor_mobile && <p className="text-gray-600">{po.vendor_mobile}</p>}
          </div>
          <div className="w-1/2 p-2">
            <p className="mb-1 font-semibold text-gray-600">Delivery Address:</p>
            <p className="text-gray-900">{po.del_address ?? 'Same as company address'}</p>
            <p className="mt-2"><span className="font-semibold text-gray-600">Payment Term: </span>{po.payment_term ?? '—'}</p>
            <p><span className="font-semibold text-gray-600">PO Type: </span>{po.po_type ?? '—'}</p>
          </div>
        </div>

        {/* Value summary — no per-item breakdown exists in this data model
            (a PO here is a single agreed value, not a line-itemized order),
            so this presents the same sub-total/tax/total shape the form
            captures rather than fabricating line items. */}
        <div className="mt-1 flex justify-end border-t border-gray-800 pt-1">
          <div className="w-60 space-y-0.5">
            <div className="flex justify-between"><span className="text-gray-500">Sub Total</span><span className="font-mono">{formatINR(subTotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{isGst ? 'GST @ 18%' : 'Tax'}</span><span className="font-mono">{isGst ? formatINR(taxAmount) : 'Non-GST'}</span></div>
            <div className="flex justify-between border-t border-gray-300 pt-0.5 text-sm font-bold"><span>Order Value</span><span className="font-mono">{formatINR(totalAmount)}</span></div>
            <p className="pt-0.5 text-right text-[10px] text-gray-400">Currency: {po.currency}</p>
          </div>
        </div>

        {po.remarks && (
          <div className="mt-1 border-t border-gray-300 py-1 text-[10px]">
            <span className="font-semibold text-gray-600">Remarks / Terms : </span>{po.remarks}
          </div>
        )}

        <div className="mt-10 flex items-end justify-between border-t border-gray-300 pt-2 text-[10px]">
          <div className="text-center">
            <p className="mb-8">Vendor Acknowledgement</p>
            <p className="border-t border-gray-400 pt-1">Signature &amp; Stamp</p>
          </div>
          <div className="text-center">
            <p className="mb-8">For, {po.branch_name ?? 'CretOS RMC Plant'}</p>
            <p className="border-t border-gray-400 pt-1">Authorised Signatory</p>
          </div>
        </div>

        <p className="mt-3 text-center text-[10px] text-gray-400">This is a Computer Generated Purchase Order</p>
      </div>
    </div>
  )
}
