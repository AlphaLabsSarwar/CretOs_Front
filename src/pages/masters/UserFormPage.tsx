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

interface Branch { id: string; name: string; code: string }

const ROLES = [
  { value: 'ADMIN', label: 'Admin — full access' },
  { value: 'MANAGER', label: 'Manager — full access' },
  { value: 'OPERATOR', label: 'Operator — Quick Dispatch screen only' },
  { value: 'VIEWER', label: 'Viewer' },
]

const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().optional().refine(v => !v || v.length >= 6, { message: 'Password must be at least 6 characters' }),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']),
  branch_id: z.string().min(1, 'Branch is required'),
})
type UserFormValues = z.infer<typeof userSchema>

export default function UserFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const { data: branches } = useQuery({
    queryKey: ['branches-lookup'],
    queryFn: () => api.get('/masters/branches', { params: { limit: 100 } }).then(r => r.data.data.data as Branch[]),
  })

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get(`/masters/users/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, reset, handleSubmit, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '', password: '', role: 'VIEWER', branch_id: '' },
  })

  useEffect(() => {
    if (!existing) return
    reset({ name: existing.name ?? '', email: existing.email ?? '', password: '', role: existing.role ?? 'VIEWER', branch_id: existing.branch_id ?? '' })
  }, [existing, reset])

  async function onSubmit(values: UserFormValues) {
    setSubmitting(true)
    try {
      const payload: Record<string, any> = { ...values }
      if (!payload.password) delete payload.password
      if (isEdit && id) {
        await api.put(`/masters/users/${id}`, payload)
      } else {
        await api.post('/masters/users', payload)
      }
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ variant: 'success', title: 'User saved successfully' })
      navigate('/masters/users')
    } catch (e: any) {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please check the form and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit User${existing?.name ? ` — ${existing.name}` : ''}` : 'New User'}
        subtitle={isEdit ? 'Update login details and role' : 'Create a staff login — set role to Operator for the fast loading-bay screen'}
      />

      {loadingExisting && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading user...
        </div>
      )}

      <form className="max-w-xl pb-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4">
          <SectionHeader label="Login Details" />
          <Field label="Full Name" required error={errors.name?.message}>
            <input {...register('name')} className={inputClass(!!errors.name)} placeholder="e.g. Ramesh Kumar" />
          </Field>
          <Field label="Email" required error={errors.email?.message}>
            <input type="email" {...register('email')} className={inputClass(!!errors.email)} placeholder="name@cretos.in" />
          </Field>
          <Field label="Password" required={!isEdit} error={errors.password?.message} hint={isEdit ? 'Leave blank to keep the current password' : 'Minimum 6 characters'}>
            <input type="password" {...register('password')} className={inputClass(!!errors.password)} placeholder={isEdit ? '••••••••' : 'Set a password'} />
          </Field>

          <SectionHeader label="Access" />
          <Field label="Branch" required error={errors.branch_id?.message}>
            <select {...register('branch_id')} className={inputClass(!!errors.branch_id)}>
              <option value="">Select branch...</option>
              {branches?.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
            </select>
          </Field>
          <Field label="Role" required error={errors.role?.message} hint="Operator sees only the Quick Dispatch screen — no sidebar, no other modules">
            <select {...register('role')} className={inputClass(!!errors.role)}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <Link to="/masters/users" className="text-xs text-gray-500 hover:text-gray-800">← Back</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/masters/users')} className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit(onSubmit)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save User'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
