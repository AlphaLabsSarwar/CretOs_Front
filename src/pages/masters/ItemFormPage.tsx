import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import InlineLoader from '@/components/shared/InlineLoader'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import { Field, SectionHeader, inputClass } from '@/components/shared/form-controls'
import { MATERIAL_ROLES, MATERIAL_ROLE_LABELS } from '@/lib/materialRoles'

const ITEM_TYPES = ['RAW_MATERIAL', 'CONSUMABLE', 'FINISHED_GOOD', 'SPARE', 'OTHER']

const itemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  item_no: z.string().optional(),
  short_name: z.string().optional(),
  brand: z.string().optional(),
  item_type: z.string().optional(),
  item_group: z.string().optional(),
  category: z.string().optional(),
  uom: z.string().min(1, 'UOM is required'),
  hsn_code: z.string().optional(),
  tax_type: z.string().optional(),
  material_role: z.string().optional(),
  for_stock: z.boolean(),
  for_sale: z.boolean(),
  remarks: z.string().optional(),
})
type ItemFormValues = z.infer<typeof itemSchema>

function defaultValues(): ItemFormValues {
  return {
    name: '', item_no: '', short_name: '', brand: '', item_type: 'RAW_MATERIAL', item_group: '', category: '',
    uom: 'kg', hsn_code: '', tax_type: '', material_role: '',
    for_stock: true, for_sale: false, remarks: '',
  }
}

export default function ItemFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['item', id],
    queryFn: () => api.get(`/masters/items/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, reset, handleSubmit, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!existing) return
    reset({
      name: existing.name ?? '',
      item_no: existing.item_no ?? '',
      short_name: existing.short_name ?? '',
      brand: existing.brand ?? '',
      item_type: existing.item_type ?? 'RAW_MATERIAL',
      item_group: existing.item_group ?? '',
      category: existing.category ?? '',
      uom: existing.uom ?? 'kg',
      hsn_code: existing.hsn_code ?? '',
      tax_type: existing.tax_type ?? '',
      material_role: existing.material_role ?? '',
      for_stock: existing.for_stock ?? true,
      for_sale: existing.for_sale ?? false,
      remarks: existing.remarks ?? '',
    })
  }, [existing, reset])

  async function onSubmit(values: ItemFormValues) {
    setSubmitting(true)
    try {
      const payload = {
        ...values,
        material_role: values.material_role || null,
        item_no: values.item_no || null,
        hsn_code: values.hsn_code || null,
      }
      if (isEdit && id) {
        await api.put(`/masters/items/${id}`, payload)
      } else {
        await api.post('/masters/items', payload)
      }
      toast({ variant: 'success', title: 'Item saved' })
      navigate('/masters/items')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Item' : 'New Item'}
        subtitle="Materials, stock items and sale items. Assigning a Recipe Role links this item into concrete mix recipes and raw material stock."
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <InlineLoader /> Loading...
        </div>
      )}

      <form className="pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-3 max-w-4xl">
          <SectionHeader label="Identity" />
          <Field label="Item Name" required error={errors.name?.message}>
            <input {...register('name')} className={inputClass(!!errors.name)} placeholder="e.g. OPC 43 Cement" />
          </Field>
          <Field label="Item No" hint="Optional — your own code for this item">
            <input {...register('item_no')} className={inputClass(false, 'font-mono')} placeholder="e.g. RM-001" />
          </Field>
          <Field label="Short Name">
            <input {...register('short_name')} className={inputClass(false)} placeholder="e.g. Cement" />
          </Field>
          <Field label="Brand">
            <input {...register('brand')} className={inputClass(false)} placeholder="e.g. UltraTech" />
          </Field>
          <Field label="Item Type">
            <select {...register('item_type')} className={inputClass(false)}>
              {ITEM_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <input {...register('category')} className={inputClass(false)} placeholder="e.g. Binder" />
          </Field>

          <SectionHeader label="Units & Tax" />
          <Field label="UOM" required error={errors.uom?.message} hint="e.g. kg, L, bag, ton">
            <input {...register('uom')} className={inputClass(!!errors.uom, 'font-mono')} placeholder="kg" />
          </Field>
          <Field label="HSN Code">
            <input {...register('hsn_code')} className={inputClass(false, 'font-mono')} placeholder="Optional" />
          </Field>
          <Field label="Tax Type">
            <input {...register('tax_type')} className={inputClass(false)} placeholder="e.g. GST 18%" />
          </Field>

          <SectionHeader label="Recipe & Stock" />
          <Field
            label="Recipe Role"
            hint="Assign this item as the current material for a concrete mix recipe slot — enables auto stock deduction on dispatch."
          >
            <select {...register('material_role')} className={inputClass(false)}>
              <option value="">None</option>
              {MATERIAL_ROLES.map(r => <option key={r} value={r}>{MATERIAL_ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
          <Field label="Track as Stock">
            <label className="flex h-9 items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...register('for_stock')} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
              Included in stock tracking
            </label>
          </Field>
          <Field label="Available for Sale">
            <label className="flex h-9 items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...register('for_sale')} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
              Can be sold directly
            </label>
          </Field>

          <SectionHeader label="Remarks" />
          <div className="lg:col-span-3">
            <textarea rows={2} {...register('remarks')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Optional notes" />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/masters/items" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/masters/items')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
