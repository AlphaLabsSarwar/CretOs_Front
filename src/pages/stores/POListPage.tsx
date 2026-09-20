import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { formatINR } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface PORow {
  id: string
  po_no: string
  date: string
  vendor_name: string | null
  po_type: string | null
  total_amount: string | number
  status: string
}

const STATUS_OPTIONS = ['', 'DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'CLOSED', 'CANCELLED']

function RowActions({
  po, canApprove, onActivate, onApprove, onReject,
}: {
  po: PORow
  canApprove: boolean
  onActivate: (p: PORow) => void
  onApprove: (p: PORow) => void
  onReject: (p: PORow) => void
}) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/stores/po/${po.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      {po.status === 'DRAFT' && (
        <button type="button" onClick={() => onActivate(po)} className="rounded px-1.5 py-1 text-[11px] text-accent hover:bg-orange-50">
          Activate
        </button>
      )}
      {po.status === 'PENDING_APPROVAL' && canApprove && (
        <>
          <button type="button" onClick={() => onApprove(po)} className="rounded px-1.5 py-1 text-[11px] text-green-700 hover:bg-green-50">
            Approve
          </button>
          <button type="button" onClick={() => onReject(po)} className="rounded px-1.5 py-1 text-[11px] text-red-600 hover:bg-red-50">
            Reject
          </button>
        </>
      )}
      {po.status === 'PENDING_APPROVAL' && !canApprove && (
        <span className="text-[11px] text-purple-600">Awaiting approval</span>
      )}
    </div>
  )
}

export default function POListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const user = authStore.getUser()
  const canApprove = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const { data, isLoading } = useQuery({
    queryKey: ['pos', page, status],
    queryFn: () =>
      api.get('/stores/po', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: PORow[]; total: number; page: number; limit: number }),
  })

  const activate = useMutation({
    mutationFn: (po: PORow) => api.put(`/stores/po/${po.id}`, { status: 'ACTIVE' }),
    onSuccess: (res) => {
      const pending = res.data.data.status === 'PENDING_APPROVAL'
      toast({ variant: 'success', title: pending ? 'Submitted for approval' : 'Purchase order activated', description: pending ? 'This PO is over the auto-approval limit and needs Admin/Manager sign-off.' : undefined })
      queryClient.invalidateQueries({ queryKey: ['pos'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const approve = useMutation({
    mutationFn: (po: PORow) => api.post(`/stores/po/${po.id}/approve`),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Purchase order approved' })
      queryClient.invalidateQueries({ queryKey: ['pos'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not approve', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const reject = useMutation({
    mutationFn: (po: PORow) => api.post(`/stores/po/${po.id}/reject`),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Purchase order rejected' })
      queryClient.invalidateQueries({ queryKey: ['pos'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Could not reject', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const columns: Column<PORow>[] = [
    {
      key: 'po_no',
      header: 'PO No',
      render: p => <Link to={`/stores/po/${p.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{p.po_no}</Link>,
    },
    { key: 'date', header: 'Date', render: p => new Date(p.date).toLocaleDateString('en-IN') },
    { key: 'vendor_name', header: 'Vendor', render: p => p.vendor_name ?? '—' },
    { key: 'po_type', header: 'Type', render: p => p.po_type ?? '—' },
    { key: 'total_amount', header: 'Total', align: 'right', render: p => <span className="font-semibold">₹{formatINR(Number(p.total_amount))}</span> },
    { key: 'status', header: 'Status', render: p => <StatusBadge status={p.status} /> },
    { key: 'actions', header: '', align: 'right', render: p => (
      <RowActions po={p} canApprove={canApprove} onActivate={row => activate.mutate(row)} onApprove={row => approve.mutate(row)} onReject={row => reject.mutate(row)} />
    ) },
  ]

  const pos = data?.data ?? []
  const showEmptyState = !isLoading && pos.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Orders placed with vendors for raw material (cement, aggregate, admixture...)"
        onNew={() => navigate('/stores/po/new')}
        newLabel="New PO"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <ShoppingCart size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No purchase orders yet.</p>
          <button onClick={() => navigate('/stores/po/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New PO
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={pos} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
