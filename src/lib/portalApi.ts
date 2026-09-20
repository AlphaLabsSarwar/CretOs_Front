import axios from 'axios'

// Separate axios instance from lib/api.ts — different token, different 401
// destination (customer portal login, not the staff login).
export const portalApi = axios.create({
  baseURL: '/api/v1/portal',
  headers: { 'Content-Type': 'application/json' },
})

portalApi.interceptors.request.use(config => {
  const token = localStorage.getItem('cretos_portal_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

portalApi.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cretos_portal_token')
      localStorage.removeItem('cretos_portal_customer')
      window.location.href = '/portal/login'
    }
    return Promise.reject(err)
  }
)
