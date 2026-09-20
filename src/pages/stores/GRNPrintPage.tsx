import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR, formatQty } from '@/lib/utils'
import CompanyLogo from '@/components/shared/CompanyLogo'

interface GRNPrintData {
  id: string
  number: string
  date: string
  grn_type: string | null
  party_challan_no: string
  challan_date: string
  royalty_pass_no: string | null
  vehicle_no: string | null
  gate_entry_no: string | null
  godown: string | null
  wb_no: string | null
  total_qty: string | number
  total_amount: string | number
  gross_weight: string | number | null
  tare_weight: string | number | null
  net_weight: string | number | null
  remarks: string | null
  status: string
  po_no: string | null
  vendor_name: string | null
  vendor_gstin: string | null
  vendor_address: string | null
  vendor_city: string | null
  vendor_state: string | null
  vendor_mobile: string | null
  branch_name: string | null
  branch_code: string | null
  branch_gstin: string | null
  branch_address: string | null
  branch_city: string | null
  branch_state: string | null
  branch_pin_code: string | null
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

export default function GRNPrintPage() {
  const { id } = useParams()

  const { data: grn, isLoading } = useQuery({
    queryKey: ['grn-print', id],
    queryFn: () => api.get(`/stores/grn/${id}`).then(r => r.data.data as GRNPrintData),
    enabled: !!id,
  })

  useEffect(() => {
    document.title = grn ? `GRN ${grn.number}` : 'Goods Receipt Note'
  }, [grn])

  if (isLoading || !grn) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xs text-gray-400">
        <Loader2 size={14} className="mr-2 animate-spin" /> Loading GRN...
      </div>
    )
  }

  const hasWeighbridge = grn.gross_weight != null || grn.tare_weight != null

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <Link to={`/stores/grn/${id}/edit`} className="text-xs text-gray-500 hover:text-gray-800">← Back to GRN</Link>
        <button
          onClick={() => window.print()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover"
        >
          <Printer size={13} /> Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto max-w-3xl border-2 border-gray-800 bg-white p-5 text-[11px] text-gray-800 shadow-sm print:max-w-none print:border print:shadow-none">
        <div className="mb-3 flex justify-center">
          <div className="border-2 border-gray-800 px-6 py-1 text-sm font-bold tracking-wide">GOODS RECEIPT NOTE</div>
        </div>

        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-2">
          <div>
            <h1 className="text-base font-bold uppercase text-gray-900">{grn.branch_name ?? 'CretOS RMC Plant'}</h1>
            <p className="mt-0.5 text-gray-600">
              {[grn.branch_address, grn.branch_city, grn.branch_state].filter(Boolean).join(', ')}
              {grn.branch_pin_code ? `- ${grn.branch_pin_code}` : ''}
            </p>
            {grn.branch_gstin && <p className="font-mono text-gray-600">GSTIN: {grn.branch_gstin}</p>}
          </div>
          <CompanyLogo companyId={grn.branch_company_id} width={80} />
        </div>

        <div className="grid grid-cols-2 border-b border-gray-300">
          <div className="border-r border-gray-300 pr-2">
            <GridCell label="GRN No" value={grn.number} bold />
            <GridCell label="GRN Date" value={fmtDate(grn.date)} bold />
            <GridCell label="GRN Type" value={grn.grn_type ?? '—'} />
            <GridCell label="Against PO" value={grn.po_no ?? '—'} />
            <GridCell label="Status" value={grn.status} />
          </div>
          <div className="pl-2">
            <GridCell label="Party Challan No" value={grn.party_challan_no} bold />
            <GridCell label="Party Challan Date" value={fmtDate(grn.challan_date)} bold />
            <GridCell label="Vehicle No" value={grn.vehicle_no ?? '—'} />
            <GridCell label="Gate Entry No" value={grn.gate_entry_no ?? '—'} />
            <GridCell label="Godown" value={grn.godown ?? '—'} />
          </div>
        </div>

        <div className="border-b border-gray-300 p-2">
          <p className="mb-1 font-semibold text-gray-600">Received From (Vendor):</p>
          <p className="font-medium text-gray-900">{grn.vendor_name ?? '—'}</p>
          {grn.vendor_address && <p className="text-gray-600">{grn.vendor_address}</p>}
          <p className="text-gray-600">{[grn.vendor_city, grn.vendor_state].filter(Boolean).join(', ')}</p>
          <div className="mt-0.5 flex gap-4">
            {grn.vendor_gstin && <p><span className="font-semibold">GST No.: </span><span className="font-mono">{grn.vendor_gstin}</span></p>}
            {grn.vendor_mobile && <p className="text-gray-600">{grn.vendor_mobile}</p>}
          </div>
        </div>

        {/* Weighbridge — only plants with one send gross/tare/net */}
        {hasWeighbridge && (
          <div className="grid grid-cols-4 border-b border-gray-300 py-1 text-[10px]">
            <GridCell label="WB No" value={grn.wb_no ?? '—'} />
            <GridCell label="Gross Wt" value={grn.gross_weight != null ? `${formatQty(Number(grn.gross_weight))} kg` : '—'} />
            <GridCell label="Tare Wt" value={grn.tare_weight != null ? `${formatQty(Number(grn.tare_weight))} kg` : '—'} />
            <GridCell label="Net Wt" value={grn.net_weight != null ? `${formatQty(Number(grn.net_weight))} kg` : '—'} bold />
          </div>
        )}

        {grn.royalty_pass_no && (
          <div className="border-b border-gray-300 py-1 text-[10px]">
            <span className="font-semibold text-gray-600">Royalty Pass No: </span>{grn.royalty_pass_no}
          </div>
        )}

        {/* Received value — no per-material line-item breakdown exists in
            this data model (a GRN here totals one received quantity/value,
            not itemized per material), so this presents exactly what the
            form captures. */}
        <div className="mt-1 flex justify-end border-t border-gray-800 pt-1">
          <div className="w-60 space-y-0.5">
            <div className="flex justify-between"><span className="text-gray-500">Total Qty Received</span><span className="font-mono">{formatQty(Number(grn.total_qty))}</span></div>
            <div className="flex justify-between border-t border-gray-300 pt-0.5 text-sm font-bold"><span>Total Value</span><span className="font-mono">{formatINR(Number(grn.total_amount))}</span></div>
          </div>
        </div>

        {grn.remarks && (
          <div className="mt-1 border-t border-gray-300 py-1 text-[10px]">
            <span className="font-semibold text-gray-600">Remarks : </span>{grn.remarks}
          </div>
        )}

        <div className="mt-10 grid grid-cols-3 gap-6 text-[10px]">
          <div className="border-t border-gray-400 pt-1 text-center text-gray-500">Weighbridge / Gate Signature</div>
          <div className="border-t border-gray-400 pt-1 text-center text-gray-500">Store Keeper Signature</div>
          <div className="border-t border-gray-400 pt-1 text-center text-gray-500">Received By (Name &amp; Stamp)</div>
        </div>

        <p className="mt-3 text-center text-[10px] text-gray-400">This is a Computer Generated Goods Receipt Note</p>
      </div>
    </div>
  )
}
