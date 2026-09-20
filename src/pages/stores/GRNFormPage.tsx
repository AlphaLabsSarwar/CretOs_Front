import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

interface LookupVendor { id: string; name: string; code: string | null; mobile: string | null }
interface LookupPO { id: string; po_no: string; date: string; total_amount: string | number }

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

const grnSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  vendor_id: z.string().min(1, 'Vendor is required'),
  po_id: z.string().optional(),
  grn_type: z.string().optional(),
  party_challan_no: z.string().min(1, "Party's challan number is required"),
  challan_date: z.string().min(1, "Party's challan date is required"),
  royalty_pass_no: z.string().optional(),
  vehicle_no: z.string().optional(),
  gate_entry_no: z.string().optional(),
  godown: z.string().optional(),
  wb_no: z.string().optional(),
  total_qty: optionalNumber,
  total_amount: optionalNumber,
  gross_weight: optionalNumber,
  tare_weight: optionalNumber,
  remarks: z.string().optional(),
})

type GRNFormValues = z.infer<typeof grnSchema>

const GRN_TYPES = ['MATERIAL', 'RETURN', 'OTHER']

function defaultValues(): GRNFormValues {
  const today = new Date().toISOString().slice(0, 10)
  return {
    date: today, vendor_id: '', po_id: '', grn_type: 'MATERIAL', party_challan_no: '', challan_date: today,
    royalty_pass_no: '', vehicle_no: '', gate_entry_no: '', godown: '', wb_no: '',
    total_qty: undefined, total_amount: undefined, gross_weight: undefined, tare_weight: undefined, remarks: '',
  }
}

export default function GRNFormPage() {
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
    queryKey: ['grn', id],
    queryFn: () => api.get(`/stores/grn/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, control, watch, reset, handleSubmit, formState: { errors } } = useForm<GRNFormValues>({
    resolver: zodResolver(grnSchema),
    defaultValues: defaultValues(),
  })

  const vendorId = watch('vendor_id')

  const { data: vendorPOs } = useQuery({
    queryKey: ['vendor-pos', vendorId],
    queryFn: () => api.get('/stores/grn/vendor-pos', { params: { vendor_id: vendorId } }).then(r => r.data.data as LookupPO[]),
    enabled: !!vendorId,
  })

  useEffect(() => {
    if (!existing) return
    reset({
      date: existing.date?.slice(0, 10) ?? defaultValues().date,
      vendor_id: existing.vendor_id ?? '',
      po_id: existing.po_id ?? '',
      grn_type: existing.grn_type ?? 'MATERIAL',
      party_challan_no: existing.party_challan_no ?? '',
      challan_date: existing.challan_date?.slice(0, 10) ?? defaultValues().challan_date,
      royalty_pass_no: existing.royalty_pass_no ?? '',
      vehicle_no: existing.vehicle_no ?? '',
      gate_entry_no: existing.gate_entry_no ?? '',
      godown: existing.godown ?? '',
      wb_no: existing.wb_no ?? '',
      total_qty: existing.total_qty != null ? Number(existing.total_qty) : undefined,
      total_amount: existing.total_amount != null ? Number(existing.total_amount) : undefined,
      gross_weight: existing.gross_weight != null ? Number(existing.gross_weight) : undefined,
      tare_weight: existing.tare_weight != null ? Number(existing.tare_weight) : undefined,
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  async function onSubmit(values: GRNFormValues) {
    setSubmitting(true)
    try {
      const payload = { ...values, po_id: values.po_id || null, branch_id: user?.branch?.id, status: 'ACTIVE' }
      if (isEdit && id) {
        await api.put(`/stores/grn/${id}`, payload)
      } else {
        await api.post('/stores/grn', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['grns'] })
      queryClient.invalidateQueries({ queryKey: ['grn', id] })
      toast({ variant: 'success', title: 'GRN saved' })
      navigate('/stores/grn')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit GRN${existing?.number ? ` ${existing.number}` : ''}` : 'New GRN'}
        subtitle={isEdit ? 'Update this goods receipt note' : 'Record material received from a vendor at the plant'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading GRN...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <SectionHeader label="GRN Info" />
          <Field label="GRN No" required>
            <input value={isEdit ? existing?.number ?? '—' : 'Auto-generated'} readOnly className="h-9 w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500" />
          </Field>
          <Field label="Date" required error={errors.date?.message}>
            <input type="date" {...register('date')} className={inputClass(!!errors.date)} />
          </Field>
          <Field label="GRN Type">
            <select {...register('grn_type')} className={inputClass(false)}>
              {GRN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div />

          <SectionHeader label="Vendor & PO" />
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
          <Field label="Against PO" hint="Optional — link to an approved purchase order">
            <Controller
              control={control}
              name="po_id"
              render={({ field }) => (
                <SearchableSelect
                  options={vendorPOs ?? []}
                  value={field.value}
                  onChange={v => field.onChange(v)}
                  displayKey="po_no"
                  valueKey="id"
                  disabled={!vendorId}
                  placeholder={vendorId ? 'Select PO...' : 'Select vendor first'}
                />
              )}
            />
          </Field>

          <SectionHeader label="Party Challan" />
          <Field label="Party Challan No" required error={errors.party_challan_no?.message}>
            <input {...register('party_challan_no')} className={inputClass(!!errors.party_challan_no)} placeholder="Vendor's delivery challan no." />
          </Field>
          <Field label="Party Challan Date" required error={errors.challan_date?.message}>
            <input type="date" {...register('challan_date')} className={inputClass(!!errors.challan_date)} />
          </Field>
          <Field label="Royalty Pass No">
            <input {...register('royalty_pass_no')} className={inputClass(false)} placeholder="Optional" />
          </Field>
          <Field label="Vehicle No">
            <input {...register('vehicle_no')} className={inputClass(false, 'font-mono uppercase')} />
          </Field>

          <SectionHeader label="Gate & Storage" />
          <Field label="Gate Entry No">
            <input {...register('gate_entry_no')} className={inputClass(false)} />
          </Field>
          <Field label="Weighbridge No">
            <input {...register('wb_no')} className={inputClass(false)} />
          </Field>
          <Field label="Godown">
            <input {...register('godown')} className={inputClass(false)} placeholder="Storage location" />
          </Field>
          <Field label="Gross Weight (kg)" hint="Optional — filled in only if a weighbridge is present">
            <input type="number" step="0.01" {...register('gross_weight', { valueAsNumber: true })} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <Field label="Tare Weight (kg)">
            <input type="number" step="0.01" {...register('tare_weight', { valueAsNumber: true })} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <div />

          <SectionHeader label="Quantity & Value" />
          <Field label="Total Qty">
            <input type="number" step="0.01" {...register('total_qty', { valueAsNumber: true })} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <Field label="Total Amount">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
              <input type="number" step="0.01" {...register('total_amount', { valueAsNumber: true })} className={inputClass(false, 'pl-6 text-right font-mono')} />
            </div>
          </Field>

          <SectionHeader label="Remarks" />
          <div className="lg:col-span-2">
            <textarea rows={3} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/stores/grn" className="text-xs text-gray-500 hover:text-gray-800">← Back to List</Link>
          <div className="flex items-center gap-2">
            {isEdit && id && (
              <Link
                to={`/stores/grn/${id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Printer size={13} /> Print
              </Link>
            )}
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save GRN'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
