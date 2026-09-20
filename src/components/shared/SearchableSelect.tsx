import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchableSelectProps<T> {
  options: T[]
  value?: string | null
  onChange: (value: string, option: T | null) => void
  displayKey: keyof T
  valueKey: keyof T
  /** Additional fields to match against as the user types (e.g. mobile number). Defaults to [displayKey]. */
  filterKeys?: (keyof T)[]
  renderOption?: (option: T, active: boolean) => React.ReactNode
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  error?: boolean
  id?: string
}

export default function SearchableSelect<T extends Record<string, any>>({
  options,
  value,
  onChange,
  displayKey,
  valueKey,
  filterKeys,
  renderOption,
  placeholder = 'Search...',
  loading,
  disabled,
  error,
  id,
}: SearchableSelectProps<T>) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => options.find(o => String(o[valueKey]) === String(value)) ?? null,
    [options, value, valueKey]
  )

  // Keep the input text in sync with the current selection while the list is closed.
  useEffect(() => {
    if (!open) setQuery(selected ? String(selected[displayKey]) : '')
  }, [selected, open, displayKey])

  const filtered = useMemo(() => {
    const isShowingSelection = selected && query === String(selected[displayKey])
    if (!query || isShowingSelection) return options
    const q = query.toLowerCase()
    const keys = filterKeys ?? [displayKey]
    return options.filter(o => keys.some(k => String(o[k] ?? '').toLowerCase().includes(q)))
  }, [options, query, filterKeys, displayKey, selected])

  useEffect(() => setActiveIndex(0), [query, open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectOption(opt: T) {
    onChange(String(opt[valueKey]), opt)
    setQuery(String(opt[displayKey]))
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('', null)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[activeIndex]
      if (opt) selectOption(opt)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (loading) {
    return <div className="h-9 w-full bg-gray-100 rounded-lg animate-pulse" />
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        value={query}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
          if (value) onChange('', null)
        }}
        className={cn(
          'w-full h-9 pl-3 pr-14 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent',
          error ? 'border-red-400' : 'border-gray-300',
          disabled && 'bg-gray-50 cursor-not-allowed'
        )}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {value && !disabled && (
          <button type="button" tabIndex={-1} onClick={handleClear} aria-label="Clear selection" className="text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
        <ChevronDown size={13} className="text-gray-400" />
      </div>

      {open && !disabled && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-400">No results</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={String(opt[valueKey])}
                onMouseDown={e => {
                  e.preventDefault()
                  selectOption(opt)
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn('px-3 py-1.5 text-xs cursor-pointer', i === activeIndex ? 'bg-orange-50 text-gray-900' : 'text-gray-700')}
              >
                {renderOption ? renderOption(opt, i === activeIndex) : String(opt[displayKey])}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
