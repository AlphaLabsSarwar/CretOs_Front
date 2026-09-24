import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Copy, Download, FileText, Image as ImageIcon, Pencil, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import { getRecipe } from '@/lib/recipes'
import SampleDataBadge from './SampleDataBadge'
import { StatusPill } from './RecipeStorePage'

// One recipe: headline specs, tabbed detail (material combination, trials,
// batch history, documents, versions) and the approval workflow. Sample data —
// see lib/recipes.ts.

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'material', label: 'Material Combination' },
  { key: 'trial', label: 'Trial Results' },
  { key: 'batch', label: 'Batch History' },
  { key: 'docs', label: 'Documents' },
  { key: 'versions', label: 'Version History' },
] as const
type Tab = (typeof TABS)[number]['key']

const NOTE_TONE = { ok: 'text-green-600', warn: 'text-amber-600', bad: 'text-red-600', muted: 'text-slate-400' } as const
const RESULT_TONE = { Passed: 'bg-green-50 text-green-600', Failed: 'bg-red-100 text-red-600', Pending: 'bg-amber-100 text-amber-600' } as const
const TH = 'py-[7px] text-left text-[9px] font-semibold text-slate-400'

export default function RecipeDetailPage() {
  const { id = '' } = useParams()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('material')
  const recipe = getRecipe(id)
  const notYet = (what: string) => toast({ title: `${what} isn’t available yet`, description: 'The Recipe Store is running on sample data until its backend is connected.' })

  if (!recipe) {
    return (
      <div className="panel mx-auto mt-10 max-w-md p-8 text-center">
        <p className="text-sm font-semibold">Recipe not found</p>
        <Link to="/recipes" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">Back to Recipe Store</Link>
      </div>
    )
  }

  const released = recipe.approvals.every(a => a.date)
  const conic = recipe.composition.reduce<{ stops: string[]; at: number }>((acc, c) => {
    acc.stops.push(`${c.color} ${acc.at}% ${acc.at + c.pct}%`)
    return { stops: acc.stops, at: acc.at + c.pct }
  }, { stops: [], at: 0 }).stops.join(',')

  return (
    <div>
      <Link to="/recipes" className="mb-2.5 inline-flex items-center gap-[5px] text-[11.5px] text-slate-400 hover:text-accent"><ArrowLeft size={12} />Recipe Store</Link>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[19px] font-bold text-slate-900">{recipe.name}</h1>
                <span className="font-mono text-[11px] text-slate-400">{recipe.id}</span>
                <span className="rounded-md bg-accent-light px-2 py-0.5 font-mono text-[10.5px] font-semibold text-accent-hover">{recipe.grade}</span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-gray-500">v{recipe.version}</span>
                <StatusPill status={recipe.status} />
                <SampleDataBadge />
              </div>
              <p className="mt-[5px] text-xs text-slate-400">{[recipe.customer, recipe.project, recipe.plant].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => notYet('Editing recipes')} aria-label="Edit" title="Edit" className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-accent-light hover:text-accent"><Pencil size={14} /></button>
              <button onClick={() => notYet('Duplicating recipes')} aria-label="Duplicate" title="Duplicate" className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-accent-light hover:text-accent"><Copy size={14} /></button>
            </div>
          </div>

          <div className="panel mt-4 grid grid-cols-2 gap-2 px-3.5 py-3 sm:grid-cols-4 lg:grid-cols-7">
            {recipe.specs.map(s => (
              <div key={s.label}>
                <p className="text-[9px] uppercase text-slate-400">{s.label}</p>
                <p className={cn('mt-0.5 font-mono text-xs font-bold', s.tone === 'ok' && 'text-green-600')}>{s.value}</p>
              </div>
            ))}
          </div>

          <div role="tablist" className="mt-[18px] flex gap-[18px] overflow-x-auto border-b border-gray-200">
            {TABS.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn('whitespace-nowrap border-b-2 px-0.5 py-2.5 text-[12.5px] transition-colors',
                  tab === t.key ? 'border-accent font-bold text-slate-900' : 'border-transparent font-medium text-slate-400 hover:text-slate-600')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="panel mt-4 p-[18px]">
              <p className="mb-3 text-[12.5px] leading-relaxed text-slate-600">{recipe.description}</p>
              <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-[10px] bg-slate-50 p-3"><p className="text-[10px] text-slate-400">Used this month</p><p className="mt-[3px] font-mono text-base font-bold">{recipe.usage.ordersThisMonth} orders</p></div>
                <div className="rounded-[10px] bg-slate-50 p-3"><p className="text-[10px] text-slate-400">Avg. 28-day strength</p><p className="mt-[3px] font-mono text-base font-bold text-green-600">{recipe.usage.avgStrength} MPa</p></div>
                <div className="rounded-[10px] bg-slate-50 p-3"><p className="text-[10px] text-slate-400">Cost per m³</p><p className="mt-[3px] font-mono text-base font-bold">₹{recipe.usage.costPerCum.toLocaleString('en-IN')}</p></div>
              </div>
            </div>
          )}

          {tab === 'material' && (
            <div className="panel mt-4 overflow-hidden">
              <p className="border-b border-gray-200 px-4 py-3 text-xs font-bold">Material combination · per 1 m³</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10.8px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className={cn(TH, 'px-3.5')}>Material &amp; Supplier</th>
                      <th className={cn(TH, 'px-1.5')}>Unit</th>
                      <th className={cn(TH, 'px-1.5')}>Target</th>
                      <th className={cn(TH, 'px-1.5')}>Tolerance</th>
                      <th className={cn(TH, 'px-1.5')}>Actual (last batch)</th>
                      <th className={cn(TH, 'px-1.5')}>Cost</th>
                      <th className={cn(TH, 'px-3.5')}>Availability &amp; Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.materials.map(m => {
                      const unused = m.target == null
                      return (
                        <tr key={m.material} className={cn('border-t border-gray-200', m.highlight === 'warn' && 'bg-amber-100', unused && 'opacity-60')}>
                          <td className="px-3.5 py-2"><div className="font-semibold">{m.material}</div><div className="text-[9.5px] text-slate-400">{m.supplier}</div></td>
                          <td className="px-1.5 py-2 text-slate-400">{unused ? '—' : m.unit}</td>
                          <td className={cn('px-1.5 py-2', unused ? 'text-slate-400' : 'font-mono font-semibold')}>{unused ? 'Not used' : m.target}</td>
                          <td className="px-1.5 py-2 font-mono text-slate-400">{m.tolerance != null ? `±${m.tolerance}` : '—'}</td>
                          <td className="px-1.5 py-2 font-mono">{m.actual ?? '—'}</td>
                          <td className="px-1.5 py-2 font-mono">{m.cost != null ? `₹${m.cost.toLocaleString('en-IN')}` : '—'}</td>
                          <td className="px-3.5 py-2"><span className={cn('text-[9.5px] font-semibold', NOTE_TONE[m.noteTone], m.noteTone === 'muted' && 'font-normal')}>{m.note}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-gray-200 bg-slate-50 px-4 py-3.5 sm:grid-cols-4 lg:grid-cols-7">
                {recipe.totals.map(t => (
                  <div key={t.label}>
                    <p className="text-[9px] text-slate-400">{t.label}</p>
                    <p className={cn('mt-0.5 font-mono text-[12.5px] font-bold', t.tone === 'warn' && 'text-amber-600')}>{t.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'trial' && (
            <div className="panel mt-4 overflow-hidden">
              <p className="border-b border-gray-200 px-4 py-3 text-xs font-bold">Trial &amp; cube-test results</p>
              <table className="w-full text-[11.5px]">
                <thead><tr className="bg-slate-50">{['Sample', 'Cast', 'Slump', '7-day', '28-day', 'Result'].map((h, i, a) => <th key={h} className={cn(TH, 'text-[9.5px]', i === 0 || i === a.length - 1 ? 'px-4' : 'px-2')}>{h}</th>)}</tr></thead>
                <tbody>
                  {recipe.trials.map(t => (
                    <tr key={t.sample} className="border-t border-gray-200">
                      <td className="px-4 py-2 font-mono">{t.sample}</td>
                      <td className="px-2 py-2 font-mono text-slate-600">{t.cast}</td>
                      <td className="px-2 py-2 font-mono">{t.slump}</td>
                      <td className="px-2 py-2 font-mono">{t.d7}</td>
                      <td className={cn('px-2 py-2 font-mono', t.d28 != null ? 'font-bold' : 'text-slate-400')}>{t.d28 ?? 'pending'}</td>
                      <td className="px-4 py-2"><span className={cn('rounded-full px-[9px] py-0.5 text-[10px] font-semibold', RESULT_TONE[t.result])}>{t.result}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'batch' && (
            <div className="panel mt-4 overflow-hidden">
              <p className="border-b border-gray-200 px-4 py-3 text-xs font-bold">Production batches using this recipe</p>
              <table className="w-full text-[11.5px]">
                <thead><tr className="bg-slate-50">{['Batch', 'Date', 'Plant', 'Planned', 'Actual', 'Deviation'].map((h, i, a) => <th key={h} className={cn(TH, 'text-[9.5px]', i === 0 || i === a.length - 1 ? 'px-4' : 'px-2')}>{h}</th>)}</tr></thead>
                <tbody>
                  {recipe.batches.map(b => (
                    <tr key={b.batch} className={cn('border-t border-gray-200', !b.ok && 'bg-red-50')}>
                      <td className="px-4 py-2 font-mono">{b.batch}</td>
                      <td className="px-2 py-2 font-mono text-slate-600">{b.date}</td>
                      <td className="px-2 py-2 text-slate-600">{b.plant}</td>
                      <td className="px-2 py-2 font-mono">{b.planned.toFixed(1)} m³</td>
                      <td className="px-2 py-2 font-mono">{b.actual.toFixed(1)} m³</td>
                      <td className="px-4 py-2"><span className={cn('text-[10px] font-semibold', b.ok ? 'text-green-600' : 'text-red-600')}>{b.deviation}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'docs' && (
            <div className="panel mt-4 overflow-hidden">
              {recipe.documents.map(d => (
                <button key={d.name} onClick={() => notYet('Downloading documents')} className="flex w-full items-center gap-3 border-b border-gray-200 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50">
                  {d.kind === 'image' ? <ImageIcon size={16} className="text-accent" /> : <FileText size={16} className="text-accent" />}
                  <span className="flex-1 text-xs font-medium">{d.name}</span>
                  <span className="text-[10.5px] text-slate-400">{d.date}</span>
                  <Download size={14} className="text-slate-400" />
                </button>
              ))}
            </div>
          )}

          {tab === 'versions' && (
            <div className="panel mt-4 overflow-hidden">
              {recipe.versions.map((v, i) => (
                <div key={v.version} className="border-b border-gray-200 px-4 py-3.5 last:border-0">
                  <div className="flex justify-between">
                    <span className={cn('font-mono text-xs font-bold', i > 0 && 'text-slate-400')}>v{v.version}{i === 0 && ' · current'}</span>
                    <span className="text-[10.5px] text-slate-400">{v.date} · {v.by}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-slate-600">{v.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          {recipe.alert && (
            <div className="flex items-start gap-[9px] rounded-[10px] border border-amber-200 bg-amber-100 px-[13px] py-[11px]">
              <AlertTriangle size={15} className="mt-px shrink-0 text-amber-600" />
              <p className="text-[11px] leading-normal text-amber-800">{recipe.alert}</p>
            </div>
          )}

          <section className="panel p-4">
            <p className="mb-3 text-xs font-bold">Approval workflow</p>
            <div className="flex flex-col">
              {recipe.approvals.map((a, i) => {
                const done = !!a.date
                const last = i === recipe.approvals.length - 1
                return (
                  <div key={a.step} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      {done
                        ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600"><Check size={11} className="text-white" /></span>
                        : <span className="h-5 w-5 rounded-full border-2 border-accent bg-accent-light" />}
                      {!last && <span className={cn('min-h-5 w-0.5 flex-1', done ? 'bg-green-600' : 'bg-gray-200')} />}
                    </div>
                    <div className={last ? '' : 'pb-3.5'}>
                      <p className="text-xs font-semibold">{a.step}</p>
                      <p className="mt-px text-[10.5px] text-slate-400">{done ? `${a.by} · ${a.date}` : 'Ready to send'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => notYet('Sending recipes to the batching plant')}
              disabled={released || recipe.status !== 'Approved'}
              className="mt-3.5 flex h-[42px] w-full items-center justify-center gap-2 rounded-[9px] bg-accent text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <Send size={14} /> Send to Batching Plant
            </button>
          </section>

          <section className="panel p-4">
            <p className="mb-3 text-xs font-bold">Mix composition</p>
            <div className="flex items-center gap-4">
              <div className="relative h-[100px] w-[100px] shrink-0 rounded-full" style={{ background: `conic-gradient(${conic})` }}>
                <div className="absolute inset-[15px] rounded-full bg-white" />
              </div>
              <div className="flex flex-col gap-[5px] text-[10.5px]">
                {recipe.composition.map(c => (
                  <span key={c.label} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: c.color }} />{c.label} · {c.pct}%</span>
                ))}
              </div>
            </div>
          </section>

          <section className="panel p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-xs font-bold">Recent versions</p>
              <button onClick={() => setTab('versions')} className="text-[10.5px] font-semibold text-accent hover:underline">View all</button>
            </div>
            <div className="flex flex-col gap-[9px]">
              {recipe.versions.slice(0, 3).map((v, i) => (
                <div key={v.version} className="flex justify-between">
                  <span className={cn('font-mono text-[11.5px]', i === 0 ? 'font-semibold' : 'text-slate-400')}>v{v.version}</span>
                  <span className="text-[10.5px] text-slate-400">{v.date} · {v.by}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
