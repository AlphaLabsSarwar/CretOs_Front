import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, Droplet, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { permissionsStore } from '@/store/permissions'
import { cn, formatDate, formatINRCompact, formatQtyShort, formatTime } from '@/lib/utils'

// Sales pipeline — Lead → Follow-up → Quotation → Order → Dispatch plan →
// Challan → Invoice as one kanban. There's no pipeline endpoint; each column
// is the first few rows of the list screen it links to (same endpoints, same
// permissions), and the count badge is that list's total. A column the user
// can't open simply isn't shown.

interface Page<T> { data: T[]; total: number }
interface Card { id: string; title: string; mono?: boolean; sub?: string | null; meta?: React.ReactNode; to: string; warn?: boolean }
interface Column {
  key: string
  label: string
  module: string
  listPath: string
  fetch: () => Promise<Page<any>>
  toCard: (row: any) => Card
}

const PREVIEW = 4
const num = (v: unknown) => (v == null || v === '' ? null : Number(v))

function dispatchState(c: any): { label: string; cls: string } {
  if (c.status === 'DRAFT') return { label: 'Draft', cls: 'text-slate-400' }
  if (c.site_out) return { label: 'Delivered', cls: 'text-green-600' }
  if (c.site_in) return { label: 'At site', cls: 'text-green-600' }
  return { label: 'On the road', cls: 'text-amber-700' }
}

function buildColumns(branchId?: string): Column[] {
  const list = (url: string, params: Record<string, unknown> = {}) => () =>
    api.get(url, { params: { page: 1, limit: PREVIEW, ...params } }).then(r => r.data.data as Page<any>)

  return [
    {
      key: 'lead', label: 'Lead', module: 'marketing.tenders', listPath: '/marketing/tenders',
      fetch: list('/marketing/tenders', { status: 'NEW' }),
      toCard: t => ({
        id: t.id, title: t.customer_name, sub: t.project_site, to: `/marketing/tenders/${t.id}/edit`,
        meta: num(t.estimated_value) ? <span className="font-mono text-slate-600">₹{formatINRCompact(num(t.estimated_value)!)} est.</span> : null,
      }),
    },
    {
      key: 'followup', label: 'Follow-up', module: 'marketing.tenders', listPath: '/marketing/tenders',
      fetch: list('/marketing/tenders', { status: 'IN_REVIEW' }),
      toCard: t => ({
        id: t.id, title: t.customer_name, sub: t.project_site, to: `/marketing/tenders/${t.id}/edit`,
        meta: t.submission_deadline
          ? <span className="flex items-center gap-1 font-mono text-accent"><Clock size={10} />Due {formatDate(t.submission_deadline)}</span>
          : null,
      }),
    },
    {
      key: 'quotation', label: 'Quotation', module: 'marketing.quotations', listPath: '/marketing/quotations',
      fetch: list('/marketing/quotations', { status: 'ACTIVE' }),
      toCard: q => ({
        id: q.id, title: q.quot_no, mono: true, sub: q.project_site ?? q.heading, to: `/marketing/quotations/${q.id}/edit`,
        meta: q.valid_date ? <span className="font-mono text-slate-600">Valid till {formatDate(q.valid_date)}</span> : null,
      }),
    },
    {
      key: 'order', label: 'Sales Order', module: 'sales.orders', listPath: '/sales/orders',
      fetch: list('/sales/orders', { status: 'ACTIVE' }),
      toCard: o => ({
        id: o.id, title: o.order_no, mono: true, sub: o.job_site, to: `/sales/orders/${o.id}/edit`,
        meta: <span className="font-mono text-slate-600">{formatDate(o.from_date)} – {formatDate(o.to_date)}</span>,
      }),
    },
    {
      key: 'schedule', label: 'Dispatch Plan', module: 'sales.schedules', listPath: '/sales/schedules',
      fetch: list('/sales/schedules', { status: 'ACTIVE' }),
      toCard: s => ({
        id: s.id, title: s.job_site, sub: s.sch_no, to: `/sales/schedules/${s.id}/edit`,
        meta: (
          <>
            <span className="flex items-center gap-[5px]">
              {s.grade_name && <span className="rounded bg-accent-light px-[5px] py-px font-mono text-accent">{s.grade_name}</span>}
              <span className="font-mono text-slate-600">{formatQtyShort(Number(s.qty))} m³</span>
            </span>
            {s.pump_type && s.pump_type !== 'NONE' && (
              <span className="mt-1 flex items-center gap-1 font-mono text-[9px] text-slate-400"><Droplet size={10} />Pump required</span>
            )}
          </>
        ),
      }),
    },
    {
      key: 'challan', label: 'Challan', module: 'sales.challans', listPath: '/sales/challans',
      fetch: list('/sales/challans', { branch_id: branchId }),
      toCard: c => {
        const st = dispatchState(c)
        return {
          id: c.id, title: c.challan_no, mono: true, sub: c.customer_name, to: `/sales/challans/${c.id}/edit`,
          meta: <span className={cn('font-mono', st.cls)}>{st.label}{c.dispatch_time && !c.site_out && c.status !== 'DRAFT' ? ` · ${formatTime(c.dispatch_time)}` : ''}</span>,
        }
      },
    },
    {
      key: 'invoice', label: 'Invoice', module: 'finance.invoices', listPath: '/finance/invoices',
      fetch: list('/finance/invoices'),
      toCard: i => ({
        id: i.id, title: i.invoice_no, mono: true, sub: i.customer_name, to: `/finance/invoices/${i.id}`,
        warn: i.status === 'PENDING_APPROVAL',
        meta: (
          <span className={cn('font-mono text-[10.5px] font-bold', i.status === 'POSTED' ? 'text-green-600' : i.status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-700')}>
            ₹{formatINRCompact(Number(i.total_amount))}{i.status === 'PENDING_APPROVAL' ? ' · approval' : i.status === 'DRAFT' ? ' · draft' : ''}
          </span>
        ),
      }),
    },
  ]
}

function PipelineColumn({ col }: { col: Column }) {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({ queryKey: ['pipeline', col.key], queryFn: col.fetch, refetchInterval: 60_000 })
  const cards = (data?.data ?? []).map(col.toCard)

  return (
    <div className="flex w-[180px] shrink-0 flex-col gap-2 lg:w-auto lg:min-w-0 lg:flex-1">
      <Link to={col.listPath} className="flex items-center justify-between px-0.5 hover:text-accent">
        <span className="text-[11px] font-bold">{col.label}</span>
        <span className="rounded-full bg-[#EEF1F5] px-1.5 py-px font-mono text-[10px] text-slate-400">{data?.total ?? '–'}</span>
      </Link>
      {isLoading && Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[62px] animate-pulse rounded-[10px] bg-gray-100" />)}
      {isError && <p className="rounded-[10px] border border-dashed border-gray-200 p-2.5 text-[10px] text-slate-400">Couldn’t load</p>}
      {!isLoading && !isError && cards.length === 0 && (
        <p className="rounded-[10px] border border-dashed border-gray-200 p-2.5 text-center text-[10px] text-slate-400">Nothing here</p>
      )}
      {cards.map(card => (
        <button
          key={card.id}
          onClick={() => navigate(card.to)}
          className={cn(
            'kpi-tile rounded-[10px] p-[9px] text-left',
            card.warn && 'border-amber-200 bg-amber-100',
          )}
        >
          <p className={cn('truncate text-[11px] font-bold', card.mono && 'font-mono')}>{card.title || '—'}</p>
          {card.sub && <p className="mt-0.5 truncate text-[9.5px] text-slate-400">{card.sub}</p>}
          {card.meta && <div className="mt-1.5 text-[9.5px]">{card.meta}</div>}
        </button>
      ))}
      {data && data.total > cards.length && (
        <Link to={col.listPath} className="px-0.5 text-[10px] font-medium text-accent hover:underline">+{data.total - cards.length} more</Link>
      )}
    </div>
  )
}

/** A column's list total for the headline tiles — shares the column's cached query. */
function useColumnTotal(columns: Column[], key: string) {
  const col = columns.find(c => c.key === key)
  return useQuery({
    queryKey: ['pipeline', key],
    queryFn: col?.fetch ?? (() => Promise.resolve({ data: [], total: 0 })),
    enabled: !!col,
    refetchInterval: 60_000,
  }).data?.total
}

function Kpi({ label, value, tone }: { label: string; value: number | undefined; tone?: string }) {
  return (
    <div className="rounded-[10px] border border-gray-200 bg-white px-3.5 py-[11px]">
      <p className="text-[10px] uppercase tracking-[0.04em] text-slate-400">{label}</p>
      <p className={cn('mt-[3px] font-mono text-base font-bold', tone)}>{value ?? '–'}</p>
    </div>
  )
}

export default function PipelinePage() {
  const navigate = useNavigate()
  const user = authStore.getUser()
  const columns = buildColumns(user?.branch?.id).filter(c => permissionsStore.has(c.module))
  const canAddLead = permissionsStore.has('marketing.tenders')

  const leads = useColumnTotal(columns, 'lead')
  const followups = useColumnTotal(columns, 'followup')
  const quotes = useColumnTotal(columns, 'quotation')
  const orders = useColumnTotal(columns, 'order')

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales</h1>
          <p className="mt-[3px] text-xs text-slate-400">Lead → Follow-up → Quotation → Order → Dispatch → Challan → Invoice</p>
        </div>
        {canAddLead && (
          <button
            onClick={() => navigate('/marketing/tenders/new')}
            className="flex h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Plus size={14} /> New Lead
          </button>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Open leads" value={leads != null || followups != null ? (leads ?? 0) + (followups ?? 0) : undefined} />
        <Kpi label="Open quotations" value={quotes} />
        <Kpi label="Active orders" value={orders} tone="text-green-600" />
        <Kpi label="In follow-up" value={followups} tone="text-accent" />
      </div>

      <div className="-mx-6 mt-4 overflow-x-auto px-6 pb-2">
        <div className="flex gap-2.5">
          {columns.map(col => <PipelineColumn key={col.key} col={col} />)}
        </div>
      </div>
    </div>
  )
}
