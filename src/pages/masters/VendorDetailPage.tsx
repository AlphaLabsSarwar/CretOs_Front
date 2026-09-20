import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, CheckCircle2, Loader2, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatINR, maskAccountNumber } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'
import VendorTypeBadge from '@/components/shared/VendorTypeBadge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Vendor {
  id: string
  name: string
  code: string | null
  vendor_type: string
  is_active: boolean
  gstin: string | null
  pan_no: string | null
  tan_no: string | null
  contact_person: string | null
  designation: string | null
  mobile: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  pin_code: string | null
  bank_name: string | null
  bank_branch: string | null
  account_no: string | null
  ifsc_code: string | null
}

interface VendorHistorySummary {
  total_pos: number
  total_pos_amount: number
  total_grns: number
  total_grns_qty: number
  total_paid: number
  outstanding: number
}

interface Transaction {
  type: string
  id: string
  number: string
  date: string
  amount: number
  status: string
  remarks: string | null
}

interface LedgerEntry {
  date: string | null
  type: string
  reference_no: string
  debit: number
  credit: number
  balance: number
  remarks: string | null
}

function InfoCard({ title, rows }: { title: string; rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="section-label mb-3">{title}</p>
      <dl className="space-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-xs">
            <dt className="text-gray-500">{r.label}</dt>
            <dd className="text-right font-medium text-gray-800">{r.value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function TransactionsTab({
  vendorId,
  type,
  numberLabel,
  emptyLabel,
}: {
  vendorId: string
  type: 'po' | 'grn' | 'payment'
  numberLabel: string
  emptyLabel: string
}) {
  const [page, setPage] = useState(1)
  const limit = 10
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-history', vendorId, type, page],
    queryFn: () =>
      api
        .get(`/masters/vendors/${vendorId}/history`, { params: { type, page, limit } })
        .then(r => r.data.data as { transactions: Transaction[]; total: number }),
  })

  const columns: Column<Transaction>[] = [
    { key: 'number', header: numberLabel, render: t => <span className="font-mono text-xs">{t.number}</span> },
    { key: 'date', header: 'Date', render: t => formatDate(t.date) },
    { key: 'amount', header: 'Amount', align: 'right', render: t => `₹${formatINR(t.amount)}` },
    { key: 'status', header: 'Status', render: t => <StatusBadge status={t.status} /> },
    { key: 'remarks', header: 'Remarks', render: t => t.remarks || '—' },
  ]

  return (
    <DataTable
      columns={columns}
      data={data?.transactions ?? []}
      loading={isLoading}
      total={data?.total}
      page={page}
      limit={limit}
      onPageChange={setPage}
      emptyMessage={`No ${emptyLabel} found`}
    />
  )
}

function LedgerTab({ vendorId }: { vendorId: string }) {
  const [page, setPage] = useState(1)
  const limit = 10
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-ledger', vendorId],
    queryFn: () => api.get(`/masters/vendors/${vendorId}/ledger`).then(r => r.data.data as LedgerEntry[]),
  })

  const all = data ?? []
  const total = all.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const paged = useMemo(() => all.slice((page - 1) * limit, page * limit), [all, page])
  const rows = useMemo(() => paged.map((r, i) => ({ ...r, id: `${page}-${i}` })), [paged, page])
  const isLastPage = page >= totalPages

  const columns: Column<LedgerEntry & { id: string }>[] = [
    { key: 'date', header: 'Date', render: r => (r.date ? formatDate(r.date) : '—') },
    { key: 'type', header: 'Type', render: r => <span className="font-medium text-gray-600">{r.type}</span> },
    { key: 'reference_no', header: 'Reference', render: r => <span className="font-mono text-xs">{r.reference_no}</span> },
    { key: 'debit', header: 'Debit', align: 'right', render: r => (r.debit ? `₹${formatINR(r.debit)}` : '—') },
    { key: 'credit', header: 'Credit', align: 'right', render: r => (r.credit ? `₹${formatINR(r.credit)}` : '—') },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: r => (
        <span className="font-semibold">
          ₹{formatINR(Math.abs(r.balance))} {r.balance >= 0 ? 'Dr' : 'Cr'}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={isLoading}
      total={total}
      page={page}
      limit={limit}
      onPageChange={setPage}
      emptyMessage="No ledger entries found"
      rowClassName={(_row, i) => (isLastPage && i === rows.length - 1 ? 'bg-orange-50/70' : '')}
    />
  )
}

export default function VendorDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => api.get(`/masters/vendors/${id}`).then(r => r.data.data as Vendor),
    enabled: !!id,
  })

  const { data: summary } = useQuery({
    queryKey: ['vendor-history-summary', id],
    queryFn: () =>
      api
        .get(`/masters/vendors/${id}/history`, { params: { limit: 1 } })
        .then(r => r.data.data.summary as VendorHistorySummary),
    enabled: !!id,
  })

  const toggleActive = useMutation({
    mutationFn: () =>
      vendor?.is_active
        ? api.delete(`/masters/vendors/${id}`)
        : api.put(`/masters/vendors/${id}`, { is_active: true }),
    onSuccess: () => {
      toast({ variant: 'success', title: vendor?.is_active ? 'Vendor deactivated' : 'Vendor activated' })
      queryClient.invalidateQueries({ queryKey: ['vendor', id] })
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
    onError: (e: any) => {
      toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Loader2 size={13} className="animate-spin" /> Loading vendor...
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        Vendor not found.{' '}
        <Link to="/masters/vendors" className="text-accent hover:underline">
          Back to list
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link to="/masters/vendors" className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
        <ArrowLeft size={13} /> Back to Vendors
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page-title">{vendor.name}</h1>
          {vendor.code && <span className="status-badge border border-gray-200 bg-gray-50 font-mono text-gray-600">{vendor.code}</span>}
          <VendorTypeBadge type={vendor.vendor_type} />
          <StatusBadge status={vendor.is_active ? 'ACTIVE' : 'INACTIVE'} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/masters/vendors/${vendor.id}/edit`)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Pencil size={13} /> Edit
          </button>
          <button
            onClick={() => toggleActive.mutate()}
            disabled={toggleActive.isPending}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {vendor.is_active ? <Ban size={13} /> : <CheckCircle2 size={13} />}
            {vendor.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoCard
          title="Contact"
          rows={[
            { label: 'Contact Person', value: vendor.contact_person },
            { label: 'Mobile', value: vendor.mobile },
            { label: 'Email', value: vendor.email },
            { label: 'Designation', value: vendor.designation },
          ]}
        />
        <InfoCard
          title="Address"
          rows={[
            { label: 'Address', value: vendor.address },
            { label: 'City', value: vendor.city },
            { label: 'State', value: vendor.state },
            { label: 'PIN', value: vendor.pin_code },
          ]}
        />
        <InfoCard
          title="Tax Details"
          rows={[
            { label: 'GSTIN', value: vendor.gstin && <span className="font-mono uppercase">{vendor.gstin}</span> },
            { label: 'PAN', value: vendor.pan_no && <span className="font-mono uppercase">{vendor.pan_no}</span> },
            { label: 'TAN', value: vendor.tan_no && <span className="font-mono uppercase">{vendor.tan_no}</span> },
          ]}
        />
        <InfoCard
          title="Bank"
          rows={[
            { label: 'Bank Name', value: vendor.bank_name },
            { label: 'IFSC', value: vendor.ifsc_code && <span className="font-mono uppercase">{vendor.ifsc_code}</span> },
            { label: 'Account No', value: <span className="font-mono">{maskAccountNumber(vendor.account_no)}</span> },
          ]}
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total POs" value={summary?.total_pos ?? '—'} />
        <StatTile label="Total GRN" value={summary?.total_grns ?? '—'} />
        <StatTile label="Total Paid" value={summary ? `₹${formatINR(summary.total_paid)}` : '—'} />
        <StatTile label="Outstanding" value={summary ? `₹${formatINR(summary.outstanding)}` : '—'} />
      </div>

      <Tabs defaultValue="po">
        <TabsList>
          <TabsTrigger value="po">Purchase Orders</TabsTrigger>
          <TabsTrigger value="grn">GRNs</TabsTrigger>
          <TabsTrigger value="payment">Payments</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="po">
          <TransactionsTab vendorId={vendor.id} type="po" numberLabel="PO No" emptyLabel="purchase orders" />
        </TabsContent>
        <TabsContent value="grn">
          <TransactionsTab vendorId={vendor.id} type="grn" numberLabel="GRN No" emptyLabel="GRNs" />
        </TabsContent>
        <TabsContent value="payment">
          <TransactionsTab vendorId={vendor.id} type="payment" numberLabel="Voucher No" emptyLabel="payments" />
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerTab vendorId={vendor.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
