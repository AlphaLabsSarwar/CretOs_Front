import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// A tiny inline spinner for the button's own loading state — RmcLoader's
// full truck animation is for page/section loading, far too large to sit
// inside an 8-40px tall button.
function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// Extracted from the exact classes that were hand-copied onto ~30+ pages'
// "New" / save / row-action buttons (see PageHeader.tsx pre-refactor). This
// is a consolidation, not a re-skin — every variant below should render
// pixel-identical to what was already on screen. Change the look here once,
// instead of finding and editing every page.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium rounded-lg ' +
    'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:
          'bg-accent hover:bg-accent-hover text-white hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95',
        secondary:
          'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-95',
        ghost: 'text-gray-600 hover:bg-gray-100 active:scale-95',
        destructive:
          'bg-red-600 hover:bg-red-700 text-white hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95',
        // Bare icon button — matches DataTable's pagination arrows.
        icon: 'rounded text-gray-600 hover:bg-gray-100 hover:scale-110 active:scale-90 disabled:hover:scale-100',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-5 text-sm',
        iconSm: 'h-7 w-7 p-0',
        iconMd: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

// eslint-disable-next-line react/display-name
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Spinner className="h-3.5 w-3.5" /> : children}
      </button>
    )
  }
)
