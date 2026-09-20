import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ModuleDef { key: string; label: string; group: string }
interface RolesMatrix { roles: string[]; modules: ModuleDef[]; matrix: Record<string, Record<string, boolean>> }
interface UserRow { id: string; name: string; email: string; role: string; overrideCount: number }
interface UserModuleRow { key: string; label: string; group: string; roleDefault: boolean; override: boolean | null; resolved: boolean }

// ADMIN is a superuser by design (see utils/permissions.ts) — its row is
// never editable, so it's excluded from the matrix entirely rather than
// shown disabled everywhere.
const EDITABLE_ROLES = ['MANAGER', 'OPERATOR', 'VIEWER']

function groupBy<T extends { group: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    if (!map.has(item.group)) map.set(item.group, [])
    map.get(item.group)!.push(item)
  }
  return Array.from(map.entries())
}

function RoleMatrixTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['permissions-roles'],
    queryFn: () => api.get('/admin/permissions/roles').then(r => r.data.data as RolesMatrix),
  })

  const toggle = useMutation({
    mutationFn: (v: { role: string; module_key: string; can_access: boolean }) =>
      api.put('/admin/permissions/roles', v),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: ['permissions-roles'] })
      const prev = queryClient.getQueryData<RolesMatrix>(['permissions-roles'])
      if (prev) {
        queryClient.setQueryData<RolesMatrix>(['permissions-roles'], {
          ...prev,
          matrix: { ...prev.matrix, [v.role]: { ...prev.matrix[v.role], [v.module_key]: v.can_access } },
        })
      }
      return { prev }
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['permissions-roles'], ctx.prev)
      toast({ variant: 'error', title: 'Could not update', description: e?.response?.data?.error ?? 'Please try again.' })
    },
  })

  if (isLoading) return <RmcLoader size="sm" />
  if (!data) return null

  const groups = groupBy(data.modules)

  return (
    <div>
      <p className="mb-4 text-xs text-gray-500">
        ADMIN always has full access and isn't shown here. Toggling a cell takes effect immediately for every user with that role (unless they have a personal override — see the "By User" tab).
      </p>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="section-label px-4 py-2.5 text-left">Tab / Tile</th>
              {EDITABLE_ROLES.map(role => (
                <th key={role} className="section-label px-4 py-2.5 text-center">{role}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([group, mods]) => (
              <Fragment key={group}>
                <tr className="bg-gray-50/70">
                  <td colSpan={EDITABLE_ROLES.length + 1} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {group}
                  </td>
                </tr>
                {mods.map((m, i) => (
                  <tr key={m.key} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-4 py-2 text-xs text-gray-700">{m.label}</td>
                    {EDITABLE_ROLES.map(role => {
                      const checked = data.matrix[role]?.[m.key] ?? false
                      return (
                        <td key={role} className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => toggle.mutate({ role, module_key: m.key, can_access: e.target.checked })}
                            className="h-3.5 w-3.5 cursor-pointer accent-accent"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ByUserTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string>('')

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['permissions-users'],
    queryFn: () => api.get('/admin/permissions/users').then(r => r.data.data as UserRow[]),
  })

  const editableUsers = useMemo(() => (users ?? []).filter(u => u.role !== 'ADMIN'), [users])

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['permissions-user', selectedId],
    queryFn: () => api.get(`/admin/permissions/users/${selectedId}`).then(r => r.data.data as { user: UserRow; modules: UserModuleRow[] }),
    enabled: !!selectedId,
  })

  const setOverride = useMutation({
    mutationFn: (v: { module_key: string; can_access: boolean | null }) =>
      api.put(`/admin/permissions/users/${selectedId}`, v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions-user', selectedId] })
      queryClient.invalidateQueries({ queryKey: ['permissions-users'] })
    },
    onError: (e: any) => {
      toast({ variant: 'error', title: 'Could not update', description: e?.response?.data?.error ?? 'Please try again.' })
    },
  })

  const groups = detail ? groupBy(detail.modules) : []

  return (
    <div>
      <p className="mb-4 text-xs text-gray-500">
        Grant or deny a specific tab for one person, overriding their role's default. Reset clears the override so they go back to inheriting their role.
      </p>
      <div className="mb-4 w-full max-w-sm">
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          disabled={usersLoading}
          className="h-8 w-full rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">Select a user...</option>
          {editableUsers.map(u => (
            <option key={u.id} value={u.id}>{u.name} — {u.role}{u.overrideCount ? ` (${u.overrideCount} override${u.overrideCount > 1 ? 's' : ''})` : ''}</option>
          ))}
        </select>
      </div>

      {!selectedId && <p className="py-8 text-center text-xs text-gray-400">Pick a user to see and edit their access.</p>}
      {selectedId && detailLoading && <RmcLoader size="sm" />}

      {detail && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="section-label px-4 py-2.5 text-left">Tab / Tile</th>
                <th className="section-label px-4 py-2.5 text-center">Role Default</th>
                <th className="section-label px-4 py-2.5 text-center">Access</th>
                <th className="section-label px-4 py-2.5 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([group, mods]) => (
                <Fragment key={group}>
                  <tr className="bg-gray-50/70">
                    <td colSpan={4} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {group}
                    </td>
                  </tr>
                  {mods.map((m, i) => (
                    <tr key={m.key} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                      <td className="px-4 py-2 text-xs text-gray-700">{m.label}</td>
                      <td className="px-4 py-2 text-center text-[11px] text-gray-400">{m.roleDefault ? 'Granted' : 'Denied'}</td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.resolved}
                          onChange={e => setOverride.mutate({ module_key: m.key, can_access: e.target.checked })}
                          className="h-3.5 w-3.5 cursor-pointer accent-accent"
                        />
                        {m.override !== null && (
                          <span className="ml-1.5 rounded border border-orange-200 bg-orange-50 px-1 py-0.5 text-[9px] font-medium text-accent">override</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {m.override !== null && (
                          <button
                            type="button"
                            title="Reset to role default"
                            onClick={() => setOverride.mutate({ module_key: m.key, can_access: null })}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function PermissionsPage() {
  return (
    <div>
      <PageHeader title="Permissions" subtitle="Control which tabs each role — or a specific person — can see" />
      <Tabs defaultValue="role">
        <TabsList>
          <TabsTrigger value="role">By Role</TabsTrigger>
          <TabsTrigger value="user">By User</TabsTrigger>
        </TabsList>
        <TabsContent value="role"><RoleMatrixTab /></TabsContent>
        <TabsContent value="user"><ByUserTab /></TabsContent>
      </Tabs>
    </div>
  )
}
