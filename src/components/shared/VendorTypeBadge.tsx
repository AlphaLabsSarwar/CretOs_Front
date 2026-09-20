import { cn } from '@/lib/utils'

type VendorType = 'SUPPLIER' | 'TRANSPORTER' | 'BOTH'

const STYLES: Record<VendorType, string> = {
  SUPPLIER: 'bg-blue-50 text-blue-700 border border-blue-200',
  TRANSPORTER: 'bg-purple-50 text-purple-700 border border-purple-200',
  BOTH: 'bg-orange-50 text-orange-700 border border-orange-200',
}

const LABELS: Record<VendorType, string> = {
  SUPPLIER: 'Supplier',
  TRANSPORTER: 'Transporter',
  BOTH: 'Both',
}

export default function VendorTypeBadge({ type }: { type: string }) {
  const key = (type in STYLES ? type : 'SUPPLIER') as VendorType
  return <span className={cn('status-badge', STYLES[key])}>{LABELS[key]}</span>
}
