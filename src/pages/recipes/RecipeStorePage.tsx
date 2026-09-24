import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, ChevronDown, Copy, Eye, FlaskConical, Plus, Search, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import { RECIPES, RECIPE_STATS, ROW_TINT, STATUS_STYLE, type RecipeStatus } from '@/lib/recipes'
import SampleDataBadge from './SampleDataBadge'

// Recipe Store — library of concrete mix recipes. Sample data until the recipe
// API exists (see lib/recipes.ts); actions that would write say so instead of
// pretending to.

const FILTERS = ['Plant', 'Customer', 'Grade', 'Status'] as const
type FilterKey = (typeof FILTERS)[number]

const valueOf = (r: (typeof RECIPES)[number], key: FilterKey) =>
  key === 'Plant' ? r.plant : key === 'Customer' ? r.customer ?? 'Internal' : key === 'Grade' ? r.grade : r.status

function FilterChip({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className={cn('relative flex h-[34px] items-center gap-[5px] rounded-lg border px-[11px] text-[11.5px] transition-colors hover:border-slate-300',
      value ? 'border-accent/40 bg-accent-light text-accent-hover' : 'border-gray-200 bg-page text-slate-600')}>
      {value || label}
      <ChevronDown size={12} />
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={`Filter by ${label.toLowerCase()}`} className="absolute inset-0 cursor-pointer opacity-0">
        <option value="">All {label.toLowerCase()}s</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

export default function RecipeStorePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<FilterKey, string>>({ Plant: '', Customer: '', Grade: '', Status: '' })

  const options = useMemo(() => Object.fromEntries(FILTERS.map(k => [k, [...new Set(RECIPES.map(r => valueOf(r, k)))]])) as Record<FilterKey, string[]>, [])
  const q = search.trim().toLowerCase()
  const rows = RECIPES.filter(r =>
    FILTERS.every(k => !filters[k] || valueOf(r, k) === filters[k]) &&
    (!q || [r.id, r.name, r.grade, r.customer, r.project, r.mixType].some(v => v?.toLowerCase().includes(q))))

  const notYet = (what: string) => toast({ title: `${what} isn’t available yet`, description: 'The Recipe Store is running on sample data until its backend is connected.' })

  const kpis: { label: string; value: number; bar: string; tone?: string }[] = [
    { label: 'Active approved', value: RECIPE_STATS.approved, bar: 'bg-green-600' },
    { label: 'Trial mixes in progress', value: RECIPE_STATS.inTrial, bar: 'bg-accent' },
    { label: 'Pending lab approval', value: RECIPE_STATS.pendingApproval, bar: 'bg-amber-600' },
    { label: 'Recipes used today', value: RECIPE_STATS.usedToday, bar: 'bg-blue-600' },
    { label: 'Expiring / review due', value: RECIPE_STATS.reviewDue, bar: 'bg-red-600', tone: 'text-red-600' },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Recipe Store &amp; Mix Combinations</h1>
            <SampleDataBadge />
          </div>
          <p className="mt-1 text-xs text-slate-400">Create, validate, and manage concrete mix designs for every plant and customer.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link to="/recipes/trial" className="flex h-[34px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-[13px] text-xs font-semibold text-slate-600 transition-colors hover:border-accent/50 hover:text-accent">
            <FlaskConical size={14} /> Start Trial Mix
          </Link>
          <button onClick={() => notYet('Creating recipes')} className="flex h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover">
            <Plus size={14} /> Create New Recipe
          </button>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] max-w-[420px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipe ID, customer, grade, project, or material…"
            aria-label="Search recipes"
            className="h-9 w-full rounded-[9px] border border-gray-200 pl-8 pr-3 text-xs outline-none focus:border-accent"
          />
        </div>
        {FILTERS.map(k => (
          <FilterChip key={k} label={k} options={options[k]} value={filters[k]} onChange={v => setFilters(f => ({ ...f, [k]: v }))} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map(k => (
          <div key={k.label} className="kpi-tile p-[13px]">
            <span className={cn('mb-2 block h-1 w-8 rounded-sm', k.bar)} />
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.04em] text-slate-400">{k.label}</p>
            <p className={cn('mt-[3px] font-mono text-[19px] font-bold', k.tone)}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="panel mt-3.5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[9.5px] text-slate-400">
                {['Recipe', 'Grade', 'Customer / Project', 'Plant', 'Mix Type', 'Ver.', 'Status', 'Updated', 'Actions'].map((h, i, a) => (
                  <th key={h} className={cn('py-2 font-semibold', i === 0 || i === a.length - 1 ? 'px-3' : 'px-2')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-xs text-slate-400">No recipes match these filters</td></tr>}
              {rows.map(r => {
                const tinted = !!ROW_TINT[r.status]
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/recipes/${r.id}`)}
                    className={cn('cursor-pointer border-t border-gray-200 transition-colors', ROW_TINT[r.status] ?? 'hover:bg-slate-50', r.status === 'Archived' && 'opacity-70')}
                  >
                    <td className="px-3 py-[9px]"><div className="font-mono font-semibold">{r.id}</div><div className="text-[10.5px] text-slate-400">{r.name}</div></td>
                    <td className="px-2 py-[9px]">
                      <span className={cn('rounded-md px-[7px] py-0.5 font-mono text-[10.5px] font-semibold',
                        r.status === 'Archived' ? 'bg-slate-100 text-gray-500' : tinted ? 'bg-white text-accent-hover' : 'bg-accent-light text-accent-hover')}>{r.grade}</span>
                    </td>
                    <td className="px-2 py-[9px]">
                      {r.customer ? <><div>{r.customer}</div><div className="text-[10.5px] text-slate-400">{r.project}</div></> : <span className="text-slate-400">{r.project ?? '—'}</span>}
                    </td>
                    <td className="px-2 py-[9px] text-slate-600">{r.plant}</td>
                    <td className="px-2 py-[9px] text-slate-600">{r.mixType}</td>
                    <td className="px-2 py-[9px] font-mono">v{r.version}</td>
                    <td className="px-2 py-[9px]"><StatusPill status={r.status} /></td>
                    <td className="px-2 py-[9px] text-slate-600">{r.updatedOn} · {r.updatedBy}</td>
                    <td className="px-3 py-[9px]" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <IconButton label="View" onClick={() => navigate(`/recipes/${r.id}`)}><Eye size={13} /></IconButton>
                        <IconButton label="Duplicate" onClick={() => notYet('Duplicating recipes')}><Copy size={13} /></IconButton>
                        {r.status === 'Rejected'
                          ? <IconButton label="Archive" onClick={() => notYet('Archiving recipes')}><Archive size={13} /></IconButton>
                          : r.status !== 'Archived' && <IconButton label="Send to batching plant" onClick={() => notYet('Sending recipes to the plant')}><Send size={13} /></IconButton>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function StatusPill({ status }: { status: RecipeStatus }) {
  return <span className={cn('whitespace-nowrap rounded-full px-[9px] py-[3px] text-[10px] font-semibold', STATUS_STYLE[status])}>{status}</span>
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-accent-light hover:text-accent">
      {children}
    </button>
  )
}
