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
import { Field, SectionHeader, ToggleGroup, inputClass } from '@/components/shared/form-controls'

const journalSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  ledger_name: z.string().min(1, 'Ledger name is required'),
  trans_type: z.enum(['DEBIT', 'CREDIT'], { required_error: 'Debit/Credit is required' }),
  pay_amount: z.preprocess(
    v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.coerce.number({ required_error: 'Amount is required', invalid_type_error: 'Amount is required' }).min(0.01, 'Amount must be greater than 0')
  ),
  ref_no: z.string().optional(),
  remarks: z.string().optional(),
})

type JournalFormValues = z.infer<typeof journalSchema>

function defaultValues(): JournalFormValues {
  return {
    date: new Date().toISOString().slice(0, 10), ledger_name: '', trans_type: 'DEBIT',
    pay_amount: undefined as unknown as number, ref_no: '', remarks: '',
  }
}

export default function JournalFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState(false)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['journal', id],
    queryFn: () => api.get(`/finance/journals/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, watch, setValue, reset, handleSubmit, formState: { errors } } = useForm<JournalFormValues>({
    resolver: zodResolver(journalSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      date: existing.date?.slice(0, 10) ?? defaultValues().date,
      ledger_name: existing.ledger_name ?? '',
      trans_type: existing.trans_type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      pay_amount: existing.pay_amount != null ? Number(existing.pay_amount) : (undefined as unknown as number),
      ref_no: existing.ref_no ?? '',
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  const transType = watch('trans_type')

  async function onSubmit(values: JournalFormValues) {
    setSubmitting(true)
    try {
      const payload = { ...values, branch_id: user?.branch?.id, currency: 'INR', status: 'ACTIVE' }
      if (isEdit && id) {
        await api.put(`/finance/journals/${id}`, payload)
      } else {
        await api.post('/finance/journals', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['journals'] })
      queryClient.invalidateQueries({ queryKey: ['journal', id] })
      toast({ variant: 'success', title: 'Journal entry saved' })
      navigate('/finance/journals')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Journal Entry${existing?.number ? ` ${existing.number}` : ''}` : 'New Journal Entry'}
        subtitle={isEdit ? 'Update this journal entry' : 'Post a general ledger adjustment'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading entry...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Entry Info" />
          <Field label="Entry No" required>
            <input value={isEdit ? existing?.number ?? '—' : 'Auto-generated'} readOnly className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500" />
          </Field>
          <Field label="Date" required error={errors.date?.message}>
            <input type="date" {...register('date')} className={inputClass(!!errors.date)} />
          </Field>

          <SectionHeader label="Ledger Entry" />
          <Field label="Ledger Name" required error={errors.ledger_name?.message}>
            <input {...register('ledger_name')} className={inputClass(!!errors.ledger_name)} placeholder="e.g. Depreciation A/c" />
          </Field>
          <Field label="Debit / Credit" required error={errors.trans_type?.message}>
            <ToggleGroup value={transType} onChange={v => setValue('trans_type', v as JournalFormValues['trans_type'], { shouldValidate: true })} options={[{ value: 'DEBIT', label: 'Debit' }, { value: 'CREDIT', label: 'Credit' }]} />
          </Field>
          <Field label="Amount" required error={errors.pay_amount?.message}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
              <input type="number" step="0.01" {...register('pay_amount', { valueAsNumber: true })} className={inputClass(!!errors.pay_amount, 'pl-6 text-right font-mono')} />
            </div>
          </Field>
          <Field label="Reference No">
            <input {...register('ref_no')} className={inputClass(false)} placeholder="Optional" />
          </Field>

          <SectionHeader label="Remarks" />
          <div className="lg:col-span-2">
            <textarea rows={3} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Narration..." />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/finance/journals" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
          <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </form>
    </div>
  )
}
