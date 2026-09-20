import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, ToggleGroup, inputClass } from '@/components/shared/form-controls'

interface LookupVendor { id: string; name: string; code: string | null; mobile: string | null }

const PO_TYPES = ['MATERIAL', 'SERVICE', 'CAPITAL']
const PAYMENT_TERMS = ['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60']

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

const poSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  vendor_id: z.string().min(1, 'Vendor is required'),
  po_type: z.string().optional(),
  tax_type: z.enum(['GST', 'NON_GST']),
  ref_no: z.string().optional(),
  valid_date: z.string().min(1, 'Valid date is required'),
  payment_term: z.string().optional(),
  del_address: z.string().optional(),
  sub_total: z.preprocess(
    v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.coerce.number({ required_error: 'Amount is required', invalid_type_error: 'Amount is required' }).min(0.01, 'Amount must be greater than 0')
  ),
  currency: z.string().optional(),
  remarks: z.string().optional(),
})

type POFormValues = z.infer<typeof poSchema>

function defaultValues(): POFormValues {
  const today = new Date().toISOString().slice(0, 10)
  const valid = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  return {
    date: today, vendor_id: '', po_type: 'MATERIAL', tax_type: 'GST', ref_no: '',
    valid_date: valid, payment_term: '', del_address: '', sub_total: undefined as unknown as number,
    currency: 'INR', remarks: '',
  }
}

export default function POFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState<'draft' | 'active' | null>(null)

  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors-lookup'],
    queryFn: () => api.get('/masters/vendors/lookup').then(r => r.data.data as LookupVendor[]),
    staleTime: 5 * 60_000,
  })

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['po', id],
    queryFn: () => api.get(`/stores/po/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, control, watch, setValue, reset, handleSubmit, formState: { errors } } = useForm<POFormValues>({
    resolver: zodResolver(poSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      date: existing.date?.slice(0, 10) ?? defaultValues().date,
      vendor_id: existing.vendor_id ?? '',
      po_type: existing.po_type ?? 'MATERIAL',
      tax_type: existing.tax_type ?? 'GST',
      ref_no: existing.ref_no ?? '',
      valid_date: existing.valid_date?.slice(0, 10) ?? defaultValues().valid_date,
      payment_term: existing.payment_term ?? '',
      del_address: existing.del_address ?? '',
      sub_total: existing.sub_total != null ? Number(existing.sub_total) : (undefined as unknown as number),
      currency: existing.currency ?? 'INR',
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  const taxType = watch('tax_type')
  const subTotal = watch('sub_total')
  const taxAmount = useMemo(() => (taxType === 'GST' ? (Number(subTotal) || 0) * 0.18 : 0), [taxType, subTotal])
  const totalAmount = (Number(subTotal) || 0) + taxAmount

  async function onSubmit(values: POFormValues, intent: 'draft' | 'active') {
    setSubmitting(intent)
    try {
      const payload = { ...values, branch_id: user?.branch?.id, status: intent === 'active' ? 'ACTIVE' : 'DRAFT' }
      if (isEdit && id) {
        await api.put(`/stores/po/${id}`, payload)
      } else {
        await api.post('/stores/po', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['pos'] })
      queryClient.invalidateQueries({ queryKey: ['po', id] })
      toast({ variant: 'success', title: intent === 'active' ? 'Purchase order approved' : 'Purchase order saved as draft' })
      navigate('/stores/po')
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
        title={isEdit ? `Edit PO${existing?.po_no ? ` ${existing.po_no}` : ''}` : 'New Purchase Order'}
        subtitle={isEdit ? 'Update this purchase order' : 'Order raw material or services from a vendor'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading purchase order...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="PO Info" />
          <Field label="PO No" required>
            <input value={isEdit ? existing?.po_no ?? '—' : 'Auto-generated'} readOnly className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500" />
          </Field>
          <Field label="Date" required error={errors.date?.message}>
            <input type="date" {...register('date')} className={inputClass(!!errors.date)} />
          </Field>
          <Field label="PO Type">
            <select {...register('po_type')} className={inputClass(false)}>
              {PO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Tax Type" required error={errors.tax_type?.message}>
            <ToggleGroup value={taxType} onChange={v => setValue('tax_type', v as POFormValues['tax_type'], { shouldValidate: true })} options={[{ value: 'GST', label: 'GST' }, { value: 'NON_GST', label: 'NON-GST' }]} />
          </Field>
          <Field label="Valid Until" required error={errors.valid_date?.message}>
            <input type="date" {...register('valid_date')} className={inputClass(!!errors.valid_date)} />
          </Field>
          <Field label="Reference No">
            <input {...register('ref_no')} className={inputClass(false)} placeholder="Optional" />
          </Field>

          <SectionHeader label="Vendor & Delivery" />
          <Field label="Vendor" required error={errors.vendor_id?.message}>
            <Controller
              control={control}
              name="vendor_id"
              render={({ field }) => (
                <SearchableSelect
                  options={vendors ?? []}
                  value={field.value}
                  onChange={v => field.onChange(v)}
                  displayKey="name"
                  valueKey="id"
                  filterKeys={['name', 'code', 'mobile']}
                  loading={vendorsLoading}
                  placeholder="Search vendor..."
                  error={!!errors.vendor_id}
                />
              )}
            />
          </Field>
          <Field label="Payment Term">
            <select {...register('payment_term')} className={inputClass(false)}>
              <option value="">Select term...</option>
              {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div className="lg:col-span-2">
            <label className="field-label">Delivery Address</label>
            <textarea rows={2} {...register('del_address')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <SectionHeader label="Amount" />
          <Field label="Sub Total" required error={errors.sub_total?.message}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
              <input type="number" step="0.01" {...register('sub_total', { valueAsNumber: true })} className={inputClass(!!errors.sub_total, 'pl-6 text-right font-mono')} />
            </div>
          </Field>
          <Field label="Currency">
            <input {...register('currency')} className={inputClass(false, 'font-mono uppercase')} />
          </Field>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs lg:col-span-2">
            <span className="text-gray-500">Sub Total: <span className="font-mono text-gray-800">₹{formatINR(Number(subTotal) || 0)}</span></span>
            {taxType === 'GST' && <span className="text-gray-500">GST (18%): <span className="font-mono text-gray-800">₹{formatINR(taxAmount)}</span></span>}
            <span className="text-gray-500">Total: <span className="font-mono font-semibold text-gray-900">₹{formatINR(totalAmount)}</span></span>
          </div>

          <SectionHeader label="Remarks" />
          <div className="lg:col-span-2">
            <textarea rows={3} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/stores/po" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
          <div className="flex items-center gap-2">
            {isEdit && id && (
              <Link
                to={`/stores/po/${id}/print`}
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
            <button type="button" disabled={isBusy} onClick={handleSubmit(v => onSubmit(v, 'active'))} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting === 'active' && <Loader2 size={13} className="animate-spin" />}
              {submitting === 'active' ? 'Saving...' : 'Approve PO'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
