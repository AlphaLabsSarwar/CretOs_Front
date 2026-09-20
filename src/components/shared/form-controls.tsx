import { cn } from '@/lib/utils'

export function inputClass(hasError: boolean, extra?: string) {
  return cn(
    'h-9 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent',
    hasError ? 'border-red-400' : 'border-gray-300',
    extra
  )
}

export function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pb-1 lg:col-span-2">
      <span className="section-label whitespace-nowrap">{label}</span>
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  )
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="field-label">
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  )
}

export function ToggleGroup({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="inline-flex h-9 rounded-lg border border-gray-300 bg-gray-50 p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded px-3 text-xs font-medium transition-colors',
            value === opt.value ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
