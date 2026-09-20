import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

const MOBILE_RE = /^[0-9]{10}$/
const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

const pumpSchema = z.object({
  pump_no: z.string().min(1, 'Pump number is required'),
  pump_type: z.string().optional(),
  capacity_cum_hr: optionalNumber,
  ownership: z.string().optional(),
  operator_name: z.string().optional(),
  mobile: z.string().optional().refine(v => !v || MOBILE_RE.test(v), { message: 'Must be 10 digits' }),
  remarks: z.string().optional(),
})
type PumpFormValues = z.infer<typeof pumpSchema>

const PUMP_TYPES = ['BOOM', 'LINE', 'TRAILER']
const OWNERSHIP_TYPES = ['OWNED', 'HIRED']

function defaultValues(): PumpFormValues {
  return { pump_no: '', pump_type: 'BOOM', capacity_cum_hr: undefined, ownership: 'OWNED', operator_name: '', mobile: '', remarks: '' }
}

export default function PumpFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['pump', id],
    queryFn: () => api.get(`/masters/pumps/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, reset, handleSubmit, formState: { errors } } = useForm<PumpFormValues>({
    resolver: zodResolver(pumpSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      pump_no: existing.pump_no ?? '',
      pump_type: existing.pump_type ?? 'BOOM',
      capacity_cum_hr: existing.capacity_cum_hr != null ? Number(existing.capacity_cum_hr) : undefined,
      ownership: existing.ownership ?? 'OWNED',
      operator_name: existing.operator_name ?? '',
      mobile: existing.mobile ?? '',
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  async function onSubmit(values: PumpFormValues) {
    setSubmitting(true)
    try {
      if (isEdit && id) await api.put(`/masters/pumps/${id}`, values)
      else await api.post('/masters/pumps', values)
      queryClient.invalidateQueries({ queryKey: ['pumps'] })
      queryClient.invalidateQueries({ queryKey: ['pump', id] })
      toast({ variant: 'success', title: 'Pump saved successfully' })
      navigate('/masters/pumps')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Pump${existing?.pump_no ? ` — ${existing.pump_no}` : ''}` : 'New Pump'}
        subtitle={isEdit ? 'Update pump master details' : 'Add a boom or line pump to the fleet'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading pump...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Pump Info" />
          <Field label="Pump No" required error={errors.pump_no?.message}>
            <input {...register('pump_no')} className={inputClass(!!errors.pump_no, 'font-mono uppercase')} placeholder="e.g. PMP-01" />
          </Field>
          <Field label="Type">
            <select {...register('pump_type')} className={inputClass(false)}>
              {PUMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Capacity (Cum/hr)">
            <input type="number" step="0.1" {...register('capacity_cum_hr', { valueAsNumber: true })} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <Field label="Ownership">
            <select {...register('ownership')} className={inputClass(false)}>
              {OWNERSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <SectionHeader label="Operator" />
          <Field label="Operator Name">
            <input {...register('operator_name')} className={inputClass(false)} />
          </Field>
          <Field label="Mobile" error={errors.mobile?.message}>
            <input {...register('mobile')} className={inputClass(!!errors.mobile, 'font-mono')} placeholder="10-digit mobile" />
          </Field>
          <Field label="Remarks">
            <input {...register('remarks')} className={inputClass(false)} />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/masters/pumps" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/masters/pumps')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save Pump'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
