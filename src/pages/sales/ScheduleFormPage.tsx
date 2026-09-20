import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, ToggleGroup, inputClass } from '@/components/shared/form-controls'

interface LookupCustomer { id: string; name: string; mobile: string | null; code: string | null }
interface LookupOrder { id: string; order_no: string; job_site: string; customer_id: string }
interface LookupGrade { id: string; grade_name: string; grade_code: string | null }

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

const scheduleSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  customer_id: z.string().min(1, 'Customer is required'),
  order_id: z.string().optional(),
  job_site: z.string().min(1, 'Job site is required'),
  grade_name: z.string().min(1, 'Grade is required'),
  qty: z.preprocess(
    v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.coerce.number({ required_error: 'Qty is required', invalid_type_error: 'Qty is required' }).min(0.1, 'Qty must be greater than 0')
  ),
  pump_type: z.enum(['WITHOUT_PUMP', 'WITH_PUMP']),
  pump_name: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  rate: optionalNumber,
  supervisor: z.string().optional(),
  mkt_user: z.string().optional(),
  remarks: z.string().optional(),
})

type ScheduleFormValues = z.infer<typeof scheduleSchema>

function defaultValues(): ScheduleFormValues {
  const today = new Date().toISOString().slice(0, 10)
  return {
    date: today, customer_id: '', order_id: '', job_site: '', grade_name: '',
    qty: undefined as unknown as number, pump_type: 'WITHOUT_PUMP', pump_name: '',
    start_time: '', end_time: '', rate: undefined, supervisor: '', mkt_user: '', remarks: '',
  }
}

export default function ScheduleFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState<'draft' | 'active' | null>(null)

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: () => api.get('/masters/customers', { params: { limit: 200, is_active: true } }).then(r => r.data.data.data as LookupCustomer[]),
    staleTime: 5 * 60_000,
  })

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ['grades-lookup', user?.branch?.id],
    queryFn: () => api.get('/masters/grades', { params: { limit: 200, is_active: true, branch_id: user?.branch?.id } }).then(r => r.data.data.data as LookupGrade[]),
    staleTime: 5 * 60_000,
  })

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => api.get(`/sales/schedules/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, control, watch, setValue, reset, handleSubmit, formState: { errors } } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: defaultValues(),
  })

  const customerId = watch('customer_id')

  const { data: orders } = useQuery({
    queryKey: ['orders-lookup', customerId],
    queryFn: () => api.get('/sales/orders', { params: { limit: 100, customer_id: customerId, status: 'ACTIVE' } }).then(r => r.data.data.data as LookupOrder[]),
    enabled: !!customerId,
  })

  useEffect(() => {
    if (!existing) return
    reset({
      date: existing.date?.slice(0, 10) ?? defaultValues().date,
      customer_id: existing.customer_id ?? '',
      order_id: existing.order_id ?? '',
      job_site: existing.job_site ?? '',
      grade_name: existing.grade_name ?? '',
      qty: existing.qty != null ? Number(existing.qty) : (undefined as unknown as number),
      pump_type: existing.pump_type ?? 'WITHOUT_PUMP',
      pump_name: existing.pump_name ?? '',
      start_time: existing.start_time?.slice(0, 16) ?? '',
      end_time: existing.end_time?.slice(0, 16) ?? '',
      rate: existing.rate != null ? Number(existing.rate) : undefined,
      supervisor: existing.supervisor ?? '',
      mkt_user: existing.mkt_user ?? '',
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  const pumpType = watch('pump_type')

  async function onSubmit(values: ScheduleFormValues, intent: 'draft' | 'active') {
    setSubmitting(intent)
    try {
      const payload = {
        ...values,
        order_id: values.order_id || null,
        start_time: values.start_time || null,
        end_time: values.end_time || null,
        branch_id: user?.branch?.id,
        status: intent === 'active' ? 'ACTIVE' : 'DRAFT',
      }
      if (isEdit && id) {
        await api.put(`/sales/schedules/${id}`, payload)
      } else {
        await api.post('/sales/schedules', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['schedule', id] })
      toast({ variant: 'success', title: intent === 'active' ? 'Schedule activated' : 'Schedule saved as draft' })
      navigate('/sales/schedules')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(null)
    }
  }

  const isBusy = submitting !== null

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Schedule${existing?.sch_no ? ` ${existing.sch_no}` : ''}` : 'New Daily Schedule'}
        subtitle={isEdit ? 'Update this dispatch schedule' : 'Plan a job site delivery — activated schedules can be pulled into a dispatch challan'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading schedule...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Schedule Info" />
          <Field label="Schedule No" required>
            <input value={isEdit ? existing?.sch_no ?? '—' : 'Auto-generated'} readOnly className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500" />
          </Field>
          <Field label="Date" required error={errors.date?.message}>
            <input type="date" {...register('date')} className={inputClass(!!errors.date)} />
          </Field>

          <SectionHeader label="Customer & Site" />
          <Field label="Customer" required error={errors.customer_id?.message}>
            <Controller
              control={control}
              name="customer_id"
              render={({ field }) => (
                <SearchableSelect
                  options={customers ?? []}
                  value={field.value}
                  onChange={v => { field.onChange(v); setValue('order_id', '') }}
                  displayKey="name"
                  valueKey="id"
                  filterKeys={['name', 'mobile', 'code']}
                  loading={customersLoading}
                  placeholder="Search customer..."
                  error={!!errors.customer_id}
                />
              )}
            />
          </Field>
          <Field label="Work Order" hint="Optional — link to an active order">
            <Controller
              control={control}
              name="order_id"
              render={({ field }) => (
                <SearchableSelect
                  options={orders ?? []}
                  value={field.value}
                  onChange={(v, opt) => { field.onChange(v); if (opt) setValue('job_site', opt.job_site, { shouldValidate: true }) }}
                  displayKey="order_no"
                  valueKey="id"
                  disabled={!customerId}
                  placeholder={customerId ? 'Select order...' : 'Select customer first'}
                  renderOption={o => <div>{o.order_no} — <span className="text-gray-400">{o.job_site}</span></div>}
                />
              )}
            />
          </Field>
          <Field label="Job Site" required error={errors.job_site?.message}>
            <input {...register('job_site')} className={inputClass(!!errors.job_site)} placeholder="Site address" />
          </Field>
          <div />

          <SectionHeader label="Concrete Details" />
          <Field label="Grade" required error={errors.grade_name?.message}>
            <Controller
              control={control}
              name="grade_name"
              render={({ field }) => (
                <SearchableSelect
                  options={grades ?? []}
                  value={(grades ?? []).find(g => g.grade_name === field.value)?.id ?? ''}
                  onChange={(_v, opt) => field.onChange(opt?.grade_name ?? '')}
                  displayKey="grade_name"
                  valueKey="id"
                  loading={gradesLoading}
                  placeholder="Search grade..."
                  error={!!errors.grade_name}
                />
              )}
            />
          </Field>
          <Field label="Qty (Cum)" required error={errors.qty?.message}>
            <input type="number" step="0.1" {...register('qty', { valueAsNumber: true })} className={inputClass(!!errors.qty, 'text-right font-mono')} />
          </Field>
          <Field label="Pump">
            <ToggleGroup value={pumpType} onChange={v => setValue('pump_type', v as ScheduleFormValues['pump_type'])} options={[{ value: 'WITHOUT_PUMP', label: 'Without Pump' }, { value: 'WITH_PUMP', label: 'With Pump' }]} />
          </Field>
          {pumpType === 'WITH_PUMP' && (
            <Field label="Pump Name">
              <input {...register('pump_name')} className={inputClass(false)} />
            </Field>
          )}

          <SectionHeader label="Timing & Rate" />
          <Field label="Start Time">
            <input type="datetime-local" {...register('start_time')} className={inputClass(false)} />
          </Field>
          <Field label="End Time">
            <input type="datetime-local" {...register('end_time')} className={inputClass(false)} />
          </Field>
          <Field label="Rate (₹ / Cum)">
            <input type="number" step="0.01" {...register('rate', { valueAsNumber: true })} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <div />
          <Field label="Supervisor">
            <input {...register('supervisor')} className={inputClass(false)} />
          </Field>
          <Field label="Marketing User">
            <input {...register('mkt_user')} className={inputClass(false)} />
          </Field>

          <SectionHeader label="Remarks" />
          <div className="lg:col-span-2">
            <textarea rows={3} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/sales/schedules" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
          <div className="flex items-center gap-2">
            <button type="button" disabled={isBusy} onClick={handleSubmit(v => onSubmit(v, 'draft'))} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting === 'draft' && <Loader2 size={13} className="animate-spin" />}
              {submitting === 'draft' ? 'Saving...' : isEdit ? 'Update Draft' : 'Save as Draft'}
            </button>
            <button type="button" disabled={isBusy} onClick={handleSubmit(v => onSubmit(v, 'active'))} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting === 'active' && <Loader2 size={13} className="animate-spin" />}
              {submitting === 'active' ? 'Saving...' : 'Save & Activate'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
