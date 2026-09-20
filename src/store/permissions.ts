import { api } from '@/lib/api'

// Caches the resolved set of module keys (tabs/tiles) the current user can
// see — fetched once after login via GET /me/permissions and cached in
// localStorage so Sidebar/route guards can read it synchronously on every
// render without re-fetching. ADMIN always resolves to "every module" on
// the backend, so this store doesn't special-case role client-side.
const KEY = 'cretos_modules'

export const permissionsStore = {
  getModules(): string[] {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  },
  setModules(modules: string[]) {
    localStorage.setItem(KEY, JSON.stringify(modules))
  },
  clear() {
    localStorage.removeItem(KEY)
  },
  has(moduleKey: string): boolean {
    return this.getModules().includes(moduleKey)
  },
  // Call after login (and optionally on app load, in case an admin changed
  // something since the last session) — refreshes the cached set.
  async refresh(): Promise<string[]> {
    const res = await api.get('/me/permissions')
    const modules = res.data.data.modules as string[]
    this.setModules(modules)
    return modules
  },
}
