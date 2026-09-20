import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, ToggleGroup, inputClass } from '@/components/shared/form-controls'
import { getLastUsedVehicle, getLastUsedDriver, rememberLastUsed } from '@/lib/smartDefaults'
import CreditStatusBanner from '@/components/shared/CreditStatusBanner'
import CreditOverrideDialog, { readCreditBlock, type CreditBlockDetails } from '@/components/shared/CreditOverrideDialog'
import DispatchEtaPanel from '@/components/shared/DispatchEtaPanel'

interface LookupCustomer { id: string; name: string; mobile: string }
interface LookupVehicle { id: string; vehicle_no: string; vehicle_type: string; capacity: string }
interface LookupDriver { id: string; name: string; mobile: string; license_no: string | null }
interface LookupGrade {
  id: string
  grade_name: string
  grade_code: string | null
  cement_qty: string | null
  mm20_qty: string | null
  mm10_qty: string | null
  water_qty: string | null
  admix_qty: string | null
  total_weight: string | null
}
interface ChallanLookups {
  customers: LookupCustomer[]
  vehicles: LookupVehicle[]
  drivers: LookupDriver[]
  grades: LookupGrade[]
}
interface PendingSchedule {
  id: string
  sch_no: string
  date: string
  customer_id: string
  customer_name: string | null
  job_site: string
  grade_name: string | null
  qty: string
  pump_type: string
}

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

const challanSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  dispatch_time: z.string().min(1, 'Dispatch time is required'),
  customer_id: z.string().min(1, 'Customer is required'),
  job_site: z.string().min(1, 'Job site is required'),
  schedule_id: z.string().optional(),
  order_no: z.string().optional(),
  grade_id: z.string().optional(),
  grade_name: z.string().min(1, 'Grade is required'),
  qty: z.preprocess(
    v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.coerce.number({ required_error: 'Qty is required', invalid_type_error: 'Qty is required' })
      .min(0.001, 'Minimum 0.001')
      .max(99.999, 'Maximum 99.999')
  ),
  pump_type: z.enum(['WITHOUT_PUMP', 'WITH_PUMP'], { required_error: 'Pump type is required' }),
  pump_no: z.string().optional(),
  slump: optionalNumber,
  vehicle_id: z.string().min(1, 'Vehicle is required'),
  driver_id: z.string().min(1, 'Driver is required'),
  helper: z.string().optional(),
  start_km: optionalNumber,
  end_km: optionalNumber,
  open_rmc: optionalNumber,
  curr_rmc: optionalNumber,
  gross_weight: optionalNumber,
  tare_weight: optionalNumber,
  tax_type: z.enum(['GST', 'NON_GST'], { required_error: 'Tax type is required' }),
  rate: optionalNumber,
  inv_rate: optionalNumber,
  toll_tax: optionalNumber,
  remarks: z.string().optional(),
})

type ChallanFormValues = z.infer<typeof challanSchema>

function defaultValues(): ChallanFormValues {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const branchId = authStore.getUser()?.branch?.id
  return {
    date: now.toISOString().slice(0, 10),
    dispatch_time: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
    customer_id: '',
    job_site: '',
    schedule_id: '',
    order_no: '',
    grade_id: '',
    grade_name: '',
    qty: undefined as unknown as number,
    pump_type: 'WITHOUT_PUMP',
    pump_no: '',
    slump: undefined,
    vehicle_id: getLastUsedVehicle(branchId),
    driver_id: getLastUsedDriver(branchId),
    helper: '',
    start_km: undefined,
    end_km: undefined,
    open_rmc: undefined,
    curr_rmc: undefined,
    gross_weight: undefined,
    tare_weight: undefined,
    tax_type: 'GST',
    rate: undefined,
    inv_rate: undefined,
    toll_tax: undefined,
    remarks: '',
  }
}

function num(v: number | undefined | null): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0
}

function toNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function MixDesignCard({ grade }: { grade: LookupGrade }) {
  const cement = toNum(grade.cement_qty)
  const water = toNum(grade.water_qty)
  const admix = toNum(grade.admix_qty)
  const mm20 = toNum(grade.mm20_qty)
  const mm10 = toNum(grade.mm10_qty)
  const weight = toNum(grade.total_weight)
  const wc = cement && water ? (water / cement).toFixed(2) : '—'
  return (
    <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs">
      <p className="mb-1.5 font-medium text-gray-700">Mix Design — {grade.grade_name}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-gray-600 sm:grid-cols-3">
        <span>Cement: {cement ?? '—'}kg</span>
        <span>Water: {water ?? '—'}L</span>
        <span>W/C: {wc}</span>
        <span>20mm: {mm20 ?? '—'}kg</span>
        <span>10mm: {mm10 ?? '—'}kg</span>
        <span />
        <span>Admix: {admix ?? '—'}L</span>
        <span>Weight: {weight ?? '—'}kg</span>
      </div>
    </div>
  )
}

export default function ChallanFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState<'draft' | 'post' | null>(null)
  // Set when POST /:id/post comes back 409 CREDIT_BLOCKED — holds the id to
  // retry against so CreditOverrideDialog's confirm doesn't need to redo the
  // create-then-post dance, just re-call /post with the override.
  const [creditBlock, setCreditBlock] = useState<{ challanId: string; message: string; details: CreditBlockDetails } | null>(null)
  const [overriding, setOverriding] = useState(false)
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const { data: lookups, isLoading: lookupsLoading } = useQuery({
    queryKey: ['challan-lookups'],
    queryFn: () => api.get('/sales/challans/lookups').then(r => r.data.data as ChallanLookups),
    staleTime: 5 * 60_000,
  })

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['challan', id],
    queryFn: () => api.get(`/sales/challans/${id}`).then(r => r.data.data),
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
  } = useForm<ChallanFormValues>({
    resolver: zodResolver(challanSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      date: existing.date?.slice(0, 10) ?? defaultValues().date,
      dispatch_time: existing.dispatch_time?.slice(0, 16) ?? defaultValues().dispatch_time,
      customer_id: existing.customer_id ?? '',
      job_site: existing.job_site ?? '',
      schedule_id: existing.schedule_id ?? '',
      order_no: existing.order_no ?? '',
      grade_id: existing.grade_id ?? '',
      grade_name: existing.grade_name ?? '',
      qty: existing.qty != null ? Number(existing.qty) : (undefined as unknown as number),
      pump_type: existing.pump_type ?? 'WITHOUT_PUMP',
      pump_no: existing.pump_no ?? '',
      slump: existing.slump != null ? Number(existing.slump) : undefined,
      vehicle_id: existing.vehicle_id ?? '',
      driver_id: existing.driver_id ?? '',
      helper: existing.helper ?? '',
      start_km: existing.start_km != null ? Number(existing.start_km) : undefined,
      end_km: existing.end_km != null ? Number(existing.end_km) : undefined,
      open_rmc: existing.open_rmc != null ? Number(existing.open_rmc) : undefined,
      curr_rmc: existing.curr_rmc != null ? Number(existing.curr_rmc) : undefined,
      gross_weight: existing.gross_weight != null ? Number(existing.gross_weight) : undefined,
      tare_weight: existing.tare_weight != null ? Number(existing.tare_weight) : undefined,
      tax_type: existing.tax_type ?? 'GST',
      rate: existing.rate != null ? Number(existing.rate) : undefined,
      inv_rate: existing.inv_rate != null ? Number(existing.inv_rate) : undefined,
      toll_tax: existing.toll_tax != null ? Number(existing.toll_tax) : undefined,
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  const date = watch('date')
  const jobSite = watch('job_site')
  const pumpType = watch('pump_type')
  const taxType = watch('tax_type')
  const gradeId = watch('grade_id')
  const gradeName = watch('grade_name')
  const startKm = watch('start_km')
  const endKm = watch('end_km')
  const openRmc = watch('open_rmc')
  const currRmc = watch('curr_rmc')
  const grossWeight = watch('gross_weight')
  const tareWeight = watch('tare_weight')
  const qty = watch('qty')
  const rate = watch('rate')
  const tollTax = watch('toll_tax')
  const vehicleId = watch('vehicle_id')
  const customerId = watch('customer_id')

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['pending-schedules', date],
    queryFn: () => api.get('/sales/challans/pending-schedules', { params: { date } }).then(r => r.data.data as PendingSchedule[]),
    enabled: !!date,
  })

  // Rate contracts — auto-fill Rate when this customer+grade combo has an agreed rate.
  const { data: rateContract } = useQuery({
    queryKey: ['rate-contract', customerId, gradeName],
    queryFn: () => api.get('/masters/customer-rates/lookup', { params: { customer_id: customerId, grade_name: gradeName } }).then(r => r.data.data as { id: string; rate: string } | null),
    enabled: !!customerId && !!gradeName,
    staleTime: 30_000,
  })
  useEffect(() => {
    if (rateContract?.rate && !rate) setValue('rate', Number(rateContract.rate), { shouldValidate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateContract])

  // Conflict detection — is this vehicle already out on another undelivered trip?
  const { data: vehicleChallans } = useQuery({
    queryKey: ['vehicle-open-challans', vehicleId],
    queryFn: () => api.get('/sales/challans', { params: { vehicle_id: vehicleId, limit: 5 } }).then(r => r.data.data.data as any[]),
    enabled: !!vehicleId,
    staleTime: 15_000,
  })
  const vehicleConflict = useMemo(() => {
    if (!vehicleChallans) return null
    return vehicleChallans.find(c => c.id !== id && ['DRAFT', 'ACTIVE'].includes(c.status) && !c.site_out) ?? null
  }, [vehicleChallans, id])

  const selectedGrade = useMemo(() => {
    if (!lookups) return null
    return lookups.grades.find(g => g.id === gradeId) ?? lookups.grades.find(g => g.grade_name === gradeName) ?? null
  }, [lookups, gradeId, gradeName])

  const distance = num(endKm) - num(startKm)
  const totalRmc = num(currRmc) - num(openRmc)
  const subtotal = num(qty) * num(rate)
  const invoiceTotal = subtotal + num(tollTax)

  async function onSubmit(values: ChallanFormValues, intent: 'draft' | 'post') {
    setSubmitting(intent)
    try {
      const payload = {
        ...values,
        grade_id: values.grade_id || null,
        schedule_id: values.schedule_id || null,
      }
      let challanId = id
      if (isEdit && id) {
        await api.put(`/sales/challans/${id}`, { ...payload, status: 'DRAFT' })
      } else {
        const res = await api.post('/sales/challans', payload)
        challanId = res.data?.data?.id
      }
      if (intent === 'post' && challanId) {
        try {
          await api.post(`/sales/challans/${challanId}/post`)
        } catch (postErr: any) {
          const block = readCreditBlock(postErr)
          if (block) {
            // Challan itself saved fine as a Draft — only the dispatch step is
            // blocked, so surface the override dialog rather than a toast.
            setCreditBlock({ challanId, ...block })
            return
          }
          throw postErr
        }
      }
      rememberLastUsed(user?.branch?.id, values.vehicle_id, values.driver_id)
      toast({
        variant: 'success',
        title: intent === 'post' ? 'Challan posted' : 'Challan saved as draft',
        description: `Challan ${isEdit ? 'updated' : 'created'} successfully.`,
      })
      navigate('/sales/challans')
    } catch (e: any) {
      toast({
        variant: 'error',
        title: 'Something went wrong',
        description: e?.response?.data?.error ?? 'Please try again.',
      })
    } finally {
      setSubmitting(null)
    }
  }

  async function onOverrideCredit(reason: string) {
    if (!creditBlock) return
    setOverriding(true)
    try {
      await api.post(`/sales/challans/${creditBlock.challanId}/post`, { overrideCredit: true, overrideReason: reason })
      toast({ variant: 'success', title: 'Challan posted', description: 'Dispatched with a credit override — logged to the audit trail.' })
      setCreditBlock(null)
      navigate('/sales/challans')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Could not override', description: e?.response?.data?.error ?? 'Please try again.' })
    } finally {
      setOverriding(false)
    }
  }

  const isBusy = submitting !== null
  const isPostedChallan = isEdit && existing?.status === 'ACTIVE'

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Challan${existing?.challan_no ? ` ${existing.challan_no}` : ''}` : 'New Dispatch Challan'}
        subtitle={isEdit ? 'Update dispatch challan' : 'Create a new dispatch challan'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading challan...
        </div>
      )}

      {isPostedChallan && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="shrink-0" />
          This challan is already posted. Editing will reset it to Draft.
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          {/* SECTION A — Challan Info */}
          <SectionHeader label="Challan Info" />
          <Field label="Challan No" required>
            <input
              value={isEdit ? existing?.challan_no ?? '—' : 'Auto-generated'}
              readOnly
              className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500"
            />
          </Field>
          <Field label="Date" required error={errors.date?.message}>
            <input type="date" {...register('date')} className={inputClass(!!errors.date)} />
          </Field>
          <Field label="Branch" required>
            <input
              value={user?.branch?.name ?? '—'}
              readOnly
              className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500"
            />
          </Field>
          <Field label="Dispatch Time" required error={errors.dispatch_time?.message}>
            <input type="datetime-local" {...register('dispatch_time')} className={inputClass(!!errors.dispatch_time)} />
          </Field>

          {/* SECTION B — Customer & Site */}
          <SectionHeader label="Customer & Site" />
          <Field label="Customer" required error={errors.customer_id?.message}>
            <Controller
              control={control}
              name="customer_id"
              render={({ field }) => (
                <SearchableSelect
                  options={lookups?.customers ?? []}
                  value={field.value}
                  onChange={v => field.onChange(v)}
                  displayKey="name"
                  valueKey="id"
                  filterKeys={['name', 'mobile']}
                  loading={lookupsLoading}
                  placeholder="Search customer..."
                  error={!!errors.customer_id}
                  renderOption={c => (
                    <div className="flex items-center justify-between gap-2">
                      <span>{c.name}</span>
                      <span className="font-mono text-[11px] text-gray-400">{c.mobile}</span>
                    </div>
                  )}
                />
              )}
            />
            <CreditStatusBanner customerId={customerId} />
          </Field>
          <Field label="Job Site" required error={errors.job_site?.message}>
            <input {...register('job_site')} className={inputClass(!!errors.job_site)} placeholder="Site address" />
          </Field>
          <Field label="Schedule No">
            <Controller
              control={control}
              name="schedule_id"
              render={({ field }) => (
                <SearchableSelect
                  options={schedules ?? []}
                  value={field.value}
                  onChange={(v, opt) => {
                    field.onChange(v)
                    if (opt) {
                      setValue('customer_id', opt.customer_id, { shouldValidate: true })
                      setValue('job_site', opt.job_site, { shouldValidate: true })
                      setValue('grade_name', opt.grade_name ?? '', { shouldValidate: true })
                      const matchedGrade = lookups?.grades.find(g => g.grade_name === opt.grade_name)
                      setValue('grade_id', matchedGrade?.id ?? '')
                      setValue('qty', Number(opt.qty), { shouldValidate: true })
                    }
                  }}
                  displayKey="sch_no"
                  valueKey="id"
                  filterKeys={['sch_no', 'customer_name', 'job_site']}
                  loading={schedulesLoading}
                  placeholder="Pending schedules..."
                  renderOption={s => (
                    <div>
                      <div>{s.sch_no} — {s.customer_name ?? '—'}</div>
                      <div className="text-[11px] text-gray-400">{s.job_site} · {s.grade_name ?? '—'} · {s.qty} Cum</div>
                    </div>
                  )}
                />
              )}
            />
          </Field>
          <Field label="Order No">
            <input {...register('order_no')} className={inputClass(false)} placeholder="Optional" />
          </Field>

          {/* SECTION C — Concrete Details */}
          <SectionHeader label="Concrete Details" />
          <Field label="Grade" required error={errors.grade_name?.message}>
            <Controller
              control={control}
              name="grade_id"
              render={({ field }) => (
                <SearchableSelect
                  options={lookups?.grades ?? []}
                  value={field.value}
                  onChange={(v, opt) => {
                    field.onChange(v)
                    setValue('grade_name', opt?.grade_name ?? '', { shouldValidate: true })
                  }}
                  displayKey="grade_name"
                  valueKey="id"
                  loading={lookupsLoading}
                  placeholder="Search grade..."
                  error={!!errors.grade_name}
                />
              )}
            />
            {selectedGrade && <MixDesignCard grade={selectedGrade} />}
          </Field>
          <Field label="Qty (Cum)" required error={errors.qty?.message}>
            <input
              type="number"
              step="0.001"
              min="0.001"
              max="99.999"
              {...register('qty', { valueAsNumber: true })}
              className={inputClass(!!errors.qty, 'text-right font-mono')}
            />
            <DispatchEtaPanel jobSite={jobSite} qty={qty} />
          </Field>
          <Field label="Pump">
            <ToggleGroup
              value={pumpType}
              onChange={v => setValue('pump_type', v as ChallanFormValues['pump_type'], { shouldValidate: true })}
              options={[
                { value: 'WITHOUT_PUMP', label: 'Without Pump' },
                { value: 'WITH_PUMP', label: 'With Pump' },
              ]}
            />
          </Field>
          {pumpType === 'WITH_PUMP' && (
            <Field label="Pump No">
              <input {...register('pump_no')} className={inputClass(false)} placeholder="Pump vehicle no." />
            </Field>
          )}
          <Field label="Slump">
            <input
              type="number"
              step="0.01"
              {...register('slump', { valueAsNumber: true })}
              className={inputClass(false, 'text-right font-mono')}
            />
          </Field>

          {/* SECTION D — Vehicle & Driver */}
          <SectionHeader label="Vehicle & Driver" />
          <Field label="Vehicle No" required error={errors.vehicle_id?.message}>
            <Controller
              control={control}
              name="vehicle_id"
              render={({ field }) => (
                <SearchableSelect
                  options={lookups?.vehicles ?? []}
                  value={field.value}
                  onChange={v => field.onChange(v)}
                  displayKey="vehicle_no"
                  valueKey="id"
                  filterKeys={['vehicle_no', 'vehicle_type']}
                  loading={lookupsLoading}
                  placeholder="Search vehicle..."
                  error={!!errors.vehicle_id}
                  renderOption={v => (
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono">{v.vehicle_no}</span>
                      <span className="text-[11px] text-gray-400">{v.vehicle_type} · {v.capacity} Cum</span>
                    </div>
                  )}
                />
              )}
            />
            {vehicleConflict && (
              <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                This vehicle is already out on {vehicleConflict.challan_no} ({vehicleConflict.status}, no Site Out recorded yet). Double-check before dispatching again.
              </p>
            )}
          </Field>
          <Field label="Driver" required error={errors.driver_id?.message}>
            <Controller
              control={control}
              name="driver_id"
              render={({ field }) => (
                <SearchableSelect
                  options={lookups?.drivers ?? []}
                  value={field.value}
                  onChange={v => field.onChange(v)}
                  displayKey="name"
                  valueKey="id"
                  filterKeys={['name', 'mobile']}
                  loading={lookupsLoading}
                  placeholder="Search driver..."
                  error={!!errors.driver_id}
                  renderOption={d => (
                    <div className="flex items-center justify-between gap-2">
                      <span>{d.name}</span>
                      <span className="font-mono text-[11px] text-gray-400">{d.mobile}</span>
                    </div>
                  )}
                />
              )}
            />
          </Field>
          <Field label="Helper">
            <input {...register('helper')} className={inputClass(false)} placeholder="Helper name" />
          </Field>
          <div />
          <Field label="Start KM">
            <input
              type="number"
              step="0.01"
              {...register('start_km', { valueAsNumber: true })}
              className={inputClass(false, 'text-right font-mono')}
            />
          </Field>
          <Field label="End KM">
            <input
              type="number"
              step="0.01"
              {...register('end_km', { valueAsNumber: true })}
              className={inputClass(false, 'text-right font-mono')}
            />
            <p className="mt-1 text-xs text-gray-500">
              Distance: <span className="font-mono text-gray-700">{distance.toFixed(2)} km</span>
            </p>
          </Field>

          {/* SECTION E — Drum Readings */}
          <SectionHeader label="Drum Readings" />
          <Field label="Open RMC">
            <input
              type="number"
              step="0.01"
              {...register('open_rmc', { valueAsNumber: true })}
              className={inputClass(false, 'text-right font-mono')}
            />
          </Field>
          <Field label="Current RMC">
            <input
              type="number"
              step="0.01"
              {...register('curr_rmc', { valueAsNumber: true })}
              className={inputClass(false, 'text-right font-mono')}
            />
            <p className="mt-1 text-xs text-gray-500">
              Total RMC: <span className="font-mono text-gray-700">{totalRmc.toFixed(2)}</span>
            </p>
          </Field>

          {/* SECTION E.1 — Weighbridge (optional; only plants with one will fill these in) */}
          <SectionHeader label="Weighbridge (optional)" />
          <Field label="Gross Weight (kg)">
            <input
              type="number"
              step="0.01"
              {...register('gross_weight', { valueAsNumber: true })}
              className={inputClass(false, 'text-right font-mono')}
            />
          </Field>
          <Field label="Tare Weight (kg)">
            <input
              type="number"
              step="0.01"
              {...register('tare_weight', { valueAsNumber: true })}
              className={inputClass(false, 'text-right font-mono')}
            />
            <p className="mt-1 text-xs text-gray-500">
              Net Weight: <span className="font-mono text-gray-700">
                {num(grossWeight) && num(tareWeight) ? (num(grossWeight) - num(tareWeight)).toFixed(2) : '—'}
              </span> kg
            </p>
          </Field>

          {/* SECTION F — Billing */}
          <SectionHeader label="Billing" />
          <Field label="Tax Type" required error={errors.tax_type?.message}>
            <ToggleGroup
              value={taxType}
              onChange={v => setValue('tax_type', v as ChallanFormValues['tax_type'], { shouldValidate: true })}
              options={[
                { value: 'GST', label: 'GST' },
                { value: 'NON_GST', label: 'NON-GST' },
              ]}
            />
          </Field>
          <Field label="Rate (₹ / Cum)">
            <input
              type="number"
              step="0.01"
              {...register('rate', { valueAsNumber: true })}
              className={inputClass(false, 'text-right font-mono')}
            />
          </Field>
          <Field label="Invoice Rate">
            <input
              type="number"
              step="0.01"
              {...register('inv_rate', { valueAsNumber: true })}
              className={inputClass(false, 'text-right font-mono')}
            />
          </Field>
          <Field label="Toll Tax">
            <input
              type="number"
              step="0.01"
              {...register('toll_tax', { valueAsNumber: true })}
              className={inputClass(false, 'text-right font-mono')}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs lg:col-span-2">
            <span className="text-gray-500">
              Subtotal: <span className="font-mono text-gray-800">₹{formatINR(subtotal)}</span>
            </span>
            <span className="text-gray-500">
              Invoice Total: <span className="font-mono font-semibold text-gray-900">₹{formatINR(invoiceTotal)}</span>
            </span>
          </div>

          {/* SECTION G — Remarks */}
          <SectionHeader label="Remarks" />
          <div className="lg:col-span-2">
            <textarea
              rows={3}
              {...register('remarks')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/sales/challans" className="text-xs text-gray-500 hover:text-gray-800">
            ← Back to List
          </Link>
          <div className="flex items-center gap-2">
            {isEdit && id && (
              <Link
                to={`/sales/challans/${id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Printer size={13} /> Print
              </Link>
            )}
            <button
              type="button"
              disabled={isBusy}
              onClick={handleSubmit(v => onSubmit(v, 'draft'))}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === 'draft' && <Loader2 size={13} className="animate-spin" />}
              {submitting === 'draft' ? 'Saving...' : isEdit ? 'Update Draft' : 'Save as Draft'}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleSubmit(v => onSubmit(v, 'post'))}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === 'post' && <Loader2 size={13} className="animate-spin" />}
              {submitting === 'post' ? 'Saving...' : isEdit ? 'Re-post Challan' : 'Post Challan'}
            </button>
          </div>
        </div>
      </form>

      {creditBlock && (
        <CreditOverrideDialog
          message={creditBlock.message}
          details={creditBlock.details}
          canOverride={isAdminOrManager}
          submitting={overriding}
          onCancel={() => setCreditBlock(null)}
          onOverride={onOverrideCredit}
        />
      )}
    </div>
  )
}
