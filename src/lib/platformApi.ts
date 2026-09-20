import axios from 'axios'

// Separate axios instance from lib/api.ts and lib/portalApi.ts — its own
// token, its own 401 destination. A platform admin's session must never mix
// with a staff or customer-portal session, even in the same browser.
export const platformApi = axios.create({
  baseURL: '/api/v1/platform',
  headers: { 'Content-Type': 'application/json' },
})

platformApi.interceptors.request.use(config => {
  const token = localStorage.getItem('cretos_platform_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

platformApi.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cretos_platform_token')
      localStorage.removeItem('cretos_platform_admin')
      window.location.href = '/platform/login'
    }
    return Promise.reject(err)
  }
)
