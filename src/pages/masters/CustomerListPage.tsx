import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, FileText, Pencil, Search, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'
import ImportCsvModal, { ImportColumn, ImportResult } from '@/components/shared/ImportCsvModal'

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'code', label: 'Code' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'mobile', label: 'Mobile', aliases: ['Phone'] },
  { key: 'email', label: 'Email' },
  { key: 'contact_person', label: 'Contact Person' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pin_code', label: 'Pin Code', aliases: ['Pincode', 'Zip'] },
  { key: 'payment_term', label: 'Payment Term' },
  { key: 'credit_limit', label: 'Credit Limit' },
]

interface CustomerRow {
  id: string
  name: string
  code: string | null
  gstin: string | null
  mobile: string | null
  contact_person: string | null
  city: string | null
  state: string | null
  payment_term: string | null
  credit_limit: string | number | null
  is_active: boolean
  credit_hold: boolean
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

function RowActions({ customer, onToggleActive }: { customer: CustomerRow; onToggleActive: (c: CustomerRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/masters/customers/${customer.id}/statement`} title="Statement" aria-label="Statement" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <FileText size={14} />
      </Link>
      <Link to={`/masters/customers/${customer.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      <button
        type="button"
        onClick={() => onToggleActive(customer)}
        className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        {customer.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function CustomerListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isActive, setIsActive] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, isActive],
    queryFn: () =>
      api
        .get('/masters/customers', {
          params: { page, limit: 25, search: search || undefined, is_active: isActive || undefined },
        })
        .then(r => r.data.data as { data: CustomerRow[]; total: number; page: number; limit: number }),
  })

  const toggleActive = useMutation({
    mutationFn: (customer: CustomerRow) =>
      customer.is_active
        ? api.delete(`/masters/customers/${customer.id}`)
        : api.put(`/masters/customers/${customer.id}`, { is_active: true }),
    onSuccess: (_res, customer) => {
      toast({ variant: 'success', title: customer.is_active ? 'Customer deactivated' : 'Customer activated' })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (e: any) => {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' })
    },
  })

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: c => (
        <div className="flex items-center gap-1.5">
          <Link to={`/masters/customers/${c.id}/edit`} className="font-medium text-gray-800 hover:text-accent">
            {c.name}
          </Link>
          {c.credit_hold && (
            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700" title="Credit hold — dispatch blocked">
              Hold
            </span>
          )}
        </div>
      ),
    },
    { key: 'code', header: 'Code', render: c => <span className="font-mono text-xs text-gray-500">{c.code ?? '—'}</span> },
    { key: 'gstin', header: 'GSTIN', render: c => <span className="font-mono text-xs text-gray-600">{c.gstin || '—'}</span> },
    {
      key: 'contact',
      header: 'Contact',
      render: c => (
        <div>
          <p className="text-xs text-gray-700">{c.contact_person ?? '—'}</p>
          {c.mobile && <p className="font-mono text-[11px] text-gray-400">{c.mobile}</p>}
        </div>
      ),
    },
    { key: 'location', header: 'City/State', render: c => (c.city || c.state ? `${c.city ?? '—'}, ${c.state ?? '—'}` : '—') },
    { key: 'payment_term', header: 'Payment Term', render: c => c.payment_term ?? '—' },
    {
      key: 'credit_limit',
      header: 'Credit Limit',
      align: 'right',
      render: c => (c.credit_limit != null ? `₹${formatINR(Number(c.credit_limit))}` : '—'),
    },
    { key: 'is_active', header: 'Status', render: c => <StatusBadge status={c.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', header: '', align: 'right', render: c => <RowActions customer={c} onToggleActive={cust => toggleActive.mutate(cust)} /> },
  ]

  const customers = data?.data ?? []
  const showEmptyState = !isLoading && customers.length === 0 && !search && !isActive

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Buyers of ready-mix concrete — the party billed on each order and dispatch"
        onNew={() => navigate('/masters/customers/new')}
        newLabel="New Customer"
        actions={
          <button
            onClick={() => setImportOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload size={13} /> Import CSV
          </button>
        }
      />

      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Customers"
        columns={IMPORT_COLUMNS}
        onImport={rows => api.post('/masters/customers/import', { rows }).then(r => r.data.data as ImportResult)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name, code, mobile..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select
          value={isActive}
          onChange={e => { setIsActive(e.target.value); setPage(1) }}
          className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <Building2 size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No customers yet. Add your first customer to start an order.</p>
          <button
            onClick={() => navigate('/masters/customers/new')}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover"
          >
            + Add Customer
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={customers} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
