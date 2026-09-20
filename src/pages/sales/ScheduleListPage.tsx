import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'
import VehicleSuggestionPanel from './VehicleSuggestionPanel'

interface ScheduleRow {
  id: string
  sch_no: string
  date: string
  job_site: string
  grade_name: string | null
  qty: string | number
  pump_type: string
  status: string
}

const STATUS_OPTIONS = ['', 'DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED']

function RowActions({ schedule, onActivate }: { schedule: ScheduleRow; onActivate: (s: ScheduleRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/sales/schedules/${schedule.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      {schedule.status === 'DRAFT' && (
        <button type="button" onClick={() => onActivate(schedule)} className="rounded px-1.5 py-1 text-[11px] text-accent hover:bg-orange-50">
          Activate
        </button>
      )}
    </div>
  )
}

export default function ScheduleListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = authStore.getUser()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['schedules', page, status],
    queryFn: () =>
      api.get('/sales/schedules', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: ScheduleRow[]; total: number; page: number; limit: number }),
  })

  const activate = useMutation({
    mutationFn: (schedule: ScheduleRow) => api.put(`/sales/schedules/${schedule.id}`, { status: 'ACTIVE' }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Schedule activated' })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const columns: Column<ScheduleRow>[] = [
    {
      key: 'sch_no',
      header: 'Schedule No',
      render: s => <Link to={`/sales/schedules/${s.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{s.sch_no}</Link>,
    },
    { key: 'date', header: 'Date', render: s => new Date(s.date).toLocaleDateString('en-IN') },
    { key: 'job_site', header: 'Job Site' },
    { key: 'grade_name', header: 'Grade', render: s => s.grade_name ?? '—' },
    { key: 'qty', header: 'Qty (Cum)', align: 'right', render: s => Number(s.qty).toFixed(2) },
    { key: 'pump_type', header: 'Pump', render: s => s.pump_type === 'WITH_PUMP' ? 'With Pump' : 'Without Pump' },
    { key: 'status', header: 'Status', render: s => <StatusBadge status={s.status} /> },
    { key: 'actions', header: '', align: 'right', render: s => <RowActions schedule={s} onActivate={row => activate.mutate(row)} /> },
  ]

  const schedules = data?.data ?? []
  const showEmptyState = !isLoading && schedules.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="Daily Schedule"
        subtitle="Plan tomorrow's dispatch by job site and grade — dispatch challans can pull straight from an activated schedule"
        onNew={() => navigate('/sales/schedules/new')}
        newLabel="New Schedule"
      />

      <VehicleSuggestionPanel branchId={user?.branch?.id} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <Calendar size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No schedules yet. Plan a job site's dispatch for the day.</p>
          <button onClick={() => navigate('/sales/schedules/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New Schedule
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={schedules} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
