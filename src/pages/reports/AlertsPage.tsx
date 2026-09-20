import { useQuery, useMutation } from '@tanstack/react-query'
import { AlertTriangle, Mail, MessageCircle, Package } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR } from '@/lib/utils'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'

interface CreditBreach { customerId: string; name: string; mobile: string | null; email: string | null; outstanding: number; creditLimit: number; overBy: number }
interface LowStockItem { material: string; qty_on_hand: number; reorder_level: number }
interface AlertsData { creditBreaches: CreditBreach[]; lowStock: LowStockItem[] }

// Mirrors utils/notifications.ts on the backend — there's no WhatsApp Business
// API or SMTP configured, so this is a one-click wa.me/mailto deep link, not
// an automatic send. See NotifyButtons.tsx for the same pattern on challans/invoices.
function waLink(mobile: string, message: string): string {
  const digits = mobile.replace(/\D/g, '')
  const withCountry = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`
}
function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default function AlertsPage() {
  const user = authStore.getUser()

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', user?.branch?.id],
    queryFn: () => api.get('/dashboard/alerts', { params: { branch_id: user?.branch?.id } }).then(r => r.data.data as AlertsData),
    enabled: !!user?.branch?.id,
  })

  const log = useMutation({
    mutationFn: (vars: { channel: 'WHATSAPP' | 'EMAIL'; entityId: string; recipient?: string }) =>
      api.post('/notifications', { entity_type: 'CUSTOMER', entity_id: vars.entityId, channel: vars.channel, recipient: vars.recipient }),
  })

  function notify(channel: 'WHATSAPP' | 'EMAIL', link: string, entityId: string, recipient?: string) {
    window.open(link, channel === 'WHATSAPP' ? '_blank' : '_self')
    log.mutate({ channel, entityId, recipient })
  }

  const breaches = data?.creditBreaches ?? []
  const lowStock = data?.lowStock ?? []

  return (
    <div>
      <PageHeader title="Alerts" subtitle="Credit-limit breaches and low stock — notify with one click" />

      {isLoading ? (
        <RmcLoader size="sm" />
      ) : (
        <div className="space-y-6">
          <div>
            <p className="section-label mb-2">Credit Limit Breaches ({breaches.length})</p>
            {breaches.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">No customers currently over their credit limit</div>
            ) : (
              <div className="space-y-2">
                {breaches.map(b => {
                  const msg = `Hi ${b.name}, a friendly reminder that your outstanding balance is ₹${formatINR(b.outstanding)}, which is ₹${formatINR(b.overBy)} over your approved credit limit of ₹${formatINR(b.creditLimit)}. Please arrange payment at your earliest convenience. — CretOS`
                  return (
                    <div key={b.customerId} className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/40 px-4 py-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{b.name}</p>
                          <p className="text-xs text-gray-500">
                            Outstanding ₹{formatINR(b.outstanding)} · Limit ₹{formatINR(b.creditLimit)} · <span className="font-medium text-red-600">Over by ₹{formatINR(b.overBy)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={!b.mobile}
                          title={b.mobile ? `Send to ${b.mobile}` : 'No mobile on file'}
                          onClick={() => b.mobile && notify('WHATSAPP', waLink(b.mobile, msg), b.customerId, b.mobile)}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-green-300 px-3 text-xs font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <MessageCircle size={13} /> WhatsApp
                        </button>
                        <button
                          disabled={!b.email}
                          title={b.email ? `Send to ${b.email}` : 'No email on file'}
                          onClick={() => b.email && notify('EMAIL', mailtoLink(b.email, 'Outstanding balance over credit limit', msg), b.customerId, b.email)}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-blue-300 px-3 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Mail size={13} /> Email
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <p className="section-label mb-2">Low Stock ({lowStock.length})</p>
            {lowStock.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">No materials below their reorder level</div>
            ) : (
              <div className="space-y-2">
                {lowStock.map(s => (
                  <div key={s.material} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
                    <Package size={15} className="text-amber-500" />
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">{s.material}</span> is at {s.qty_on_hand} — below reorder level of {s.reorder_level}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
