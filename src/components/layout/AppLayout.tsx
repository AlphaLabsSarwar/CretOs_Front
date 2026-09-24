import { Suspense, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { UNSAFE_LocationContext, useLocation, useOutlet } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import Sidebar from './Sidebar'
import CommandPalette from '@/components/shared/CommandPalette'
import ChatWidget from '@/components/shared/ChatWidget'
import RmcLoader from '@/components/shared/RmcLoader'
import TransitionLayers from '@/components/shared/TransitionLayers'
import { recordRecent } from '@/lib/recent'
import { cn } from '@/lib/utils'

// Screens drawn on the dark "command center" surface instead of the light page.
const DARK_ROUTES = ['/tracking']

function getBreadcrumb(path: string): string {
  const map: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/tracking': 'Live Tracking',
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
  const dark = DARK_ROUTES.some(p => location.pathname.startsWith(p))

  // Sidebar is a static column on md+ and an off-canvas drawer below it —
  // this is the one piece of state that decides which. Closed by default
  // (and re-closed on every navigation) so a route change never leaves the
  // drawer covering the new page on mobile.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  useEffect(() => setMobileNavOpen(false), [location.pathname])
  // Feeds "Recently opened" on the home launcher (see lib/recent.ts).
  useEffect(() => recordRecent(location.pathname), [location.pathname])
  // The scroll container outlives route changes, so a new page would open at
  // the previous page's scroll depth — start every page at the top.
  const mainRef = useRef<HTMLElement>(null)
  const outlet = useOutlet()
  const locationCtx = useContext(UNSAFE_LocationContext)
  useLayoutEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [location.pathname])

  // ProductTour itself lives at the App root (see App.tsx), not here — the
  // tour navigates to /quick-dispatch, which is a route sibling of this
  // layout, not a child of it (see App.tsx's route tree). Mounting the tour
  // inside AppLayout meant it unmounted the instant the tour navigated
  // somewhere that swaps AppLayout out entirely.
  return (
    // The page colour eases between light and the dark command-center screens.
    <div className={cn('flex h-screen overflow-hidden transition-colors duration-500 ease-out', dark ? 'bg-command-bg' : 'bg-page')}>
      <CommandPalette />
      <ChatWidget />
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar — mobile only. On desktop each page carries its own title
            and search lives in the sidebar, as in the product design. */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 md:hidden">
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
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6">
          {/* The boundary sits outside the keyed view so it persists: in-app
              navigation (a transition, see v7_startTransition in App.tsx)
              keeps the current page up while the next one loads, and the
              fallback only appears on a cold load of a page URL — inside the
              layout, so the sidebar never blanks. */}
          <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><RmcLoader size="md" /></div>}>
            {/* Each route change mounts a fresh view — the page fades in and its
                sections rise in a short cascade (.route-view in index.css) —
                while the previous page fades out on top, pinned where it was
                scrolled and frozen on its own location. */}
            <div className="relative">
              <TransitionLayers
                layerKey={location.pathname}
                value={{ outlet, locationCtx }}
                getOffset={() => mainRef.current?.scrollTop ?? 0}
                leavingClassName="page-leave pointer-events-none absolute inset-x-0 top-0"
                render={v => (
                  <UNSAFE_LocationContext.Provider value={v.locationCtx}>
                    <div className="route-view">{v.outlet}</div>
                  </UNSAFE_LocationContext.Provider>
                )}
              />
            </div>
          </Suspense>
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
