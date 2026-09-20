import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { Field, SectionHeader, ToggleGroup, inputClass } from '@/components/shared/form-controls'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const MOBILE_RE = /^[0-9]{10}$/
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const PIN_RE = /^[0-9]{6}$/

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
]

const PAYMENT_TERMS = ['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60']

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

function optionalPattern(re: RegExp, message: string) {
  return z
    .string()
    .optional()
    .refine(v => !v || re.test(v), { message })
}

const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  code: z.string().optional(),
  vendor_type: z.enum(['SUPPLIER', 'TRANSPORTER', 'BOTH'], { required_error: 'Vendor type is required' }),
  gstin: optionalPattern(GSTIN_RE, 'Invalid GSTIN format'),
  pan_no: optionalPattern(PAN_RE, 'Invalid PAN format (e.g. AAAAA0000A)'),
  tan_no: z.string().optional(),
  remarks: z.string().optional(),
  contact_person: z.string().optional(),
  designation: z.string().optional(),
  mobile: optionalPattern(MOBILE_RE, 'Must be 10 digits'),
  email: z
    .string()
    .optional()
    .refine(v => !v || z.string().email().safeParse(v).success, { message: 'Invalid email address' }),
  mobile2: optionalPattern(MOBILE_RE, 'Must be 10 digits'),
  email2: z
    .string()
    .optional()
    .refine(v => !v || z.string().email().safeParse(v).success, { message: 'Invalid email address' }),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pin_code: optionalPattern(PIN_RE, 'Must be 6 digits'),
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  account_no: z.string().optional(),
  ifsc_code: optionalPattern(IFSC_RE, 'Invalid IFSC format (e.g. SBIN0001234)'),
  account_type: z.string().optional(),
  payment_term: z.string().optional(),
  credit_limit: optionalNumber,
  opening_balance: optionalNumber,
})

type VendorFormValues = z.infer<typeof vendorSchema>

interface VendorHistorySummary {
  total_pos: number
  total_pos_amount: number
  total_grns: number
  total_paid: number
  outstanding: number
}

function defaultValues(): VendorFormValues {
  return {
    name: '',
    code: '',
    vendor_type: 'SUPPLIER',
    gstin: '',
    pan_no: '',
    tan_no: '',
    remarks: '',
    contact_person: '',
    designation: '',
    mobile: '',
    email: '',
    mobile2: '',
    email2: '',
    address: '',
    city: '',
    state: '',
    pin_code: '',
    bank_name: '',
    bank_branch: '',
    account_no: '',
    ifsc_code: '',
    account_type: '',
    payment_term: '',
    credit_limit: undefined,
    opening_balance: undefined,
  }
}

function formatGstinGroups(raw: string): string {
  const groups = [2, 5, 4, 1, 1, 1, 1]
  let out = ''
  let idx = 0
  for (const len of groups) {
    if (idx >= raw.length) break
    out += (out ? ' ' : '') + raw.slice(idx, idx + len)
    idx += len
  }
  return out
}

function uppercaseOnChange(fieldOnChange: (e: React.ChangeEvent<HTMLInputElement>) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.toUpperCase()
    fieldOnChange(e)
  }
}

export default function VendorFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [showAccountNo, setShowAccountNo] = useState(false)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => api.get(`/masters/vendors/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { data: summary } = useQuery({
    queryKey: ['vendor-history-summary', id],
    queryFn: () =>
      api
        .get(`/masters/vendors/${id}/history`, { params: { limit: 1 } })
        .then(r => r.data.data.summary as VendorHistorySummary),
    enabled: isEdit,
  })

  const {
    register,
    control,
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: defaultValues(),
    mode: 'onBlur',
  })

  useEffect(() => {
    if (!existing) return
    reset({
      name: existing.name ?? '',
      code: existing.code ?? '',
      vendor_type: existing.vendor_type ?? 'SUPPLIER',
      gstin: existing.gstin ?? '',
      pan_no: existing.pan_no ?? '',
      tan_no: existing.tan_no ?? '',
      remarks: existing.remarks ?? '',
      contact_person: existing.contact_person ?? '',
      designation: existing.designation ?? '',
      mobile: existing.mobile ?? '',
      email: existing.email ?? '',
      mobile2: existing.mobile2 ?? '',
      email2: existing.email2 ?? '',
      address: existing.address ?? '',
      city: existing.city ?? '',
      state: existing.state ?? '',
      pin_code: existing.pin_code ?? '',
      bank_name: existing.bank_name ?? '',
      bank_branch: existing.bank_branch ?? '',
      account_no: existing.account_no ?? '',
      ifsc_code: existing.ifsc_code ?? '',
      account_type: existing.account_type ?? '',
      payment_term: existing.payment_term ?? '',
      credit_limit: existing.credit_limit != null ? Number(existing.credit_limit) : undefined,
      opening_balance: existing.opening_balance != null ? Number(existing.opening_balance) : undefined,
    })
  }, [existing, reset])

  const vendorType = watch('vendor_type')
  const accountType = watch('account_type')

  async function onSubmit(values: VendorFormValues) {
    setSubmitting(true)
    try {
      const payload = { ...values, code: values.code || undefined }
      let vendorId = id
      if (isEdit && id) {
        await api.put(`/masters/vendors/${id}`, payload)
      } else {
        const res = await api.post('/masters/vendors', payload)
        vendorId = res.data?.data?.id
      }
      await queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] })
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      queryClient.invalidateQueries({ queryKey: ['vendor-history-summary', vendorId] })
      toast({ variant: 'success', title: 'Vendor saved successfully' })
      navigate(`/masters/vendors/${vendorId}`)
    } catch (e: any) {
      toast({
        variant: 'error',
        title: 'Something went wrong',
        description: e?.response?.data?.error ?? 'Please check the form and try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Vendor${existing?.name ? ` — ${existing.name}` : ''}` : 'New Vendor'}
        subtitle={isEdit ? 'Update vendor master details' : 'Add a new supplier or transporter'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading vendor...
        </div>
      )}

      <form className="pb-4">
        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact">Contact & Address</TabsTrigger>
            <TabsTrigger value="bank">Bank Details</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          {/* TAB 1 — Basic Info */}
          <TabsContent value="basic">
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
              <Field label="Vendor Name" required error={errors.name?.message}>
                <input {...register('name')} className={inputClass(!!errors.name)} placeholder="e.g. Shree Cement Ltd." />
              </Field>
              <Field label="Vendor Code" hint="Leave blank to auto-generate">
                <input {...register('code')} className={inputClass(false, 'font-mono')} placeholder="Auto-generated" />
              </Field>
              <Field label="Vendor Type" required error={errors.vendor_type?.message}>
                <ToggleGroup
                  value={vendorType}
                  onChange={v => setValue('vendor_type', v as VendorFormValues['vendor_type'], { shouldValidate: true })}
                  options={[
                    { value: 'SUPPLIER', label: 'Supplier' },
                    { value: 'TRANSPORTER', label: 'Transporter' },
                    { value: 'BOTH', label: 'Both' },
                  ]}
                />
              </Field>
              <div />
              <Field label="GSTIN" error={errors.gstin?.message} hint={!errors.gstin ? '15 characters, e.g. 29 ABCDE 1234 F 1 Z 5' : undefined}>
                <Controller
                  control={control}
                  name="gstin"
                  render={({ field }) => {
                    const raw = (field.value ?? '').toUpperCase()
                    const valid = raw.length === 15 && GSTIN_RE.test(raw) && !errors.gstin
                    return (
                      <div className="relative">
                        <input
                          value={formatGstinGroups(raw)}
                          onChange={e => {
                            const next = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15)
                            field.onChange(next)
                          }}
                          onBlur={field.onBlur}
                          placeholder="15-character GSTIN"
                          className={inputClass(!!errors.gstin, 'pr-8 font-mono uppercase')}
                        />
                        {valid && (
                          <CheckCircle2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-600" />
                        )}
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
                    <input
                      {...field}
                      value={field.value ?? ''}
                      onChange={uppercaseOnChange(field.onChange)}
                      placeholder="AAAAA0000A"
                      className={inputClass(!!errors.pan_no, 'font-mono uppercase')}
                    />
                  )}
                />
              </Field>
              <Field label="TAN No">
                <Controller
                  control={control}
                  name="tan_no"
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      onChange={uppercaseOnChange(field.onChange)}
                      className={inputClass(false, 'font-mono uppercase')}
                    />
                  )}
                />
              </Field>
              <div className="lg:col-span-2">
                <label className="field-label">Remarks</label>
                <textarea
                  rows={3}
                  {...register('remarks')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB 2 — Contact & Address */}
          <TabsContent value="contact">
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
              <SectionHeader label="Contact" />
              <Field label="Contact Person">
                <input {...register('contact_person')} className={inputClass(false)} />
              </Field>
              <Field label="Designation">
                <input {...register('designation')} className={inputClass(false)} />
              </Field>
              <Field label="Mobile" error={errors.mobile?.message}>
                <input {...register('mobile')} className={inputClass(!!errors.mobile, 'font-mono')} placeholder="10-digit mobile" />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <input type="email" {...register('email')} className={inputClass(!!errors.email)} />
              </Field>
              <Field label="Mobile 2" error={errors.mobile2?.message}>
                <input {...register('mobile2')} className={inputClass(!!errors.mobile2, 'font-mono')} />
              </Field>
              <Field label="Email 2" error={errors.email2?.message}>
                <input type="email" {...register('email2')} className={inputClass(!!errors.email2)} />
              </Field>

              <SectionHeader label="Address" />
              <div className="lg:col-span-2">
                <label className="field-label">Address</label>
                <textarea
                  rows={2}
                  {...register('address')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <Field label="City">
                <input {...register('city')} className={inputClass(false)} />
              </Field>
              <Field label="State">
                <select {...register('state')} className={inputClass(false)}>
                  <option value="">Select state...</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="PIN Code" error={errors.pin_code?.message}>
                <input {...register('pin_code')} className={inputClass(!!errors.pin_code, 'font-mono')} placeholder="6-digit PIN" />
              </Field>
            </div>
          </TabsContent>

          {/* TAB 3 — Bank Details */}
          <TabsContent value="bank">
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
              <Field label="Bank Name">
                <input {...register('bank_name')} className={inputClass(false)} />
              </Field>
              <Field label="Bank Branch">
                <input {...register('bank_branch')} className={inputClass(false)} />
              </Field>
              <Field label="Account No">
                <div className="relative">
                  <input
                    type={showAccountNo ? 'text' : 'password'}
                    autoComplete="off"
                    {...register('account_no')}
                    className={inputClass(false, 'pr-9 font-mono')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountNo(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showAccountNo ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
              <Field label="IFSC Code" error={errors.ifsc_code?.message} hint={!errors.ifsc_code ? 'e.g. SBIN0001234' : undefined}>
                <Controller
                  control={control}
                  name="ifsc_code"
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      onChange={uppercaseOnChange(field.onChange)}
                      className={inputClass(!!errors.ifsc_code, 'font-mono uppercase')}
                    />
                  )}
                />
              </Field>
              <Field label="Account Type">
                <ToggleGroup
                  value={accountType || ''}
                  onChange={v => setValue('account_type', v)}
                  options={[
                    { value: 'Current', label: 'Current' },
                    { value: 'Savings', label: 'Savings' },
                    { value: 'CC', label: 'CC' },
                  ]}
                />
              </Field>
            </div>
          </TabsContent>

          {/* TAB 4 — Financial */}
          <TabsContent value="financial">
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
              <Field label="Payment Term">
                <select {...register('payment_term')} className={inputClass(false)}>
                  <option value="">Select term...</option>
                  {PAYMENT_TERMS.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <div />
              <Field label="Credit Limit">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    {...register('credit_limit', { valueAsNumber: true })}
                    className={inputClass(false, 'pl-6 text-right font-mono')}
                  />
                </div>
              </Field>
              <Field label="Opening Balance">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    {...register('opening_balance', { valueAsNumber: true })}
                    className={inputClass(false, 'pl-6 text-right font-mono')}
                  />
                </div>
              </Field>

              {isEdit && summary && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs lg:col-span-2">
                  <div className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-3">
                    <span className="text-gray-500">
                      Total POs: <span className="font-mono text-gray-800">{summary.total_pos}</span>{' '}
                      <span className="font-mono text-gray-800">₹{formatINR(summary.total_pos_amount)}</span>
                    </span>
                    <span className="text-gray-500">
                      Total Paid: <span className="font-mono text-gray-800">₹{formatINR(summary.total_paid)}</span>
                    </span>
                    <span className="text-gray-500">
                      Outstanding: <span className="font-mono font-semibold text-gray-900">₹{formatINR(summary.outstanding)}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* FOOTER */}
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/masters/vendors" className="text-xs text-gray-500 hover:text-gray-800">
            ← Back
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/masters/vendors')}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit(onSubmit)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save Vendor'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
