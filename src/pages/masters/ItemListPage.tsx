import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Pencil, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'
import { MATERIAL_ROLE_LABELS } from '@/lib/materialRoles'

interface ItemRow {
  id: string
  item_no: string | null
  name: string
  brand: string | null
  category: string | null
  uom: string
  hsn_code: string | null
  for_stock: boolean
  for_sale: boolean
  material_role: string | null
  is_active: boolean
}

function RowActions({ item, onToggleActive }: { item: ItemRow; onToggleActive: (i: ItemRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/masters/items/${item.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      <button type="button" onClick={() => onToggleActive(item)} className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700">
        {item.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function ItemListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['items', page, search],
    queryFn: () => api.get('/masters/items', { params: { page, limit: 25, search: search || undefined } })
      .then(r => r.data.data as { data: ItemRow[]; total: number }),
  })

  const toggleActive = useMutation({
    mutationFn: (item: ItemRow) =>
      item.is_active
        ? api.delete(`/masters/items/${item.id}`)
        : api.put(`/masters/items/${item.id}`, { is_active: true }),
    onSuccess: (_res, item) => {
      toast({ variant: 'success', title: item.is_active ? 'Item deactivated' : 'Item activated' })
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const columns: Column<ItemRow>[] = [
    { key: 'name', header: 'Item', render: i => (
      <Link to={`/masters/items/${i.id}/edit`} className="font-medium text-gray-800 hover:text-accent">{i.name}</Link>
    )},
    { key: 'item_no', header: 'Item No', render: i => <span className="font-mono text-xs text-gray-500">{i.item_no ?? '—'}</span> },
    { key: 'category', header: 'Category', render: i => i.category ?? i.brand ?? '—' },
    { key: 'uom', header: 'UOM', render: i => <span className="font-mono text-xs">{i.uom}</span> },
    { key: 'hsn_code', header: 'HSN', render: i => <span className="font-mono text-xs text-gray-500">{i.hsn_code ?? '—'}</span> },
    { key: 'material_role', header: 'Recipe Role', render: i => i.material_role ? (
      <span className="status-badge border border-orange-200 bg-orange-50 text-orange-700">{MATERIAL_ROLE_LABELS[i.material_role] ?? i.material_role}</span>
    ) : <span className="text-xs text-gray-300">—</span> },
    { key: 'flags', header: 'Flags', render: i => (
      <div className="flex gap-1">
        {i.for_stock && <span className="status-badge border border-blue-200 bg-blue-50 text-blue-700">Stock</span>}
        {i.for_sale && <span className="status-badge border border-green-200 bg-green-50 text-green-700">Sale</span>}
      </div>
    )},
    { key: 'is_active', header: 'Status', render: i => <StatusBadge status={i.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', header: '', align: 'right', render: i => <RowActions item={i} onToggleActive={row => toggleActive.mutate(row)} /> },
  ]

  const items = data?.data ?? []
  const showEmptyState = !isLoading && items.length === 0 && !search

  return (
    <div>
      <PageHeader
        title="Materials"
        subtitle="Item master — raw materials, stock items and sale items. Assign a Recipe Role to link an item into concrete mix recipes."
        onNew={() => navigate('/masters/items/new')}
        newLabel="New Item"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search item name, no., brand..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <Boxes size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No items yet. Add cement, aggregates, sand or any other material.</p>
          <button onClick={() => navigate('/masters/items/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + Add Item
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={items} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
