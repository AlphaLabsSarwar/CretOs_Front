import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Users as UsersIcon, Pencil, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import DataTable, { Column, StatusBadge } from '@/components/shared/DataTable'

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  branch_name: string | null
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  OPERATOR: 'Operator (Quick Dispatch only)',
  VIEWER: 'Viewer',
}

function RowActions({ user, onToggleActive }: { user: UserRow; onToggleActive: (u: UserRow) => void }) {
  return (
    <div className="row-actions flex items-center justify-end gap-1">
      <Link to={`/masters/users/${user.id}/edit`} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Pencil size={14} />
      </Link>
      <button type="button" onClick={() => onToggleActive(user)} className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700">
        {user.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function UserListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () =>
      api.get('/masters/users', { params: { page, limit: 25, search: search || undefined } })
        .then(r => r.data.data as { data: UserRow[]; total: number; page: number; limit: number }),
  })

  const toggleActive = useMutation({
    mutationFn: (user: UserRow) =>
      user.is_active
        ? api.delete(`/masters/users/${user.id}`)
        : api.put(`/masters/users/${user.id}`, { is_active: true }),
    onSuccess: (_res, user) => {
      toast({ variant: 'success', title: user.is_active ? 'User deactivated' : 'User activated' })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e: any) => toast({ variant: 'error', title: 'Something went wrong', description: e?.response?.data?.error ?? 'Please try again.' }),
  })

  const columns: Column<UserRow>[] = [
    { key: 'name', header: 'Name', render: u => <Link to={`/masters/users/${u.id}/edit`} className="font-medium text-gray-800 hover:text-accent">{u.name}</Link> },
    { key: 'email', header: 'Email', render: u => <span className="text-xs text-gray-600">{u.email}</span> },
    { key: 'role', header: 'Role', render: u => <span className="text-xs">{ROLE_LABELS[u.role] ?? u.role}</span> },
    { key: 'branch_name', header: 'Branch', render: u => u.branch_name ?? '—' },
    { key: 'is_active', header: 'Status', render: u => <StatusBadge status={u.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', header: '', align: 'right', render: u => <RowActions user={u} onToggleActive={row => toggleActive.mutate(row)} /> },
  ]

  const users = data?.data ?? []
  const showEmptyState = !isLoading && users.length === 0 && !search

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Staff logins — set role to Operator for a fast loading-bay-only screen"
        onNew={() => navigate('/masters/users/new')}
        newLabel="New User"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name, email..."
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-16">
          <UsersIcon size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">No additional users yet.</p>
          <button onClick={() => navigate('/masters/users/new')} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover">
            + Add User
          </button>
        </div>
      ) : (
        <DataTable columns={columns} data={users} loading={isLoading} total={data?.total} page={page} limit={25} onPageChange={setPage} />
      )}
    </div>
  )
}
