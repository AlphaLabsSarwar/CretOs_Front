interface PortalCustomer {
  id: string
  name: string
  email: string
}

// Deliberately separate from store/auth.ts (staff) — a customer's portal
// session must never be confused with a staff session, even in localStorage.
export const portalAuthStore = {
  getCustomer(): PortalCustomer | null {
    const raw = localStorage.getItem('cretos_portal_customer')
    return raw ? JSON.parse(raw) : null
  },
  getToken(): string | null {
    return localStorage.getItem('cretos_portal_token')
  },
  setAuth(token: string, customer: PortalCustomer) {
    localStorage.setItem('cretos_portal_token', token)
    localStorage.setItem('cretos_portal_customer', JSON.stringify(customer))
  },
  clear() {
    localStorage.removeItem('cretos_portal_token')
    localStorage.removeItem('cretos_portal_customer')
  },
  isLoggedIn(): boolean {
    return !!this.getToken()
  },
}
