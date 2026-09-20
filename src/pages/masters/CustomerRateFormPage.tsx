import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import InlineLoader from '@/components/shared/InlineLoader'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

interface LookupCustomer { id: string; name: string; mobile: string }
interface LookupGrade { id: string; grade_name: string; grade_code: string | null }

const rateSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  grade_name: z.string().min(1, 'Grade is required'),
  rate: z.preprocess(
    v => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number({ required_error: 'Rate is required' }).min(0.01, 'Rate must be greater than 0')
  ),
  remarks: z.string().optional(),
})
type RateFormValues = z.infer<typeof rateSchema>

function defaultValues(): RateFormValues {
  return { customer_id: '', grade_name: '', rate: undefined as unknown as number, remarks: '' }
}

export default function CustomerRateFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState(false)

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: () => api.get('/masters/customers', { params: { limit: 500 } }).then(r => r.data.data.data as LookupCustomer[]),
    staleTime: 5 * 60_000,
  })
  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ['grades-lookup'],
    queryFn: () => api.get('/masters/grades', { params: { limit: 500, branch_id: user?.branch?.id } }).then(r => r.data.data.data as LookupGrade[]),
    staleTime: 5 * 60_000,
  })

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['customer-rate', id],
    queryFn: () => api.get(`/masters/customer-rates/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { control, register, reset, handleSubmit, formState: { errors } } = useForm<RateFormValues>({
    resolver: zodResolver(rateSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      customer_id: existing.customer_id ?? '',
      grade_name: existing.grade_name ?? '',
      rate: existing.rate != null ? Number(existing.rate) : (undefined as unknown as number),
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  async function onSubmit(values: RateFormValues) {
    setSubmitting(true)
    try {
      const payload = { ...values, branch_id: user?.branch?.id }
      if (isEdit && id) {
        await api.put(`/masters/customer-rates/${id}`, payload)
      } else {
        await api.post('/masters/customer-rates', payload)
      }
      toast({ variant: 'success', title: 'Rate contract saved' })
      navigate('/masters/customer-rates')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Rate Contract' : 'New Rate Contract'}
        subtitle="One agreed rate per customer + grade. The challan form auto-fills Rate when this combination is selected."
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <InlineLoader /> Loading...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2 max-w-2xl">
          <SectionHeader label="Contract" />
          <Field label="Customer" required error={errors.customer_id?.message}>
            <Controller
              control={control}
              name="customer_id"
              render={({ field }) => (
                <SearchableSelect
                  options={customers ?? []}
                  value={field.value}
                  onChange={v => field.onChange(v)}
                  displayKey="name"
                  valueKey="id"
                  filterKeys={['name', 'mobile']}
                  loading={customersLoading}
                  placeholder="Search customer..."
                  error={!!errors.customer_id}
                />
              )}
            />
          </Field>
          <Field label="Grade" required error={errors.grade_name?.message}>
            <Controller
              control={control}
              name="grade_name"
              render={({ field }) => (
                <SearchableSelect
                  options={grades ?? []}
                  value={field.value}
                  onChange={v => field.onChange(v)}
                  displayKey="grade_name"
                  valueKey="grade_name"
                  loading={gradesLoading}
                  placeholder="Search grade..."
                  error={!!errors.grade_name}
                />
              )}
            />
          </Field>
          <Field label="Rate (₹ / Cum)" required error={errors.rate?.message}>
            <input type="number" step="0.01" {...register('rate', { valueAsNumber: true })} className={inputClass(!!errors.rate, 'text-right font-mono')} />
          </Field>
          <div />
          <div className="lg:col-span-2">
            <Field label="Remarks">
              <textarea rows={2} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Optional notes" />
            </Field>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/masters/customer-rates" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/masters/customer-rates')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save Rate Contract'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
