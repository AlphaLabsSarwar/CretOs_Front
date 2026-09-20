import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

// Wraps the 'bg-white rounded-xl border border-gray-200' shell that's
// hand-copied onto dashboard tiles, panels, and summary bars across the
// app. `padded` covers the two sizes actually in use (p-4 for compact
// tiles, p-6 for form/report panels); pass padding="none" for tables and
// other content that manages its own inner spacing (matches DataTable).
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md'
  lift?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'md', lift, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-white rounded-xl border border-gray-200',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-6',
        lift && 'card-lift',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
Card.displayName = 'Card'

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between mb-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold text-gray-900', className)} {...props} />
}
