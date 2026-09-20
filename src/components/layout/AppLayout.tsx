import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import Sidebar from './Sidebar'
import CommandPalette from '@/components/shared/CommandPalette'
import ChatWidget from '@/components/shared/ChatWidget'

function getBreadcrumb(path: string): string {
  const map: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/sales/challans': 'Sales / Dispatch Challan',
    '/sales/challans/new': 'Sales / Dispatch Challan / New',
    '/sales/schedules': 'Sales / Daily Schedule',
    '/sales/orders': 'Sales / Work Orders',
    '/marketing/quotations': 'Marketing / Quotations',
    '/finance/payments': 'Finance / Payment Voucher',
    '/finance/receipts': 'Finance / Receipt Voucher',
    '/finance/journals': 'Finance / Journal Entry',
    '/stores/po': 'Stores / Purchase Order',
    '/stores/grn': 'Stores / GRN',
    '/stores/indents': 'Stores / Indent',
    '/masters/customers': 'Masters / Customers',
    '/masters/vendors': 'Masters / Vendors',
    '/masters/vehicles': 'Masters / Vehicles',
    '/masters/grades': 'Concrete Lab / Grade Master',
    '/masters/users': 'Masters / Users',
  }
  if (map[path]) return map[path]
  if (/^\/sales\/challans\/[^/]+\/edit$/.test(path)) return 'Sales / Dispatch Challan / Edit'
  return 'CretOS'
}

export default function AppLayout() {
  const location = useLocation()
  const breadcrumb = getBreadcrumb(location.pathname)
  const parts = breadcrumb.split(' / ')

  // Sidebar is a static column on md+ and an off-canvas drawer below it —
  // this is the one piece of state that decides which. Closed by default
  // (and re-closed on every navigation) so a route change never leaves the
  // drawer covering the new page on mobile.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  useEffect(() => setMobileNavOpen(false), [location.pathname])

  // ProductTour itself lives at the App root (see App.tsx), not here — the
  // tour navigates to /quick-dispatch, which is a route sibling of this
  // layout, not a child of it (see App.tsx's route tree). Mounting the tour
  // inside AppLayout meant it unmounted the instant the tour navigated
  // somewhere that swaps AppLayout out entirely.
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <CommandPalette />
      <ChatWidget />
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            {/* Hamburger — mobile only, opens the Sidebar drawer */}
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="-ml-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 md:hidden"
            >
              <Menu size={18} />
            </button>
            {parts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300">/</span>}
                <span className={i === parts.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                  {part}
                </span>
              </span>
            ))}
          </div>
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            aria-label="Search or jump to..."
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-400 hover:border-gray-300 hover:text-gray-600 sm:px-3"
          >
            <Search size={13} />
            <span className="hidden sm:inline">Search or jump to...</span>
            <kbd className="ml-2 hidden rounded border border-gray-300 bg-white px-1 text-[10px] sm:inline">⌘K</kbd>
          </button>
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* key={pathname} forces a remount on every route change, which
              re-triggers the fade-slide-up CSS animation each time. */}
          <div key={location.pathname} className="animate-fade-slide-up">
            <Outlet />
          </div>
          {/* Scroll-room spacer, not padding — a DataTable's pagination bar
              always puts its "Next" button at the right edge (see
              DataTable.tsx), the same corner ChatWidget's fixed bottom-5
              right-5 bubble sits in. Scrolling a long list to the bottom
              would otherwise put Next directly under the bubble. This adds
              blank scrollable space *after* the page content instead of
              growing main's own padding — bumping the padding would also
              widen the gap every form page's sticky footer (search "-mb-6")
              expects to exactly cancel, leaving a visible gap under those
              footers instead. */}
          <div className="h-16" aria-hidden="true" />
        </main>
      </div>
    </div>
  )
}
