import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Upload, X } from 'lucide-react'
import { parseCSVWithHeaders, normalizeHeader } from '@/lib/csv'
import { cn } from '@/lib/utils'

export interface ImportColumn {
  key: string
  label: string
  required?: boolean
  /** Extra header aliases to auto-match against, beyond the label itself (e.g. "Phone" for mobile). */
  aliases?: string[]
}

export interface ImportResult {
  success: number
  failed: { row: number; error: string }[]
  total: number
}

interface ImportCsvModalProps {
  open: boolean
  onClose: () => void
  title: string
  columns: ImportColumn[]
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>
  onImported?: () => void
}

type Step = 'upload' | 'map' | 'result'

export default function ImportCsvModal({ open, onClose, title, columns, onImport, onImported }: ImportCsvModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({}) // columnKey -> csv header
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload')
    setFileName('')
    setHeaders([])
    setRows([])
    setMapping({})
    setResult(null)
    setParseError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFile(file: File) {
    setParseError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const parsed = parseCSVWithHeaders(text)
      if (parsed.headers.length === 0) {
        setParseError('Could not read any columns from this file. Make sure the first row has column headers.')
        return
      }
      // Auto-match CSV headers to target columns
      const autoMap: Record<string, string> = {}
      for (const col of columns) {
        const candidates = [col.label, col.key, ...(col.aliases ?? [])].map(normalizeHeader)
        const match = parsed.headers.find(h => candidates.includes(normalizeHeader(h)))
        if (match) autoMap[col.key] = match
      }
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      setMapping(autoMap)
      setStep('map')
    }
    reader.onerror = () => setParseError('Could not read that file.')
    reader.readAsText(file)
  }

  const mappedRows = useMemo(() => {
    return rows.map(r => {
      const obj: Record<string, string> = {}
      for (const col of columns) {
        const header = mapping[col.key]
        if (!header) continue
        const idx = headers.indexOf(header)
        if (idx >= 0) obj[col.key] = (r[idx] ?? '').trim()
      }
      return obj
    })
  }, [rows, headers, mapping, columns])

  const missingRequired = columns.filter(c => c.required && !mapping[c.key])

  async function handleImport() {
    setImporting(true)
    try {
      const res = await onImport(mappedRows)
      setResult(res)
      setStep('result')
      if (res.success > 0) onImported?.()
    } catch (e: any) {
      setResult({ success: 0, failed: [{ row: 0, error: e?.response?.data?.error ?? e.message ?? 'Import failed' }], total: mappedRows.length })
      setStep('result')
    } finally {
      setImporting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Import {title} from CSV</h2>
          <button onClick={handleClose} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="max-h-[calc(85vh-56px)] overflow-y-auto px-5 py-4">
          {step === 'upload' && (
            <div>
              <p className="mb-3 text-xs text-gray-500">
                Upload a CSV exported from Excel, Google Sheets, or your old system. The first row must be column headers.
                Expected columns: {columns.map(c => c.label + (c.required ? ' *' : '')).join(', ')}.
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-10 text-center hover:border-accent hover:bg-orange-50/30">
                <Upload size={22} className="text-gray-400" />
                <span className="text-xs text-gray-600">Click to choose a .csv file{fileName && <> — <span className="font-medium">{fileName}</span></>}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              {parseError && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle size={13} /> {parseError}</p>
              )}
            </div>
          )}

          {step === 'map' && (
            <div>
              <p className="mb-3 text-xs text-gray-500">
                Matched {rows.length} row{rows.length === 1 ? '' : 's'} from <span className="font-medium">{fileName}</span>.
                Check the column mapping below — we've auto-matched what we could.
              </p>
              <div className="mb-4 space-y-2">
                {columns.map(col => (
                  <div key={col.key} className="flex items-center gap-3">
                    <label className="w-36 shrink-0 text-xs text-gray-700">
                      {col.label}{col.required && <span className="text-accent"> *</span>}
                    </label>
                    <select
                      value={mapping[col.key] ?? ''}
                      onChange={e => setMapping(m => ({ ...m, [col.key]: e.target.value }))}
                      className={cn(
                        'h-8 flex-1 rounded-lg border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent',
                        col.required && !mapping[col.key] ? 'border-red-300' : 'border-gray-300'
                      )}
                    >
                      <option value="">— Skip —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <p className="mb-1.5 text-xs font-medium text-gray-500">Preview (first 3 rows)</p>
              <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {columns.filter(c => mapping[c.key]).map(c => (
                        <th key={c.key} className="px-2 py-1.5 text-left font-medium text-gray-500">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 3).map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {columns.filter(c => mapping[c.key]).map(c => (
                          <td key={c.key} className="px-2 py-1.5 text-gray-700">{r[c.key] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {missingRequired.length > 0 && (
                <p className="mb-3 flex items-center gap-1.5 text-xs text-red-600">
                  <AlertTriangle size={13} /> Map required column{missingRequired.length > 1 ? 's' : ''}: {missingRequired.map(c => c.label).join(', ')}
                </p>
              )}

              <div className="flex items-center justify-between">
                <button onClick={() => reset()} className="text-xs text-gray-500 hover:text-gray-800">← Choose a different file</button>
                <button
                  onClick={handleImport}
                  disabled={importing || missingRequired.length > 0 || rows.length === 0}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importing && <Loader2 size={13} className="animate-spin" />}
                  {importing ? 'Importing...' : `Import ${rows.length} row${rows.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div>
              <div className={cn('mb-3 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs', result.failed.length === 0 ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800')}>
                {result.failed.length === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                Imported {result.success} of {result.total} row{result.total === 1 ? '' : 's'}.
                {result.failed.length > 0 && ` ${result.failed.length} failed.`}
              </div>
              {result.failed.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">Row</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.failed.map((f, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2 py-1.5 text-gray-700">{f.row || '—'}</td>
                          <td className="px-2 py-1.5 text-red-600">{f.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <button onClick={handleClose} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
