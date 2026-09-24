import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Send, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import SampleDataBadge from './SampleDataBadge'

// Start Trial Mix — 4-step wizard: details → build & compare combinations →
// test results → approve / release. Local state only: nothing is saved until
// the recipe API exists, and the final actions say so.

const STEPS = ['Trial Details', 'Build Combination', 'Test Results', 'Approve / Revise'] as const
const PURPOSES = ['New Grade', 'Cost Optimization', 'Material Replacement', 'Pumpability Improvement', 'Strength Improvement', 'Customer Requirement', 'Corrective Trial']
const SOURCES = ['Blank Recipe', 'Approved Recipe', 'Duplicate Trial']
const OUTCOMES = {
  Passed: 'text-green-600 bg-green-50',
  Failed: 'text-red-600 bg-red-100',
  'Needs Retest': 'text-amber-600 bg-amber-100',
  Pending: 'text-gray-500 bg-slate-100',
} as const
type Outcome = keyof typeof OUTCOMES

// Sample comparison (combination C deliberately out of range).
const COMBOS = ['Combination A', 'Combination B', 'Combination C']
const COMPARE: { label: string; values: string[]; strong?: boolean; tones?: (string | undefined)[] }[] = [
  { label: 'Cement (kg)', values: ['340', '320', '300'] },
  { label: 'Fly Ash / GGBS (kg)', values: ['—', '60', '80'] },
  { label: 'Water (L)', values: ['153', '148', '168'] },
  { label: 'Admixture (L)', values: ['3.4', '3.8', '3.0'] },
  { label: 'W/C ratio', values: ['0.45', '0.39', '0.56'], strong: true, tones: [undefined, 'text-green-600', 'text-red-600'] },
  { label: 'Cost / m³', values: ['₹4,540', '₹4,380', '₹4,020'] },
  { label: 'Theoretical strength range', values: ['33–37 MPa', '35–39 MPa', '24–28 MPa'], strong: true, tones: [undefined, 'text-green-600', 'text-red-600'] },
]
const FLAGGED = 2

const FIELD = 'h-[38px] w-full rounded-[9px] border border-gray-200 px-3 text-[12.5px] outline-none transition-colors focus:border-accent disabled:bg-slate-50 disabled:text-slate-400'
const LABEL = 'mb-[5px] block text-[11px] text-slate-600'
const PILL = 'cursor-pointer rounded-full border px-[13px] py-1.5 text-[11.5px] transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className={LABEL}>{label}</span>{children}</label>
}

function Choice({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(PILL, active ? 'border-accent bg-accent text-white' : 'border-gray-200 bg-white text-slate-600 hover:border-slate-300', className)}
    >
      {children}
    </button>
  )
}

export default function TrialMixPage() {
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [purpose, setPurpose] = useState('Strength Improvement')
  const [source, setSource] = useState('Blank Recipe')
  const [outcome, setOutcome] = useState<Outcome>('Pending')
  const [labApproved, setLabApproved] = useState(false)
  const [plantApproved, setPlantApproved] = useState(false)
  const canRelease = labApproved && plantApproved
  const notYet = (what: string) => toast({ title: `${what} isn’t available yet`, description: 'Trial mixes aren’t saved until the Recipe Store backend is connected.' })

  return (
    <div>
      <Link to="/recipes" className="mb-2 inline-flex items-center gap-[5px] text-[11.5px] text-slate-400 hover:text-accent"><ArrowLeft size={12} />Recipe Store</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">Start Trial Mix</h1>
        <SampleDataBadge />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Trial <span className="font-mono">TRIAL-0091</span> · experiment with a new combination before it becomes a production recipe.
      </p>

      {/* Stepper */}
      <ol className="mt-5 flex max-w-[760px] items-center">
        {STEPS.map((label, i) => {
          const n = i + 1
          const state = step === n ? 'current' : step > n ? 'done' : 'todo'
          return (
            <li key={label} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
              <button type="button" onClick={() => setStep(n)} aria-current={state === 'current' ? 'step' : undefined} className="flex flex-col items-center gap-1.5">
                <span className={cn('flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-bold transition-colors duration-200',
                  state === 'current' ? 'bg-accent text-white' : state === 'done' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400')}>{n}</span>
                <span className={cn('whitespace-nowrap text-[10.5px] font-semibold', state === 'current' ? 'text-slate-900' : 'text-slate-400')}>{label}</span>
              </button>
              {i < STEPS.length - 1 && <span className={cn('mx-2 mb-[18px] h-0.5 flex-1 transition-colors duration-200', step > n ? 'bg-green-600' : 'bg-gray-200')} />}
            </li>
          )
        })}
      </ol>

      {step === 1 && (
        <section className="panel mt-5 max-w-[900px] p-[22px]">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Trial ID"><input className={cn(FIELD, 'font-mono')} value="TRIAL-0091" disabled /></Field>
            <Field label="Plant"><input className={FIELD} placeholder="Whitefield Plant" /></Field>
            <Field label="Laboratory"><input className={FIELD} placeholder="Whitefield QC Lab" /></Field>
            <Field label="Customer / Project (optional)"><input className={FIELD} placeholder="Internal trial" /></Field>
            <Field label="Concrete Grade"><input className={FIELD} placeholder="M35" /></Field>
            <Field label="Curing Period"><input className={FIELD} placeholder="28 days" /></Field>
          </div>
          <p className="mb-2 mt-[18px] text-[11px] text-slate-600">Purpose of trial</p>
          <div className="flex flex-wrap gap-[7px]">
            {PURPOSES.map(p => <Choice key={p} active={purpose === p} onClick={() => setPurpose(p)}>{p}</Choice>)}
          </div>
          <div className="mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Target Strength"><input className={FIELD} placeholder="35 MPa" /></Field>
            <Field label="Target Slump"><input className={FIELD} placeholder="120mm" /></Field>
            <Field label="Workability"><input className={FIELD} placeholder="S4" /></Field>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="panel mt-5 p-5">
          <p className="mb-2 text-[11px] text-slate-600">Start from</p>
          <div className="mb-4 flex flex-wrap gap-[7px]">
            {SOURCES.map(s => <Choice key={s} active={source === s} onClick={() => setSource(s)}>{s}</Choice>)}
          </div>
          <p className="mb-2.5 text-xs font-bold">Compare combinations</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[9.5px] text-slate-400">
                  <th className="px-3.5 py-2 font-semibold">Material (per m³)</th>
                  {COMBOS.map((c, i) => <th key={c} className={cn('px-2.5 py-2 font-semibold', i === FLAGGED && 'bg-red-100')}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(row => (
                  <tr key={row.label} className={cn('border-t border-gray-200', row.strong && 'bg-slate-50')}>
                    <td className={cn('px-3.5 py-2', row.strong && 'font-semibold')}>{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className={cn('px-2.5 py-2 font-mono', row.strong && 'font-bold', row.tones?.[i], i === FLAGGED && 'bg-red-100')}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-[9px] bg-red-100 px-[13px] py-2.5">
            <AlertTriangle size={14} className="shrink-0 text-red-600" />
            <p className="text-[11px] text-red-800">Combination C&rsquo;s water-cement ratio (0.56) is well outside the approved range for M35 — likely to fail the 28-day strength target.</p>
          </div>
        </section>
      )}

      {step === 3 && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <section className="panel p-5">
            <p className="mb-2.5 text-xs font-bold">Fresh concrete checks</p>
            <div className="mb-[18px] grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {[['Slump', '118mm'], ['Temperature', '29°C'], ['Density', '2,412'], ['Workability', 'S4'], ['Air Content', '1.8%']].map(([k, v]) => (
                <div key={k} className="rounded-[9px] bg-slate-50 p-2.5"><p className="text-[9.5px] text-slate-400">{k}</p><p className="mt-0.5 font-mono text-sm font-bold">{v}</p></div>
              ))}
            </div>
            <p className="mb-2.5 text-xs font-bold">Cube-test results</p>
            <table className="mb-4 w-full text-[11.5px]">
              <thead><tr className="bg-slate-50 text-left text-[9.5px] text-slate-400"><th className="px-3 py-[7px] font-semibold">Cube</th><th className="px-2 py-[7px] font-semibold">7-day</th><th className="px-2 py-[7px] font-semibold">28-day</th></tr></thead>
              <tbody>
                {[['CB-T091-1', '24.6', '36.2'], ['CB-T091-2', '24.1', '35.8'], ['CB-T091-3', '23.9', null]].map(([c, d7, d28]) => (
                  <tr key={c} className="border-t border-gray-200">
                    <td className="px-3 py-[7px] font-mono">{c}</td>
                    <td className="px-2 py-[7px] font-mono">{d7}</td>
                    <td className={cn('px-2 py-[7px] font-mono', d28 ? 'font-bold text-green-600' : 'text-slate-400')}>{d28 ?? 'pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Field label="Lab notes & visual observation">
              <textarea rows={3} className={cn(FIELD, 'h-auto resize-none py-2.5')} defaultValue="Cohesive mix, no segregation observed. Slight bleeding at edges after 20 min." />
            </Field>
            <p className={cn(LABEL, 'mt-3.5')}>Attachments</p>
            <button type="button" onClick={() => notYet('Uploading attachments')} className="w-full rounded-[10px] border-2 border-dashed border-gray-200 p-[18px] text-center text-slate-400 transition-colors hover:border-accent/50 hover:text-accent">
              <Upload size={20} className="mx-auto mb-1.5" />
              <span className="text-[11.5px]">Cube-test photos, lab sheets &amp; certificates</span>
            </button>
          </section>

          <section className="panel self-start p-[18px]">
            <p className="mb-3 text-xs font-bold">Trial outcome</p>
            <div className="flex flex-col gap-2">
              {(Object.keys(OUTCOMES) as Outcome[]).map(o => (
                <Choice key={o} active={outcome === o} onClick={() => setOutcome(o)} className="rounded-[9px] px-3.5 py-2.5 text-center text-[12.5px] font-semibold">{o}</Choice>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-normal text-slate-400">
              Current outcome: <strong className={OUTCOMES[outcome].split(' ')[0]}>{outcome}</strong>. The 28-day result for cube 3 is still pending — the final outcome locks once all cubes report.
            </p>
          </section>
        </div>
      )}

      {step === 4 && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold">Trial summary · TRIAL-0091</p>
              <span className={cn('rounded-full px-2.5 py-[3px] text-[10px] font-semibold', OUTCOMES[outcome])}>{outcome}</span>
            </div>
            <p className="mb-4 mt-2 text-[11.5px] text-slate-400">Combination B · M35 · {purpose} trial · 28-day average 36.0 MPa against a 35 MPa target.</p>
            <p className="mb-2 text-[11px] text-slate-600">Assign this recipe to</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Customer / Project"><input className={FIELD} placeholder="Select customer…" /></Field>
              <Field label="Plant"><input className={FIELD} placeholder="Whitefield Plant" /></Field>
              <Field label="Concrete Grade"><input className={FIELD} placeholder="M35" /></Field>
              <Field label="Save as"><input className={FIELD} placeholder="New version, keeps original intact" disabled /></Field>
            </div>
            <div className="mt-[18px] flex flex-col gap-2.5 sm:flex-row">
              <button onClick={() => notYet('Converting trials to recipes')} className="h-[42px] flex-1 rounded-[9px] border border-gray-200 bg-white text-[12.5px] font-semibold text-slate-600 transition-colors hover:border-accent/50 hover:text-accent">Convert to Approved Recipe</button>
              <button onClick={() => notYet('Saving trial versions')} className="h-[42px] flex-1 rounded-[9px] border border-gray-200 bg-white text-[12.5px] font-semibold text-slate-600 transition-colors hover:border-accent/50 hover:text-accent">Save as New Version</button>
            </div>
          </section>

          <section className="panel self-start p-[18px]">
            <p className="mb-3 text-xs font-bold">Required approvals</p>
            {[
              { checked: labApproved, set: setLabApproved, title: 'Lab approval', sub: 'Quality lab confirms test results meet target' },
              { checked: plantApproved, set: setPlantApproved, title: 'Plant manager approval', sub: 'Confirms material availability and batching readiness' },
            ].map(a => (
              <label key={a.title} className="mb-3.5 flex cursor-pointer items-start gap-[9px] text-xs">
                <input type="checkbox" checked={a.checked} onChange={e => a.set(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
                <span><span className="block font-semibold">{a.title}</span><span className="mt-px block text-[10.5px] text-slate-400">{a.sub}</span></span>
              </label>
            ))}
            <button
              disabled={!canRelease}
              onClick={() => notYet('Releasing to batching')}
              className="mt-0.5 flex h-11 w-full items-center justify-center gap-2 rounded-[9px] bg-accent text-[12.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:opacity-100"
            >
              <Send size={14} /> {canRelease ? 'Release to Batching' : 'Awaiting Approvals'}
            </button>
            <p className="mt-2.5 text-center text-[10.5px] text-slate-400">
              {canRelease ? 'Both approvals received — ready to send to the plant.' : 'Both lab and plant-manager approval are required before release.'}
            </p>
          </section>
        </div>
      )}

      <div className="mt-5 flex max-w-[900px] justify-between">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          className={cn('flex h-[38px] items-center gap-1.5 rounded-[9px] border border-gray-200 bg-white px-3.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300', step === 1 && 'invisible')}
        >
          <ChevronLeft size={13} /> Back
        </button>
        <button
          onClick={() => setStep(s => Math.min(STEPS.length, s + 1))}
          className={cn('flex h-[38px] items-center gap-1.5 rounded-[9px] bg-accent px-4 text-xs font-semibold text-white transition-colors hover:bg-accent-hover', step === STEPS.length && 'invisible')}
        >
          Continue <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
