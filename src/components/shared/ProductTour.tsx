import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Truck, FileText, CreditCard, TrendingUp, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { authStore } from '@/store/auth'
import { permissionsStore } from '@/store/permissions'

interface TourStep {
  icon: React.ElementType
  title: string
  body: string
  // Where this step actually takes the person — undefined means "stay put"
  // (used for the closing tip). Real navigation, not a screenshot, is the
  // point: the card floats over the live screen instead of covering it, so
  // whatever it's describing is right there to click on.
  path?: string
  // Gates the step on the same module-permission set Sidebar.tsx filters
  // its nav with — no point walking someone to a screen RequireModule is
  // just going to block them from seeing.
  moduleKey?: string
}

const ALL_STEPS: TourStep[] = [
  {
    icon: LayoutDashboard,
    title: 'Welcome to CretOS',
    body: "This is your plant's ERP — dispatch, invoicing, stores, quality, and reports all in one place. Let's walk through it screen by screen.",
    path: '/dashboard',
    moduleKey: 'dashboard',
  },
  {
    icon: Truck,
    title: 'Quick Dispatch',
    body: "This is the fast, one-screen flow for when a truck is loaded and waiting — pick vehicle, driver, customer, grade and qty, and dispatch in seconds.",
    path: '/quick-dispatch',
  },
  {
    icon: Truck,
    title: 'Dispatch Challans',
    body: 'The full challan list — every dispatch, its status, and site-in/site-out tracking. Create one here when you need the complete form instead of Quick Dispatch.',
    path: '/sales/challans',
    moduleKey: 'sales.challans',
  },
  {
    icon: FileText,
    title: 'Tenders / RFQ',
    body: 'Track an inquiry or bid invitation here before it is worth pricing. Once it is, Convert to Quotation carries the details over for you.',
    path: '/marketing/tenders',
    moduleKey: 'marketing.tenders',
  },
  {
    icon: CreditCard,
    title: 'Invoices',
    body: 'Bill delivered challans from here. Credit control runs automatically at dispatch time, so an over-limit or on-hold customer gets caught before the truck leaves, not after.',
    path: '/finance/invoices',
    moduleKey: 'finance.invoices',
  },
  {
    icon: TrendingUp,
    title: 'Alerts',
    body: "Anything that needs attention today — credit breaches, low stock, overdue tests — surfaces here without digging through each report separately.",
    path: '/reports/alerts',
    moduleKey: 'reports.alerts',
  },
  {
    icon: Search,
    title: "You're set",
    body: 'One more thing: press ⌘K (or Ctrl+K) anywhere to search and jump straight to a screen, a customer, or a challan — faster than clicking through the sidebar.',
    path: '/dashboard',
    moduleKey: 'dashboard',
  },
]

function tourSeenKey(userId: string) {
  return `cretos_tour_seen_${userId}`
}

// Has this user dismissed or finished the tour before, on this browser? A
// deliberately client-side, per-browser flag (not a DB column) — this is
// cosmetic onboarding state, not worth a migration + route across three
// separate user tables (staff/portal/platform). See Sidebar.tsx's "Take a
// tour" link for how to replay it on demand.
export function hasTourRun(userId: string): boolean {
  return localStorage.getItem(tourSeenKey(userId)) === '1'
}

export function markTourSeen(userId: string) {
  localStorage.setItem(tourSeenKey(userId), '1')
}

export default function ProductTour({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const user = authStore.getUser()

  // Only walk through screens this user can actually open — same filter
  // Sidebar.tsx applies to its own nav, so the tour never marches someone
  // into a RequireModule "you don't have access to this page" wall.
  const steps = useMemo(
    () => ALL_STEPS.filter(s => !s.moduleKey || permissionsStore.has(s.moduleKey)),
    []
  )

  const current = steps[step]
  const isLast = step === steps.length - 1
  const Icon = current.icon

  // Navigate to each step's real screen as the tour advances — the whole
  // point of a "hands on" tour vs. a static modal. No scrim over the page:
  // the card floats in a corner so the live screen underneath stays fully
  // visible and clickable while it's being described.
  useEffect(() => {
    if (current.path) navigate(current.path)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function finish() {
    if (user) markTourSeen(user.id)
    onClose()
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-4 sm:inset-auto sm:bottom-5 sm:right-5 sm:justify-end sm:px-0">
      <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start gap-3 px-4 pt-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Icon size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Step {step + 1} of {steps.length}</p>
            <h2 className="text-sm font-semibold text-gray-900">{current.title}</h2>
          </div>
          <button onClick={finish} className="text-gray-300 hover:text-gray-500" aria-label="Skip tour">
            <X size={16} />
          </button>
        </div>

        <p className="px-4 pb-4 pt-2 text-xs leading-relaxed text-gray-500">{current.body}</p>

        <div className="mb-3 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-accent' : 'w-1.5 bg-gray-200'}`} />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-0.5 text-xs font-medium text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-0"
          >
            <ChevronLeft size={13} /> Back
          </button>
          <button onClick={finish} className="text-xs font-medium text-gray-400 hover:text-gray-600">
            Skip
          </button>
          <button
            onClick={() => (isLast ? finish() : setStep(s => s + 1))}
            className="flex items-center gap-0.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover"
          >
            {isLast ? 'Get Started' : 'Next'} {!isLast && <ChevronRight size={13} />}
          </button>
        </div>
      </div>
    </div>
  )
}
