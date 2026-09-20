import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Truck, Calendar, ClipboardList, FileText,
  CreditCard, Receipt, ShoppingCart, Package, Warehouse,
  Users, Building2, Car, FlaskConical, ChevronDown, ChevronRight,
  LogOut, Settings, TrendingUp, Bell, ShieldCheck, HelpCircle, X, Factory
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { authStore } from '@/store/auth'
import { permissionsStore } from '@/store/permissions'
import { SHOW_TOUR_EVENT } from '@/lib/tourEvent'

interface NavItem {
  label: string
  icon: React.ElementType
  path?: string
  moduleKey?: string
  children?: { label: string; path: string; moduleKey: string }[]
}

// Every leaf here carries the module_key it corresponds to in
// packages/shared/src/permissions.ts — visibility is resolved per-user by
// the backend (GET /me/permissions), not hardcoded by role here anymore.
const NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', moduleKey: 'dashboard' },
  {
    label: 'Sales', icon: Truck,
    children: [
      { label: 'Dispatch Challan', path: '/sales/challans', moduleKey: 'sales.challans' },
      { label: 'Daily Schedule', path: '/sales/schedules', moduleKey: 'sales.schedules' },
      { label: 'Work Orders', path: '/sales/orders', moduleKey: 'sales.orders' },
    ],
  },
  {
    label: 'Marketing', icon: FileText,
    children: [
      { label: 'Tenders / RFQ', path: '/marketing/tenders', moduleKey: 'marketing.tenders' },
      { label: 'Quotations', path: '/marketing/quotations', moduleKey: 'marketing.quotations' },
    ],
  },
  {
    label: 'Finance', icon: CreditCard,
    children: [
      { label: 'Invoices', path: '/finance/invoices', moduleKey: 'finance.invoices' },
      { label: 'Payment Voucher', path: '/finance/payments', moduleKey: 'finance.payments' },
      { label: 'Receipt Voucher', path: '/finance/receipts', moduleKey: 'finance.receipts' },
      { label: 'Journal Entry', path: '/finance/journals', moduleKey: 'finance.journals' },
      { label: 'Petty Cash Register', path: '/finance/cashbook', moduleKey: 'finance.cashbook' },
    ],
  },
  {
    label: 'Stores', icon: Warehouse,
    children: [
      { label: 'Purchase Order', path: '/stores/po', moduleKey: 'stores.po' },
      { label: 'GRN', path: '/stores/grn', moduleKey: 'stores.grn' },
      { label: 'Indent', path: '/stores/indents', moduleKey: 'stores.indents' },
      { label: 'Raw Material Stock', path: '/stores/stock', moduleKey: 'stores.stock' },
    ],
  },
  {
    label: 'Concrete Lab', icon: FlaskConical,
    children: [
      { label: 'Grade Master', path: '/masters/grades', moduleKey: 'lab.grades' },
      { label: 'Cube Test Results', path: '/quality/tests', moduleKey: 'lab.tests' },
      { label: 'NCR / CAPA', path: '/quality/ncr', moduleKey: 'lab.ncr' },
    ],
  },
  {
    label: 'Production', icon: Factory,
    children: [
      { label: 'Weighbridge', path: '/production/weighbridge', moduleKey: 'production.weighbridge' },
      { label: 'Batching / MES', path: '/production/batches', moduleKey: 'production.batching' },
      { label: 'Plant Connectivity', path: '/production/connectivity', moduleKey: 'production.batching' },
      { label: 'Material Reconciliation', path: '/production/reconciliation', moduleKey: 'production.reconciliation' },
      { label: 'Concrete Age Monitor', path: '/production/concrete-age', moduleKey: 'production.concreteAge' },
      { label: 'Pump Schedule', path: '/production/pumps', moduleKey: 'production.pumps' },
      { label: 'OEE / Downtime', path: '/production/oee', moduleKey: 'production.oee' },
      { label: 'Energy Management', path: '/production/energy', moduleKey: 'production.energy' },
      { label: 'Carbon / Sustainability', path: '/production/carbon', moduleKey: 'production.carbon' },
    ],
  },
  {
    label: 'Masters', icon: Building2,
    children: [
      { label: 'Customers', path: '/masters/customers', moduleKey: 'masters.customers' },
      { label: 'Rate Contracts', path: '/masters/customer-rates', moduleKey: 'masters.customerRates' },
      { label: 'Materials', path: '/masters/items', moduleKey: 'masters.items' },
      { label: 'Vendors', path: '/masters/vendors', moduleKey: 'masters.vendors' },
      { label: 'Vehicles', path: '/masters/vehicles', moduleKey: 'masters.vehicles' },
      { label: 'Drivers', path: '/masters/drivers', moduleKey: 'masters.drivers' },
      { label: 'Users', path: '/masters/users', moduleKey: 'masters.users' },
      { label: 'Pumps', path: '/masters/pumps', moduleKey: 'production.pumps' },
    ],
  },
  { label: 'Fleet', icon: Car, path: '/fleet', moduleKey: 'fleet' },
  { label: 'Alerts', icon: Bell, path: '/reports/alerts', moduleKey: 'reports.alerts' },
  {
    label: 'Reports', icon: TrendingUp,
    children: [
      { label: 'Profitability', path: '/reports/profitability', moduleKey: 'reports.profitability' },
      { label: 'AR/AP Aging', path: '/reports/aging', moduleKey: 'reports.aging' },
      { label: 'Credit Risk', path: '/reports/credit-risk', moduleKey: 'reports.creditRisk' },
      { label: 'Sales Analysis', path: '/reports/sales-analysis', moduleKey: 'reports.salesAnalysis' },
      { label: 'GSTR Export', path: '/reports/gstr-export', moduleKey: 'reports.gstrExport' },
      { label: 'Multi-Branch Overview', path: '/reports/multi-branch', moduleKey: 'reports.multiBranch' },
      { label: 'Driver Scorecard', path: '/reports/driver-scorecard', moduleKey: 'reports.driverScorecard' },
      { label: 'Plant Capacity', path: '/reports/capacity', moduleKey: 'reports.capacity' },
    ],
  },
  {
    label: 'Admin', icon: ShieldCheck,
    children: [
      { label: 'Audit Log', path: '/admin/audit-log', moduleKey: 'admin.auditLog' },
      { label: 'Scheduled Reports', path: '/admin/report-schedules', moduleKey: 'admin.reportSchedules' },
      { label: 'Permissions', path: '/admin/permissions', moduleKey: 'admin.permissions' },
    ],
  },
]

interface SidebarProps {
  // Below the md breakpoint the sidebar is an off-canvas drawer owned by
  // AppLayout (which also renders the hamburger toggle + backdrop); above
  // md it's always visible and these props are simply unused.
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation()
  const user = authStore.getUser()
  const [expanded, setExpanded] = useState<string[]>([])
  // Falls back to the generic "C" mark until the logo loads (or forever, if
  // this company never uploaded one / the request 404s) — see Platform
  // Admin > Companies > Edit for the upload UI and components/shared/
  // CompanyLogo.tsx for the same fallback pattern used on print pages.
  const [logoFailed, setLogoFailed] = useState(false)
  const companyId = user?.company?.id

  const toggle = (label: string) => {
    setExpanded(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  const isExpanded = (label: string) => expanded.includes(label)

  const isChildActive = (item: NavItem) =>
    item.children?.some(c => location.pathname.startsWith(c.path)) ?? false

  // Resolve each item against the cached module set from GET /me/permissions
  // (refreshed on login) — a leaf item needs its own moduleKey; a group
  // needs at least one visible child, and only shows those children.
  const visibleNav = NAV
    .map(item => {
      if (item.path) {
        return item.moduleKey && permissionsStore.has(item.moduleKey) ? item : null
      }
      const children = (item.children ?? []).filter(c => permissionsStore.has(c.moduleKey))
      return children.length ? { ...item, children } : null
    })
    .filter((item): item is NavItem => item !== null)

  return (
    <>
      {/* Backdrop — mobile only, taps outside the drawer to dismiss it */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'w-60 flex-shrink-0 bg-sidebar-bg flex flex-col h-screen',
          // Desktop: static column, always visible. Mobile: fixed off-canvas
          // drawer that slides in from the left over the content.
          'fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out',
          'md:sticky md:top-0 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          {companyId && !logoFailed ? (
            <img
              src={`/api/v1/public/companies/${companyId}/logo`}
              alt={user?.company?.name ?? 'Company logo'}
              className="h-7 w-7 rounded-lg object-contain bg-white/10"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
          )}
          <span className="text-white font-bold text-base tracking-tight">CretOS</span>
        </div>
        {/* Close button — mobile drawer only */}
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="text-sidebar-text hover:text-white md:hidden"
        >
          <X size={18} />
        </button>
      </div>

      {/* Company + branch indicator */}
      <div className="px-4 py-2.5 border-b border-white/10">
        {user?.company?.name && (
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-accent">{user.company.name}</p>
        )}
        <p className="text-xs text-sidebar-text">{user?.branch?.name ?? 'Branch'}</p>
        <p className="text-white text-xs font-medium">{user?.name ?? 'User'}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-none">
        {visibleNav.map(item => (
          <div key={item.label}>
            {item.path ? (
              <NavLink
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  cn('sidebar-item', isActive && 'active')
                }
              >
                <item.icon size={15} />
                <span>{item.label}</span>
              </NavLink>
            ) : (
              <>
                <button
                  onClick={() => toggle(item.label)}
                  className={cn(
                    'sidebar-item w-full justify-between',
                    isChildActive(item) && 'text-white'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon size={15} />
                    <span>{item.label}</span>
                  </div>
                  {isExpanded(item.label)
                    ? <ChevronDown size={13} />
                    : <ChevronRight size={13} />
                  }
                </button>
                {isExpanded(item.label) && item.children?.map(child => (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn('sidebar-subitem', isActive && 'active')
                    }
                  >
                    {child.label}
                  </NavLink>
                ))}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Take a tour — replays ProductTour (see components/layout/AppLayout.tsx),
          which otherwise only shows itself automatically once, on a user's
          very first login on this browser. */}
      <button
        onClick={() => window.dispatchEvent(new Event(SHOW_TOUR_EVENT))}
        className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5 text-xs text-sidebar-text hover:text-white transition-colors"
      >
        <HelpCircle size={14} /> Take a tour
      </button>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
          <span className="text-accent text-xs font-semibold">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate">{user?.name}</p>
          <p className="text-sidebar-text text-xs truncate">{user?.role}</p>
        </div>
        <button
          onClick={() => { authStore.clear(); permissionsStore.clear(); window.location.href = '/login' }}
          aria-label="Log out"
          className="text-sidebar-text hover:text-white transition-colors"
        >
          <LogOut size={14} />
        </button>
      </div>
      </aside>
    </>
  )
}
