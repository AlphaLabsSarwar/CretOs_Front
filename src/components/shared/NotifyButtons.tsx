import { useQuery, useMutation } from '@tanstack/react-query'
import { Mail, MessageCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import InlineLoader from './InlineLoader'

interface NotifyChannel {
  available: boolean
  recipient?: string
  link?: string
  reason?: string
}

interface NotifyLinksResponse {
  whatsapp: NotifyChannel
  email: NotifyChannel
}

interface NotifyButtonsProps {
  entityType: 'CHALLAN' | 'INVOICE'
  entityId: string
  linksUrl: string // e.g. `/sales/challans/${id}/notify-links`
}

export default function NotifyButtons({ entityType, entityId, linksUrl }: NotifyButtonsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['notify-links', entityType, entityId],
    queryFn: () => api.get(linksUrl).then(r => r.data.data as NotifyLinksResponse),
  })

  const log = useMutation({
    mutationFn: (vars: { channel: 'WHATSAPP' | 'EMAIL'; recipient?: string }) =>
      api.post('/notifications', { entity_type: entityType, entity_id: entityId, channel: vars.channel, recipient: vars.recipient }),
  })

  function open(channel: 'WHATSAPP' | 'EMAIL', ch: NotifyChannel) {
    if (!ch.link) return
    window.open(ch.link, channel === 'WHATSAPP' ? '_blank' : '_self')
    log.mutate({ channel, recipient: ch.recipient })
  }

  if (isLoading) {
    return <div className="flex items-center gap-1.5 text-xs text-gray-400"><InlineLoader /> Loading...</div>
  }
  if (!data) return null

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!data.whatsapp.available}
        title={data.whatsapp.available ? `Send to ${data.whatsapp.recipient} via WhatsApp` : data.whatsapp.reason}
        onClick={() => open('WHATSAPP', data.whatsapp)}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium',
          data.whatsapp.available
            ? 'border-green-300 text-green-700 hover:bg-green-50'
            : 'cursor-not-allowed border-gray-200 text-gray-400 opacity-50'
        )}
      >
        <MessageCircle size={13} /> WhatsApp
      </button>
      <button
        type="button"
        disabled={!data.email.available}
        title={data.email.available ? `Send to ${data.email.recipient} via Email` : data.email.reason}
        onClick={() => open('EMAIL', data.email)}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium',
          data.email.available
            ? 'border-blue-300 text-blue-700 hover:bg-blue-50'
            : 'cursor-not-allowed border-gray-200 text-gray-400 opacity-50'
        )}
      >
        <Mail size={13} /> Email
      </button>
    </div>
  )
}
