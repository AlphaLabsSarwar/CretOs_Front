import { useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { formatINR } from '@/lib/utils'

export interface CreditBlockDetails {
  creditLimit: number | null
  outstanding: number
  overLimit: boolean
  overBy: number
  overdueCount: number
  overdueAmount: number
  oldestOverdueDays: number
  creditHold: boolean
  holdReason: string | null
}

// Reads the shape routes/sales/challans.ts's POST /:id/post sends back on a
// 409 (see utils/creditControl.ts's blocked flag) — `code: 'CREDIT_BLOCKED'`
// alongside the human message and the full details object. Pull this out of
// a caught axios error before deciding whether to show CreditOverrideDialog.
export function readCreditBlock(e: any): { message: string; details: CreditBlockDetails } | null {
  const data = e?.response?.data
  if (data?.code !== 'CREDIT_BLOCKED' || !data?.details) return null
  return { message: data.error as string, details: data.details as CreditBlockDetails }
}

interface CreditOverrideDialogProps {
  message: string
  details: CreditBlockDetails
  canOverride: boolean
  submitting?: boolean
  onCancel: () => void
  onOverride: (reason: string) => void
}

// Shown when a dispatch is blocked by credit control (manual hold or an
// exceeded credit limit) — see utils/creditControl.ts. A dispatcher without
// Admin/Manager rights only sees the block and has to hand it off; an
// Admin/Manager can type a reason and push the truck out anyway, which gets
// logged to the audit trail (routes/sales/challans.ts's POST /:id/post).
export default function CreditOverrideDialog({ message, details, canOverride, submitting, onCancel, onOverride }: CreditOverrideDialogProps) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <AlertTriangle size={15} /> Dispatch blocked — credit control
          </h2>
          <button onClick={onCancel} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-xs text-gray-700">{message}</p>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px]">
            <span className="text-gray-500">Outstanding</span>
            <span className="text-right font-mono text-gray-800">₹{formatINR(details.outstanding)}</span>
            <span className="text-gray-500">Credit Limit</span>
            <span className="text-right font-mono text-gray-800">{details.creditLimit != null ? `₹${formatINR(details.creditLimit)}` : '—'}</span>
            {details.overdueCount > 0 && (
              <>
                <span className="text-gray-500">Overdue</span>
                <span className="text-right font-mono text-gray-800">₹{formatINR(details.overdueAmount)} ({details.overdueCount})</span>
              </>
            )}
          </div>

          {canOverride ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Reason for override <span className="text-red-500">*</span></label>
              <textarea
                rows={2}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Customer confirmed payment is in transit"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          ) : (
            <p className="text-xs text-amber-700">Only an Admin or Manager can override a credit block. The challan has been saved as a draft — ask them to release it.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button onClick={onCancel} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
            {canOverride ? 'Cancel' : 'Close'}
          </button>
          {canOverride && (
            <button
              disabled={!reason.trim() || submitting}
              onClick={() => onOverride(reason.trim())}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />} Override &amp; Dispatch
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
