import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import CompanyLogo from '@/components/shared/CompanyLogo'

interface QuotationPrintData {
  id: string
  quot_no: string
  date: string
  valid_date: string
  inquiry_no: string | null
  ref_no: string | null
  project_site: string
  address: string | null
  kind_attn: string | null
  mobile: string | null
  email: string | null
  heading: string | null
  remarks: string | null
  status: string
  customer_name: string | null
  customer_gstin: string | null
  customer_address: string | null
  customer_city: string | null
  customer_state: string | null
  branch_name: string | null
  branch_code: string | null
  branch_gstin: string | null
  branch_address: string | null
  branch_city: string | null
  branch_state: string | null
  branch_pin_code: string | null
  branch_email: string | null
  branch_phone: string | null
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

export default function QuotationPrintPage() {
  const { id } = useParams()

  const { data: quot, isLoading } = useQuery({
    queryKey: ['quotation-print', id],
    queryFn: () => api.get(`/marketing/quotations/${id}`).then(r => r.data.data as QuotationPrintData),
    enabled: !!id,
  })

  useEffect(() => {
    document.title = quot ? `Quotation ${quot.quot_no}` : 'Quotation'
  }, [quot])

  if (isLoading || !quot) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xs text-gray-400">
        <Loader2 size={14} className="mr-2 animate-spin" /> Loading quotation...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <Link to={`/marketing/quotations/${id}/edit`} className="text-xs text-gray-500 hover:text-gray-800">← Back to Quotation</Link>
        <button
          onClick={() => window.print()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover"
        >
          <Printer size={13} /> Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto max-w-3xl border-2 border-gray-800 bg-white p-5 text-[11px] text-gray-800 shadow-sm print:max-w-none print:border print:shadow-none">
        <div className="mb-3 flex justify-center">
          <div className="border-2 border-gray-800 px-6 py-1 text-sm font-bold tracking-wide">QUOTATION</div>
        </div>

        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-2">
          <div>
            <h1 className="text-base font-bold uppercase text-gray-900">{quot.branch_name ?? 'CretOS RMC Plant'}</h1>
            <p className="mt-0.5 text-gray-600">
              {[quot.branch_address, quot.branch_city, quot.branch_state].filter(Boolean).join(', ')}
              {quot.branch_pin_code ? `- ${quot.branch_pin_code}` : ''}
            </p>
            {quot.branch_gstin && <p className="font-mono text-gray-600">GSTIN: {quot.branch_gstin}</p>}
            {(quot.branch_phone || quot.branch_email) && (
              <p className="text-gray-600">{[quot.branch_phone, quot.branch_email].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <CompanyLogo companyId={quot.branch_company_id} width={80} />
        </div>

        <div className="grid grid-cols-2 border-b border-gray-300">
          <div className="border-r border-gray-300 pr-2">
            <GridCell label="Quotation No" value={quot.quot_no} bold />
            <GridCell label="Date" value={fmtDate(quot.date)} bold />
            <GridCell label="Valid Till" value={fmtDate(quot.valid_date)} />
          </div>
          <div className="pl-2">
            <GridCell label="Ref No" value={quot.ref_no ?? '—'} />
            <GridCell label="Inquiry No" value={quot.inquiry_no ?? '—'} />
            <GridCell label="Status" value={quot.status} />
          </div>
        </div>

        <div className="border-b border-gray-300 p-2">
          <p className="mb-1 font-semibold text-gray-600">To:</p>
          <p className="font-medium text-gray-900">{quot.customer_name ?? '—'}</p>
          {quot.customer_address && <p className="text-gray-600">{quot.customer_address}</p>}
          <p className="text-gray-600">{[quot.customer_city, quot.customer_state].filter(Boolean).join(', ')}</p>
          {quot.customer_gstin && <p className="mt-0.5"><span className="font-semibold">GST No.: </span><span className="font-mono">{quot.customer_gstin}</span></p>}
          {quot.kind_attn && <p className="mt-1"><span className="font-semibold text-gray-600">Kind Attn: </span>{quot.kind_attn}{quot.mobile ? ` (${quot.mobile})` : ''}</p>}
          <p className="mt-1"><span className="font-semibold text-gray-600">Project / Site: </span>{quot.project_site}</p>
          {quot.address && <p><span className="font-semibold text-gray-600">Site Address: </span>{quot.address}</p>}
        </div>

        {/* Body — a rate quotation here is a written offer (heading + terms
            in remarks), not a priced line-item grid; there's no per-grade
            rate table in this data model, so the letter content is
            presented as-is rather than fabricated into a fake table. */}
        <div className="min-h-[200px] py-3">
          {quot.heading && <p className="mb-3 font-semibold text-gray-900">{quot.heading}</p>}
          {quot.remarks && <p className="whitespace-pre-wrap text-gray-800">{quot.remarks}</p>}
          {!quot.heading && !quot.remarks && <p className="text-gray-400">No quotation content on file.</p>}
        </div>

        <div className="mt-10 flex items-end justify-between border-t border-gray-300 pt-2 text-[10px]">
          <p className="text-gray-500">This quotation is valid until {fmtDate(quot.valid_date)}, subject to prevailing rates thereafter.</p>
          <div className="shrink-0 text-center">
            <p className="mb-8">For, {quot.branch_name ?? 'CretOS RMC Plant'}</p>
            <p className="border-t border-gray-400 pt-1">Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  )
}
