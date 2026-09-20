import { cn } from '@/lib/utils'

// Generalizes the tinted-pill look that DataTable's StatusBadge already
// established for record statuses (DRAFT/ACTIVE/POSTED/...), so the same
// visual language covers the other ad hoc colored tags scattered across
// list pages (credit-risk flags, low-stock tags, role badges, etc.)
// instead of each page inventing its own bg-*/text-* pair.
const TONES = {
  success: 'bg-green-50 text-green-700 border border-green-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  error: 'bg-red-50 text-red-600 border border-red-200',
  info: 'bg-blue-50 text-blue-700 border border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200',
  neutral: 'bg-gray-100 text-gray-600 border border-gray-200',
} as const

export type BadgeTone = keyof typeof TONES

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: React.ReactNode
}) {
  return <span className={cn('status-badge', TONES[tone], className)}>{children}</span>
}
