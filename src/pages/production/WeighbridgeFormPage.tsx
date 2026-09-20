import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import InlineLoader from '@/components/shared/InlineLoader'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'
import { Badge } from '@/components/ui/badge'

interface LookupVehicle { id: string; vehicle_no: string }
interface LookupDriver { id: string; name: string }
interface LookupChallan { id: string; challan_no: string; job_site: string | null }

const TICKET_TYPES = [
  { value: 'OUTWARD_RMC', label: 'Outward — RMC Delivery' },
  { value: 'INWARD_MATERIAL', label: 'Inward — Material Receipt' },
  { value: 'OUTWARD_OTHER', label: 'Outward — Other' },
]

const createSchema = z.object({
  ticket_type: z.string().min(1),
  vehicle_id: z.string().optional(),
  vehicle_no_manual: z.string().optional(),
  driver_id: z.string().optional(),
  challan_id: z.string().optional(),
  material_desc: z.string().optional(),
  gross_weight: z.coerce.number({ required_error: 'Gross weight is required', invalid_type_error: 'Gross weight is required' }).positive('Must be greater than zero'),
  remarks: z.string().optional(),
})
type CreateValues = z.infer<typeof createSchema>

export default function WeighbridgeFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState(false)
  const [tareWeight, setTareWeight] = useState('')

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles-lookup'],
    queryFn: () => api.get('/masters/vehicles', { params: { limit: 200, branch_id: user?.branch?.id } }).then(r => r.data.data.data as LookupVehicle[]),
    enabled: !isEdit,
    staleTime: 60_000,
  })
  const { data: drivers } = useQuery({
    queryKey: ['drivers-lookup'],
    queryFn: () => api.get('/masters/drivers', { params: { limit: 200, branch_id: user?.branch?.id } }).then(r => r.data.data.data as LookupDriver[]),
    enabled: !isEdit,
    staleTime: 60_000,
  })
  const { data: challans } = useQuery({
    queryKey: ['challans-lookup-recent-wb'],
    queryFn: () => api.get('/sales/challans', { params: { limit: 100, branch_id: user?.branch?.id } }).then(r => r.data.data.data as LookupChallan[]),
    enabled: !isEdit,
    staleTime: 60_000,
  })

  const { data: existing, isLoading: loadingExisting, refetch } = useQuery({
    queryKey: ['weighbridge-ticket', id],
    queryFn: () => api.get(`/production/weighbridge/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { control, register, reset, handleSubmit, formState: { errors } } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { ticket_type: 'OUTWARD_RMC', vehicle_id: '', vehicle_no_manual: '', driver_id: '', challan_id: '', material_desc: '', remarks: '' },
  })

  useEffect(() => { reset() }, [reset])

  async function onCreate(values: CreateValues) {
    setSubmitting(true)
    try {
      await api.post('/production/weighbridge', { ...values, branch_id: user?.branch?.id })
      toast({ variant: 'success', title: 'Gross weight captured' })
      navigate('/production/weighbridge')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function onCaptureTare() {
    const tare = Number(tareWeight)
    if (!tare || tare <= 0) {
      toast({ variant: 'error', title: 'Enter a valid tare weight' })
      return
    }
    setSubmitting(true)
    try {
      await api.put(`/production/weighbridge/${id}/tare`, { tare_weight: tare })
      toast({ variant: 'success', title: 'Tare captured — ticket completed' })
      refetch()
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (isEdit) {
    return (
      <div>
        <PageHeader
          title={existing?.ticket_no ? `Ticket ${existing.ticket_no}` : 'Weighbridge Ticket'}
          subtitle="Gate weighment record"
        />
        {loadingExisting ? (
          <div className="flex items-center gap-2 text-xs text-gray-400"><InlineLoader /> Loading...</div>
        ) : existing ? (
          <div className="max-w-xl space-y-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <div><span className="text-xs text-gray-400">Type</span><div>{existing.ticket_type?.replace('_', ' ')}</div></div>
              <div><span className="text-xs text-gray-400">Status</span><div><Badge tone={existing.status === 'COMPLETED' ? 'success' : existing.status === 'CANCELLED' ? 'error' : 'warning'}>{existing.status}</Badge></div></div>
              <div><span className="text-xs text-gray-400">Vehicle</span><div>{existing.vehicle_no ?? existing.vehicle_no_manual ?? '—'}</div></div>
              <div><span className="text-xs text-gray-400">Driver</span><div>{existing.driver_name ?? '—'}</div></div>
              <div><span className="text-xs text-gray-400">Challan</span><div className="font-mono">{existing.challan_no ?? '—'}</div></div>
              <div><span className="text-xs text-gray-400">Job Site</span><div>{existing.job_site ?? '—'}</div></div>
              <div><span className="text-xs text-gray-400">Gross Weight</span><div className="font-mono font-semibold">{Number(existing.gross_weight).toLocaleString()} kg</div></div>
              <div><span className="text-xs text-gray-400">Gross Time</span><div>{existing.gross_time ? new Date(existing.gross_time).toLocaleString() : '—'}</div></div>
            </div>

            {existing.status === 'GROSS_DONE' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <SectionHeader label="Capture Tare Weight" />
                <div className="mt-3 flex items-end gap-3">
                  <div className="w-40">
                    <label className="field-label">Tare Weight (kg)</label>
                    <input type="number" step="0.1" value={tareWeight} onChange={e => setTareWeight(e.target.value)} className={inputClass(false, 'text-right font-mono')} />
                  </div>
                  <button type="button" disabled={submitting} onClick={onCaptureTare} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
                    {submitting && <Loader2 size={13} className="animate-spin" />}
                    Capture Tare & Complete
                  </button>
                </div>
              </div>
            )}

            {existing.status === 'COMPLETED' && (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs">
                <span className="text-gray-500">Tare: <span className="font-mono font-semibold text-gray-900">{Number(existing.tare_weight).toLocaleString()} kg</span></span>
                <span className="text-gray-500">Net: <span className="font-mono font-semibold text-gray-900">{Number(existing.net_weight).toLocaleString()} kg</span></span>
                <span className="text-gray-500">Tare Time: {existing.tare_time ? new Date(existing.tare_time).toLocaleString() : '—'}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Ticket not found.</p>
        )}
        <div className="mt-6">
          <Link to="/production/weighbridge" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="New Weighbridge Ticket" subtitle="Capture the gross weight — tare is recorded separately when the vehicle returns" />
      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2 max-w-2xl">
          <SectionHeader label="Ticket" />
          <Field label="Ticket Type" required>
            <select {...register('ticket_type')} className={inputClass(false)}>
              {TICKET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Linked Challan" hint="Optional — for an outward RMC load">
            <Controller control={control} name="challan_id" render={({ field }) => (
              <SearchableSelect options={challans ?? []} value={field.value} onChange={v => field.onChange(v)}
                displayKey="challan_no" valueKey="id" filterKeys={['challan_no']} placeholder="Search challan..."
                renderOption={c => <div><div className="font-mono">{c.challan_no}</div><div className="text-[11px] text-gray-400">{c.job_site ?? '—'}</div></div>} />
            )} />
          </Field>

          <SectionHeader label="Vehicle & Driver" />
          <Field label="Vehicle" hint="Leave blank and use manual entry for a hired truck not in the master">
            <Controller control={control} name="vehicle_id" render={({ field }) => (
              <SearchableSelect options={vehicles ?? []} value={field.value} onChange={v => field.onChange(v)}
                displayKey="vehicle_no" valueKey="id" filterKeys={['vehicle_no']} placeholder="Search vehicle..." />
            )} />
          </Field>
          <Field label="Manual Vehicle No" hint="Only if not selected above">
            <input {...register('vehicle_no_manual')} className={inputClass(false, 'font-mono')} placeholder="e.g. MH-12-AB-1234" />
          </Field>
          <Field label="Driver">
            <Controller control={control} name="driver_id" render={({ field }) => (
              <SearchableSelect options={drivers ?? []} value={field.value} onChange={v => field.onChange(v)}
                displayKey="name" valueKey="id" filterKeys={['name']} placeholder="Search driver..." />
            )} />
          </Field>
          <div />

          <SectionHeader label="Weighment" />
          <Field label="Material / Load Description">
            <input {...register('material_desc')} className={inputClass(false)} placeholder="e.g. M-25 RMC / 20mm Aggregate" />
          </Field>
          <Field label="Gross Weight (kg)" required error={errors.gross_weight?.message}>
            <input type="number" step="0.1" {...register('gross_weight', { valueAsNumber: true })} className={inputClass(!!errors.gross_weight, 'text-right font-mono')} />
          </Field>

          <SectionHeader label="Remarks" />
          <div className="lg:col-span-2">
            <textarea rows={2} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Optional notes" />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/production/weighbridge" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/production/weighbridge')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onCreate)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Capture Gross Weight'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
