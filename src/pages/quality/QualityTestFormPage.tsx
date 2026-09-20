import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Printer } from 'lucide-react'
import InlineLoader from '@/components/shared/InlineLoader'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import SearchableSelect from '@/components/shared/SearchableSelect'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'

interface LookupChallan { id: string; challan_no: string; customer_name: string | null; grade_name: string | null }

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().optional()
)

const testSchema = z.object({
  challan_id: z.string().optional(),
  grade_name: z.string().optional(),
  cast_date: z.string().min(1, 'Cast date is required'),
  test_date: z.string().optional(),
  age_days: z.preprocess(v => (v === '' || v === null || v === undefined ? 28 : v), z.coerce.number().min(1)),
  cube_id: z.string().optional(),
  target_strength: optionalNumber,
  actual_strength: optionalNumber,
  result: z.enum(['PENDING', 'PASS', 'FAIL']).optional(),
  remarks: z.string().optional(),
})
type TestFormValues = z.infer<typeof testSchema>

function defaultValues(): TestFormValues {
  return {
    challan_id: '', grade_name: '',
    cast_date: new Date().toISOString().slice(0, 10),
    test_date: '', age_days: 28, cube_id: '',
    target_strength: undefined, actual_strength: undefined,
    result: 'PENDING', remarks: '',
  }
}

export default function QualityTestFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [submitting, setSubmitting] = useState(false)

  const { data: challans, isLoading: challansLoading } = useQuery({
    queryKey: ['challans-lookup-recent'],
    queryFn: () => api.get('/sales/challans', { params: { limit: 100, branch_id: user?.branch?.id } })
      .then(r => r.data.data.data as LookupChallan[]),
    staleTime: 60_000,
  })

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['quality-test', id],
    queryFn: () => api.get(`/quality/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { control, register, watch, setValue, reset, handleSubmit, formState: { errors } } = useForm<TestFormValues>({
    resolver: zodResolver(testSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      challan_id: existing.challan_id ?? '',
      grade_name: existing.grade_name ?? '',
      cast_date: existing.cast_date?.slice(0, 10) ?? defaultValues().cast_date,
      test_date: existing.test_date?.slice(0, 10) ?? '',
      age_days: existing.age_days ?? 28,
      cube_id: existing.cube_id ?? '',
      target_strength: existing.target_strength != null ? Number(existing.target_strength) : undefined,
      actual_strength: existing.actual_strength != null ? Number(existing.actual_strength) : undefined,
      result: existing.result ?? 'PENDING',
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  const target = watch('target_strength')
  const actual = watch('actual_strength')
  const projectedResult = actual != null && target != null ? (actual >= target ? 'PASS' : 'FAIL') : 'PENDING'

  async function onSubmit(values: TestFormValues) {
    setSubmitting(true)
    try {
      const payload = { ...values, branch_id: user?.branch?.id, challan_id: values.challan_id || null }
      if (isEdit && id) {
        await api.put(`/quality/${id}`, payload)
      } else {
        await api.post('/quality', payload)
      }
      toast({ variant: 'success', title: 'Quality test saved' })
      navigate('/quality/tests')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Cube Test' : 'New Cube Test'}
        subtitle="Record a compressive strength test — result is derived automatically from Target vs Actual"
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <InlineLoader /> Loading...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2 max-w-2xl">
          <SectionHeader label="Source" />
          <Field label="Dispatch Challan" hint="Optional — links the cube back to the concrete batch delivered">
            <Controller
              control={control}
              name="challan_id"
              render={({ field }) => (
                <SearchableSelect
                  options={challans ?? []}
                  value={field.value}
                  onChange={(v, opt) => {
                    field.onChange(v)
                    if (opt?.grade_name) setValue('grade_name', opt.grade_name)
                  }}
                  displayKey="challan_no"
                  valueKey="id"
                  filterKeys={['challan_no', 'customer_name']}
                  loading={challansLoading}
                  placeholder="Search challan..."
                  renderOption={c => (
                    <div>
                      <div className="font-mono">{c.challan_no}</div>
                      <div className="text-[11px] text-gray-400">{c.customer_name ?? '—'} · {c.grade_name ?? '—'}</div>
                    </div>
                  )}
                />
              )}
            />
          </Field>
          <Field label="Grade">
            <input {...register('grade_name')} className={inputClass(false)} placeholder="e.g. M-25" />
          </Field>

          <SectionHeader label="Cube Details" />
          <Field label="Cube ID">
            <input {...register('cube_id')} className={inputClass(false, 'font-mono')} placeholder="e.g. CB-0142" />
          </Field>
          <Field label="Cast Date" required error={errors.cast_date?.message}>
            <input type="date" {...register('cast_date')} className={inputClass(!!errors.cast_date)} />
          </Field>
          <Field label="Age at Test">
            <select {...register('age_days', { valueAsNumber: true })} className={inputClass(false)}>
              <option value={7}>7 days</option>
              <option value={28}>28 days</option>
            </select>
          </Field>
          <Field label="Test Date">
            <input type="date" {...register('test_date')} className={inputClass(false)} />
          </Field>

          <SectionHeader label="Strength (MPa)" />
          <Field label="Target Strength">
            <input type="number" step="0.1" {...register('target_strength', { valueAsNumber: true })} className={inputClass(false, 'text-right font-mono')} />
          </Field>
          <Field label="Actual Strength">
            <input type="number" step="0.1" {...register('actual_strength', { valueAsNumber: true })} className={inputClass(false, 'text-right font-mono')} />
          </Field>

          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs lg:col-span-2">
            <span className="text-gray-500">Result:</span>
            <span className={`status-badge ${projectedResult === 'PASS' ? 'bg-green-50 text-green-700 border border-green-200' : projectedResult === 'FAIL' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {projectedResult}
            </span>
            <span className="text-gray-400">Derived from Actual ≥ Target — enter both to compute.</span>
          </div>

          <SectionHeader label="Remarks" />
          <div className="lg:col-span-2">
            <textarea rows={2} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Optional notes" />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/quality/tests" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            {isEdit && id && (
              <Link
                to={`/quality/tests/${id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Printer size={13} /> Print
              </Link>
            )}
            <button type="button" onClick={() => navigate('/quality/tests')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save Test'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
