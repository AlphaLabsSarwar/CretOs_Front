import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRightCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'
import { StatusBadge } from '@/components/shared/DataTable'

interface LookupCustomer { id: string; name: string; mobile: string | null }

const MOBILE_RE = /^[0-9]{10}$/
const SOURCES = ['REFERRAL', 'REPEAT_CUSTOMER', 'WEBSITE', 'GOVT_TENDER', 'SITE_VISIT', 'OTHER']
const GRADES = ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40', 'M-45', 'M-50']
const TERMINAL_STATUSES = ['WON', 'LOST', 'CANCELLED']

const tenderSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  customer_id: z.string().optional(),
  customer_name: z.string().min(1, 'Customer / prospect name is required'),
  contact_person: z.string().optional(),
  mobile: z.string().optional().refine(v => !v || MOBILE_RE.test(v), { message: 'Must be 10 digits' }),
  email: z.string().optional().refine(v => !v || z.string().email().safeParse(v).success, { message: 'Invalid email address' }),
  project_site: z.string().min(1, 'Project / site is required'),
  source: z.string().optional(),
  scope_description: z.string().optional(),
  estimated_qty: z.preprocess(v => (v === '' || v === null || v === undefined ? undefined : v), z.coerce.number().optional()),
  grade_requirement: z.string().optional(),
  submission_deadline: z.string().optional(),
  estimated_value: z.preprocess(v => (v === '' || v === null || v === undefined ? undefined : v), z.coerce.number().optional()),
  remarks: z.string().optional(),
})
type TenderFormValues = z.infer<typeof tenderSchema>

function defaultValues(): TenderFormValues {
  return {
    date: new Date().toISOString().slice(0, 10),
    customer_id: '', customer_name: '', contact_person: '', mobile: '', email: '',
    project_site: '', source: '', scope_description: '', estimated_qty: undefined,
    grade_requirement: '', submission_deadline: '', estimated_value: undefined, remarks: '',
  }
}

export default function TenderFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [lostReasonDraft, setLostReasonDraft] = useState('')
  const [showLostPrompt, setShowLostPrompt] = useState(false)

  const { data: lookups, isLoading: lookupsLoading } = useQuery({
    queryKey: ['tenders-lookups'],
    queryFn: () => api.get('/marketing/tenders/lookups').then(r => r.data.data.customers as LookupCustomer[]),
    staleTime: 5 * 60_000,
  })

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['tender', id],
    queryFn: () => api.get(`/marketing/tenders/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, control, reset, setValue, handleSubmit, formState: { errors } } = useForm<TenderFormValues>({
    resolver: zodResolver(tenderSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      date: existing.date?.slice(0, 10) ?? defaultValues().date,
      customer_id: existing.customer_id ?? '',
      customer_name: existing.customer_name ?? '',
      contact_person: existing.contact_person ?? '',
      mobile: existing.mobile ?? '',
      email: existing.email ?? '',
      project_site: existing.project_site ?? '',
      source: existing.source ?? '',
      scope_description: existing.scope_description ?? '',
      estimated_qty: existing.estimated_qty != null ? Number(existing.estimated_qty) : undefined,
      grade_requirement: existing.grade_requirement ?? '',
      submission_deadline: existing.submission_deadline?.slice(0, 10) ?? '',
      estimated_value: existing.estimated_value != null ? Number(existing.estimated_value) : undefined,
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  const isTerminal = isEdit && TERMINAL_STATUSES.includes(existing?.status)
  const isReadOnly = isTerminal

  async function onSubmit(values: TenderFormValues) {
    setSubmitting(true)
    try {
      const payload = { ...values, customer_id: values.customer_id || undefined }
      if (isEdit && id) {
        await api.put(`/marketing/tenders/${id}`, payload)
      } else {
        await api.post('/marketing/tenders', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
      queryClient.invalidateQueries({ queryKey: ['tender', id] })
      toast({ variant: 'success', title: 'RFQ saved' })
      navigate('/marketing/tenders')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const statusMutation = useMutation({
    mutationFn: (body: { status: string; lostReason?: string }) => api.patch(`/marketing/tenders/${id}/status`, body),
    onSuccess: (_res, vars) => {
      toast({ variant: 'success', title: `Marked as ${vars.status}` })
      queryClient.invalidateQueries({ queryKey: ['tender', id] })
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
      setShowLostPrompt(false)
      setLostReasonDraft('')
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not update status', description: e?.response?.data?.error }),
  })

  const convertMutation = useMutation({
    mutationFn: () => api.post(`/marketing/tenders/${id}/convert-to-quotation`),
    onSuccess: (res) => {
      toast({ variant: 'success', title: 'Converted to quotation' })
      const quotationId = res.data?.data?.id
      queryClient.invalidateQueries({ queryKey: ['tender', id] })
      if (quotationId) navigate(`/marketing/quotations/${quotationId}/edit`)
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not convert', description: e?.response?.data?.error }),
  })

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit RFQ${existing?.tender_no ? ` ${existing.tender_no}` : ''}` : 'Log RFQ'}
        subtitle={isEdit ? 'Update this inquiry / bid invitation' : 'Track an inquiry before it is worth pricing as a Quotation'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading RFQ...
        </div>
      )}

      {isEdit && existing && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-xs text-gray-500">Status:</span>
          <StatusBadge status={existing.status} />
          {existing.lost_reason && <span className="text-xs text-gray-500">— {existing.lost_reason}</span>}
          {existing.converted_quot_no && (
            <Link to={`/marketing/quotations`} className="text-xs text-accent hover:underline">
              Converted to quotation {existing.converted_quot_no}
            </Link>
          )}
          {!isTerminal && (
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {existing.status === 'NEW' && (
                <button type="button" onClick={() => statusMutation.mutate({ status: 'IN_REVIEW' })} className="rounded-lg border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100">
                  Mark In Review
                </button>
              )}
              {!existing.converted_quotation_id && (
                <button
                  type="button"
                  disabled={convertMutation.isPending}
                  onClick={() => convertMutation.mutate()}
                  className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  <ArrowRightCircle size={12} /> Convert to Quotation
                </button>
              )}
              <button type="button" onClick={() => statusMutation.mutate({ status: 'WON' })} className="rounded-lg border border-green-300 px-2.5 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50">
                Mark Won
              </button>
              <button type="button" onClick={() => setShowLostPrompt(true)} className="rounded-lg border border-red-300 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">
                Mark Lost
              </button>
            </div>
          )}
        </div>
      )}

      {showLostPrompt && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <label className="mb-1 block text-xs font-medium text-red-800">Why was this RFQ lost?</label>
          <div className="flex items-center gap-2">
            <input value={lostReasonDraft} onChange={e => setLostReasonDraft(e.target.value)} placeholder="e.g. Lost on price to a competitor" className="h-8 flex-1 rounded-lg border border-red-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-400" />
            <button
              type="button"
              disabled={!lostReasonDraft.trim() || statusMutation.isPending}
              onClick={() => statusMutation.mutate({ status: 'LOST', lostReason: lostReasonDraft.trim() })}
              className="h-8 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Confirm
            </button>
            <button type="button" onClick={() => setShowLostPrompt(false)} className="h-8 rounded-lg border border-gray-300 px-3 text-xs text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isReadOnly && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          This RFQ is {existing?.status} and can no longer be edited.
        </div>
      )}

      <form className="pb-4">
        <fieldset disabled={isReadOnly} className="disabled:opacity-60">
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
            <SectionHeader label="RFQ Info" />
            <Field label="RFQ No">
              <input value={isEdit ? existing?.tender_no ?? '—' : 'Auto-generated'} readOnly className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500" />
            </Field>
            <Field label="Date" required error={errors.date?.message}>
              <input type="date" {...register('date')} className={inputClass(!!errors.date)} />
            </Field>
            <Field label="Source">
              <select {...register('source')} className={inputClass(false)}>
                <option value="">Select source...</option>
                {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Submission Deadline">
              <input type="date" {...register('submission_deadline')} className={inputClass(false)} />
            </Field>

            <SectionHeader label="Prospect / Customer" />
            <Field label="Link Existing Customer" hint="Optional — leave blank for a new prospect">
              <Controller
                control={control}
                name="customer_id"
                render={({ field }) => (
                  <SearchableSelect
                    options={lookups ?? []}
                    value={field.value}
                    onChange={(v, opt) => {
                      field.onChange(v)
                      if (opt) {
                        setValue('customer_name', opt.name, { shouldValidate: true })
                        if (opt.mobile) setValue('mobile', opt.mobile)
                      }
                    }}
                    displayKey="name"
                    valueKey="id"
                    filterKeys={['name', 'mobile']}
                    loading={lookupsLoading}
                    placeholder="Search existing customers..."
                  />
                )}
              />
            </Field>
            <Field label="Customer / Prospect Name" required error={errors.customer_name?.message}>
              <input id="customer_name" {...register('customer_name')} className={inputClass(!!errors.customer_name)} placeholder="Company or individual name" />
            </Field>
            <Field label="Contact Person">
              <input {...register('contact_person')} className={inputClass(false)} />
            </Field>
            <Field label="Mobile" error={errors.mobile?.message}>
              <input {...register('mobile')} className={inputClass(!!errors.mobile, 'font-mono')} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input type="email" {...register('email')} className={inputClass(!!errors.email)} />
            </Field>
            <div />

            <SectionHeader label="Scope" />
            <Field label="Project Site" required error={errors.project_site?.message}>
              <input {...register('project_site')} className={inputClass(!!errors.project_site)} placeholder="Site address / project name" />
            </Field>
            <Field label="Grade Requirement">
              <select {...register('grade_requirement')} className={inputClass(false)}>
                <option value="">Select grade...</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Estimated Qty (Cum)">
              <input type="number" step="0.01" {...register('estimated_qty', { valueAsNumber: true })} className={inputClass(false, 'text-right font-mono')} />
            </Field>
            <Field label="Estimated Value">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                <input type="number" step="0.01" {...register('estimated_value', { valueAsNumber: true })} className={inputClass(false, 'pl-6 text-right font-mono')} />
              </div>
            </Field>
            <div className="lg:col-span-2">
              <label className="field-label">Scope Description</label>
              <textarea rows={2} {...register('scope_description')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div className="lg:col-span-2">
              <label className="field-label">Remarks</label>
              <textarea rows={2} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
          </div>
        </fieldset>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/marketing/tenders" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
          {!isReadOnly && (
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : isEdit ? 'Update RFQ' : 'Save RFQ'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
