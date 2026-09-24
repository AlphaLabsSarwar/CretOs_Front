import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import QRCode from 'qrcode'
import { isNotFound, route } from './mock/router'

// ─── Offline UI mode ─────────────────────────────────────────────────────
// Backend is switched off while the UI is being reworked. Every axios
// request (api, portalApi, platformApi, and bare axios on the public pages)
// is answered here instead of going over the network:
//   • login / permissions calls succeed with a fake session, so every realm
//     (staff, customer portal, platform admin) can be entered;
//   • every other endpoint is served from a demo dataset (lib/mock/data.ts
//     via lib/mock/router.ts) — lists, details, dashboards and reports all
//     populated, and saves/edits/deletes applied in memory until reload;
//   • a GET the router doesn't know rejects, so that screen shows its
//     empty/error state instead of crashing on an unexpected shape.
// Set VITE_USE_BACKEND=true (e.g. in .env.local) to talk to the real API again.
export const OFFLINE = import.meta.env.VITE_USE_BACKEND !== 'true'

const ALL_MODULES = [
  'dashboard',
  'sales.challans', 'sales.schedules', 'sales.orders',
  'marketing.tenders', 'marketing.quotations',
  'finance.invoices', 'finance.payments', 'finance.receipts', 'finance.journals', 'finance.cashbook',
  'stores.po', 'stores.grn', 'stores.indents', 'stores.stock',
  'lab.tests', 'lab.grades', 'lab.ncr',
  'production.weighbridge', 'production.batching', 'production.reconciliation', 'production.concreteAge',
  'production.pumps', 'production.oee', 'production.energy', 'production.carbon',
  'masters.customers', 'masters.customerRates', 'masters.items', 'masters.vendors',
  'masters.vehicles', 'masters.drivers', 'masters.users',
  'fleet',
  'reports.profitability', 'reports.aging', 'reports.creditRisk', 'reports.salesAnalysis',
  'reports.gstrExport', 'reports.multiBranch', 'reports.driverScorecard', 'reports.capacity', 'reports.alerts',
  'admin.auditLog', 'admin.reportSchedules', 'admin.permissions',
]

const MOCK_USER = {
  id: 'offline-user',
  name: 'Demo Admin',
  email: 'demo@cretos.local',
  role: 'ADMIN',
  branch: { id: 'offline-branch', name: 'Main Plant', code: 'MAIN' },
  company: { id: 'offline-company', name: 'Demo RMC Pvt Ltd', code: 'DEMO' },
}
const MOCK_CUSTOMER = { id: 'offline-customer', name: 'Demo Customer', email: 'customer@cretos.local' }
const MOCK_PLATFORM_ADMIN = { id: 'offline-platform', name: 'Platform Admin', email: 'platform@cretos.local' }

// Keyed by "METHOD path" with the /api/v1 prefix stripped.
const MOCK_ROUTES: Record<string, unknown> = {
  'POST /auth/login': { token: 'offline-token', user: MOCK_USER },
  'GET /me/permissions': { modules: ALL_MODULES },
  'POST /portal/login': { token: 'offline-portal-token', customer: MOCK_CUSTOMER },
  'POST /platform/login': { token: 'offline-platform-token', admin: MOCK_PLATFORM_ADMIN },
}

// A short, realistic network delay — under the loaders' 140ms grace period
// (see .loader-enter in index.css), so screens feel instant rather than flashy.
const LATENCY_MS = 110

function parseBody(data: unknown) {
  if (typeof data !== 'string') return data ?? {}
  try { return JSON.parse(data) } catch { return {} }
}

async function offlineAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const [rawPath, rawQuery] = `${config.baseURL ?? ''}${config.url ?? ''}`.replace(/^\/api\/v1/, '').split('?')
  const method = (config.method ?? 'get').toUpperCase()
  const key = `${method} ${rawPath}`
  const ok = (data: unknown): AxiosResponse => ({ data: { data }, status: 200, statusText: 'OK', headers: {}, config })

  await new Promise(r => setTimeout(r, LATENCY_MS))

  if (key in MOCK_ROUTES) return ok(MOCK_ROUTES[key])

  // Challan dispatch QR (fetched as an image blob, not JSON): a real,
  // scannable code pointing at the challan's public tracking page.
  const qr = method === 'GET' && rawPath.match(/^\/sales\/challans\/([^/]+)\/qr$/)
  if (qr) {
    const dataUrl = await QRCode.toDataURL(`${window.location.origin}/track/${qr[1]}`, { margin: 1, width: 240 })
    const blob = await (await fetch(dataUrl)).blob()
    return { data: blob, status: 200, statusText: 'OK', headers: {}, config }
  }

  // Everything else is answered from the demo dataset (lib/mock).
  const query = { ...Object.fromEntries(new URLSearchParams(rawQuery ?? '')), ...(config.params ?? {}) }
  const match = route({ method, path: rawPath, query, body: parseBody(config.data) })
  if (match) {
    try {
      return ok(match.handler({ method, path: rawPath, query, body: parseBody(config.data) }, match.params))
    } catch (e) {
      if (!isNotFound(e)) throw e
      throw new AxiosError(`Not found (offline demo): ${key}`, AxiosError.ERR_BAD_REQUEST, config, null,
        { data: { error: 'Record not found in the offline demo data' }, status: 404, statusText: 'Not Found', headers: {}, config })
    }
  }

  // Unknown writes succeed quietly so every form's Save still completes.
  if (method !== 'GET') return ok({ id: `offline-${Date.now()}`, ok: true })

  // Flag it in the console so a screen missing demo data is easy to spot.
  console.warn(`[offline] no demo data for ${key}`)
  // No `response` on the error, so the 401 interceptors never fire.
  throw new AxiosError(`Backend disabled (offline UI mode): ${key}`, AxiosError.ERR_NETWORK, config)
}

if (OFFLINE) {
  axios.defaults.adapter = offlineAdapter

  // Start already signed in as an admin with every module, so the whole app
  // is reachable without going through the login screen.
  if (!localStorage.getItem('cretos_token')) {
    localStorage.setItem('cretos_token', 'offline-token')
    localStorage.setItem('cretos_user', JSON.stringify(MOCK_USER))
  }
  localStorage.setItem('cretos_modules', JSON.stringify(ALL_MODULES))
}
