import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

const MOBILE_RE = /^[0-9]{10}$/

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

const vehicleSchema = z.object({
  vehicle_no: z.string().min(1, 'Vehicle number is required'),
  vehicle_type: z.string().optional(),
  capacity: optionalNumber,
  owner_name: z.string().optional(),
  mobile: z.string().optional().refine(v => !v || MOBILE_RE.test(v), { message: 'Must be 10 digits' }),
})

type VehicleFormValues = z.infer<typeof vehicleSchema>

const VEHICLE_TYPES = ['TRANSIT_MIXER', 'PUMP', 'TIPPER', 'OTHER']

function defaultValues(): VehicleFormValues {
  return { vehicle_no: '', vehicle_type: 'TRANSIT_MIXER', capacity: undefined, owner_name: '', mobile: '' }
}

export default function VehicleFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => api.get(`/masters/vehicles/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, reset, handleSubmit, formState: { errors } } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      vehicle_no: existing.vehicle_no ?? '',
      vehicle_type: existing.vehicle_type ?? 'TRANSIT_MIXER',
      capacity: existing.capacity != null ? Number(existing.capacity) : undefined,
      owner_name: existing.owner_name ?? '',
      mobile: existing.mobile ?? '',
    })
  }, [existing, reset])

  async function onSubmit(values: VehicleFormValues) {
    setSubmitting(true)
    try {
      if (isEdit && id) {
        await api.put(`/masters/vehicles/${id}`, values)
      } else {
        await api.post('/masters/vehicles', values)
      }
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicle', id] })
      toast({ variant: 'success', title: 'Vehicle saved successfully' })
      navigate('/masters/vehicles')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Vehicle${existing?.vehicle_no ? ` — ${existing.vehicle_no}` : ''}` : 'New Vehicle'}
        subtitle={isEdit ? 'Update vehicle master details' : 'Add a transit mixer or pump used for dispatch'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading vehicle...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="Vehicle Info" />
          <Field label="Vehicle No" required error={errors.vehicle_no?.message}>
            <input {...register('vehicle_no')} className={inputClass(!!errors.vehicle_no, 'font-mono uppercase')} placeholder="e.g. RJ20GA1234" />
          </Field>
          <Field label="Vehicle Type">
            <select {...register('vehicle_type')} className={inputClass(false)}>
              {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Capacity (Cum)">
            <input type="number" step="0.1" {...register('capacity', { valueAsNumber: true })} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <div />

          <SectionHeader label="Owner" />
          <Field label="Owner Name">
            <input {...register('owner_name')} className={inputClass(false)} placeholder="Self / owner name" />
          </Field>
          <Field label="Mobile" error={errors.mobile?.message}>
            <input {...register('mobile')} className={inputClass(!!errors.mobile, 'font-mono')} placeholder="10-digit mobile" />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/masters/vehicles" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/masters/vehicles')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save Vehicle'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
