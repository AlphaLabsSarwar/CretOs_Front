import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  total?: number
  page?: number
  limit?: number
  onPageChange?: (page: number) => void
  onRowClick?: (row: T) => void
  emptyMessage?: string
  rowClassName?: (row: T, index: number) => string
}

// Shimmer sweeps left-to-right like wet concrete leveling out, instead of a
// plain pulse — same "table is loading" job, themed to match RmcLoader.
// Exported so the handful of pages with a hand-rolled <table> (StockPage,
// FleetPage, ProfitabilityReportPage — anything not using DataTable itself)
// can use the same loading treatment instead of a bare spinner + row.
export function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-3.5 rounded w-full animate-pour-sweep"
            style={{
              backgroundImage: 'linear-gradient(90deg, #E5E7EB 25%, #FDF0E8 50%, #E5E7EB 75%)',
              backgroundSize: '200% 100%',
            }}
          />
        </td>
      ))}
    </tr>
  )
}

// Kept as a thin wrapper (same name, same signature) over the generalized
// Badge component in components/ui/badge.tsx — 16 pages already import this
// exact export, so the status->tone mapping moved here without touching any
// of those call sites.
const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  POSTED: 'info',
  CLOSED: 'neutral',
  CANCELLED: 'error',
  PENDING_APPROVAL: 'purple',
  NEW: 'info',
  IN_REVIEW: 'warning',
  QUOTED: 'purple',
  WON: 'success',
  LOST: 'error',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status}</Badge>
}

export default function DataTable<T extends { id: string }>({
  columns, data, loading, total = 0, page = 1, limit = 25,
  onPageChange, onRowClick, emptyMessage = 'No records found', rowClassName,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-2.5 text-left section-label whitespace-nowrap',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="rows-enter">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={columns.length} />)
              : data.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                    {emptyMessage}
                  </td>
                </tr>
              )
              : data.map((row, i) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  // A clickable row that only responds to a mouse is
                  // unreachable for anyone navigating by keyboard — which is
                  // every list screen in the app, since opening a record is
                  // the primary action. tabIndex + Enter/Space + a focus ring
                  // make the row behave like the button it already is.
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onRowClick(row)
                    }
                  } : undefined}
                  className={cn(
                    'border-b border-gray-100 last:border-0 transition-all duration-150',
                    i % 2 === 1 && 'bg-gray-50/50',
                    onRowClick && 'cursor-pointer hover:bg-orange-50/40 hover:shadow-[inset_2px_0_0_0_theme(colors.accent.DEFAULT)] active:bg-orange-100/40 focus:outline-none focus-visible:bg-orange-50/40 focus-visible:shadow-[inset_2px_0_0_0_theme(colors.accent.DEFAULT)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40',
                    rowClassName?.(row, i)
                  )}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-2.5 whitespace-nowrap',
                        col.align === 'right' && 'text-right table-num',
                        col.align === 'center' && 'text-center',
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as any)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-white">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="icon"
              size="iconSm"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              className="hover:scale-110 active:scale-90 disabled:hover:scale-100"
            >
              <ChevronLeft size={15} />
            </Button>
            <span className="text-xs text-gray-600 px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="icon"
              size="iconSm"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="hover:scale-110 active:scale-90 disabled:hover:scale-100"
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
