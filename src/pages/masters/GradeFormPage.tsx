import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, History, Lock } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'
import { cn } from '@/lib/utils'

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

const requiredNumber = (label: string) => z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number({ required_error: `${label} is required`, invalid_type_error: `${label} is required` }).min(0, `${label} must be positive`)
)

const gradeSchema = z.object({
  grade_name: z.string().min(1, 'Grade name is required'),
  grade_code: z.string().optional(),
  comm_grade: z.string().optional(),
  cement_grade: z.string().optional(),
  msa: z.string().optional(),
  cement_qty: requiredNumber('Cement qty'),
  flyash_qty: optionalNumber,
  ggbs_qty: optionalNumber,
  mm20_qty: requiredNumber('20mm qty'),
  mm10_qty: optionalNumber,
  mm40_qty: optionalNumber,
  csand_qty: optionalNumber,
  fsand_qty: optionalNumber,
  water_qty: optionalNumber,
  admix_qty: optionalNumber,
  admix_type: z.string().optional(),
  admix_name: z.string().optional(),
  total_weight: optionalNumber,
  remarks: z.string().optional(),
})

type GradeFormValues = z.infer<typeof gradeSchema>

const MSA_OPTIONS = ['10mm', '12.5mm', '20mm', '40mm']
const COMM_GRADES = ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40', 'M-45', 'M-50', 'M-60']

function defaultValues(): GradeFormValues {
  return {
    grade_name: '', grade_code: '', comm_grade: '', cement_grade: 'OPC 43', msa: '20mm',
    cement_qty: undefined as unknown as number, flyash_qty: undefined, ggbs_qty: undefined,
    mm20_qty: undefined as unknown as number, mm10_qty: undefined, mm40_qty: undefined,
    csand_qty: undefined, fsand_qty: undefined, water_qty: undefined, admix_qty: undefined,
    admix_type: '', admix_name: '', total_weight: undefined, remarks: '',
  }
}

function num(v: number | undefined | null): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0
}

export default function GradeFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState(false)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['grade', id],
    queryFn: () => api.get(`/masters/grades/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  // Recipe quantities are locked once a batch or challan has already used
  // this exact version (is_locked, from the backend) — see
  // routes/masters/grades.ts. A superseded version (is_current === false)
  // is frozen entirely: it's kept for history, never edited again.
  const isSuperseded = isEdit && existing ? existing.is_current === false : false
  const quantitiesLocked = isEdit && existing ? Boolean(existing.is_locked) || isSuperseded : false
  const readOnly = isSuperseded

  const { register, watch, setValue, reset, handleSubmit, getValues, formState: { errors } } = useForm<GradeFormValues>({
    resolver: zodResolver(gradeSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      grade_name: existing.grade_name ?? '',
      grade_code: existing.grade_code ?? '',
      comm_grade: existing.comm_grade ?? '',
      cement_grade: existing.cement_grade ?? 'OPC 43',
      msa: existing.msa ?? '20mm',
      cement_qty: existing.cement_qty != null ? Number(existing.cement_qty) : (undefined as unknown as number),
      flyash_qty: existing.flyash_qty != null ? Number(existing.flyash_qty) : undefined,
      ggbs_qty: existing.ggbs_qty != null ? Number(existing.ggbs_qty) : undefined,
      mm20_qty: existing.mm20_qty != null ? Number(existing.mm20_qty) : (undefined as unknown as number),
      mm10_qty: existing.mm10_qty != null ? Number(existing.mm10_qty) : undefined,
      mm40_qty: existing.mm40_qty != null ? Number(existing.mm40_qty) : undefined,
      csand_qty: existing.csand_qty != null ? Number(existing.csand_qty) : undefined,
      fsand_qty: existing.fsand_qty != null ? Number(existing.fsand_qty) : undefined,
      water_qty: existing.water_qty != null ? Number(existing.water_qty) : undefined,
      admix_qty: existing.admix_qty != null ? Number(existing.admix_qty) : undefined,
      admix_type: existing.admix_type ?? '',
      admix_name: existing.admix_name ?? '',
      total_weight: existing.total_weight != null ? Number(existing.total_weight) : undefined,
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  const cement = watch('cement_qty')
  const flyash = watch('flyash_qty')
  const ggbs = watch('ggbs_qty')
  const mm20 = watch('mm20_qty')
  const mm10 = watch('mm10_qty')
  const mm40 = watch('mm40_qty')
  const csand = watch('csand_qty')
  const fsand = watch('fsand_qty')
  const water = watch('water_qty')
  const admix = watch('admix_qty')

  const computedTotal = useMemo(
    () => num(cement) + num(flyash) + num(ggbs) + num(mm20) + num(mm10) + num(mm40) + num(csand) + num(fsand) + num(water) + num(admix),
    [cement, flyash, ggbs, mm20, mm10, mm40, csand, fsand, water, admix]
  )
  const waterCementRatio = useMemo(() => {
    const binder = num(cement) + num(flyash) + num(ggbs)
    return binder > 0 && num(water) > 0 ? (num(water) / binder) : 0
  }, [cement, flyash, ggbs, water])

  function buildPayload(values: GradeFormValues) {
    return {
      ...values,
      grade_code: values.grade_code || values.grade_name.replace(/[^A-Za-z0-9]/g, ''),
      total_weight: values.total_weight ?? computedTotal,
      water_ratio: waterCementRatio || undefined,
      branch_id: user?.branch?.id,
    }
  }

  async function onSubmit(values: GradeFormValues) {
    setSubmitting(true)
    try {
      const payload = buildPayload(values)
      if (isEdit && id) {
        await api.put(`/masters/grades/${id}`, payload)
      } else {
        await api.post('/masters/grades', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      queryClient.invalidateQueries({ queryKey: ['grade', id] })
      toast({ variant: 'success', title: 'Mix design recipe saved' })
      navigate('/masters/grades')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function onSaveAsNewVersion() {
    if (!id) return
    setSubmitting(true)
    try {
      const payload = buildPayload(getValues())
      const res = await api.post(`/masters/grades/${id}/new-version`, payload)
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      queryClient.invalidateQueries({ queryKey: ['grade-versions', id] })
      toast({ variant: 'success', title: res.data.message ?? 'New version created' })
      navigate(`/masters/grades/${res.data.data.id}/edit`)
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const qtyInputClass = (hasError: boolean, extra?: string) =>
    cn(inputClass(hasError, extra), quantitiesLocked && 'bg-gray-50 text-gray-500 cursor-not-allowed')

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Recipe${existing?.grade_name ? ` — ${existing.grade_name}${existing?.version ? ` (v${existing.version})` : ''}` : ''}` : 'New Mix Design Recipe'}
        subtitle={isEdit ? 'Update the concrete mix design' : 'Define the material quantities per cubic meter for a concrete grade'}
        actions={isEdit && id ? (
          <Link to={`/masters/grades/${id}/versions`} className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <History size={13} /> Version History
          </Link>
        ) : undefined}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading recipe...
        </div>
      )}

      {isSuperseded && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
          <Lock size={13} /> This is version v{existing?.version} — it was superseded and is kept for historical record only. It cannot be edited.
        </div>
      )}
      {!isSuperseded && quantitiesLocked && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <Lock size={13} /> This recipe is already in use by a batch or dispatch challan — quantities are locked. Use "Save as New Version" below to change them.
        </div>
      )}

      <form className="pb-4">
        <fieldset disabled={readOnly} className="contents">
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-3">
            <SectionHeader label="Grade Info" />
            <Field label="Grade Name" required error={errors.grade_name?.message}>
              <input {...register('grade_name')} className={inputClass(!!errors.grade_name)} placeholder="e.g. M-25" />
            </Field>
            <Field label="Grade Code" hint="Leave blank to auto-generate">
              <input {...register('grade_code')} className={inputClass(false, 'font-mono')} placeholder="Auto-generated" />
            </Field>
            <Field label="Commercial Grade">
              <select {...register('comm_grade')} className={inputClass(false)}>
                <option value="">Select...</option>
                {COMM_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Cement Grade">
              <input {...register('cement_grade')} className={inputClass(false)} placeholder="e.g. OPC 43" />
            </Field>
            <Field label="MSA (Max Size Aggregate)">
              <select {...register('msa')} className={inputClass(false)}>
                {MSA_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <div />

            <SectionHeader label="Binder (kg / cum)" />
            <Field label="Cement" required error={errors.cement_qty?.message}>
              <input type="number" step="0.1" disabled={quantitiesLocked} {...register('cement_qty', { valueAsNumber: true })} className={qtyInputClass(!!errors.cement_qty, 'text-right font-mono')} />
            </Field>
            <Field label="Fly Ash">
              <input type="number" step="0.1" disabled={quantitiesLocked} {...register('flyash_qty', { valueAsNumber: true })} className={qtyInputClass(false, 'text-right font-mono')} />
            </Field>
            <Field label="GGBS">
              <input type="number" step="0.1" disabled={quantitiesLocked} {...register('ggbs_qty', { valueAsNumber: true })} className={qtyInputClass(false, 'text-right font-mono')} />
            </Field>

            <SectionHeader label="Aggregate (kg / cum)" />
            <Field label="20mm" required error={errors.mm20_qty?.message}>
              <input type="number" step="0.1" disabled={quantitiesLocked} {...register('mm20_qty', { valueAsNumber: true })} className={qtyInputClass(!!errors.mm20_qty, 'text-right font-mono')} />
            </Field>
            <Field label="10mm">
              <input type="number" step="0.1" disabled={quantitiesLocked} {...register('mm10_qty', { valueAsNumber: true })} className={qtyInputClass(false, 'text-right font-mono')} />
            </Field>
            <Field label="40mm">
              <input type="number" step="0.1" disabled={quantitiesLocked} {...register('mm40_qty', { valueAsNumber: true })} className={qtyInputClass(false, 'text-right font-mono')} />
            </Field>
            <Field label="Coarse Sand">
              <input type="number" step="0.1" disabled={quantitiesLocked} {...register('csand_qty', { valueAsNumber: true })} className={qtyInputClass(false, 'text-right font-mono')} />
            </Field>
            <Field label="Fine Sand">
              <input type="number" step="0.1" disabled={quantitiesLocked} {...register('fsand_qty', { valueAsNumber: true })} className={qtyInputClass(false, 'text-right font-mono')} />
            </Field>
            <div />

            <SectionHeader label="Water & Admixture" />
            <Field label="Water (L / cum)">
              <input type="number" step="0.1" disabled={quantitiesLocked} {...register('water_qty', { valueAsNumber: true })} className={qtyInputClass(false, 'text-right font-mono')} />
            </Field>
            <Field label="Admixture (L / cum)">
              <input type="number" step="0.01" disabled={quantitiesLocked} {...register('admix_qty', { valueAsNumber: true })} className={qtyInputClass(false, 'text-right font-mono')} />
            </Field>
            <Field label="Admixture Type">
              <input {...register('admix_type')} className={inputClass(false)} placeholder="e.g. Superplasticizer" />
            </Field>
            <Field label="Admixture Name">
              <input {...register('admix_name')} className={inputClass(false)} placeholder="e.g. Sika ViscoCrete" />
            </Field>
            <Field label="Total Weight (kg)" hint="Auto-calculated if left blank">
              <input type="number" step="0.1" disabled={quantitiesLocked} {...register('total_weight', { valueAsNumber: true })} className={qtyInputClass(false, 'text-right font-mono')} placeholder={computedTotal ? computedTotal.toFixed(1) : ''} />
            </Field>
            <div />

            <div className="flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-xs lg:col-span-3">
              <span className="font-medium text-gray-700">Mix Design Summary</span>
              <span className="text-gray-500">Total Weight: <span className="font-mono font-semibold text-gray-900">{computedTotal.toFixed(1)} kg</span></span>
              <span className="text-gray-500">Water/Cement Ratio: <span className="font-mono font-semibold text-gray-900">{waterCementRatio ? waterCementRatio.toFixed(3) : '—'}</span></span>
            </div>

            <SectionHeader label="Remarks" />
            <div className="lg:col-span-3">
              <textarea rows={3} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Additional notes..." />
            </div>
          </div>
        </fieldset>

        {!readOnly && (
          <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
            <Link to="/masters/grades" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => navigate('/masters/grades')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              {isEdit && (
                <button type="button" disabled={submitting} onClick={onSaveAsNewVersion} className="flex h-9 items-center gap-1.5 rounded-lg border border-accent px-4 text-xs font-medium text-accent hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  Save as New Version
                </button>
              )}
              <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
                {submitting && <Loader2 size={13} className="animate-spin" />}
                {submitting ? 'Saving...' : 'Save Recipe'}
              </button>
            </div>
          </div>
        )}
        {readOnly && (
          <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
            <Link to="/masters/grades" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
            <Link to={`/masters/grades/${id}/versions`} className="text-xs text-accent hover:underline">View all versions</Link>
          </div>
        )}
      </form>
    </div>
  )
}
