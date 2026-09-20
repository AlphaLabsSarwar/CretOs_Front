import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

const SOURCE_TYPES = ['QUALITY_TEST', 'BATCH', 'CHALLAN', 'CUSTOMER_COMPLAINT', 'OTHER']
const SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL']

const ncrSchema = z.object({
  source_type: z.string().min(1),
  severity: z.string().min(1),
  description: z.string().min(5, 'Describe the non-conformance'),
  assigned_to: z.string().optional(),
  target_close_date: z.string().optional(),
})
type NcrFormValues = z.infer<typeof ncrSchema>

export default function NcrFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<NcrFormValues>({
    resolver: zodResolver(ncrSchema),
    defaultValues: { source_type: 'OTHER', severity: 'MINOR', description: '', assigned_to: '', target_close_date: '' },
  })

  async function onSubmit(values: NcrFormValues) {
    setSubmitting(true)
    try {
      const res = await api.post('/quality/ncr', { ...values, target_close_date: values.target_close_date || undefined })
      queryClient.invalidateQueries({ queryKey: ['ncr'] })
      toast({ variant: 'success', title: 'NCR raised' })
      navigate(`/quality/ncr/${res.data.data.id}`)
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Raise NCR" subtitle="Log a non-conformance to start the corrective/preventive action trail" />

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Non-Conformance" />
          <Field label="Source">
            <select {...register('source_type')} className={inputClass(false)}>
              {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Severity">
            <select {...register('severity')} className={inputClass(false)}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="lg:col-span-2">
            <Field label="Description" required error={errors.description?.message}>
              <textarea {...register('description')} rows={3} className={inputClass(!!errors.description)} placeholder="What went wrong, and where" />
            </Field>
          </div>
          <Field label="Assigned To">
            <input {...register('assigned_to')} className={inputClass(false)} placeholder="Name or email" />
          </Field>
          <Field label="Target Close Date">
            <input type="date" {...register('target_close_date')} className={inputClass(false)} />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/quality/ncr" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/quality/ncr')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Raising...' : 'Raise NCR'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
