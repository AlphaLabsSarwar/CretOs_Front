import {
  LayoutDashboard, Truck, Calendar, ClipboardList, FileText,
  CreditCard, Receipt, ShoppingCart, Package, Warehouse,
  Users, Building2, Car, FlaskConical, TrendingUp, Bell, ShieldCheck, Factory, MapPinned
} from 'lucide-react'

export interface NavItem {
  label: string
  icon: React.ElementType
  path?: string
  moduleKey?: string
  children?: { label: string; path: string; moduleKey: string }[]
}

// Every leaf here carries the module_key it corresponds to in
// packages/shared/src/permissions.ts — visibility is resolved per-user by
// the backend (GET /me/permissions), not hardcoded by role here anymore.
export const NAV: NavItem[] = [
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
  // Same module as Fleet — its data comes from /fleet/live, so no new permission key.
  { label: 'Live Tracking', icon: MapPinned, path: '/tracking', moduleKey: 'fleet' },
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

/**
 * The top-level NAV group a route belongs to, or null if it isn't under any
 * sidebar screen. Matches by path prefix, so "/sales/challans/new" and
 * "/sales/challans/:id/edit" still resolve to Sales; the longest match wins.
 * This is what scopes the sidebar to one workspace (see Sidebar.tsx).
 */
export function findWorkspace(pathname: string): NavItem | null {
  let best: { item: NavItem; len: number } | null = null
  for (const item of NAV) {
    const paths = item.path ? [item.path] : (item.children ?? []).map(c => c.path)
    for (const p of paths) {
      if ((pathname === p || pathname.startsWith(p + '/')) && (!best || p.length > best.len)) best = { item, len: p.length }
    }
  }
  return best?.item ?? null
}
