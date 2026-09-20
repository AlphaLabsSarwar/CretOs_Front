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

interface LookupVendor { id: string; name: string; code: string | null; mobile: string | null }

const TRANS_TYPES = ['CASH', 'BANK', 'CHEQUE', 'NEFT', 'RTGS', 'UPI']

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

const paymentSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  vendor_id: z.string().min(1, 'Vendor is required'),
  ledger_name: z.string().min(1, 'Ledger name is required'),
  pay_amount: z.preprocess(
    v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.coerce.number({ required_error: 'Amount is required', invalid_type_error: 'Amount is required' }).min(0.01, 'Amount must be greater than 0')
  ),
  trans_type: z.string().min(1, 'Payment mode is required'),
  ref_no: z.string().optional(),
  ref_date: z.string().optional(),
  cheque_no: z.string().optional(),
  instr_date: z.string().optional(),
  bank_date: z.string().optional(),
  bank_name: z.string().optional(),
  print_name: z.string().optional(),
  remarks: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

function defaultValues(): PaymentFormValues {
  return {
    date: new Date().toISOString().slice(0, 10), vendor_id: '', ledger_name: '',
    pay_amount: undefined as unknown as number, trans_type: 'BANK',
    ref_no: '', ref_date: '', cheque_no: '', instr_date: '', bank_date: '', bank_name: '', print_name: '', remarks: '',
  }
}

export default function PaymentFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState(false)

  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors-lookup'],
    queryFn: () => api.get('/masters/vendors/lookup').then(r => r.data.data as LookupVendor[]),
    staleTime: 5 * 60_000,
  })

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => api.get(`/finance/payments/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, control, watch, setValue, reset, handleSubmit, formState: { errors } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      date: existing.date?.slice(0, 10) ?? defaultValues().date,
      vendor_id: existing.vendor_id ?? '',
      ledger_name: existing.ledger_name ?? '',
      pay_amount: existing.pay_amount != null ? Number(existing.pay_amount) : (undefined as unknown as number),
      trans_type: existing.trans_type ?? 'BANK',
      ref_no: existing.ref_no ?? '',
      ref_date: existing.ref_date?.slice(0, 10) ?? '',
      cheque_no: existing.cheque_no ?? '',
      instr_date: existing.instr_date?.slice(0, 10) ?? '',
      bank_date: existing.bank_date?.slice(0, 10) ?? '',
      bank_name: existing.bank_name ?? '',
      print_name: existing.print_name ?? '',
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  const transType = watch('trans_type')

  async function onSubmit(values: PaymentFormValues) {
    setSubmitting(true)
    try {
      const payload = { ...values, branch_id: user?.branch?.id, currency: 'INR', status: 'ACTIVE' }
      if (isEdit && id) {
        await api.put(`/finance/payments/${id}`, payload)
      } else {
        await api.post('/finance/payments', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment', id] })
      toast({ variant: 'success', title: 'Payment voucher saved' })
      navigate('/finance/payments')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Payment${existing?.number ? ` ${existing.number}` : ''}` : 'New Payment Voucher'}
        subtitle={isEdit ? 'Update this payment voucher' : 'Record a payment made to a vendor'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading payment...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Voucher Info" />
          <Field label="Voucher No" required>
            <input value={isEdit ? existing?.number ?? '—' : 'Auto-generated'} readOnly className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500" />
          </Field>
          <Field label="Date" required error={errors.date?.message}>
            <input type="date" {...register('date')} className={inputClass(!!errors.date)} />
          </Field>

          <SectionHeader label="Vendor" />
          <Field label="Vendor" required error={errors.vendor_id?.message}>
            <Controller
              control={control}
              name="vendor_id"
              render={({ field }) => (
                <SearchableSelect
                  options={vendors ?? []}
                  value={field.value}
                  onChange={(v, opt) => { field.onChange(v); if (opt) setValue('ledger_name', opt.name, { shouldValidate: true }) }}
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
          <Field label="Ledger Name" required error={errors.ledger_name?.message}>
            <input {...register('ledger_name')} className={inputClass(!!errors.ledger_name)} />
          </Field>

          <SectionHeader label="Amount & Mode" />
          <Field label="Amount" required error={errors.pay_amount?.message}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
              <input type="number" step="0.01" {...register('pay_amount', { valueAsNumber: true })} className={inputClass(!!errors.pay_amount, 'pl-6 text-right font-mono')} />
            </div>
          </Field>
          <Field label="Payment Mode" required error={errors.trans_type?.message}>
            <ToggleGroup value={transType} onChange={v => setValue('trans_type', v, { shouldValidate: true })} options={TRANS_TYPES.map(t => ({ value: t, label: t }))} />
          </Field>
          <Field label="Reference No">
            <input {...register('ref_no')} className={inputClass(false)} placeholder="e.g. Invoice/PO number" />
          </Field>
          <Field label="Reference Date">
            <input type="date" {...register('ref_date')} className={inputClass(false)} />
          </Field>

          {transType === 'CHEQUE' && (
            <>
              <SectionHeader label="Cheque Details" />
              <Field label="Cheque No">
                <input {...register('cheque_no')} className={inputClass(false, 'font-mono')} />
              </Field>
              <Field label="Instrument Date">
                <input type="date" {...register('instr_date')} className={inputClass(false)} />
              </Field>
              <Field label="Bank Realization Date">
                <input type="date" {...register('bank_date')} className={inputClass(false)} />
              </Field>
              <Field label="Bank Name">
                <input {...register('bank_name')} className={inputClass(false)} />
              </Field>
            </>
          )}

          <SectionHeader label="Remarks" />
          <Field label="Print Name" hint="Name to show on the printed voucher">
            <input {...register('print_name')} className={inputClass(false)} />
          </Field>
          <div />
          <div className="lg:col-span-2">
            <textarea rows={3} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Additional notes..." />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/finance/payments" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
          <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </form>
    </div>
  )
}
