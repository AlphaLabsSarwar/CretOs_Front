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

const SALES_TYPES = ['RMC SALE', 'RATE CONTRACT', 'ONE-TIME']

const orderSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  customer_id: z.string().min(1, 'Customer is required'),
  job_site: z.string().min(1, 'Job site is required'),
  sales_type: z.string().optional(),
  tax_type: z.enum(['GST', 'NON_GST'], { required_error: 'Tax type is required' }),
  quotation_no: z.string().optional(),
  po_no: z.string().optional(),
  po_date: z.string().optional(),
  deli_date: z.string().optional(),
  from_date: z.string().min(1, 'From date is required'),
  to_date: z.string().min(1, 'To date is required'),
  currency: z.string().optional(),
  remarks: z.string().optional(),
}).refine(v => !v.from_date || !v.to_date || new Date(v.to_date) >= new Date(v.from_date), {
  message: 'To date must be on/after from date',
  path: ['to_date'],
})

type OrderFormValues = z.infer<typeof orderSchema>

function defaultValues(): OrderFormValues {
  const today = new Date().toISOString().slice(0, 10)
  return {
    date: today, customer_id: '', job_site: '', sales_type: 'RMC SALE', tax_type: 'GST',
    quotation_no: '', po_no: '', po_date: '', deli_date: '', from_date: today, to_date: today,
    currency: 'INR', remarks: '',
  }
}

export default function OrderFormPage() {
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

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/sales/orders/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, control, watch, setValue, reset, handleSubmit, formState: { errors } } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      date: existing.date?.slice(0, 10) ?? defaultValues().date,
      customer_id: existing.customer_id ?? '',
      job_site: existing.job_site ?? '',
      sales_type: existing.sales_type ?? 'RMC SALE',
      tax_type: existing.tax_type ?? 'GST',
      quotation_no: existing.quotation_no ?? '',
      po_no: existing.po_no ?? '',
      po_date: existing.po_date?.slice(0, 10) ?? '',
      deli_date: existing.deli_date?.slice(0, 10) ?? '',
      from_date: existing.from_date?.slice(0, 10) ?? defaultValues().from_date,
      to_date: existing.to_date?.slice(0, 10) ?? defaultValues().to_date,
      currency: existing.currency ?? 'INR',
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  const taxType = watch('tax_type')

  async function onSubmit(values: OrderFormValues, intent: 'draft' | 'active') {
    setSubmitting(intent)
    try {
      const payload = {
        ...values,
        po_date: values.po_date || null,
        deli_date: values.deli_date || null,
        quotation_no: values.quotation_no || null,
        po_no: values.po_no || null,
        branch_id: user?.branch?.id,
        status: intent === 'active' ? 'ACTIVE' : 'DRAFT',
      }
      if (isEdit && id) {
        await api.put(`/sales/orders/${id}`, payload)
      } else {
        await api.post('/sales/orders', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      toast({ variant: 'success', title: intent === 'active' ? 'Order activated' : 'Order saved as draft' })
      navigate('/sales/orders')
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
        title={isEdit ? `Edit Order${existing?.order_no ? ` ${existing.order_no}` : ''}` : 'New Work Order'}
        subtitle={isEdit ? 'Update this sales order' : 'Create the customer order that schedules and dispatches will be billed against'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading order...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Order Info" />
          <Field label="Order No" required>
            <input value={isEdit ? existing?.order_no ?? '—' : 'Auto-generated'} readOnly className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500" />
          </Field>
          <Field label="Date" required error={errors.date?.message}>
            <input type="date" {...register('date')} className={inputClass(!!errors.date)} />
          </Field>
          <Field label="Sales Type">
            <select {...register('sales_type')} className={inputClass(false)}>
              {SALES_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Tax Type" required error={errors.tax_type?.message}>
            <ToggleGroup value={taxType} onChange={v => setValue('tax_type', v as OrderFormValues['tax_type'], { shouldValidate: true })} options={[{ value: 'GST', label: 'GST' }, { value: 'NON_GST', label: 'NON-GST' }]} />
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
                  onChange={v => field.onChange(v)}
                  displayKey="name"
                  valueKey="id"
                  filterKeys={['name', 'mobile', 'code']}
                  loading={customersLoading}
                  placeholder="Search customer..."
                  error={!!errors.customer_id}
                  renderOption={c => (
                    <div className="flex items-center justify-between gap-2">
                      <span>{c.name}</span>
                      <span className="font-mono text-[11px] text-gray-400">{c.mobile ?? c.code ?? ''}</span>
                    </div>
                  )}
                />
              )}
            />
          </Field>
          <Field label="Job Site" required error={errors.job_site?.message}>
            <input {...register('job_site')} className={inputClass(!!errors.job_site)} placeholder="Site address" />
          </Field>
          <Field label="Quotation No">
            <input {...register('quotation_no')} className={inputClass(false)} placeholder="Optional" />
          </Field>
          <div />
          <Field label="Customer PO No">
            <input {...register('po_no')} className={inputClass(false)} placeholder="Optional" />
          </Field>
          <Field label="PO Date">
            <input type="date" {...register('po_date')} className={inputClass(false)} />
          </Field>

          <SectionHeader label="Delivery Period" />
          <Field label="From Date" required error={errors.from_date?.message}>
            <input type="date" {...register('from_date')} className={inputClass(!!errors.from_date)} />
          </Field>
          <Field label="To Date" required error={errors.to_date?.message}>
            <input type="date" {...register('to_date')} className={inputClass(!!errors.to_date)} />
          </Field>
          <Field label="Expected Delivery Date">
            <input type="date" {...register('deli_date')} className={inputClass(false)} />
          </Field>
          <Field label="Currency">
            <input {...register('currency')} className={inputClass(false, 'font-mono uppercase')} />
          </Field>

          <SectionHeader label="Remarks" />
          <div className="lg:col-span-2">
            <textarea rows={3} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Additional notes..." />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/sales/orders" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
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
