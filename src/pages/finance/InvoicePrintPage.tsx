import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR, amountInWords, taxAmountInWords, maskAccountNumber } from '@/lib/utils'
import CompanyLogo from '@/components/shared/CompanyLogo'

interface InvoiceItem {
  id: string
  description: string | null
  qty: string | number | null
  rate: string | number | null
  amount: string | number | null
  challan_no: string | null
  challan_date: string | null
  grade_name: string | null
  pump_type: string | null
  job_site: string | null
  vehicle_no: string | null
  driver_name: string | null
  hsn_code: string | null
  po_no: string | null
  po_date: string | null
}

interface InvoicePrintData {
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
  irn: string | null
  ack_no: string | null
  ack_date: string | null
  signed_qr_code: string | null
  eway_bill_no: string | null
  eway_bill_date: string | null
  customer_name: string | null
  customer_gstin: string | null
  customer_address: string | null
  customer_city: string | null
  customer_state: string | null
  customer_mobile: string | null
  branch_name: string | null
  branch_code: string | null
  branch_gstin: string | null
  branch_address: string | null
  branch_city: string | null
  branch_state: string | null
  branch_pin_code: string | null
  branch_email: string | null
  branch_pan_no: string | null
  branch_bank_name: string | null
  branch_bank_branch: string | null
  branch_account_no: string | null
  branch_ifsc_code: string | null
  branch_company_id: string | null
  items: InvoiceItem[]
}

function fmtDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(v: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

// If every line item agrees on a value (vehicle/driver/PO), show it once in
// the summary block below the table — same shape as the reference invoice,
// which assumes one challan (hence one vehicle/driver/PO) per invoice. When
// an invoice bundles several challans with different vehicles/drivers, fall
// back to a clear "Multiple" rather than arbitrarily picking the first row.
function commonValue(items: InvoiceItem[], key: keyof InvoiceItem): string | null {
  const values = [...new Set(items.map(it => it[key]).filter((v): v is string => !!v))]
  if (values.length === 0) return null
  if (values.length === 1) return values[0]
  return 'Multiple'
}

// Boxed label:value cell mimicking the ruled grid in the reference invoice.
function GridCell({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2 border-b border-gray-300 px-2 py-1 last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-semibold text-gray-900' : 'font-mono text-gray-800'}>{value}</span>
    </div>
  )
}

export default function InvoicePrintPage() {
  const { id } = useParams()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice-print', id],
    queryFn: () => api.get(`/finance/invoices/${id}`).then(r => r.data.data as InvoicePrintData),
    enabled: !!id,
  })

  useEffect(() => {
    document.title = invoice ? `Invoice ${invoice.invoice_no}` : 'Tax Invoice'
  }, [invoice])

  // Only e-invoiced invoices carry a signed QR payload (see routes/finance/
  // invoices.ts's submit-einvoice/record-einvoice) — most won't have one yet,
  // in which case this section of the header is simply left blank rather
  // than rendering a broken/empty QR box.
  useEffect(() => {
    if (!invoice?.signed_qr_code) { setQrDataUrl(null); return }
    QRCode.toDataURL(invoice.signed_qr_code, { margin: 0, width: 96 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [invoice?.signed_qr_code])

  if (isLoading || !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xs text-gray-400">
        <Loader2 size={14} className="mr-2 animate-spin" /> Loading invoice...
      </div>
    )
  }

  const items = invoice.items
  const singleItem = items.length === 1 ? items[0] : null
  const vehicleNo = commonValue(items, 'vehicle_no')
  const driverName = commonValue(items, 'driver_name')
  const jobSite = commonValue(items, 'job_site')
  const poNo = commonValue(items, 'po_no')
  const poDate = poNo ? commonValue(items, 'po_date') : null
  const challanNo = singleItem?.challan_no ?? (items.length > 1 ? `${items.length} challans` : null)
  const isGst = invoice.tax_type === 'GST'
  const isIgst = isGst && Number(invoice.igst) > 0
  const cgstRate = isGst && !isIgst && Number(invoice.subtotal) > 0 ? (Number(invoice.cgst) / Number(invoice.subtotal) * 100) : 9
  const sgstRate = cgstRate
  const hasBank = invoice.branch_bank_name || invoice.branch_account_no

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Screen-only toolbar */}
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <Link to={`/finance/invoices/${id}`} className="text-xs text-gray-500 hover:text-gray-800">← Back to Invoice</Link>
        <button
          onClick={() => window.print()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover"
        >
          <Printer size={13} /> Print / Save as PDF
        </button>
      </div>

      {/* Printable sheet — bordered like a Tally-generated Tax Invoice */}
      <div className="mx-auto max-w-3xl border-2 border-gray-800 bg-white p-5 text-[11px] text-gray-800 shadow-sm print:max-w-none print:border print:shadow-none">
        {/* Boxed title */}
        <div className="mb-3 flex justify-center">
          <div className="border-2 border-gray-800 px-6 py-1 text-sm font-bold tracking-wide">TAX INVOICE</div>
        </div>

        {/* Company block + truck mark */}
        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-2">
          <div>
            <h1 className="text-base font-bold uppercase text-gray-900">{invoice.branch_name ?? 'CretOS RMC Plant'}</h1>
            <p className="mt-0.5 text-gray-600">
              Reg. Add : {[invoice.branch_address, invoice.branch_city, invoice.branch_state].filter(Boolean).join(', ')}
              {invoice.branch_pin_code ? `- ${invoice.branch_pin_code}` : ''}
            </p>
            {invoice.branch_email && <p className="text-gray-600">Email ID : {invoice.branch_email}</p>}
          </div>
          <CompanyLogo companyId={invoice.branch_company_id} width={80} />
        </div>

        {/* Company tax details (left) + Invoice/PO grid (right) */}
        <div className="grid grid-cols-2 border-b border-gray-300">
          <div className="border-r border-gray-300 pr-2">
            <p className="border-b border-gray-300 px-2 py-1 font-semibold text-gray-600">Company Tax Details</p>
            <GridCell label="GST NO" value={invoice.branch_gstin ?? '—'} bold />
            <GridCell label="GST State" value={invoice.branch_state ?? '—'} />
            <GridCell label="PAN NO" value={invoice.branch_pan_no ?? '—'} bold />
          </div>
          <div className="pl-2">
            <GridCell label="Invoice No" value={invoice.invoice_no} bold />
            <GridCell label="Invoice Date" value={fmtDate(invoice.date)} bold />
            <GridCell label="PO Date" value={poDate ? fmtDate(poDate) : '—'} />
            <GridCell label="PO No." value={poNo ?? 'NA'} />
          </div>
        </div>

        {/* IRN / e-Way Bill compliance row — always shown for consistency with
            the reference layout; simply reads "—" until this invoice is
            actually e-invoiced/e-way billed (see Admin actions on the Invoice
            Detail page). */}
        <div className="border-b border-gray-300 py-1 text-[10px]">
          <p><span className="font-semibold text-gray-600">IRN No : </span><span className="font-mono">{invoice.irn ?? '—'}</span></p>
          <div className="mt-0.5 flex flex-wrap justify-between gap-x-4">
            <span><span className="font-semibold text-gray-600">Ack No. </span><span className="font-mono">{invoice.ack_no ?? '—'}</span></span>
            <span><span className="font-semibold text-gray-600">Act Date </span>{fmtDateTime(invoice.ack_date)}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap justify-between gap-x-4">
            <span><span className="font-semibold text-gray-600">EWayBill No. </span><span className="font-mono">{invoice.eway_bill_no ?? '—'}</span></span>
            <span><span className="font-semibold text-gray-600">EWayBill Date. </span>{fmtDateTime(invoice.eway_bill_date)}</span>
          </div>
        </div>

        {/* Buyer / Consignee + QR */}
        <div className="flex border-b border-gray-300">
          <div className="w-1/2 border-r border-gray-300 p-2">
            <p className="mb-1 font-semibold text-gray-600">Name &amp; Address of Buyer:</p>
            <p className="font-medium text-gray-900">{invoice.customer_name ?? '—'}</p>
            {invoice.customer_address && <p className="text-gray-600">{invoice.customer_address}</p>}
            <p className="text-gray-600">{[invoice.customer_city, invoice.customer_state].filter(Boolean).join(', ')}</p>
            {invoice.customer_gstin && <p className="mt-0.5"><span className="font-semibold">GST No.: </span><span className="font-mono">{invoice.customer_gstin}</span></p>}
          </div>
          <div className="flex w-1/2 justify-between p-2">
            <div>
              <p className="mb-1 font-semibold text-gray-600">Name &amp; Address of Consignee:</p>
              <p className="font-medium text-gray-900">{invoice.customer_name ?? '—'}</p>
              {/* Delivery address = the challan's job site, since RMC is
                  always consigned to wherever the pour actually happened —
                  the customer master only carries one (billing) address. */}
              {jobSite && jobSite !== 'Multiple' ? <p className="text-gray-600">{jobSite}</p> : null}
              {invoice.customer_gstin && <p className="mt-0.5"><span className="font-semibold">GST No.: </span><span className="font-mono">{invoice.customer_gstin}</span></p>}
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="e-Invoice QR" width={72} height={72} className="ml-2 shrink-0" />}
          </div>
        </div>

        {/* Line items */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="w-8 py-1 pr-1 font-semibold text-gray-600">Sr</th>
              <th className="py-1 pr-1 font-semibold text-gray-600">Product Description</th>
              <th className="py-1 pr-1 text-center font-semibold text-gray-600">HSN/SAC Code</th>
              <th className="py-1 pr-1 text-right font-semibold text-gray-600">Qty</th>
              <th className="py-1 pr-1 text-right font-semibold text-gray-600">Rate in ₹</th>
              <th className="py-1 text-right font-semibold text-gray-600">Amount In ₹</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className="align-top">
                <td className="py-1 pr-1">{idx + 1}</td>
                <td className="py-1 pr-1">
                  <p>Ready Mix Concrete {it.grade_name ?? ''}</p>
                  <p className="text-gray-500">{it.grade_name} {it.pump_type === 'WITH_PUMP' ? 'With Pump' : 'Without Pump'}</p>
                </td>
                <td className="py-1 pr-1 text-center font-mono">{it.hsn_code ?? '—'}</td>
                <td className="py-1 pr-1 text-right font-mono">{it.qty != null ? Number(it.qty).toFixed(2) : '—'}CUM</td>
                <td className="py-1 pr-1 text-right font-mono">{formatINR(Number(it.rate ?? 0))}</td>
                <td className="py-1 text-right font-mono">{formatINR(Number(it.amount ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tax summary + amounts-in-words */}
        <div className="mt-1 flex border-t border-gray-800">
          <div className="w-1/2 border-r border-gray-300 py-1 pr-3 text-[10px]">
            {isGst && !isIgst && (
              <>
                <p><span className="font-semibold">CGST {cgstRate.toFixed(0)}</span> &nbsp; {formatINR(Number(invoice.cgst))} &nbsp; <span className="text-gray-500">Words : {taxAmountInWords(Number(invoice.cgst))}</span></p>
                <p><span className="font-semibold">SGST {sgstRate.toFixed(0)}</span> &nbsp; {formatINR(Number(invoice.sgst))} &nbsp; <span className="text-gray-500">Words : {taxAmountInWords(Number(invoice.sgst))}</span></p>
              </>
            )}
            {isIgst && (
              <p><span className="font-semibold">IGST</span> &nbsp; {formatINR(Number(invoice.igst))} &nbsp; <span className="text-gray-500">Words : {taxAmountInWords(Number(invoice.igst))}</span></p>
            )}
            <p className="mt-2 font-semibold">
              Inv. Value (IN₹): {amountInWords(Number(invoice.total_amount))}
            </p>
          </div>
          <div className="w-1/2 space-y-0.5 py-1 pl-3">
            <div className="flex justify-between"><span className="text-gray-500">Sub Total</span><span className="font-mono">{formatINR(Number(invoice.subtotal))}</span></div>
            {isGst && !isIgst && (
              <>
                <div className="flex justify-between"><span className="text-gray-500">CGST Payable @{cgstRate.toFixed(0)}%</span><span className="font-mono">{formatINR(Number(invoice.cgst))}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">SGST Payable @{sgstRate.toFixed(0)}%</span><span className="font-mono">{formatINR(Number(invoice.sgst))}</span></div>
              </>
            )}
            {isIgst && (
              <div className="flex justify-between"><span className="text-gray-500">IGST Payable</span><span className="font-mono">{formatINR(Number(invoice.igst))}</span></div>
            )}
            {!isGst && (
              <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="font-mono">Non-GST</span></div>
            )}
            <div className="flex justify-between border-t border-gray-800 pt-0.5 text-sm font-bold"><span>Invoice Total</span><span className="font-mono">{formatINR(Number(invoice.total_amount))}</span></div>
          </div>
        </div>

        {/* Transport / delivery + Remarks + Bank */}
        <div className="mt-1 flex border-t border-gray-300 pt-1">
          <div className="w-1/2 space-y-0.5 border-r border-gray-300 pr-3">
            <p><span className="font-semibold text-gray-600">Ch. No/Date: </span><span className="font-mono">{challanNo ?? '—'}</span>{singleItem?.challan_date ? ` (${fmtDate(singleItem.challan_date)})` : ''}</p>
            <p><span className="font-semibold text-gray-600">Vehicle No. </span><span className="font-mono">{vehicleNo ?? '—'}</span></p>
            <p><span className="font-semibold text-gray-600">Driver Name </span>{driverName ?? '—'}</p>
            <p><span className="font-semibold text-gray-600">Transporter: </span>SELF</p>
            <p><span className="font-semibold text-gray-600">Delivery at: </span>{jobSite ?? '—'}</p>
            {invoice.remarks && (
              <p className="pt-1"><span className="font-semibold text-gray-600">Remarks : </span>{invoice.remarks}</p>
            )}
          </div>
          <div className="w-1/2 pl-3">
            {hasBank ? (
              <>
                <p className="font-semibold text-gray-600">Company Bank</p>
                {invoice.branch_bank_name && <p>Bank : {invoice.branch_bank_name}</p>}
                {invoice.branch_account_no && <p>A/c. No.- {maskAccountNumber(invoice.branch_account_no)}</p>}
                {invoice.branch_ifsc_code && <p>IFSC Code: {invoice.branch_ifsc_code}</p>}
                {invoice.branch_bank_branch && <p>Branch : {invoice.branch_bank_branch}</p>}
              </>
            ) : (
              <p className="text-gray-400">Bank details not on file — add them under branch settings.</p>
            )}
          </div>
        </div>

        {/* Signatory footer */}
        <div className="mt-6 flex items-end justify-between border-t border-gray-300 pt-2 text-[10px]">
          <span className="font-semibold text-gray-600">RECEIVED BY</span>
          <span className="font-semibold text-gray-600">SUBJECT TO {(invoice.branch_city ?? '').toUpperCase()} JURISDICTION</span>
          <div className="text-center">
            <p className="mb-8">For, {invoice.branch_name ?? 'CretOS RMC Plant'}</p>
            <p className="border-t border-gray-400 pt-1">Authorised Signatory</p>
          </div>
        </div>

        <p className="mt-3 text-center text-[10px] text-gray-400">This is a Computer Generated Invoice</p>
      </div>
    </div>
  )
}
