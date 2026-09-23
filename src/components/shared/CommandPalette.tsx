import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Truck, Calendar, ClipboardList, FileText, CreditCard, Receipt,
  ShoppingCart, Package, Warehouse, Users, Building2, Car, FlaskConical, Plus, Search, CornerDownLeft, MapPinned,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface StaticCommand {
  id: string
  label: string
  group: string
  path: string
  icon: React.ElementType
  keywords?: string
}

interface LiveResult {
  id: string
  label: string
  sublabel?: string
  group: string
  path: string
}

// Every screen + every "create new" shortcut, flattened for instant fuzzy search.
const STATIC_COMMANDS: StaticCommand[] = [
  { id: 'nav-dashboard', label: 'Dashboard', group: 'Go to', path: '/dashboard', icon: LayoutDashboard },

  { id: 'nav-challans', label: 'Dispatch Challan', group: 'Go to', path: '/sales/challans', icon: Truck },
  { id: 'new-challan', label: 'New Dispatch Challan', group: 'Create', path: '/sales/challans/new', icon: Plus, keywords: 'challan dispatch' },
  { id: 'nav-schedules', label: 'Daily Schedule', group: 'Go to', path: '/sales/schedules', icon: Calendar },
  { id: 'new-schedule', label: 'New Schedule', group: 'Create', path: '/sales/schedules/new', icon: Plus },
  { id: 'nav-orders', label: 'Work Orders', group: 'Go to', path: '/sales/orders', icon: ClipboardList },
  { id: 'new-order', label: 'New Work Order', group: 'Create', path: '/sales/orders/new', icon: Plus },

  { id: 'nav-quotations', label: 'Quotations', group: 'Go to', path: '/marketing/quotations', icon: FileText },
  { id: 'new-quotation', label: 'New Quotation', group: 'Create', path: '/marketing/quotations/new', icon: Plus },

  { id: 'nav-invoices', label: 'Invoices', group: 'Go to', path: '/finance/invoices', icon: Receipt },
  { id: 'new-invoice', label: 'Generate Invoice', group: 'Create', path: '/finance/invoices/new', icon: Plus },
  { id: 'nav-payments', label: 'Payment Voucher', group: 'Go to', path: '/finance/payments', icon: CreditCard },
  { id: 'new-payment', label: 'New Payment Voucher', group: 'Create', path: '/finance/payments/new', icon: Plus },
  { id: 'nav-receipts', label: 'Receipt Voucher', group: 'Go to', path: '/finance/receipts', icon: CreditCard },
  { id: 'new-receipt', label: 'New Receipt Voucher', group: 'Create', path: '/finance/receipts/new', icon: Plus },
  { id: 'nav-journals', label: 'Journal Entry', group: 'Go to', path: '/finance/journals', icon: CreditCard },
  { id: 'new-journal', label: 'New Journal Entry', group: 'Create', path: '/finance/journals/new', icon: Plus },

  { id: 'nav-po', label: 'Purchase Order', group: 'Go to', path: '/stores/po', icon: ShoppingCart },
  { id: 'new-po', label: 'New Purchase Order', group: 'Create', path: '/stores/po/new', icon: Plus },
  { id: 'nav-grn', label: 'GRN', group: 'Go to', path: '/stores/grn', icon: Package },
  { id: 'new-grn', label: 'New GRN', group: 'Create', path: '/stores/grn/new', icon: Plus, keywords: 'goods receipt' },
  { id: 'nav-indents', label: 'Indent', group: 'Go to', path: '/stores/indents', icon: Warehouse },
  { id: 'new-indent', label: 'New Indent', group: 'Create', path: '/stores/indents/new', icon: Plus },

  { id: 'nav-grades', label: 'Grade Master', group: 'Go to', path: '/masters/grades', icon: FlaskConical, keywords: 'mix design concrete lab' },
  { id: 'new-grade', label: 'New Grade', group: 'Create', path: '/masters/grades/new', icon: Plus },

  { id: 'nav-tracking', label: 'Live Tracking', group: 'Go to', path: '/tracking', icon: MapPinned, keywords: 'trucks map gps fleet dispatch status location' },

  { id: 'nav-customers', label: 'Customers', group: 'Go to', path: '/masters/customers', icon: Users },
  { id: 'new-customer', label: 'New Customer', group: 'Create', path: '/masters/customers/new', icon: Plus },
  { id: 'nav-vendors', label: 'Vendors', group: 'Go to', path: '/masters/vendors', icon: Building2 },
  { id: 'new-vendor', label: 'New Vendor', group: 'Create', path: '/masters/vendors/new', icon: Plus },
  { id: 'nav-vehicles', label: 'Vehicles', group: 'Go to', path: '/masters/vehicles', icon: Car },
  { id: 'new-vehicle', label: 'New Vehicle', group: 'Create', path: '/masters/vehicles/new', icon: Plus },
  { id: 'nav-users', label: 'Users', group: 'Go to', path: '/masters/users', icon: Users, keywords: 'staff logins operator role' },
  { id: 'new-user', label: 'New User', group: 'Create', path: '/masters/users/new', icon: Plus },
]

function fuzzyMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query.toLowerCase())
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [liveResults, setLiveResults] = useState<LiveResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Global Cmd+K / Ctrl+K toggle
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setLiveResults([])
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  // Live record search (challans, customers, vendors) once the user types 2+ chars
  useEffect(() => {
    if (query.trim().length < 2) { setLiveResults([]); return }
    const handle = setTimeout(async () => {
      try {
        const [challans, customers, vendors] = await Promise.all([
          api.get('/sales/challans', { params: { limit: 5, search: query } }).then(r => r.data.data.data ?? []),
          api.get('/masters/customers', { params: { limit: 5, search: query } }).then(r => r.data.data.data ?? []),
          api.get('/masters/vendors', { params: { limit: 5, search: query } }).then(r => r.data.data.data ?? []),
        ])
        setLiveResults([
          ...challans.map((c: any): LiveResult => ({ id: `c-${c.id}`, label: c.challan_no, sublabel: c.customer_name ?? c.job_site, group: 'Challans', path: `/sales/challans/${c.id}/edit` })),
          ...customers.map((c: any): LiveResult => ({ id: `cu-${c.id}`, label: c.name, sublabel: c.mobile ?? c.code, group: 'Customers', path: `/masters/customers/${c.id}/edit` })),
          ...vendors.map((v: any): LiveResult => ({ id: `v-${v.id}`, label: v.name, sublabel: v.mobile ?? v.code, group: 'Vendors', path: `/masters/vendors/${v.id}` })),
        ])
      } catch {
        setLiveResults([])
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  const filteredStatic = useMemo(() => {
    if (!query.trim()) return STATIC_COMMANDS
    return STATIC_COMMANDS.filter(c => fuzzyMatch(query, c.label) || (c.keywords && fuzzyMatch(query, c.keywords)))
  }, [query])

  // Flatten into one ordered list for keyboard navigation: live results first (most specific), then static commands
  const flatResults = useMemo(() => {
    return [
      ...liveResults.map(r => ({ kind: 'live' as const, item: r })),
      ...filteredStatic.map(c => ({ kind: 'static' as const, item: c })),
    ]
  }, [liveResults, filteredStatic])

  useEffect(() => setActiveIndex(0), [query, liveResults])

  function go(path: string) {
    setOpen(false)
    navigate(path)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flatResults.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const r = flatResults[activeIndex]
      if (r) go(r.item.path)
    }
  }

  // Group static results for display
  const grouped = useMemo(() => {
    const groups: Record<string, StaticCommand[]> = {}
    for (const c of filteredStatic) { (groups[c.group] ??= []).push(c) }
    return groups
  }, [filteredStatic])

  const liveGroups = useMemo(() => {
    const groups: Record<string, LiveResult[]> = {}
    for (const r of liveResults) { (groups[r.group] ??= []).push(r) }
    return groups
  }, [liveResults])

  if (!open) return null

  let runningIndex = -1

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-black/40 pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Search size={15} className="text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search challans, customers, vendors, or jump to any page..."
            className="w-full text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">Esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-1.5">
          {Object.entries(liveGroups).map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="px-4 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group}</p>
              {items.map(r => {
                runningIndex++
                const idx = runningIndex
                return (
                  <button
                    key={r.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => go(r.path)}
                    className={cn('flex w-full items-center justify-between px-4 py-1.5 text-left text-xs', activeIndex === idx ? 'bg-orange-50 text-gray-900' : 'text-gray-700')}
                  >
                    <span className="font-medium">{r.label}</span>
                    {r.sublabel && <span className="text-gray-400">{r.sublabel}</span>}
                  </button>
                )
              })}
            </div>
          ))}

          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="px-4 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group}</p>
              {items.map(c => {
                runningIndex++
                const idx = runningIndex
                const Icon = c.icon
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => go(c.path)}
                    className={cn('flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-xs', activeIndex === idx ? 'bg-orange-50 text-gray-900' : 'text-gray-700')}
                  >
                    <Icon size={14} className="text-gray-400" />
                    <span>{c.label}</span>
                    {activeIndex === idx && <CornerDownLeft size={12} className="ml-auto text-gray-300" />}
                  </button>
                )
              })}
            </div>
          ))}

          {flatResults.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-gray-400">No matches for "{query}"</p>
          )}
        </div>
      </div>
    </div>
  )
}
