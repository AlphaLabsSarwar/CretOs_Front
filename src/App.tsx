import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { authStore } from './store/auth'
import { permissionsStore } from './store/permissions'
import AppLayout from './components/layout/AppLayout'
import RmcLoader from './components/shared/RmcLoader'
import LoginPage from './pages/auth/LoginPage'
import ProductTour, { hasTourRun } from './components/shared/ProductTour'
import { SHOW_TOUR_EVENT } from './lib/tourEvent'

// ─── Lazy-loaded route pages ─────────────────────────────────────────────
// Every page except LoginPage (needed for first paint) is code-split into
// its own chunk. React.lazy + Suspense below means a user only downloads
// the JS for the screens they actually visit, instead of one >500kb bundle
// up front. Grouped in the same order as the routes further down.
const HomePage = lazy(() => import('./pages/home/HomePage'))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
// Sales
const ChallanListPage = lazy(() => import('./pages/sales/ChallanListPage'))
const ChallanFormPage = lazy(() => import('./pages/sales/ChallanFormPage'))
const ChallanPrintPage = lazy(() => import('./pages/sales/ChallanPrintPage'))
const QuickDispatchPage = lazy(() => import('./pages/sales/QuickDispatchPage'))
const ScheduleListPage = lazy(() => import('./pages/sales/ScheduleListPage'))
const ScheduleFormPage = lazy(() => import('./pages/sales/ScheduleFormPage'))
const OrderListPage = lazy(() => import('./pages/sales/OrderListPage'))
const OrderFormPage = lazy(() => import('./pages/sales/OrderFormPage'))
// Marketing
const TenderListPage = lazy(() => import('./pages/marketing/TenderListPage'))
const TenderFormPage = lazy(() => import('./pages/marketing/TenderFormPage'))
const QuotationListPage = lazy(() => import('./pages/marketing/QuotationListPage'))
const QuotationFormPage = lazy(() => import('./pages/marketing/QuotationFormPage'))
const QuotationPrintPage = lazy(() => import('./pages/marketing/QuotationPrintPage'))
// Finance
const PaymentListPage = lazy(() => import('./pages/finance/PaymentListPage'))
const PaymentFormPage = lazy(() => import('./pages/finance/PaymentFormPage'))
const ReceiptListPage = lazy(() => import('./pages/finance/ReceiptListPage'))
const ReceiptFormPage = lazy(() => import('./pages/finance/ReceiptFormPage'))
const JournalListPage = lazy(() => import('./pages/finance/JournalListPage'))
const JournalFormPage = lazy(() => import('./pages/finance/JournalFormPage'))
const InvoiceListPage = lazy(() => import('./pages/finance/InvoiceListPage'))
const InvoiceFormPage = lazy(() => import('./pages/finance/InvoiceFormPage'))
const InvoiceDetailPage = lazy(() => import('./pages/finance/InvoiceDetailPage'))
const InvoicePrintPage = lazy(() => import('./pages/finance/InvoicePrintPage'))
const CashbookPage = lazy(() => import('./pages/finance/CashbookPage'))
// Stores
const POListPage = lazy(() => import('./pages/stores/POListPage'))
const POFormPage = lazy(() => import('./pages/stores/POFormPage'))
const POPrintPage = lazy(() => import('./pages/stores/POPrintPage'))
const GRNListPage = lazy(() => import('./pages/stores/GRNListPage'))
const GRNFormPage = lazy(() => import('./pages/stores/GRNFormPage'))
const GRNPrintPage = lazy(() => import('./pages/stores/GRNPrintPage'))
const IndentListPage = lazy(() => import('./pages/stores/IndentListPage'))
const IndentFormPage = lazy(() => import('./pages/stores/IndentFormPage'))
// Masters
const CustomerListPage = lazy(() => import('./pages/masters/CustomerListPage'))
const CustomerFormPage = lazy(() => import('./pages/masters/CustomerFormPage'))
const CustomerRateListPage = lazy(() => import('./pages/masters/CustomerRateListPage'))
const CustomerRateFormPage = lazy(() => import('./pages/masters/CustomerRateFormPage'))
const ItemListPage = lazy(() => import('./pages/masters/ItemListPage'))
const ItemFormPage = lazy(() => import('./pages/masters/ItemFormPage'))
const VendorListPage = lazy(() => import('./pages/masters/VendorListPage'))
const VendorFormPage = lazy(() => import('./pages/masters/VendorFormPage'))
const VendorDetailPage = lazy(() => import('./pages/masters/VendorDetailPage'))
const VehicleListPage = lazy(() => import('./pages/masters/VehicleListPage'))
const VehicleFormPage = lazy(() => import('./pages/masters/VehicleFormPage'))
const DriverListPage = lazy(() => import('./pages/masters/DriverListPage'))
const DriverFormPage = lazy(() => import('./pages/masters/DriverFormPage'))
const GradeListPage = lazy(() => import('./pages/masters/GradeListPage'))
const GradeFormPage = lazy(() => import('./pages/masters/GradeFormPage'))
const GradeVersionsPage = lazy(() => import('./pages/masters/GradeVersionsPage'))
const UserListPage = lazy(() => import('./pages/masters/UserListPage'))
const UserFormPage = lazy(() => import('./pages/masters/UserFormPage'))
const PumpListPage = lazy(() => import('./pages/masters/PumpListPage'))
const PumpFormPage = lazy(() => import('./pages/masters/PumpFormPage'))
// Production
const WeighbridgeListPage = lazy(() => import('./pages/production/WeighbridgeListPage'))
const WeighbridgeFormPage = lazy(() => import('./pages/production/WeighbridgeFormPage'))
const BatchingListPage = lazy(() => import('./pages/production/BatchingListPage'))
const BatchFormPage = lazy(() => import('./pages/production/BatchFormPage'))
const BatchDetailPage = lazy(() => import('./pages/production/BatchDetailPage'))
const ReconciliationPage = lazy(() => import('./pages/production/ReconciliationPage'))
const PlantConnectivityPage = lazy(() => import('./pages/production/PlantConnectivityPage'))
const ConcreteAgePage = lazy(() => import('./pages/production/ConcreteAgePage'))
const PumpScheduleBoardPage = lazy(() => import('./pages/production/PumpScheduleBoardPage'))
const OeePage = lazy(() => import('./pages/production/OeePage'))
const EnergyPage = lazy(() => import('./pages/production/EnergyPage'))
const CarbonPage = lazy(() => import('./pages/production/CarbonPage'))
// Quality
const QualityTestListPage = lazy(() => import('./pages/quality/QualityTestListPage'))
const QualityTestFormPage = lazy(() => import('./pages/quality/QualityTestFormPage'))
const NcrListPage = lazy(() => import('./pages/quality/NcrListPage'))
const NcrFormPage = lazy(() => import('./pages/quality/NcrFormPage'))
const NcrDetailPage = lazy(() => import('./pages/quality/NcrDetailPage'))
const QualityTestPrintPage = lazy(() => import('./pages/quality/QualityTestPrintPage'))
// Stores (raw material stock)
const StockPage = lazy(() => import('./pages/stores/StockPage'))
// Reports
const ProfitabilityReportPage = lazy(() => import('./pages/reports/ProfitabilityReportPage'))
const AgingReportPage = lazy(() => import('./pages/reports/AgingReportPage'))
const SalesAnalysisPage = lazy(() => import('./pages/reports/SalesAnalysisPage'))
const AlertsPage = lazy(() => import('./pages/reports/AlertsPage'))
const GstrExportPage = lazy(() => import('./pages/reports/GstrExportPage'))
// Admin
const CreditRiskPage = lazy(() => import('./pages/reports/CreditRiskPage'))
const MultiBranchPage = lazy(() => import('./pages/reports/MultiBranchPage'))
const DriverScorecardPage = lazy(() => import('./pages/reports/DriverScorecardPage'))
const CapacityReportPage = lazy(() => import('./pages/reports/CapacityReportPage'))
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'))
const PermissionsPage = lazy(() => import('./pages/admin/PermissionsPage'))
const ReportSchedulesPage = lazy(() => import('./pages/admin/ReportSchedulesPage'))
// Fleet
const FleetPage = lazy(() => import('./pages/fleet/FleetPage'))
const LiveTrackingPage = lazy(() => import('./pages/tracking/LiveTrackingPage'))
// Masters (extra)
const CustomerStatementPage = lazy(() => import('./pages/masters/CustomerStatementPage'))
const GradeCertificatePage = lazy(() => import('./pages/masters/GradeCertificatePage'))
// Public
const TrackPage = lazy(() => import('./pages/public/TrackPage'))
const PassportPage = lazy(() => import('./pages/public/PassportPage'))
// Customer portal
import { portalAuthStore } from './store/portalAuth'
const PortalLoginPage = lazy(() => import('./pages/portal/PortalLoginPage'))
const PortalDashboardPage = lazy(() => import('./pages/portal/PortalDashboardPage'))
// Platform Admin — the product operator's own console for onboarding clients
import { platformAuthStore } from './store/platformAuth'
const PlatformLoginPage = lazy(() => import('./pages/platform/PlatformLoginPage'))
const PlatformCompaniesPage = lazy(() => import('./pages/platform/PlatformCompaniesPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!authStore.isLoggedIn()) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Full ERP shell (sidebar + header) — just needs a login now. Which tabs
// show up inside it, and which routes actually render, is entirely down to
// resolved module permissions (see RequireModule below and Sidebar.tsx).
// An OPERATOR with zero granted modules effectively still only reaches
// Quick Dispatch, since every other route redirects to "no access"; an
// OPERATOR an admin has granted tabs to now sees exactly those.
function RequireFullAccess({ children }: { children: React.ReactNode }) {
  if (!authStore.isLoggedIn()) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Per-tab/tile gate — mirrors the backend's module-key enforcement
// (middleware/auth.ts) so a page a user isn't allowed to open doesn't even
// attempt to render (its API calls would 403 anyway). Renders an inline
// message instead of redirecting, so it can never loop back into itself.
function RequireModule({ moduleKey, children }: { moduleKey: string; children: React.ReactNode }) {
  if (!authStore.isLoggedIn()) return <Navigate to="/login" replace />
  if (!permissionsStore.has(moduleKey)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="text-sm font-medium text-gray-700">You don't have access to this page</p>
        <p className="text-xs text-gray-400">Ask an admin to grant it from Admin → Permissions.</p>
      </div>
    )
  }
  return <>{children}</>
}

// Belt-and-suspenders on top of RequireModule('admin.permissions') — the
// Permissions screen controls every other screen, so it gets an explicit,
// unconditional role check here too (matching the backend's HARD_ADMIN_ONLY),
// not just "not in the resolved module set."
function RequireAdmin({ children }: { children: React.ReactNode }) {
  if (!authStore.isLoggedIn()) return <Navigate to="/login" replace />
  if (authStore.getUser()?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// Customer self-service portal has its own auth realm — separate token/store,
// separate login page. Not part of the staff RequireFullAccess/AppLayout tree.
function RequirePortalAuth({ children }: { children: React.ReactNode }) {
  if (!portalAuthStore.isLoggedIn()) return <Navigate to="/portal/login" replace />
  return <>{children}</>
}

// Platform Admin console — a third, entirely separate auth realm from staff
// and the customer portal. Not part of any company; this is the operator's
// own login for onboarding new clients (see store/platformAuth.ts).
function RequirePlatformAuth({ children }: { children: React.ReactNode }) {
  if (!platformAuthStore.isLoggedIn()) return <Navigate to="/platform/login" replace />
  return <>{children}</>
}

// Route-level Suspense fallback — same branded loader used everywhere else
// in the app, just centered in the viewport for the full-page chunk load.
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <RmcLoader size="lg" />
    </div>
  )
}

export default function App() {
  const [showTour, setShowTour] = useState(false)

  // Lives at the App root, not inside AppLayout — the tour navigates to
  // /quick-dispatch, which sits outside AppLayout's route tree (see the
  // route list below), so mounting the tour inside AppLayout meant it got
  // unmounted the moment it navigated somewhere AppLayout doesn't render.
  // First-run: show once per (browser, user) — see ProductTour.tsx. Also
  // reopenable any time via Sidebar's "Take a tour" link, which just
  // re-dispatches the same event this listens for.
  useEffect(() => {
    const user = authStore.getUser()
    if (user && !hasTourRun(user.id)) setShowTour(true)
    const openTour = () => setShowTour(true)
    window.addEventListener(SHOW_TOUR_EVENT, openTour)
    return () => window.removeEventListener(SHOW_TOUR_EVENT, openTour)
  }, [])

  return (
    <BrowserRouter>
      {showTour && <ProductTour onClose={() => setShowTour(false)} />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Public, unauthenticated delivery tracking page — shared via WhatsApp/email */}
          <Route path="/track/:code" element={<TrackPage />} />
          <Route path="/passport/:code" element={<PassportPage />} />
          {/* Customer self-service portal — own auth realm, no staff sidebar/header chrome */}
          <Route path="/portal/login" element={<PortalLoginPage />} />
          <Route path="/portal" element={<RequirePortalAuth><PortalDashboardPage /></RequirePortalAuth>} />
          {/* Platform Admin console — the product operator's onboarding tool, own auth realm */}
          <Route path="/platform/login" element={<PlatformLoginPage />} />
          <Route path="/platform/companies" element={<RequirePlatformAuth><PlatformCompaniesPage /></RequirePlatformAuth>} />
          {/* Standalone print views — no sidebar/header chrome, so the printed page is clean */}
          <Route path="/sales/challans/:id/print" element={<ProtectedRoute><ChallanPrintPage /></ProtectedRoute>} />
          <Route path="/finance/invoices/:id/print" element={<ProtectedRoute><InvoicePrintPage /></ProtectedRoute>} />
          <Route path="/masters/customers/:id/statement" element={<ProtectedRoute><CustomerStatementPage /></ProtectedRoute>} />
          <Route path="/masters/grades/:id/certificate" element={<ProtectedRoute><GradeCertificatePage /></ProtectedRoute>} />
          <Route path="/stores/po/:id/print" element={<ProtectedRoute><POPrintPage /></ProtectedRoute>} />
          <Route path="/stores/grn/:id/print" element={<ProtectedRoute><GRNPrintPage /></ProtectedRoute>} />
          <Route path="/marketing/quotations/:id/print" element={<ProtectedRoute><QuotationPrintPage /></ProtectedRoute>} />
          <Route path="/quality/tests/:id/print" element={<ProtectedRoute><QualityTestPrintPage /></ProtectedRoute>} />
          {/* Loading-bay operator screen — minimal, single-purpose, no sidebar */}
          <Route path="/quick-dispatch" element={<ProtectedRoute><QuickDispatchPage /></ProtectedRoute>} />
          {/* Workspace launcher — post-login landing; own top-bar chrome, no sidebar */}
          <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/" element={<RequireFullAccess><AppLayout /></RequireFullAccess>}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="dashboard" element={<RequireModule moduleKey="dashboard"><DashboardPage /></RequireModule>} />
            {/* Sales */}
            <Route path="sales/challans" element={<RequireModule moduleKey="sales.challans"><ChallanListPage /></RequireModule>} />
            <Route path="sales/challans/new" element={<RequireModule moduleKey="sales.challans"><ChallanFormPage /></RequireModule>} />
            <Route path="sales/challans/:id/edit" element={<RequireModule moduleKey="sales.challans"><ChallanFormPage /></RequireModule>} />
            <Route path="sales/schedules" element={<RequireModule moduleKey="sales.schedules"><ScheduleListPage /></RequireModule>} />
            <Route path="sales/schedules/new" element={<RequireModule moduleKey="sales.schedules"><ScheduleFormPage /></RequireModule>} />
            <Route path="sales/schedules/:id/edit" element={<RequireModule moduleKey="sales.schedules"><ScheduleFormPage /></RequireModule>} />
            <Route path="sales/orders" element={<RequireModule moduleKey="sales.orders"><OrderListPage /></RequireModule>} />
            <Route path="sales/orders/new" element={<RequireModule moduleKey="sales.orders"><OrderFormPage /></RequireModule>} />
            <Route path="sales/orders/:id/edit" element={<RequireModule moduleKey="sales.orders"><OrderFormPage /></RequireModule>} />
            {/* Marketing */}
            <Route path="marketing/tenders" element={<RequireModule moduleKey="marketing.tenders"><TenderListPage /></RequireModule>} />
            <Route path="marketing/tenders/new" element={<RequireModule moduleKey="marketing.tenders"><TenderFormPage /></RequireModule>} />
            <Route path="marketing/tenders/:id/edit" element={<RequireModule moduleKey="marketing.tenders"><TenderFormPage /></RequireModule>} />
            <Route path="marketing/quotations" element={<RequireModule moduleKey="marketing.quotations"><QuotationListPage /></RequireModule>} />
            <Route path="marketing/quotations/new" element={<RequireModule moduleKey="marketing.quotations"><QuotationFormPage /></RequireModule>} />
            <Route path="marketing/quotations/:id/edit" element={<RequireModule moduleKey="marketing.quotations"><QuotationFormPage /></RequireModule>} />
            {/* Finance */}
            <Route path="finance/payments" element={<RequireModule moduleKey="finance.payments"><PaymentListPage /></RequireModule>} />
            <Route path="finance/payments/new" element={<RequireModule moduleKey="finance.payments"><PaymentFormPage /></RequireModule>} />
            <Route path="finance/payments/:id/edit" element={<RequireModule moduleKey="finance.payments"><PaymentFormPage /></RequireModule>} />
            <Route path="finance/receipts" element={<RequireModule moduleKey="finance.receipts"><ReceiptListPage /></RequireModule>} />
            <Route path="finance/receipts/new" element={<RequireModule moduleKey="finance.receipts"><ReceiptFormPage /></RequireModule>} />
            <Route path="finance/receipts/:id/edit" element={<RequireModule moduleKey="finance.receipts"><ReceiptFormPage /></RequireModule>} />
            <Route path="finance/journals" element={<RequireModule moduleKey="finance.journals"><JournalListPage /></RequireModule>} />
            <Route path="finance/journals/new" element={<RequireModule moduleKey="finance.journals"><JournalFormPage /></RequireModule>} />
            <Route path="finance/journals/:id/edit" element={<RequireModule moduleKey="finance.journals"><JournalFormPage /></RequireModule>} />
            <Route path="finance/cashbook" element={<RequireModule moduleKey="finance.cashbook"><CashbookPage /></RequireModule>} />
            <Route path="finance/invoices" element={<RequireModule moduleKey="finance.invoices"><InvoiceListPage /></RequireModule>} />
            <Route path="finance/invoices/new" element={<RequireModule moduleKey="finance.invoices"><InvoiceFormPage /></RequireModule>} />
            <Route path="finance/invoices/:id" element={<RequireModule moduleKey="finance.invoices"><InvoiceDetailPage /></RequireModule>} />
            {/* Stores */}
            <Route path="stores/po" element={<RequireModule moduleKey="stores.po"><POListPage /></RequireModule>} />
            <Route path="stores/po/new" element={<RequireModule moduleKey="stores.po"><POFormPage /></RequireModule>} />
            <Route path="stores/po/:id/edit" element={<RequireModule moduleKey="stores.po"><POFormPage /></RequireModule>} />
            <Route path="stores/grn" element={<RequireModule moduleKey="stores.grn"><GRNListPage /></RequireModule>} />
            <Route path="stores/grn/new" element={<RequireModule moduleKey="stores.grn"><GRNFormPage /></RequireModule>} />
            <Route path="stores/grn/:id/edit" element={<RequireModule moduleKey="stores.grn"><GRNFormPage /></RequireModule>} />
            <Route path="stores/indents" element={<RequireModule moduleKey="stores.indents"><IndentListPage /></RequireModule>} />
            <Route path="stores/indents/new" element={<RequireModule moduleKey="stores.indents"><IndentFormPage /></RequireModule>} />
            <Route path="stores/indents/:id/edit" element={<RequireModule moduleKey="stores.indents"><IndentFormPage /></RequireModule>} />
            <Route path="stores/stock" element={<RequireModule moduleKey="stores.stock"><StockPage /></RequireModule>} />
            {/* Production */}
            <Route path="production/weighbridge" element={<RequireModule moduleKey="production.weighbridge"><WeighbridgeListPage /></RequireModule>} />
            <Route path="production/weighbridge/new" element={<RequireModule moduleKey="production.weighbridge"><WeighbridgeFormPage /></RequireModule>} />
            <Route path="production/weighbridge/:id/edit" element={<RequireModule moduleKey="production.weighbridge"><WeighbridgeFormPage /></RequireModule>} />
            <Route path="production/batches" element={<RequireModule moduleKey="production.batching"><BatchingListPage /></RequireModule>} />
            <Route path="production/batches/new" element={<RequireModule moduleKey="production.batching"><BatchFormPage /></RequireModule>} />
            <Route path="production/batches/:id" element={<RequireModule moduleKey="production.batching"><BatchDetailPage /></RequireModule>} />
            <Route path="production/connectivity" element={<RequireModule moduleKey="production.batching"><PlantConnectivityPage /></RequireModule>} />
            <Route path="production/reconciliation" element={<RequireModule moduleKey="production.reconciliation"><ReconciliationPage /></RequireModule>} />
            <Route path="production/concrete-age" element={<RequireModule moduleKey="production.concreteAge"><ConcreteAgePage /></RequireModule>} />
            <Route path="production/pumps" element={<RequireModule moduleKey="production.pumps"><PumpScheduleBoardPage /></RequireModule>} />
            <Route path="production/oee" element={<RequireModule moduleKey="production.oee"><OeePage /></RequireModule>} />
            <Route path="production/energy" element={<RequireModule moduleKey="production.energy"><EnergyPage /></RequireModule>} />
            <Route path="production/carbon" element={<RequireModule moduleKey="production.carbon"><CarbonPage /></RequireModule>} />
            {/* Quality */}
            <Route path="quality/tests" element={<RequireModule moduleKey="lab.tests"><QualityTestListPage /></RequireModule>} />
            <Route path="quality/tests/new" element={<RequireModule moduleKey="lab.tests"><QualityTestFormPage /></RequireModule>} />
            <Route path="quality/tests/:id/edit" element={<RequireModule moduleKey="lab.tests"><QualityTestFormPage /></RequireModule>} />
            <Route path="quality/ncr" element={<RequireModule moduleKey="lab.ncr"><NcrListPage /></RequireModule>} />
            <Route path="quality/ncr/new" element={<RequireModule moduleKey="lab.ncr"><NcrFormPage /></RequireModule>} />
            <Route path="quality/ncr/:id" element={<RequireModule moduleKey="lab.ncr"><NcrDetailPage /></RequireModule>} />
            {/* Reports */}
            <Route path="reports/profitability" element={<RequireModule moduleKey="reports.profitability"><ProfitabilityReportPage /></RequireModule>} />
            <Route path="reports/aging" element={<RequireModule moduleKey="reports.aging"><AgingReportPage /></RequireModule>} />
            <Route path="reports/credit-risk" element={<RequireModule moduleKey="reports.creditRisk"><CreditRiskPage /></RequireModule>} />
            <Route path="reports/multi-branch" element={<RequireModule moduleKey="reports.multiBranch"><MultiBranchPage /></RequireModule>} />
            <Route path="reports/driver-scorecard" element={<RequireModule moduleKey="reports.driverScorecard"><DriverScorecardPage /></RequireModule>} />
            <Route path="reports/capacity" element={<RequireModule moduleKey="reports.capacity"><CapacityReportPage /></RequireModule>} />
            <Route path="reports/sales-analysis" element={<RequireModule moduleKey="reports.salesAnalysis"><SalesAnalysisPage /></RequireModule>} />
            <Route path="reports/alerts" element={<RequireModule moduleKey="reports.alerts"><AlertsPage /></RequireModule>} />
            <Route path="reports/gstr-export" element={<RequireModule moduleKey="reports.gstrExport"><GstrExportPage /></RequireModule>} />
            {/* Fleet */}
            <Route path="fleet" element={<RequireModule moduleKey="fleet"><FleetPage /></RequireModule>} />
            <Route path="tracking" element={<RequireModule moduleKey="fleet"><LiveTrackingPage /></RequireModule>} />
            {/* Admin */}
            <Route path="admin/audit-log" element={<RequireModule moduleKey="admin.auditLog"><AuditLogPage /></RequireModule>} />
            <Route path="admin/report-schedules" element={<RequireModule moduleKey="admin.reportSchedules"><ReportSchedulesPage /></RequireModule>} />
            <Route path="admin/permissions" element={<RequireAdmin><RequireModule moduleKey="admin.permissions"><PermissionsPage /></RequireModule></RequireAdmin>} />
            {/* Masters */}
            <Route path="masters/customers" element={<RequireModule moduleKey="masters.customers"><CustomerListPage /></RequireModule>} />
            <Route path="masters/customers/new" element={<RequireModule moduleKey="masters.customers"><CustomerFormPage /></RequireModule>} />
            <Route path="masters/customers/:id/edit" element={<RequireModule moduleKey="masters.customers"><CustomerFormPage /></RequireModule>} />
            <Route path="masters/customer-rates" element={<RequireModule moduleKey="masters.customerRates"><CustomerRateListPage /></RequireModule>} />
            <Route path="masters/customer-rates/new" element={<RequireModule moduleKey="masters.customerRates"><CustomerRateFormPage /></RequireModule>} />
            <Route path="masters/customer-rates/:id/edit" element={<RequireModule moduleKey="masters.customerRates"><CustomerRateFormPage /></RequireModule>} />
            <Route path="masters/items" element={<RequireModule moduleKey="masters.items"><ItemListPage /></RequireModule>} />
            <Route path="masters/items/new" element={<RequireModule moduleKey="masters.items"><ItemFormPage /></RequireModule>} />
            <Route path="masters/items/:id/edit" element={<RequireModule moduleKey="masters.items"><ItemFormPage /></RequireModule>} />
            <Route path="masters/vendors" element={<RequireModule moduleKey="masters.vendors"><VendorListPage /></RequireModule>} />
            <Route path="masters/vendors/new" element={<RequireModule moduleKey="masters.vendors"><VendorFormPage /></RequireModule>} />
            <Route path="masters/vendors/:id/edit" element={<RequireModule moduleKey="masters.vendors"><VendorFormPage /></RequireModule>} />
            <Route path="masters/vendors/:id" element={<RequireModule moduleKey="masters.vendors"><VendorDetailPage /></RequireModule>} />
            <Route path="masters/vehicles" element={<RequireModule moduleKey="masters.vehicles"><VehicleListPage /></RequireModule>} />
            <Route path="masters/vehicles/new" element={<RequireModule moduleKey="masters.vehicles"><VehicleFormPage /></RequireModule>} />
            <Route path="masters/vehicles/:id/edit" element={<RequireModule moduleKey="masters.vehicles"><VehicleFormPage /></RequireModule>} />
            <Route path="masters/drivers" element={<RequireModule moduleKey="masters.drivers"><DriverListPage /></RequireModule>} />
            <Route path="masters/drivers/new" element={<RequireModule moduleKey="masters.drivers"><DriverFormPage /></RequireModule>} />
            <Route path="masters/drivers/:id/edit" element={<RequireModule moduleKey="masters.drivers"><DriverFormPage /></RequireModule>} />
            <Route path="masters/grades" element={<RequireModule moduleKey="lab.grades"><GradeListPage /></RequireModule>} />
            <Route path="masters/grades/new" element={<RequireModule moduleKey="lab.grades"><GradeFormPage /></RequireModule>} />
            <Route path="masters/grades/:id/edit" element={<RequireModule moduleKey="lab.grades"><GradeFormPage /></RequireModule>} />
            <Route path="masters/grades/:id/versions" element={<RequireModule moduleKey="lab.grades"><GradeVersionsPage /></RequireModule>} />
            <Route path="masters/users" element={<RequireModule moduleKey="masters.users"><UserListPage /></RequireModule>} />
            <Route path="masters/users/new" element={<RequireModule moduleKey="masters.users"><UserFormPage /></RequireModule>} />
            <Route path="masters/users/:id/edit" element={<RequireModule moduleKey="masters.users"><UserFormPage /></RequireModule>} />
            <Route path="masters/pumps" element={<RequireModule moduleKey="production.pumps"><PumpListPage /></RequireModule>} />
            <Route path="masters/pumps/new" element={<RequireModule moduleKey="production.pumps"><PumpFormPage /></RequireModule>} />
            <Route path="masters/pumps/:id/edit" element={<RequireModule moduleKey="production.pumps"><PumpFormPage /></RequireModule>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
