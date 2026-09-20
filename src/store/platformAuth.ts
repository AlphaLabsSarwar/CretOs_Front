interface PlatformAdmin {
  id: string
  name: string
  email: string
}

// Deliberately separate from store/auth.ts (staff) and store/portalAuth.ts
// (customer) — a platform admin's session must never be confused with
// either, even in localStorage.
export const platformAuthStore = {
  getAdmin(): PlatformAdmin | null {
    const raw = localStorage.getItem('cretos_platform_admin')
    return raw ? JSON.parse(raw) : null
  },
  getToken(): string | null {
    return localStorage.getItem('cretos_platform_token')
  },
  setAuth(token: string, admin: PlatformAdmin) {
    localStorage.setItem('cretos_platform_token', token)
    localStorage.setItem('cretos_platform_admin', JSON.stringify(admin))
  },
  clear() {
    localStorage.removeItem('cretos_platform_token')
    localStorage.removeItem('cretos_platform_admin')
  },
  isLoggedIn(): boolean {
    return !!this.getToken()
  },
}
