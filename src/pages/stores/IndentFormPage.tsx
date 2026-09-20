import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

const indentSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  dept_name: z.string().min(1, 'Department is required'),
  total: optionalNumber,
  doc_close: z.boolean().optional(),
  remarks: z.string().optional(),
})

type IndentFormValues = z.infer<typeof indentSchema>

const DEPARTMENTS = ['Production', 'Maintenance', 'Quality Control', 'Stores', 'Admin', 'Transport']

function defaultValues(): IndentFormValues {
  return { date: new Date().toISOString().slice(0, 10), dept_name: '', total: undefined, doc_close: false, remarks: '' }
}

export default function IndentFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState(false)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['indent', id],
    queryFn: () => api.get(`/stores/indents/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, reset, handleSubmit, formState: { errors } } = useForm<IndentFormValues>({
    resolver: zodResolver(indentSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      date: existing.date?.slice(0, 10) ?? defaultValues().date,
      dept_name: existing.dept_name ?? '',
      total: existing.total != null ? Number(existing.total) : undefined,
      doc_close: existing.doc_close ?? false,
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  async function onSubmit(values: IndentFormValues) {
    setSubmitting(true)
    try {
      const payload = { ...values, branch_id: user?.branch?.id, status: 'ACTIVE' }
      if (isEdit && id) {
        await api.put(`/stores/indents/${id}`, payload)
      } else {
        await api.post('/stores/indents', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['indents'] })
      queryClient.invalidateQueries({ queryKey: ['indent', id] })
      toast({ variant: 'success', title: 'Indent saved' })
      navigate('/stores/indents')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Indent${existing?.indent_no ? ` ${existing.indent_no}` : ''}` : 'New Indent'}
        subtitle={isEdit ? 'Update this material indent' : 'Raise an internal material request for a department'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading indent...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Indent Info" />
          <Field label="Indent No" required>
            <input value={isEdit ? existing?.indent_no ?? '—' : 'Auto-generated'} readOnly className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500" />
          </Field>
          <Field label="Date" required error={errors.date?.message}>
            <input type="date" {...register('date')} className={inputClass(!!errors.date)} />
          </Field>
          <Field label="Department" required error={errors.dept_name?.message}>
            <select {...register('dept_name')} className={inputClass(!!errors.dept_name)}>
              <option value="">Select department...</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Estimated Value">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
              <input type="number" step="0.01" {...register('total', { valueAsNumber: true })} className={inputClass(false, 'pl-6 text-right font-mono')} />
            </div>
          </Field>

          <SectionHeader label="Remarks" />
          <label className="flex items-center gap-2 text-sm text-gray-700 lg:col-span-2">
            <input type="checkbox" {...register('doc_close')} className="h-4 w-4 rounded border-gray-300" />
            Mark this indent as closed
          </label>
          <div className="lg:col-span-2">
            <textarea rows={3} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" placeholder="What materials are needed and why..." />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/stores/indents" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
          <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? 'Saving...' : 'Save Indent'}
          </button>
        </div>
      </form>
    </div>
  )
}
