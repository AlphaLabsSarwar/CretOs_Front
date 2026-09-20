import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

interface LookupGrade { id: string; grade_name: string; grade_code: string | null; version: number }
interface LookupChallan { id: string; challan_no: string; job_site: string | null; grade_name: string | null }

const batchSchema = z.object({
  grade_id: z.string().min(1, 'Mix design is required'),
  challan_id: z.string().optional(),
  batch_qty_cum: z.coerce.number({ required_error: 'Batch quantity is required', invalid_type_error: 'Batch quantity is required' }).positive('Must be greater than zero'),
  mixer_no: z.string().optional(),
  operator: z.string().optional(),
  remarks: z.string().optional(),
})
type BatchValues = z.infer<typeof batchSchema>

export default function BatchFormPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState(false)

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ['grades-lookup-current'],
    queryFn: () => api.get('/masters/grades', { params: { limit: 200, branch_id: user?.branch?.id } }).then(r => r.data.data.data as LookupGrade[]),
    staleTime: 30_000,
  })
  const { data: challans, isLoading: challansLoading } = useQuery({
    queryKey: ['challans-lookup-recent-batch'],
    queryFn: () => api.get('/sales/challans', { params: { limit: 100, branch_id: user?.branch?.id } }).then(r => r.data.data.data as LookupChallan[]),
    staleTime: 30_000,
  })

  const { control, register, handleSubmit, formState: { errors } } = useForm<BatchValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: { grade_id: '', challan_id: '', mixer_no: '', operator: '', remarks: '' },
  })

  async function onSubmit(values: BatchValues) {
    setSubmitting(true)
    try {
      const res = await api.post('/production/batches', { ...values, branch_id: user?.branch?.id })
      toast({ variant: 'success', title: res.data.message ?? 'Batch requested' })
      navigate(`/production/batches/${res.data.data.id}`)
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader title="New Production Batch" subtitle="Target material quantities are computed from the mix design's recipe and sent to the plant" />
      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2 max-w-2xl">
          <SectionHeader label="Batch" />
          <Field label="Mix Design (Grade)" required error={errors.grade_id?.message}>
            <Controller control={control} name="grade_id" render={({ field }) => (
              <SearchableSelect options={grades ?? []} value={field.value} onChange={v => field.onChange(v)}
                displayKey="grade_name" valueKey="id" filterKeys={['grade_name', 'grade_code']} loading={gradesLoading}
                placeholder="Search mix design..." error={!!errors.grade_id}
                renderOption={g => <div><div>{g.grade_name}</div><div className="text-[11px] text-gray-400">v{g.version}{g.grade_code ? ` · ${g.grade_code}` : ''}</div></div>} />
            )} />
          </Field>
          <Field label="Batch Quantity (cum)" required error={errors.batch_qty_cum?.message}>
            <input type="number" step="0.01" {...register('batch_qty_cum', { valueAsNumber: true })} className={inputClass(!!errors.batch_qty_cum, 'text-right font-mono')} />
          </Field>

          <SectionHeader label="Delivery Link" />
          <Field label="Dispatch Challan" hint="Optional — links this batch to the truck load it fills" >
            <Controller control={control} name="challan_id" render={({ field }) => (
              <SearchableSelect options={challans ?? []} value={field.value} onChange={v => field.onChange(v)} loading={challansLoading}
                displayKey="challan_no" valueKey="id" filterKeys={['challan_no']} placeholder="Search challan..."
                renderOption={c => <div><div className="font-mono">{c.challan_no}</div><div className="text-[11px] text-gray-400">{c.job_site ?? '—'} · {c.grade_name ?? '—'}</div></div>} />
            )} />
          </Field>
          <div />

          <SectionHeader label="Plant" />
          <Field label="Mixer No">
            <input {...register('mixer_no')} className={inputClass(false)} placeholder="e.g. MIXER-1" />
          </Field>
          <Field label="Operator">
            <input {...register('operator')} className={inputClass(false)} placeholder="Operator name" />
          </Field>

          <SectionHeader label="Remarks" />
          <div className="lg:col-span-2">
            <textarea rows={2} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Optional notes" />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/production/batches" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/production/batches')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Requesting...' : 'Request Batch'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
