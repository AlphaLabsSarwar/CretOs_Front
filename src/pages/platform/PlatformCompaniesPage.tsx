import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Plus, X, Copy, Check, Building2, Pencil, Upload, Image } from 'lucide-react'
import { platformApi } from '@/lib/platformApi'
import { platformAuthStore } from '@/store/platformAuth'
import { formatDate } from '@/lib/utils'
import RmcLoader from '@/components/shared/RmcLoader'

interface CompanyRow {
  id: string
  name: string
  code: string
  gstin: string | null
  address: string | null
  city: string | null
  state: string | null
  pin_code: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  logo_path: string | null
  created_at: string
  branchCount: number
  userCount: number
}

// ─── Logo upload — shared by the New Company success screen and Edit modal.
// Posts straight to the platform-auth'd /companies/:id/logo route (see
// routes/platform/companies.ts); the bytes are read back everywhere else
// (print pages, sidebar) through the public route instead, via
// components/shared/CompanyLogo.tsx. `bump` is a cache-buster so the <img>
// preview refreshes immediately after a re-upload instead of showing a
// browser-cached copy of the old file.
function LogoUploadField({ companyId, existingLogo, onUploaded }: { companyId: string; existingLogo: boolean; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [bump, setBump] = useState(0)
  const [hasPreview, setHasPreview] = useState(existingLogo)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('logo', file)
      return platformApi.post(`/companies/${companyId}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      setError('')
      setHasPreview(true)
      setBump(b => b + 1)
      onUploaded()
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to upload logo'),
  })

  return (
    <div>
      {field('Company logo')}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {hasPreview ? (
            <img
              key={bump}
              src={`/api/v1/public/companies/${companyId}/logo?v=${bump}`}
              alt="Company logo"
              className="h-full w-full object-contain"
              onError={() => setHasPreview(false)}
            />
          ) : (
            <Image size={18} className="text-gray-300" />
          )}
        </div>
        <div>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Upload size={12} /> {mutation.isPending ? 'Uploading…' : hasPreview ? 'Replace logo' : 'Upload logo'}
          </button>
          <p className="mt-1 text-[11px] text-gray-400">Shown on invoices, challans and other prints. PNG/JPG, up to 8MB.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) mutation.mutate(file)
            e.target.value = ''
          }}
        />
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

interface ProvisionResult {
  companyId: string
  companyName: string
  companyCode: string
  branchName: string
  branchCode: string
  adminEmail: string
  wasExistingCompany: boolean
}

const emptyForm = {
  companyName: '', companyCode: '', companyGstin: '', companyCity: '', companyState: '', companyPhone: '', companyEmail: '',
  branchName: '', branchCode: '', branchCity: '', branchState: '',
  adminName: '', adminEmail: '', adminPassword: '',
}

function field(label: string, required = false) {
  return (
    <label className="field-label">
      {label}{required && <span className="text-red-500"> *</span>}
    </label>
  )
}

function NewCompanyModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ...emptyForm })
  const [error, setError] = useState('')
  const [result, setResult] = useState<ProvisionResult | null>(null)
  const [copied, setCopied] = useState(false)

  function set(key: keyof typeof emptyForm, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const mutation = useMutation({
    mutationFn: () => platformApi.post('/companies', form).then(r => r.data.data as ProvisionResult),
    onSuccess: data => {
      setResult(data)
      setError('')
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] })
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to create company'),
  })

  function copyLogin() {
    if (!result) return
    navigator.clipboard.writeText(`Login: ${result.adminEmail}\nPassword: ${form.adminPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {result ? 'Company created' : 'New Company'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        {result ? (
          <div className="space-y-4 p-5">
            <p className="text-xs text-gray-500">
              {result.companyName} ({result.companyCode}) is live, with its first plant "{result.branchName}" ({result.branchCode}).
              Share this login with the client:
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs">
              <p>Login: {result.adminEmail}</p>
              <p>Password: {form.adminPassword}</p>
            </div>
            <LogoUploadField companyId={result.companyId} existingLogo={false} onUploaded={() => queryClient.invalidateQueries({ queryKey: ['platform-companies'] })} />
            <div className="flex gap-2">
              <button
                onClick={copyLogin}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy login'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={e => { e.preventDefault(); mutation.mutate() }}
            className="space-y-5 p-5"
          >
            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}

            <div>
              <p className="section-label mb-2">Company</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  {field('Company name', true)}
                  <input required value={form.companyName} onChange={e => set('companyName', e.target.value)} className="form-input" placeholder="Acme Concrete Pvt Ltd" />
                </div>
                <div>
                  {field('Short code', true)}
                  <input required value={form.companyCode} onChange={e => set('companyCode', e.target.value.toUpperCase())} className="form-input" placeholder="ACME" />
                </div>
                <div>
                  {field('GSTIN')}
                  <input value={form.companyGstin} onChange={e => set('companyGstin', e.target.value)} className="form-input" />
                </div>
                <div>
                  {field('City')}
                  <input value={form.companyCity} onChange={e => set('companyCity', e.target.value)} className="form-input" />
                </div>
                <div>
                  {field('State')}
                  <input value={form.companyState} onChange={e => set('companyState', e.target.value)} className="form-input" />
                </div>
                <div>
                  {field('Phone')}
                  <input value={form.companyPhone} onChange={e => set('companyPhone', e.target.value)} className="form-input" />
                </div>
                <div>
                  {field('Email')}
                  <input type="email" value={form.companyEmail} onChange={e => set('companyEmail', e.target.value)} className="form-input" />
                </div>
              </div>
            </div>

            <div>
              <p className="section-label mb-2">First plant / branch</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {field('Plant name', true)}
                  <input required value={form.branchName} onChange={e => set('branchName', e.target.value)} className="form-input" placeholder="Acme Main Plant" />
                </div>
                <div>
                  {field('Plant code', true)}
                  <input required value={form.branchCode} onChange={e => set('branchCode', e.target.value.toUpperCase())} className="form-input" placeholder="ACMEMAIN" />
                </div>
                <div>
                  {field('City')}
                  <input value={form.branchCity} onChange={e => set('branchCity', e.target.value)} className="form-input" />
                </div>
                <div>
                  {field('State')}
                  <input value={form.branchState} onChange={e => set('branchState', e.target.value)} className="form-input" />
                </div>
              </div>
            </div>

            <div>
              <p className="section-label mb-2">First admin login</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  {field('Name', true)}
                  <input required value={form.adminName} onChange={e => set('adminName', e.target.value)} className="form-input" />
                </div>
                <div>
                  {field('Email', true)}
                  <input required type="email" value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)} className="form-input" />
                </div>
                <div>
                  {field('Temp password', true)}
                  <input required value={form.adminPassword} onChange={e => set('adminPassword', e.target.value)} className="form-input" placeholder="min 6 characters" />
                </div>
              </div>
            </div>

            <button
              type="submit" disabled={mutation.isPending}
              className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {mutation.isPending ? 'Creating…' : 'Create company'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const emptyEditForm = { name: '', gstin: '', address: '', city: '', state: '', pinCode: '', phone: '', email: '' }

function EditCompanyModal({ company, onClose }: { company: CompanyRow; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: company.name, gstin: company.gstin ?? '', address: company.address ?? '',
    city: company.city ?? '', state: company.state ?? '', pinCode: company.pin_code ?? '',
    phone: company.phone ?? '', email: company.email ?? '',
  })
  const [error, setError] = useState('')

  function set(key: keyof typeof emptyEditForm, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const mutation = useMutation({
    mutationFn: () => platformApi.patch(`/companies/${company.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] })
      onClose()
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to save changes'),
  })

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Edit {company.name}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="space-y-5 p-5">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <LogoUploadField companyId={company.id} existingLogo={!!company.logo_path} onUploaded={() => queryClient.invalidateQueries({ queryKey: ['platform-companies'] })} />

          <div>
            {field('Company name', true)}
            <input required value={form.name} onChange={e => set('name', e.target.value)} className="form-input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              {field('Short code')}
              <input disabled value={company.code} className="form-input bg-gray-50 text-gray-400" />
              <p className="mt-1 text-[11px] text-gray-400">Code can't be changed after creation.</p>
            </div>
            <div>
              {field('GSTIN')}
              <input value={form.gstin} onChange={e => set('gstin', e.target.value)} className="form-input" />
            </div>
            <div>
              {field('Pin code')}
              <input value={form.pinCode} onChange={e => set('pinCode', e.target.value)} className="form-input" />
            </div>
            <div className="col-span-2">
              {field('Address')}
              <input value={form.address} onChange={e => set('address', e.target.value)} className="form-input" />
            </div>
            <div>
              {field('City')}
              <input value={form.city} onChange={e => set('city', e.target.value)} className="form-input" />
            </div>
            <div>
              {field('State')}
              <input value={form.state} onChange={e => set('state', e.target.value)} className="form-input" />
            </div>
            <div>
              {field('Phone')}
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="form-input" />
            </div>
            <div>
              {field('Email')}
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="form-input" />
            </div>
          </div>

          <button
            type="submit" disabled={mutation.isPending}
            className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function PlatformCompaniesPage() {
  const navigate = useNavigate()
  const admin = platformAuthStore.getAdmin()
  const queryClient = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<CompanyRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['platform-companies'],
    queryFn: () => platformApi.get('/companies').then(r => r.data.data as CompanyRow[]),
  })

  const toggleActive = useMutation({
    mutationFn: (c: CompanyRow) => platformApi.patch(`/companies/${c.id}/active`, { isActive: !c.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-companies'] }),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="font-bold text-gray-900">CretOS Platform</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{admin?.name}</span>
            <button
              onClick={() => { platformAuthStore.clear(); navigate('/platform/login') }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Client companies</h1>
            <p className="text-xs text-gray-500">Every tenant on this install — each fully isolated from the others.</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover"
          >
            <Plus size={14} /> New Company
          </button>
        </div>

        {isLoading ? (
          <RmcLoader size="md" />
        ) : !data?.length ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 py-16 text-center">
            <Building2 size={24} className="text-gray-300" />
            <p className="text-sm text-gray-500">No companies yet</p>
            <p className="text-xs text-gray-400">Create your first client above.</p>
          </div>
        ) : (
          <div className="reveal overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="section-label px-4 py-2.5 text-left">Company</th>
                  <th className="section-label px-4 py-2.5 text-left">Location</th>
                  <th className="section-label px-4 py-2.5 text-right">Plants</th>
                  <th className="section-label px-4 py-2.5 text-right">Users</th>
                  <th className="section-label px-4 py-2.5 text-left">Created</th>
                  <th className="section-label px-4 py-2.5 text-left">Status</th>
                  <th className="section-label px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.map((c, idx) => (
                  <tr key={c.id} className={`border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="font-mono text-[11px] text-gray-400">{c.code}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-2.5 text-right table-num">{c.branchCount}</td>
                    <td className="px-4 py-2.5 text-right table-num">{c.userCount}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setEditing(c)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-accent"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => toggleActive.mutate(c)}
                          disabled={toggleActive.isPending}
                          className="text-xs text-gray-500 hover:text-accent disabled:opacity-50"
                        >
                          {c.is_active ? 'Suspend' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && <NewCompanyModal onClose={() => setShowNew(false)} />}
      {editing && <EditCompanyModal company={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
