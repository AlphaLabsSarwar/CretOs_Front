import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Smartphone } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

const MOBILE_RE = /^[0-9]{10}$/
const PIN_RE = /^[0-9]{4,6}$/

const driverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mobile: z.string().optional().refine(v => !v || MOBILE_RE.test(v), { message: 'Must be 10 digits' }),
  license_no: z.string().optional(),
  driver_type: z.enum(['PERMANENT', 'CASUAL']),
})

type DriverFormValues = z.infer<typeof driverSchema>

function defaultValues(): DriverFormValues {
  return { name: '', mobile: '', license_no: '', driver_type: 'PERMANENT' }
}

// ─── App Access panel ────────────────────────────────────────────────────
// Separate from the main form/save flow, same pattern as the customer portal
// toggle: this hits its own endpoint (PUT /:id/app-access) immediately on
// click rather than being bundled into the driver's next Save, since setting
// a PIN is a distinct, sensitive action an office admin should confirm
// deliberately. Only shown once the driver already exists (needs an id and a
// saved mobile number to log in with).
function AppAccessPanel({ driverId, mobile, appEnabled }: { driverId: string; mobile: string | null; appEnabled: boolean }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function setPinAndEnable() {
    if (!mobile) { setPinError('Add a mobile number and save the driver first'); return }
    if (!PIN_RE.test(pin)) { setPinError('PIN must be 4-6 digits'); return }
    setPinError(null)
    setSaving(true)
    try {
      await api.put(`/masters/drivers/${driverId}/app-access`, { pin })
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] })
      toast({ variant: 'success', title: 'PIN set — app access enabled' })
      setPin('')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Could not set PIN', description: e?.response?.data?.error ?? 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function disableAccess() {
    setSaving(true)
    try {
      await api.put(`/masters/drivers/${driverId}/app-access`, { app_enabled: false })
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] })
      toast({ variant: 'success', title: 'App access disabled' })
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Smartphone size={15} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-800">Driver App Access</h3>
        {appEnabled
          ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">Enabled</span>
          : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Disabled</span>
        }
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Lets this driver sign in to the CretOS Driver app with their mobile number ({mobile ?? 'no mobile on file'}) and a 4-6 digit PIN you set here.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">{appEnabled ? 'Reset PIN' : 'Set PIN'}</label>
          <input
            type="text" inputMode="numeric" maxLength={6} value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="4-6 digits"
            className={inputClass(!!pinError, 'w-32 font-mono')}
          />
        </div>
        <button
          type="button" disabled={saving} onClick={setPinAndEnable}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          {appEnabled ? 'Reset PIN' : 'Set PIN & Enable'}
        </button>
        {appEnabled && (
          <button
            type="button" disabled={saving} onClick={disableAccess}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Disable Access
          </button>
        )}
      </div>
      {pinError && <p className="mt-1.5 text-[11px] text-red-600">{pinError}</p>}
    </div>
  )
}

export default function DriverFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['driver', id],
    queryFn: () => api.get(`/masters/drivers/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, reset, handleSubmit, watch, formState: { errors } } = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      name: existing.name ?? '',
      mobile: existing.mobile ?? '',
      license_no: existing.license_no ?? '',
      driver_type: existing.driver_type === 'CASUAL' ? 'CASUAL' : 'PERMANENT',
    })
  }, [existing, reset])

  async function onSubmit(values: DriverFormValues) {
    setSubmitting(true)
    try {
      if (isEdit && id) {
        await api.put(`/masters/drivers/${id}`, values)
      } else {
        await api.post('/masters/drivers', values)
      }
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      queryClient.invalidateQueries({ queryKey: ['driver', id] })
      toast({ variant: 'success', title: 'Driver saved successfully' })
      navigate('/masters/drivers')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Driver${existing?.name ? ` — ${existing.name}` : ''}` : 'New Driver'}
        subtitle={isEdit ? 'Update driver details' : 'Add a transit mixer driver'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading driver...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Driver Info" />
          <Field label="Name" required error={errors.name?.message}>
            <input {...register('name')} className={inputClass(!!errors.name)} placeholder="Driver's full name" />
          </Field>
          <Field label="Mobile" error={errors.mobile?.message}>
            <input {...register('mobile')} className={inputClass(!!errors.mobile, 'font-mono')} placeholder="10-digit mobile" />
          </Field>
          <Field label="License No">
            <input {...register('license_no')} className={inputClass(false, 'font-mono uppercase')} placeholder="Driving license number" />
          </Field>
          <Field label="Driver Type" hint="Casual — hired for a single trip or day, e.g. covering for someone on leave">
            <select {...register('driver_type')} className={inputClass(false)}>
              <option value="PERMANENT">Permanent</option>
              <option value="CASUAL">Casual (Daily Wage)</option>
            </select>
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/masters/drivers" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/masters/drivers')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save Driver'}
            </button>
          </div>
        </div>
      </form>

      {isEdit && id && existing && (
        <AppAccessPanel driverId={id} mobile={watch('mobile') || existing.mobile} appEnabled={!!existing.app_enabled} />
      )}
    </div>
  )
}
