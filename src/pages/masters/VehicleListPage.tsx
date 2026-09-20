import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Car, Pencil, Search, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'
import ImportCsvModal, { ImportColumn, ImportResult } from '@/components/shared/ImportCsvModal'

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'vehicle_no', label: 'Vehicle No', required: true },
  { key: 'vehicle_type', label: 'Vehicle Type', aliases: ['Type'] },
  { key: 'capacity', label: 'Capacity' },
  { key: 'owner_name', label: 'Owner Name', aliases: ['Owner'] },
  { key: 'mobile', label: 'Mobile', aliases: ['Phone'] },
]

interface VehicleRow {
  id: string
  vehicle_no: string
  vehicle_type: string | null
  capacity: string | number | null
  owner_name: string | null
  mobile: string | null
  is_active: boolean
}

function RowActions({ vehicle, onToggleActive }: { vehicle: VehicleRow; onToggleActive: (v: VehicleRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/masters/vehicles/${vehicle.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      <button type="button" onClick={() => onToggleActive(vehicle)} className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700">
        {vehicle.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function VehicleListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', page, search],
    queryFn: () =>
      api.get('/masters/vehicles', { params: { page, limit: 25, search: search || undefined } })
        .then(r => r.data.data as { data: VehicleRow[]; total: number; page: number; limit: number }),
  })

  const toggleActive = useMutation({
    mutationFn: (vehicle: VehicleRow) =>
      vehicle.is_active
        ? api.delete(`/masters/vehicles/${vehicle.id}`)
        : api.put(`/masters/vehicles/${vehicle.id}`, { is_active: true }),
    onSuccess: (_res, vehicle) => {
      toast({ variant: 'success', title: vehicle.is_active ? 'Vehicle deactivated' : 'Vehicle activated' })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const columns: Column<VehicleRow>[] = [
    {
      key: 'vehicle_no',
      header: 'Vehicle No',
      render: v => <Link to={`/masters/vehicles/${v.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{v.vehicle_no}</Link>,
    },
    { key: 'vehicle_type', header: 'Type', render: v => v.vehicle_type ?? '—' },
    { key: 'capacity', header: 'Capacity (Cum)', align: 'right', render: v => v.capacity != null ? Number(v.capacity).toFixed(2) : '—' },
    { key: 'owner_name', header: 'Owner', render: v => v.owner_name ?? '—' },
    { key: 'mobile', header: 'Mobile', render: v => <span className="font-mono text-xs">{v.mobile ?? '—'}</span> },
    { key: 'is_active', header: 'Status', render: v => <StatusBadge status={v.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', header: '', align: 'right', render: v => <RowActions vehicle={v} onToggleActive={row => toggleActive.mutate(row)} /> },
  ]

  const vehicles = data?.data ?? []
  const showEmptyState = !isLoading && vehicles.length === 0 && !search

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Transit mixers and pumps used for dispatch"
        onNew={() => navigate('/masters/vehicles/new')}
        newLabel="New Vehicle"
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
        title="Vehicles"
        columns={IMPORT_COLUMNS}
        onImport={rows => api.post('/masters/vehicles/import', { rows }).then(r => r.data.data as ImportResult)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['vehicles'] })}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search vehicle no, owner..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <Car size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No vehicles yet. Add your first transit mixer.</p>
          <button onClick={() => navigate('/masters/vehicles/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + Add Vehicle
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={vehicles} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
