interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  branch: { id: string; name: string; code: string }
  company: { id: string; name: string; code: string }
}

export const authStore = {
  getUser(): AuthUser | null {
    const raw = localStorage.getItem('cretos_user')
    return raw ? JSON.parse(raw) : null
  },
  getToken(): string | null {
    return localStorage.getItem('cretos_token')
  },
  setAuth(token: string, user: AuthUser) {
    localStorage.setItem('cretos_token', token)
    localStorage.setItem('cretos_user', JSON.stringify(user))
  },
  clear() {
    localStorage.removeItem('cretos_token')
    localStorage.removeItem('cretos_user')
  },
  isLoggedIn(): boolean {
    return !!this.getToken()
  },
}
