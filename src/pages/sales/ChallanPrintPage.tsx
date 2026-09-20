import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Link2, Loader2, Printer, ScanLine } from 'lucide-react'
import QRCode from 'qrcode'
import { api } from '@/lib/api'
import { formatINR, formatQty } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import NotifyButtons from '@/components/shared/NotifyButtons'
import CompanyLogo from '@/components/shared/CompanyLogo'

interface ChallanPrintData {
  id: string
  challan_no: string
  date: string
  batch_no: string | null
  job_site: string
  order_no: string | null
  grade_name: string | null
  grade_code: string | null
  qty: string | number
  act_qty: string | number | null
  dispatch_time: string
  site_in: string | null
  site_out: string | null
  serial_no: string | null
  pump_type: string
  pump_no: string | null
  start_km: string | number | null
  end_km: string | number | null
  distance: string | number | null
  slump: string | number | null
  helper: string | null
  tax_type: string
  rate: string | number | null
  subtotal: string | number | null
  toll_tax: string | number | null
  invoice_total: string | number | null
  remarks: string | null
  status: string
  customer_name: string | null
  customer_mobile: string | null
  customer_gstin: string | null
  customer_address: string | null
  customer_city: string | null
  customer_state: string | null
  vehicle_no: string | null
  vehicle_type: string | null
  driver_name: string | null
  driver_mobile: string | null
  driver_license_no: string | null
  branch_name: string | null
  branch_code: string | null
  branch_gstin: string | null
  branch_address: string | null
  branch_city: string | null
  branch_state: string | null
  branch_pin_code: string | null
  branch_pan_no: string | null
  branch_company_id: string | null
  tracking_code: string | null
}

function fmtDateTime(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Boxed label:value cell — same ruled-grid look used on InvoicePrintPage.
function GridCell({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2 border-b border-gray-300 px-2 py-1 last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-semibold text-gray-900' : 'font-mono text-gray-800'}>{value}</span>
    </div>
  )
}

export default function ChallanPrintPage() {
  const { id } = useParams()
  const { toast } = useToast()

  const { data: challan, isLoading } = useQuery({
    queryKey: ['challan-print', id],
    queryFn: () => api.get(`/sales/challans/${id}`).then(r => r.data.data as ChallanPrintData),
    enabled: !!id,
  })

  useEffect(() => {
    document.title = challan ? `Challan ${challan.challan_no}` : 'Dispatch Challan'
  }, [challan])

  // The dispatch QR the driver app scans to mark arrival and, at the site,
  // delivery (see apps/api's routes/sales/challans.ts GET /:id/qr and
  // routes/driverApp/trips.ts). Fetched as a blob rather than a plain
  // <img src>, since the route needs the staff JWT (see lib/api.ts's
  // interceptor) that only axios attaches — a bare <img> tag has no way to
  // send an Authorization header. Revoked on unmount so this doesn't leak
  // object URLs across navigations.
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [passportQrUrl, setPassportQrUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!id) return
    let objectUrl: string | null = null
    api.get(`/sales/challans/${id}/qr`, { responseType: 'blob' })
      .then(res => {
        objectUrl = URL.createObjectURL(res.data)
        setQrUrl(objectUrl)
      })
      .catch(() => setQrUrl(null))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id])

  if (isLoading || !challan) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xs text-gray-400">
        <Loader2 size={14} className="mr-2 animate-spin" /> Loading challan...
      </div>
    )
  }

  const subtotal = challan.subtotal != null ? Number(challan.subtotal) : null
  const tollTax = challan.toll_tax != null ? Number(challan.toll_tax) : null
  const invoiceTotal = challan.invoice_total != null ? Number(challan.invoice_total) : null

  async function copyTrackingLink() {
    if (!challan?.tracking_code) return
    const url = `${window.location.origin}/track/${challan.tracking_code}`
    await navigator.clipboard.writeText(url)
    toast({ variant: 'success', title: 'Tracking link copied' })
  }

  async function copyPassportLink() {
    if (!challan?.tracking_code) return
    const url = `${window.location.origin}/passport/${challan.tracking_code}`
    await navigator.clipboard.writeText(url)
    toast({ variant: 'success', title: 'Batch passport link copied' })
  }

  useEffect(() => {
    if (!challan?.tracking_code) { setPassportQrUrl(null); return }
    const url = `${window.location.origin}/passport/${challan.tracking_code}`
    QRCode.toDataURL(url, { margin: 0, width: 88 }).then(setPassportQrUrl).catch(() => setPassportQrUrl(null))
  }, [challan?.tracking_code])

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Screen-only toolbar */}
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <Link to={`/sales/challans/${id}/edit`} className="text-xs text-gray-500 hover:text-gray-800">← Back to Challan</Link>
        <div className="flex items-center gap-2">
          {challan.tracking_code && (
            <button
              onClick={copyTrackingLink}
              title="Copy public tracking link"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Link2 size={13} /> Copy Tracking Link
            </button>
          )}
          {challan.tracking_code && (
            <button
              onClick={copyPassportLink}
              title="Copy digital batch passport link"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ScanLine size={13} /> Copy Batch Passport Link
            </button>
          )}
          <NotifyButtons entityType="CHALLAN" entityId={challan.id} linksUrl={`/sales/challans/${id}/notify-links`} />
          <button
            onClick={() => window.print()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover"
          >
            <Printer size={13} /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Printable sheet — bordered A4 sheet, same visual language as the
          Tax Invoice / Ledger Statement prints. */}
      <div className="mx-auto max-w-3xl border-2 border-gray-800 bg-white p-5 text-[11px] text-gray-800 shadow-sm print:max-w-none print:border print:shadow-none">
        {/* Boxed title */}
        <div className="mb-3 flex justify-center">
          <div className="border-2 border-gray-800 px-6 py-1 text-sm font-bold tracking-wide">DELIVERY CHALLAN</div>
        </div>

        {/* Company block + truck mark + dispatch QR */}
        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-2">
          <div>
            <h1 className="text-base font-bold uppercase text-gray-900">{challan.branch_name ?? 'CretOS RMC Plant'}</h1>
            <p className="mt-0.5 text-gray-600">
              {[challan.branch_address, challan.branch_city, challan.branch_state].filter(Boolean).join(', ')}
              {challan.branch_pin_code ? `- ${challan.branch_pin_code}` : ''}
            </p>
            {challan.branch_gstin && <p className="font-mono text-gray-600">GSTIN: {challan.branch_gstin}</p>}
          </div>
          <div className="flex items-start gap-3">
            {qrUrl && (
              <div className="text-center">
                <img src={qrUrl} alt="Dispatch QR" className="h-16 w-16" />
                <p className="mt-0.5 text-[8px] leading-tight text-gray-400">Driver scans to<br />start / end trip</p>
              </div>
            )}
            <CompanyLogo companyId={challan.branch_company_id} width={72} />
          </div>
        </div>

        {/* Company tax details (left) + Challan No/Date/Order/Batch grid (right) */}
        <div className="grid grid-cols-2 border-b border-gray-300">
          <div className="border-r border-gray-300 pr-2">
            <p className="border-b border-gray-300 px-2 py-1 font-semibold text-gray-600">Company Tax Details</p>
            <GridCell label="GST NO" value={challan.branch_gstin ?? '—'} bold />
            <GridCell label="PAN NO" value={challan.branch_pan_no ?? '—'} bold />
            <GridCell label="Status" value={challan.status} />
          </div>
          <div className="pl-2">
            <GridCell label="Challan No" value={challan.challan_no} bold />
            <GridCell label="Date" value={fmtDate(challan.date)} bold />
            <GridCell label="Order No" value={challan.order_no ?? '—'} />
            <GridCell label="Batch No" value={challan.batch_no ?? '—'} />
          </div>
        </div>

        {/* Customer / delivery block */}
        <div className="flex border-b border-gray-300">
          <div className="w-1/2 border-r border-gray-300 p-2">
            <p className="mb-1 font-semibold text-gray-600">Name &amp; Address of Buyer:</p>
            <p className="font-medium text-gray-900">{challan.customer_name ?? '—'}</p>
            {challan.customer_address && <p className="text-gray-600">{challan.customer_address}</p>}
            <p className="text-gray-600">{[challan.customer_city, challan.customer_state].filter(Boolean).join(', ')}</p>
            {challan.customer_gstin && <p className="mt-0.5"><span className="font-semibold">GST No.: </span><span className="font-mono">{challan.customer_gstin}</span></p>}
            {challan.customer_mobile && <p className="text-gray-600">{challan.customer_mobile}</p>}
          </div>
          <div className="w-1/2 p-2">
            <p className="mb-1 font-semibold text-gray-600">Delivery at (Job Site):</p>
            <p className="text-gray-900">{challan.job_site}</p>
            <p className="mt-2"><span className="font-semibold text-gray-600">Dispatch Time: </span>{fmtDateTime(challan.dispatch_time)}</p>
          </div>
        </div>

        {/* Vehicle / driver */}
        <div className="flex border-b border-gray-300 py-1 text-[10px]">
          <div className="w-1/2 pr-2">
            <p><span className="font-semibold text-gray-600">Vehicle No. </span><span className="font-mono">{challan.vehicle_no ?? '—'}</span>{challan.vehicle_type ? ` (${challan.vehicle_type})` : ''}</p>
          </div>
          <div className="w-1/2 pl-2">
            <p><span className="font-semibold text-gray-600">Driver Name </span>{challan.driver_name ?? '—'}{challan.driver_mobile ? ` — ${challan.driver_mobile}` : ''}{challan.driver_license_no ? ` (Lic: ${challan.driver_license_no})` : ''}</p>
          </div>
        </div>

        {/* Line item */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="py-1 pr-1 font-semibold text-gray-600">Grade</th>
              <th className="py-1 pr-1 text-right font-semibold text-gray-600">Qty</th>
              <th className="py-1 pr-1 text-right font-semibold text-gray-600">Slump</th>
              <th className="py-1 pr-1 font-semibold text-gray-600">Pump</th>
              {subtotal != null && <th className="py-1 pr-1 text-right font-semibold text-gray-600">Rate in ₹</th>}
              {subtotal != null && <th className="py-1 text-right font-semibold text-gray-600">Amount In ₹</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1 pr-1">{challan.grade_name ?? '—'}{challan.grade_code ? ` (${challan.grade_code})` : ''}</td>
              <td className="py-1 pr-1 text-right font-mono">{formatQty(Number(challan.qty))}CUM</td>
              <td className="py-1 pr-1 text-right font-mono">{challan.slump != null ? Number(challan.slump).toFixed(1) : '—'}</td>
              <td className="py-1 pr-1">{challan.pump_type === 'WITH_PUMP' ? `With Pump${challan.pump_no ? ` (${challan.pump_no})` : ''}` : 'Without Pump'}</td>
              {subtotal != null && <td className="py-1 pr-1 text-right font-mono">{formatINR(Number(challan.rate ?? 0))}</td>}
              {subtotal != null && <td className="py-1 text-right font-mono">{formatINR(subtotal)}</td>}
            </tr>
          </tbody>
        </table>

        {(subtotal != null || tollTax) && (
          <div className="mt-1 flex justify-end border-t border-gray-800 pt-1">
            <div className="w-60 space-y-0.5">
              {subtotal != null && (
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-mono">{formatINR(subtotal)}</span></div>
              )}
              {!!tollTax && (
                <div className="flex justify-between"><span className="text-gray-500">Toll Tax</span><span className="font-mono">{formatINR(tollTax)}</span></div>
              )}
              {invoiceTotal != null && (
                <div className="flex justify-between border-t border-gray-300 pt-0.5 text-sm font-bold"><span>Total</span><span className="font-mono">{formatINR(invoiceTotal)}</span></div>
              )}
              <p className="pt-0.5 text-right text-[10px] text-gray-400">Tax: {challan.tax_type}</p>
            </div>
          </div>
        )}

        {(challan.start_km != null || challan.site_in || challan.site_out) && (
          <div className="mt-1 grid grid-cols-3 gap-3 border-t border-gray-300 py-1 text-[10px]">
            <div>
              <p className="font-semibold text-gray-600">Start / End KM</p>
              <p className="font-mono">
                {challan.start_km ?? '—'} → {challan.end_km ?? '—'}
                {challan.distance != null ? ` (${Number(challan.distance).toFixed(1)} km)` : ''}
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-600">Site In</p>
              <p>{fmtDateTime(challan.site_in)}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-600">Site Out</p>
              <p>{fmtDateTime(challan.site_out)}</p>
            </div>
          </div>
        )}

        {challan.remarks && (
          <div className="border-t border-gray-300 py-1 text-[10px]">
            <span className="font-semibold text-gray-600">Remarks : </span>{challan.remarks}
          </div>
        )}

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-3 gap-6 text-[10px]">
          <div className="border-t border-gray-400 pt-1 text-center text-gray-500">Driver Signature</div>
          <div className="border-t border-gray-400 pt-1 text-center text-gray-500">Site Engineer Signature</div>
          <div className="border-t border-gray-400 pt-1 text-center text-gray-500">Received By (Name &amp; Stamp)</div>
        </div>

        {passportQrUrl && (
          <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-200 pt-2">
            <div className="text-right text-[8px] leading-tight text-gray-400">
              Scan for the digital batch passport —<br />mix design, weighbridge &amp; test results
            </div>
            <img src={passportQrUrl} alt="Batch Passport QR" className="h-14 w-14" />
          </div>
        )}

        <p className="mt-3 text-center text-[10px] text-gray-400">This is a Computer Generated Delivery Challan</p>
      </div>
    </div>
  )
}
