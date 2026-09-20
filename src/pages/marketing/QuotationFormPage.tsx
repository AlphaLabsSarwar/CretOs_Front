import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

interface LookupCustomer { id: string; name: string; mobile: string | null; code: string | null }

const MOBILE_RE = /^[0-9]{10}$/

const quotationSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  valid_date: z.string().min(1, 'Valid until date is required'),
  customer_id: z.string().min(1, 'Customer is required'),
  project_site: z.string().min(1, 'Project site is required'),
  address: z.string().optional(),
  inquiry_no: z.string().optional(),
  ref_no: z.string().optional(),
  kind_attn: z.string().optional(),
  mobile: z.string().optional().refine(v => !v || MOBILE_RE.test(v), { message: 'Must be 10 digits' }),
  email: z.string().optional().refine(v => !v || z.string().email().safeParse(v).success, { message: 'Invalid email address' }),
  heading: z.string().optional(),
  remarks: z.string().optional(),
})

type QuotationFormValues = z.infer<typeof quotationSchema>

function defaultValues(): QuotationFormValues {
  const today = new Date().toISOString().slice(0, 10)
  const valid = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  return {
    date: today, valid_date: valid, customer_id: '', project_site: '', address: '',
    inquiry_no: '', ref_no: '', kind_attn: '', mobile: '', email: '', heading: '', remarks: '',
  }
}

export default function QuotationFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState<'draft' | 'sent' | null>(null)

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: () => api.get('/masters/customers', { params: { limit: 200, is_active: true } }).then(r => r.data.data.data as LookupCustomer[]),
    staleTime: 5 * 60_000,
  })

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => api.get(`/marketing/quotations/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, control, reset, handleSubmit, formState: { errors } } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      date: existing.date?.slice(0, 10) ?? defaultValues().date,
      valid_date: existing.valid_date?.slice(0, 10) ?? defaultValues().valid_date,
      customer_id: existing.customer_id ?? '',
      project_site: existing.project_site ?? '',
      address: existing.address ?? '',
      inquiry_no: existing.inquiry_no ?? '',
      ref_no: existing.ref_no ?? '',
      kind_attn: existing.kind_attn ?? '',
      mobile: existing.mobile ?? '',
      email: existing.email ?? '',
      heading: existing.heading ?? '',
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  async function onSubmit(values: QuotationFormValues, intent: 'draft' | 'sent') {
    setSubmitting(intent)
    try {
      const payload = { ...values, branch_id: user?.branch?.id, status: intent === 'sent' ? 'ACTIVE' : 'DRAFT' }
      if (isEdit && id) {
        await api.put(`/marketing/quotations/${id}`, payload)
      } else {
        await api.post('/marketing/quotations', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['quotation', id] })
      toast({ variant: 'success', title: intent === 'sent' ? 'Quotation marked as sent' : 'Quotation saved as draft' })
      navigate('/marketing/quotations')
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
        title={isEdit ? `Edit Quotation${existing?.quot_no ? ` ${existing.quot_no}` : ''}` : 'New Quotation'}
        subtitle={isEdit ? 'Update this quotation' : 'Draft a quotation for a prospective customer'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading quotation...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Quotation Info" />
          <Field label="Quotation No" required>
            <input value={isEdit ? existing?.quot_no ?? '—' : 'Auto-generated'} readOnly className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500" />
          </Field>
          <Field label="Date" required error={errors.date?.message}>
            <input type="date" {...register('date')} className={inputClass(!!errors.date)} />
          </Field>
          <Field label="Valid Until" required error={errors.valid_date?.message}>
            <input type="date" {...register('valid_date')} className={inputClass(!!errors.valid_date)} />
          </Field>
          <Field label="Inquiry No">
            <input {...register('inquiry_no')} className={inputClass(false)} placeholder="Optional" />
          </Field>
          <Field label="Reference No">
            <input {...register('ref_no')} className={inputClass(false)} placeholder="Optional" />
          </Field>
          <div />

          <SectionHeader label="Customer & Project" />
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
                />
              )}
            />
          </Field>
          <Field label="Project Site" required error={errors.project_site?.message}>
            <input {...register('project_site')} className={inputClass(!!errors.project_site)} placeholder="Site address" />
          </Field>
          <div className="lg:col-span-2">
            <label className="field-label">Address</label>
            <textarea rows={2} {...register('address')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <Field label="Kind Attention">
            <input {...register('kind_attn')} className={inputClass(false)} placeholder="Contact person" />
          </Field>
          <div />
          <Field label="Mobile" error={errors.mobile?.message}>
            <input {...register('mobile')} className={inputClass(!!errors.mobile, 'font-mono')} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input type="email" {...register('email')} className={inputClass(!!errors.email)} />
          </Field>

          <SectionHeader label="Content" />
          <Field label="Subject / Heading">
            <input {...register('heading')} className={inputClass(false)} placeholder="e.g. Supply of M-25 Grade Concrete" />
          </Field>
          <div />
          <div className="lg:col-span-2">
            <label className="field-label">Remarks</label>
            <textarea rows={3} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/marketing/quotations" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
          <div className="flex items-center gap-2">
            {isEdit && id && (
              <Link
                to={`/marketing/quotations/${id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Printer size={13} /> Print
              </Link>
            )}
            <button type="button" disabled={isBusy} onClick={handleSubmit(v => onSubmit(v, 'draft'))} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting === 'draft' && <Loader2 size={13} className="animate-spin" />}
              {submitting === 'draft' ? 'Saving...' : isEdit ? 'Update Draft' : 'Save as Draft'}
            </button>
            <button type="button" disabled={isBusy} onClick={handleSubmit(v => onSubmit(v, 'sent'))} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting === 'sent' && <Loader2 size={13} className="animate-spin" />}
              {submitting === 'sent' ? 'Saving...' : 'Mark as Sent'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
