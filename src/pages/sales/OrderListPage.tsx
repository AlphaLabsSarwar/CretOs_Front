import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface OrderRow {
  id: string
  order_no: string
  date: string
  job_site: string
  sales_type: string | null
  tax_type: string
  from_date: string
  to_date: string
  status: string
  customer_id: string
}

const STATUS_OPTIONS = ['', 'DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED']

function RowActions({ order, onActivate }: { order: OrderRow; onActivate: (o: OrderRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/sales/orders/${order.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      {order.status === 'DRAFT' && (
        <button type="button" onClick={() => onActivate(order)} className="rounded px-1.5 py-1 text-[11px] text-accent hover:bg-orange-50">
          Activate
        </button>
      )}
    </div>
  )
}

export default function OrderListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, status],
    queryFn: () =>
      api.get('/sales/orders', { params: { page, limit: 25, status: status || undefined } })
        .then(r => r.data.data as { data: OrderRow[]; total: number; page: number; limit: number }),
  })

  const activate = useMutation({
    mutationFn: (order: OrderRow) => api.put(`/sales/orders/${order.id}`, { status: 'ACTIVE' }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Order activated' })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const columns: Column<OrderRow>[] = [
    {
      key: 'order_no',
      header: 'Order No',
      render: o => <Link to={`/sales/orders/${o.id}/edit`} className="font-mono text-xs font-medium text-gray-800 hover:text-accent">{o.order_no}</Link>,
    },
    { key: 'date', header: 'Date', render: o => new Date(o.date).toLocaleDateString('en-IN') },
    { key: 'job_site', header: 'Job Site' },
    { key: 'sales_type', header: 'Type', render: o => o.sales_type ?? '—' },
    { key: 'tax_type', header: 'Tax', render: o => o.tax_type },
    {
      key: 'period',
      header: 'Period',
      render: o => `${new Date(o.from_date).toLocaleDateString('en-IN')} – ${new Date(o.to_date).toLocaleDateString('en-IN')}`,
    },
    { key: 'status', header: 'Status', render: o => <StatusBadge status={o.status} /> },
    { key: 'actions', header: '', align: 'right', render: o => <RowActions order={o} onActivate={row => activate.mutate(row)} /> },
  ]

  const orders = data?.data ?? []
  const showEmptyState = !isLoading && orders.length === 0 && !status

  return (
    <div>
      <PageHeader
        title="Work Orders"
        subtitle="Customer sales orders — the contract a job site's schedules and dispatches are billed against"
        onNew={() => navigate('/sales/orders/new')}
        newLabel="New Order"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <ClipboardList size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No work orders yet. Create an order for a customer's job site.</p>
          <button onClick={() => navigate('/sales/orders/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + New Order
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={orders} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
