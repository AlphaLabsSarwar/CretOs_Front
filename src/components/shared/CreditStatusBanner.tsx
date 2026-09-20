import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'

interface CreditStatus {
  creditLimit: number | null
  outstanding: number
  overLimit: boolean
  overBy: number
  overdueCount: number
  overdueAmount: number
  oldestOverdueDays: number
}

// Non-blocking warning — surfaces credit risk at the point of dispatch without
// stopping the truck from going out. A dispatcher can always choose to proceed;
// the point is making sure they see it first.
export default function CreditStatusBanner({ customerId }: { customerId: string | undefined }) {
  const { data } = useQuery({
    queryKey: ['credit-status', customerId],
    queryFn: () => api.get(`/masters/customers/${customerId}/credit-status`).then(r => r.data.data as CreditStatus),
    enabled: !!customerId,
    staleTime: 30_000,
  })

  if (!data || (!data.overLimit && data.overdueCount === 0)) return null

  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <div>
        {data.overLimit && (
          <p>Customer is <span className="font-mono font-medium">₹{formatINR(data.overBy)}</span> over their ₹{formatINR(data.creditLimit ?? 0)} credit limit (outstanding: ₹{formatINR(data.outstanding)}).</p>
        )}
        {data.overdueCount > 0 && (
          <p>{data.overdueCount} invoice{data.overdueCount > 1 ? 's' : ''} overdue (₹{formatINR(data.overdueAmount)}, oldest {data.oldestOverdueDays}d). Consider confirming payment before dispatching.</p>
        )}
      </div>
    </div>
  )
}
