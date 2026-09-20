import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

function PortalAccessSection({ customerId, existing }: { customerId: string; existing: any }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [portalEmail, setPortalEmail] = useState(existing?.portal_email ?? '')
  const [portalPassword, setPortalPassword] = useState('')

  const update = useMutation({
    mutationFn: (body: any) => api.put(`/masters/customers/${customerId}/portal-access`, body),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Portal access updated' })
      setPortalPassword('')
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not update portal access', description: e?.response?.data?.error }),
  })

  const enabled = !!existing?.portal_enabled

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="section-label mb-1">Customer Self-Service Portal</p>
      <p className="mb-3 text-xs text-gray-400">
        Lets this customer log in separately at /portal to see their own invoices, statement, and delivery tracking. Admin-managed — separate credentials from staff logins.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Portal Email</label>
          <input type="email" value={portalEmail} onChange={e => setPortalEmail(e.target.value)} className="h-9 w-56 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{enabled ? 'Reset Password' : 'Set Password'}</label>
          <input type="password" value={portalPassword} onChange={e => setPortalPassword(e.target.value)} placeholder={enabled ? 'Leave blank to keep current' : ''} className="h-9 w-48 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <button
          disabled={!portalEmail || (!enabled && !portalPassword) || update.isPending}
          onClick={() => update.mutate({ portal_email: portalEmail, portal_password: portalPassword || undefined })}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {update.isPending && <Loader2 size={13} className="animate-spin" />} {enabled ? 'Update' : 'Enable Access'}
        </button>
        {enabled && (
          <button
            onClick={() => update.mutate({ portal_enabled: false })}
            className="flex h-9 items-center rounded-lg border border-red-300 px-4 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Disable Access
          </button>
        )}
      </div>
      {enabled && <p className="mt-2 text-xs text-green-700">Portal access is enabled for this customer.</p>}
    </div>
  )
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const MOBILE_RE = /^[0-9]{10}$/
const PIN_RE = /^[0-9]{6}$/

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Delhi', 'Chandigarh', 'Puducherry',
]

const PAYMENT_TERMS = ['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60']

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

function optionalPattern(re: RegExp, message: string) {
  return z.string().optional().refine(v => !v || re.test(v), { message })
}

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  code: z.string().optional(),
  gstin: optionalPattern(GSTIN_RE, 'Invalid GSTIN format'),
  pan_no: optionalPattern(PAN_RE, 'Invalid PAN format (e.g. AAAAA0000A)'),
  contact_person: z.string().optional(),
  mobile: optionalPattern(MOBILE_RE, 'Must be 10 digits'),
  email: z.string().optional().refine(v => !v || z.string().email().safeParse(v).success, { message: 'Invalid email address' }),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pin_code: optionalPattern(PIN_RE, 'Must be 6 digits'),
  payment_term: z.string().optional(),
  credit_limit: optionalNumber,
  opening_balance: optionalNumber,
  credit_hold: z.boolean().optional(),
  credit_hold_reason: z.string().optional(),
})

type CustomerFormValues = z.infer<typeof customerSchema>

function defaultValues(): CustomerFormValues {
  return {
    name: '', code: '', gstin: '', pan_no: '', contact_person: '', mobile: '', email: '',
    address: '', city: '', state: '', pin_code: '', payment_term: '',
    credit_limit: undefined, opening_balance: undefined,
    credit_hold: false, credit_hold_reason: '',
  }
}

function uppercaseOnChange(fieldOnChange: (e: React.ChangeEvent<HTMLInputElement>) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.toUpperCase()
    fieldOnChange(e)
  }
}

export default function CustomerFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/masters/customers/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, control, reset, watch, handleSubmit, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaultValues(),
    mode: 'onBlur',
  })
  const creditHold = watch('credit_hold')

  useEffect(() => {
    if (!existing) return
    reset({
      name: existing.name ?? '',
      code: existing.code ?? '',
      gstin: existing.gstin ?? '',
      pan_no: existing.pan_no ?? '',
      contact_person: existing.contact_person ?? '',
      mobile: existing.mobile ?? '',
      email: existing.email ?? '',
      address: existing.address ?? '',
      city: existing.city ?? '',
      state: existing.state ?? '',
      pin_code: existing.pin_code ?? '',
      payment_term: existing.payment_term ?? '',
      credit_limit: existing.credit_limit != null ? Number(existing.credit_limit) : undefined,
      opening_balance: existing.opening_balance != null ? Number(existing.opening_balance) : undefined,
      credit_hold: existing.credit_hold ?? false,
      credit_hold_reason: existing.credit_hold_reason ?? '',
    })
  }, [existing, reset])

  async function onSubmit(values: CustomerFormValues) {
    setSubmitting(true)
    try {
      // credit_hold is not a plain profile field — the API rejects it on the
      // ordinary create/update route (see crudFactory's PROTECTED_COLUMNS)
      // because placing/releasing a hold blocks or unblocks dispatch. It goes
      // through its own Admin/Manager-only, audit-logged endpoint below.
      const { credit_hold, credit_hold_reason, ...rest } = values
      const payload = { ...rest, code: values.code || undefined }
      let customerId = id
      if (isEdit && id) {
        await api.put(`/masters/customers/${id}`, payload)
      } else {
        const res = await api.post('/masters/customers', payload)
        customerId = res.data?.data?.id
      }

      // Only call the credit-hold route when the flag actually changed, so a
      // normal profile edit by someone without Admin/Manager rights doesn't
      // fail on a field they never touched.
      const previousHold = existing?.credit_hold ?? false
      const previousReason = existing?.credit_hold_reason ?? ''
      const holdChanged = (credit_hold ?? false) !== previousHold || (credit_hold_reason ?? '') !== previousReason
      if (customerId && holdChanged) {
        try {
          await api.put(`/masters/customers/${customerId}/credit-hold`, {
            credit_hold: credit_hold ?? false,
            credit_hold_reason: credit_hold_reason ?? '',
          })
        } catch (holdErr: any) {
          // The customer's own details did save — be specific that only the
          // hold change was refused, rather than implying nothing was saved.
          toast({
            variant: 'error',
            title: 'Customer saved, but the credit hold was not changed',
            description: holdErr?.response?.data?.error ?? 'Only an Admin or Manager can place or release a credit hold.',
          })
          queryClient.invalidateQueries({ queryKey: ['customers'] })
          navigate('/masters/customers')
          return
        }
      }
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', id] })
      toast({ variant: 'success', title: 'Customer saved successfully' })
      navigate('/masters/customers')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Customer${existing?.name ? ` — ${existing.name}` : ''}` : 'New Customer'}
        subtitle={isEdit ? 'Update customer master details' : 'Add the party who will be billed for concrete orders'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading customer...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Basic Info" />
          <Field label="Customer Name" required error={errors.name?.message}>
            <input {...register('name')} className={inputClass(!!errors.name)} placeholder="e.g. ABC Constructions" />
          </Field>
          <Field label="Customer Code" hint="Leave blank to auto-generate">
            <input {...register('code')} className={inputClass(false, 'font-mono')} placeholder="Auto-generated" />
          </Field>
          <Field label="GSTIN" error={errors.gstin?.message} hint={!errors.gstin ? '15 characters' : undefined}>
            <Controller
              control={control}
              name="gstin"
              render={({ field }) => {
                const raw = (field.value ?? '').toUpperCase()
                const valid = raw.length === 15 && GSTIN_RE.test(raw) && !errors.gstin
                return (
                  <div className="relative">
                    <input
                      value={raw}
                      onChange={e => field.onChange(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15))}
                      onBlur={field.onBlur}
                      placeholder="15-character GSTIN"
                      className={inputClass(!!errors.gstin, 'pr-8 font-mono uppercase')}
                    />
                    {valid && <CheckCircle2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-600" />}
                  </div>
                )
              }}
            />
          </Field>
          <Field label="PAN No" error={errors.pan_no?.message}>
            <Controller
              control={control}
              name="pan_no"
              render={({ field }) => (
                <input {...field} value={field.value ?? ''} onChange={uppercaseOnChange(field.onChange)} placeholder="AAAAA0000A" className={inputClass(!!errors.pan_no, 'font-mono uppercase')} />
              )}
            />
          </Field>
          <div />

          <SectionHeader label="Contact" />
          <Field label="Contact Person">
            <input {...register('contact_person')} className={inputClass(false)} />
          </Field>
          <Field label="Mobile" error={errors.mobile?.message}>
            <input {...register('mobile')} className={inputClass(!!errors.mobile, 'font-mono')} placeholder="10-digit mobile" />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input type="email" {...register('email')} className={inputClass(!!errors.email)} />
          </Field>
          <div />

          <SectionHeader label="Address" />
          <div className="lg:col-span-2">
            <label className="field-label">Address</label>
            <textarea rows={2} {...register('address')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <Field label="City">
            <input {...register('city')} className={inputClass(false)} />
          </Field>
          <Field label="State">
            <select {...register('state')} className={inputClass(false)}>
              <option value="">Select state...</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="PIN Code" error={errors.pin_code?.message}>
            <input {...register('pin_code')} className={inputClass(!!errors.pin_code, 'font-mono')} placeholder="6-digit PIN" />
          </Field>

          <SectionHeader label="Financial" />
          <Field label="Payment Term">
            <select {...register('payment_term')} className={inputClass(false)}>
              <option value="">Select term...</option>
              {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div />
          <Field label="Credit Limit">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
              <input type="number" step="0.01" {...register('credit_limit', { valueAsNumber: true })} className={inputClass(false, 'pl-6 text-right font-mono')} />
            </div>
          </Field>
          <Field label="Opening Balance">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
              <input type="number" step="0.01" {...register('opening_balance', { valueAsNumber: true })} className={inputClass(false, 'pl-6 text-right font-mono')} />
            </div>
          </Field>

          <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input type="checkbox" {...register('credit_hold')} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              <span>
                <span className="font-medium">Credit hold</span>
                <span className="block text-xs text-gray-500">Blocks new dispatches for this customer regardless of credit limit — see routes/sales/challans.ts's Post action. An Admin or Manager can still override with a reason at dispatch time.</span>
              </span>
            </label>
            {creditHold && (
              <div className="mt-2">
                <label className="field-label">Hold Reason</label>
                <input {...register('credit_hold_reason')} className={inputClass(false)} placeholder="e.g. Bounced cheque on last payment — hold until cleared" />
              </div>
            )}
          </div>
        </div>

        {isEdit && id && (
          <div className="mt-6">
            <PortalAccessSection customerId={id} existing={existing} />
          </div>
        )}

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/masters/customers" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/masters/customers')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
