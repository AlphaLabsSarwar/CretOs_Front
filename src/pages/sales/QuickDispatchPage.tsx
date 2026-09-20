import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, LogOut, Truck } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { permissionsStore } from '@/store/permissions'
import { useToast } from '@/components/shared/Toast'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { getLastUsedVehicle, getLastUsedDriver, rememberLastUsed } from '@/lib/smartDefaults'
import CreditStatusBanner from '@/components/shared/CreditStatusBanner'
import CreditOverrideDialog, { readCreditBlock, type CreditBlockDetails } from '@/components/shared/CreditOverrideDialog'
import DispatchEtaPanel from '@/components/shared/DispatchEtaPanel'

interface LookupCustomer { id: string; name: string; mobile: string }
interface LookupVehicle { id: string; vehicle_no: string; vehicle_type: string; capacity: string }
interface LookupDriver { id: string; name: string; mobile: string; license_no: string | null }
interface LookupGrade { id: string; grade_name: string; grade_code: string | null }
interface ChallanLookups {
  customers: LookupCustomer[]
  vehicles: LookupVehicle[]
  drivers: LookupDriver[]
  grades: LookupGrade[]
}

const quickSchema = z.object({
  vehicle_id: z.string().min(1, 'Pick a vehicle'),
  driver_id: z.string().min(1, 'Pick a driver'),
  customer_id: z.string().min(1, 'Pick a customer'),
  job_site: z.string().min(1, 'Job site is required'),
  grade_id: z.string().optional(),
  grade_name: z.string().min(1, 'Pick a grade'),
  qty: z.preprocess(
    v => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number({ required_error: 'Qty is required' }).min(0.001).max(99.999)
  ),
  pump_type: z.enum(['WITHOUT_PUMP', 'WITH_PUMP']),
})
type QuickFormValues = z.infer<typeof quickSchema>

function emptyValues(branchId: string | undefined): QuickFormValues {
  return {
    vehicle_id: getLastUsedVehicle(branchId),
    driver_id: getLastUsedDriver(branchId),
    customer_id: '',
    job_site: '',
    grade_id: '',
    grade_name: '',
    qty: undefined as unknown as number,
    pump_type: 'WITHOUT_PUMP',
  }
}

const bigInput = 'h-14 w-full rounded-xl border-2 border-gray-200 px-4 text-lg focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent'

export default function QuickDispatchPage() {
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState(false)
  const [lastDispatched, setLastDispatched] = useState<string | null>(null)
  const vehicleTriggerRef = useRef<HTMLDivElement>(null)
  // See ChallanFormPage.tsx for the same pattern — a 409 CREDIT_BLOCKED from
  // POST /:id/post means the challan itself saved fine (it's sitting as a
  // Draft), only the dispatch step needs an Admin/Manager override.
  const [creditBlock, setCreditBlock] = useState<{ challanId: string; message: string; details: CreditBlockDetails } | null>(null)
  const [overriding, setOverriding] = useState(false)
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const { data: lookups, isLoading: lookupsLoading } = useQuery({
    queryKey: ['challan-lookups'],
    queryFn: () => api.get('/sales/challans/lookups').then(r => r.data.data as ChallanLookups),
    staleTime: 5 * 60_000,
  })

  const { control, register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<QuickFormValues>({
    resolver: zodResolver(quickSchema),
    defaultValues: emptyValues(user?.branch?.id),
  })
  const customerId = watch('customer_id')
  const jobSite = watch('job_site')
  const qty = watch('qty')

  async function onSubmit(values: QuickFormValues) {
    setSubmitting(true)
    try {
      const now = new Date().toISOString().slice(0, 16)
      const res = await api.post('/sales/challans', {
        ...values,
        grade_id: values.grade_id || null,
        date: now.slice(0, 10),
        dispatch_time: now,
        tax_type: 'GST',
      })
      const challanId = res.data?.data?.id
      const challanNo = res.data?.data?.challan_no
      if (challanId) {
        try {
          await api.post(`/sales/challans/${challanId}/post`)
        } catch (postErr: any) {
          const block = readCreditBlock(postErr)
          if (block) {
            setCreditBlock({ challanId, ...block })
            return
          }
          throw postErr
        }
      }
      rememberLastUsed(user?.branch?.id, values.vehicle_id, values.driver_id)
      setLastDispatched(challanNo)
      toast({ variant: 'success', title: `Dispatched — ${challanNo}` })
      // Reset for the next truck — keep vehicle/driver blank so the operator picks the next one fresh,
      // but customer/site/grade often repeat back-to-back, so leave those as-is.
      reset({ ...emptyValues(user?.branch?.id), customer_id: values.customer_id, job_site: values.job_site, grade_id: values.grade_id, grade_name: values.grade_name, pump_type: values.pump_type })
    } catch (e: any) {
      toast({ variant: 'error', title: 'Could not dispatch', description: e?.response?.data?.error ?? 'Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function onOverrideCredit(reason: string) {
    if (!creditBlock) return
    setOverriding(true)
    try {
      await api.post(`/sales/challans/${creditBlock.challanId}/post`, { overrideCredit: true, overrideReason: reason })
      toast({ variant: 'success', title: 'Dispatched with credit override', description: 'Logged to the audit trail.' })
      setCreditBlock(null)
    } catch (e: any) {
      toast({ variant: 'error', title: 'Could not override', description: e?.response?.data?.error ?? 'Please try again.' })
    } finally {
      setOverriding(false)
    }
  }

  useEffect(() => { document.title = 'Quick Dispatch — CretOS' }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent"><Truck size={16} className="text-white" /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Quick Dispatch</p>
            <p className="text-xs text-gray-400">{user?.branch?.name ?? 'Branch'} · {user?.name}</p>
          </div>
        </div>
        <button
          onClick={() => { authStore.clear(); permissionsStore.clear(); window.location.href = '/login' }}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {lastDispatched && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 size={18} /> Last dispatched: <span className="font-mono font-medium">{lastDispatched}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div ref={vehicleTriggerRef}>
            <label className="mb-1 block text-sm font-medium text-gray-700">Vehicle</label>
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
                  filterKeys={['vehicle_no']}
                  loading={lookupsLoading}
                  placeholder="Scan or search vehicle..."
                  error={!!errors.vehicle_id}
                />
              )}
            />
            {errors.vehicle_id && <p className="mt-1 text-xs text-red-600">{errors.vehicle_id.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Driver</label>
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
                />
              )}
            />
            {errors.driver_id && <p className="mt-1 text-xs text-red-600">{errors.driver_id.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Customer</label>
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
                />
              )}
            />
            {errors.customer_id && <p className="mt-1 text-xs text-red-600">{errors.customer_id.message}</p>}
            <CreditStatusBanner customerId={customerId} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Job Site</label>
            <input {...register('job_site')} className={bigInput} placeholder="Site address" />
            {errors.job_site && <p className="mt-1 text-xs text-red-600">{errors.job_site.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Grade</label>
            <Controller
              control={control}
              name="grade_id"
              render={({ field }) => (
                <SearchableSelect
                  options={lookups?.grades ?? []}
                  value={field.value}
                  onChange={(v, opt) => { field.onChange(v); setValue('grade_name', opt?.grade_name ?? '', { shouldValidate: true }) }}
                  displayKey="grade_name"
                  valueKey="id"
                  loading={lookupsLoading}
                  placeholder="Search grade..."
                  error={!!errors.grade_name}
                />
              )}
            />
            {errors.grade_name && <p className="mt-1 text-xs text-red-600">{errors.grade_name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Quantity (Cum)</label>
            <input type="number" step="0.001" inputMode="decimal" {...register('qty', { valueAsNumber: true })} className={`${bigInput} font-mono`} />
            {errors.qty && <p className="mt-1 text-xs text-red-600">{errors.qty.message}</p>}
            <DispatchEtaPanel jobSite={jobSite} qty={qty} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pump</label>
            <Controller
              control={control}
              name="pump_type"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {(['WITHOUT_PUMP', 'WITH_PUMP'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => field.onChange(v)}
                      className={`h-12 rounded-xl border-2 text-sm font-medium transition-colors ${field.value === v ? 'border-accent bg-accent text-white' : 'border-gray-200 text-gray-600'}`}
                    >
                      {v === 'WITH_PUMP' ? 'With Pump' : 'Without Pump'}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-14 w-full rounded-xl bg-accent text-base font-semibold text-white shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Dispatching...' : 'Dispatch Truck'}
          </button>
        </form>
      </main>

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
