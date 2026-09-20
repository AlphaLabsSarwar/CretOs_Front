import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Eye, MoreHorizontal, Pencil, Search, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatINR } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'
import VendorTypeBadge from '@/components/shared/VendorTypeBadge'
import ImportCsvModal, { ImportColumn, ImportResult } from '@/components/shared/ImportCsvModal'

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'code', label: 'Code' },
  { key: 'vendor_type', label: 'Vendor Type', aliases: ['Type'] },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'pan_no', label: 'PAN' },
  { key: 'mobile', label: 'Mobile', aliases: ['Phone'] },
  { key: 'email', label: 'Email' },
  { key: 'contact_person', label: 'Contact Person' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pin_code', label: 'Pin Code', aliases: ['Pincode', 'Zip'] },
  { key: 'payment_term', label: 'Payment Term' },
  { key: 'credit_limit', label: 'Credit Limit' },
  { key: 'opening_balance', label: 'Opening Balance' },
]

interface VendorRow {
  id: string
  name: string
  code: string | null
  vendor_type: string
  gstin: string | null
  mobile: string | null
  contact_person: string | null
  city: string | null
  state: string | null
  payment_term: string | null
  is_active: boolean
  total_pos: number
  total_grns: number
  outstanding_amount: number
}

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'TRANSPORTER', label: 'Transporter' },
  { value: 'BOTH', label: 'Both' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

function RowActionsMenu({ vendor, onToggleActive }: { vendor: VendorRow; onToggleActive: (v: VendorRow) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link
        to={`/masters/vendors/${vendor.id}`}
        title="View"
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <Eye size={14} />
      </Link>
      <Link
        to={`/masters/vendors/${vendor.id}/edit`}
        title="Edit"
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <Pencil size={14} />
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <MoreHorizontal size={14} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onToggleActive(vendor)
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                {vendor.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function VendorListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [vendorType, setVendorType] = useState('')
  const [isActive, setIsActive] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', page, search, vendorType, isActive],
    queryFn: () =>
      api
        .get('/masters/vendors', {
          params: {
            page,
            limit: 25,
            search: search || undefined,
            vendor_type: vendorType || undefined,
            is_active: isActive || undefined,
          },
        })
        .then(r => r.data.data as { data: VendorRow[]; total: number; page: number; limit: number }),
  })

  const toggleActive = useMutation({
    mutationFn: (vendor: VendorRow) =>
      vendor.is_active
        ? api.delete(`/masters/vendors/${vendor.id}`)
        : api.put(`/masters/vendors/${vendor.id}`, { is_active: true }),
    onSuccess: (_res, vendor) => {
      toast({ variant: 'success', title: vendor.is_active ? 'Vendor deactivated' : 'Vendor activated' })
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
    onError: (e: any) => {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' })
    },
  })

  const columns: Column<VendorRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: v => (
        <Link to={`/masters/vendors/${v.id}`} className="font-medium text-gray-800 hover:text-accent">
          {v.name}
        </Link>
      ),
    },
    { key: 'code', header: 'Code', render: v => <span className="font-mono text-xs text-gray-500">{v.code ?? '—'}</span> },
    { key: 'vendor_type', header: 'Type', render: v => <VendorTypeBadge type={v.vendor_type} /> },
    { key: 'gstin', header: 'GSTIN', render: v => <span className="font-mono text-xs text-gray-600">{v.gstin || '—'}</span> },
    {
      key: 'contact',
      header: 'Contact',
      render: v => (
        <div>
          <p className="text-xs text-gray-700">{v.contact_person ?? '—'}</p>
          {v.mobile && <p className="font-mono text-[11px] text-gray-400">{v.mobile}</p>}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'City/State',
      render: v => (v.city || v.state ? `${v.city ?? '—'}, ${v.state ?? '—'}` : '—'),
    },
    { key: 'payment_term', header: 'Payment Term', render: v => v.payment_term ?? '—' },
    { key: 'total_pos', header: 'Total POs', align: 'right', render: v => v.total_pos },
    {
      key: 'outstanding_amount',
      header: 'Outstanding',
      align: 'right',
      render: v => <span className={cn(v.outstanding_amount > 0 && 'text-red-600')}>₹{formatINR(v.outstanding_amount)}</span>,
    },
    { key: 'is_active', header: 'Status', render: v => <StatusBadge status={v.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: v => <RowActionsMenu vendor={v} onToggleActive={vendor => toggleActive.mutate(vendor)} />,
    },
  ]

  const vendors = data?.data ?? []
  const showEmptyState = !isLoading && vendors.length === 0 && !search && !vendorType && !isActive

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Supplier and transporter master"
        onNew={() => navigate('/masters/vendors/new')}
        newLabel="New Vendor"
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
        title="Vendors"
        columns={IMPORT_COLUMNS}
        onImport={rows => api.post('/masters/vendors/import', { rows }).then(r => r.data.data as ImportResult)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['vendors'] })}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search name, code, GSTIN..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select
          value={vendorType}
          onChange={e => {
            setVendorType(e.target.value)
            setPage(1)
          }}
          className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={isActive}
          onChange={e => {
            setIsActive(e.target.value)
            setPage(1)
          }}
          className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <Building2 size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No vendors yet. Add your first supplier.</p>
          <button
            onClick={() => navigate('/masters/vendors/new')}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover"
          >
            + Add Vendor
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={vendors}
          loading={isLoading}
          total={data?.total}
          page={page}
          limit={25}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
