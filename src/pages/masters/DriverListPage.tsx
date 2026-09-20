import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserRound, Pencil, Search, Upload, Smartphone } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'
import ImportCsvModal, { ImportColumn, ImportResult } from '@/components/shared/ImportCsvModal'

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'mobile', label: 'Mobile', aliases: ['Phone'] },
  { key: 'license_no', label: 'License No', aliases: ['License'] },
  { key: 'driver_type', label: 'Driver Type', aliases: ['Type'] },
]

interface DriverRow {
  id: string
  name: string
  mobile: string | null
  license_no: string | null
  is_active: boolean
  app_enabled: boolean
  driver_type: string
}

function RowActions({ driver, onToggleActive }: { driver: DriverRow; onToggleActive: (v: DriverRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/masters/drivers/${driver.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      <button type="button" onClick={() => onToggleActive(driver)} className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700">
        {driver.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function DriverListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [driverType, setDriverType] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, search, driverType],
    queryFn: () =>
      api.get('/masters/drivers', { params: { page, limit: 25, search: search || undefined, driver_type: driverType || undefined } })
        .then(r => r.data.data as { data: DriverRow[]; total: number; page: number; limit: number }),
  })

  const toggleActive = useMutation({
    mutationFn: (driver: DriverRow) =>
      driver.is_active
        ? api.delete(`/masters/drivers/${driver.id}`)
        : api.put(`/masters/drivers/${driver.id}`, { is_active: true }),
    onSuccess: (_res, driver) => {
      toast({ variant: 'success', title: driver.is_active ? 'Driver deactivated' : 'Driver activated' })
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const columns: Column<DriverRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: d => (
        <div className="flex items-center gap-1.5">
          <Link to={`/masters/drivers/${d.id}/edit`} className="text-xs font-medium text-gray-800 hover:text-accent">{d.name}</Link>
          {d.driver_type === 'CASUAL' && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700" title="Casual / daily-wage driver">
              Casual
            </span>
          )}
        </div>
      ),
    },
    { key: 'mobile', header: 'Mobile', render: d => <span className="font-mono text-xs">{d.mobile ?? '—'}</span> },
    { key: 'license_no', header: 'License No', render: d => <span className="font-mono text-xs">{d.license_no ?? '—'}</span> },
    {
      key: 'app_enabled', header: 'App Access',
      render: d => d.app_enabled
        ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700"><Smartphone size={11} /> Enabled</span>
        : <span className="text-[11px] text-gray-400">Off</span>,
    },
    { key: 'is_active', header: 'Status', render: d => <StatusBadge status={d.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', header: '', align: 'right', render: d => <RowActions driver={d} onToggleActive={row => toggleActive.mutate(row)} /> },
  ]

  const drivers = data?.data ?? []
  const showEmptyState = !isLoading && drivers.length === 0 && !search

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle="Transit mixer drivers — mobile app access is set per driver from the edit screen"
        onNew={() => navigate('/masters/drivers/new')}
        newLabel="New Driver"
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
        title="Drivers"
        columns={IMPORT_COLUMNS}
        onImport={rows => api.post('/masters/drivers/import', { rows }).then(r => r.data.data as ImportResult)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['drivers'] })}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name, mobile..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select
          value={driverType}
          onChange={e => { setDriverType(e.target.value); setPage(1) }}
          className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All Types</option>
          <option value="PERMANENT">Permanent</option>
          <option value="CASUAL">Casual (Daily Wage)</option>
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <UserRound size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No drivers yet. Add your first driver.</p>
          <button onClick={() => navigate('/masters/drivers/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + Add Driver
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={drivers} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
