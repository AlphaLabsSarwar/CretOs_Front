import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCopy, FileJson, Loader2, Send, Truck } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'

interface PayloadResult {
  payload: Record<string, unknown>
  warnings: string[]
  alreadyFiled: boolean
}

interface GstCompliancePanelProps {
  invoiceId: string
  irn: string | null
  ackNo: string | null
  ewayBillNo: string | null
  onRecorded: () => void
}

function PayloadCard({
  title,
  description,
  fetchUrl,
  submitUrl,
  filed,
  filedLabel,
  recordFields,
  recordUrl,
  onRecorded,
}: {
  title: string
  description: string
  fetchUrl: string
  submitUrl: string
  filed: { label: string; value: string }[] | null
  filedLabel: string
  recordFields: { key: string; label: string; placeholder: string; required?: boolean }[]
  recordUrl: string
  onRecorded: () => void
}) {
  const { toast } = useToast()
  const [result, setResult] = useState<PayloadResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recording, setRecording] = useState(false)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [recordValues, setRecordValues] = useState<Record<string, string>>({})

  async function generate() {
    setLoading(true)
    try {
      const res = await api.get(fetchUrl)
      setResult(res.data.data as PayloadResult)
    } catch (e: any) {
      toast({ variant: 'error', title: 'Could not generate payload', description: e?.response?.data?.error ?? 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  async function submitLive() {
    setSubmitting(true)
    try {
      await api.post(submitUrl)
      toast({ variant: 'success', title: `${filedLabel} filed successfully` })
      onRecorded()
    } catch (e: any) {
      toast({ variant: 'error', title: 'Could not file with GSP', description: e?.response?.data?.error ?? 'Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function copyPayload() {
    if (!result) return
    await navigator.clipboard.writeText(JSON.stringify(result.payload, null, 2))
    toast({ variant: 'success', title: 'Payload copied to clipboard' })
  }

  async function submitRecord() {
    const missing = recordFields.find(f => f.required && !recordValues[f.key])
    if (missing) { toast({ variant: 'error', title: `${missing.label} is required` }); return }
    setRecording(true)
    try {
      await api.post(recordUrl, recordValues)
      toast({ variant: 'success', title: `${filedLabel} recorded` })
      setShowRecordForm(false)
      onRecorded()
    } catch (e: any) {
      toast({ variant: 'error', title: 'Could not save', description: e?.response?.data?.error ?? 'Please try again.' })
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="section-label mb-1">{title}</p>
      <p className="mb-3 text-xs text-gray-500">{description}</p>

      {filed ? (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
          <div className="flex items-center gap-1.5 font-medium"><CheckCircle2 size={13} /> {filedLabel} on file</div>
          {filed.map(f => <p key={f.label} className="mt-0.5 font-mono">{f.label}: {f.value}</p>)}
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              onClick={submitLive}
              disabled={submitting}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {submitting ? 'Filing...' : 'Submit to Government'}
            </button>
            <button
              onClick={generate}
              disabled={loading}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <FileJson size={13} />}
              {loading ? 'Generating...' : 'Generate Payload (manual)'}
            </button>
          </div>
          <p className="mb-2 text-[11px] text-gray-400">
            "Submit to Government" files live via your configured GSP — until you've added GSP credentials, it'll tell you so and you can fall back to the manual payload below.
          </p>

          {result && (
            <div>
              {result.warnings.length > 0 && (
                <div className="mb-2 space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}
                    </p>
                  ))}
                </div>
              )}
              <div className="relative">
                <pre className="max-h-48 overflow-auto rounded-lg bg-gray-900 p-3 text-[10px] leading-relaxed text-gray-100">
                  {JSON.stringify(result.payload, null, 2)}
                </pre>
                <button
                  onClick={copyPayload}
                  className="absolute right-2 top-2 flex items-center gap-1 rounded bg-gray-800 px-2 py-1 text-[10px] text-gray-200 hover:bg-gray-700"
                >
                  <ClipboardCopy size={11} /> Copy
                </button>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                Submit this via your GSP (GST Suvidha Provider) — CretOS isn't connected to a live government API. Once you get the result back, record it below.
              </p>

              {!showRecordForm ? (
                <button onClick={() => setShowRecordForm(true)} className="mt-2 text-xs font-medium text-accent hover:underline">
                  + Record {filedLabel.toLowerCase()} details
                </button>
              ) : (
                <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {recordFields.map(f => (
                    <div key={f.key}>
                      <label className="mb-0.5 block text-[11px] text-gray-500">{f.label}{f.required && <span className="text-accent"> *</span>}</label>
                      <input
                        value={recordValues[f.key] ?? ''}
                        onChange={e => setRecordValues(v => ({ ...v, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="h-8 w-full rounded-lg border border-gray-300 px-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  ))}
                  <button
                    onClick={submitRecord}
                    disabled={recording}
                    className={cn('flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover', recording && 'opacity-50')}
                  >
                    {recording && <Loader2 size={12} className="animate-spin" />}
                    Save
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function GstCompliancePanel({ invoiceId, irn, ackNo, ewayBillNo, onRecorded }: GstCompliancePanelProps) {
  return (
    <div className="mb-5">
      <p className="section-label mb-2">GST Compliance</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PayloadCard
          title="e-Invoice (IRN)"
          description="Compliant e-invoice JSON (schema INV-01) for this posted invoice."
          fetchUrl={`/finance/invoices/${invoiceId}/einvoice-payload`}
          submitUrl={`/finance/invoices/${invoiceId}/submit-einvoice`}
          filed={irn ? [{ label: 'IRN', value: irn }, ...(ackNo ? [{ label: 'Ack No', value: ackNo }] : [])] : null}
          filedLabel="e-Invoice"
          recordUrl={`/finance/invoices/${invoiceId}/record-einvoice`}
          recordFields={[
            { key: 'irn', label: 'IRN', placeholder: '64-character IRN from your GSP', required: true },
            { key: 'ack_no', label: 'Acknowledgement No', placeholder: 'Optional' },
          ]}
          onRecorded={onRecorded}
        />
        <PayloadCard
          title="e-Way Bill"
          description="Compliant e-way bill JSON (EWB-01), pulling vehicle + distance from the linked challans."
          fetchUrl={`/finance/invoices/${invoiceId}/ewaybill-payload`}
          submitUrl={`/finance/invoices/${invoiceId}/submit-ewaybill`}
          filed={ewayBillNo ? [{ label: 'E-Way Bill No', value: ewayBillNo }] : null}
          filedLabel="E-Way Bill"
          recordUrl={`/finance/invoices/${invoiceId}/record-ewaybill`}
          recordFields={[
            { key: 'eway_bill_no', label: 'E-Way Bill No', placeholder: '12-digit number from your GSP', required: true },
          ]}
          onRecorded={onRecorded}
        />
      </div>
    </div>
  )
}
