import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from '@/lib/api'

// One logo per company. The bytes are served by the public, unauthenticated
// route (GET /public/companies/:id/logo) so print pages and the sidebar can use
// a plain <img src>. That route is cached for 5 minutes, so a freshly uploaded
// logo would keep showing the old one — every URL built here carries a
// `?v=<version>` that changes on upload/remove. The version lives in
// localStorage (shared by every tab, so a print page opened in a new tab is
// already up to date) and a window event re-renders anything showing the logo
// in the tab where the change happened.
const CHANGED_EVENT = 'cretos:company-logo-changed'
const versionKey = (companyId: string) => `cretos_logo_v_${companyId}`

function readVersion(companyId: string): string {
  try { return localStorage.getItem(versionKey(companyId)) ?? '' } catch { return '' }
}

export function companyLogoUrl(companyId: string): string {
  const v = readVersion(companyId)
  return `/api/v1/public/companies/${companyId}/logo${v ? `?v=${v}` : ''}`
}

function bumpVersion(companyId: string) {
  try { localStorage.setItem(versionKey(companyId), String(Date.now())) } catch { /* private mode: this tab still updates via the event */ }
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGED_EVENT, callback)
  window.addEventListener('storage', callback) // another tab changed it
  return () => {
    window.removeEventListener(CHANGED_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

/** Re-renders the caller whenever this company's logo is uploaded or removed. */
export function useCompanyLogoVersion(companyId?: string | null): string {
  return useSyncExternalStore(subscribe, () => (companyId ? readVersion(companyId) : ''), () => '')
}

export type LogoStatus = 'loading' | 'ready' | 'none'

/** Whether the company has a logo, and its (versioned) URL. The route answers 404 when there's none. */
export function useCompanyLogo(companyId?: string | null): { url: string | null; status: LogoStatus } {
  const version = useCompanyLogoVersion(companyId)
  const [state, setState] = useState<{ key: string; status: LogoStatus }>({ key: '', status: 'loading' })
  const key = `${companyId}|${version}`

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    const img = new Image()
    img.onload = () => !cancelled && setState({ key, status: 'ready' })
    img.onerror = () => !cancelled && setState({ key, status: 'none' })
    img.src = companyLogoUrl(companyId)
    return () => { cancelled = true }
  }, [companyId, key])

  if (!companyId) return { url: null, status: 'none' }
  // Until the check for the *current* version finishes, report "loading" rather
  // than the previous version's answer.
  if (state.key !== key) return { url: null, status: 'loading' }
  return { url: state.status === 'ready' ? companyLogoUrl(companyId) : null, status: state.status }
}

/** Admin only (enforced by the API). `blob` is the edited image, already PNG. */
export async function uploadCompanyLogo(companyId: string, blob: Blob): Promise<void> {
  const form = new FormData()
  form.append('logo', blob, 'logo.png')
  await api.post('/masters/company/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  bumpVersion(companyId)
}

export async function removeCompanyLogo(companyId: string): Promise<void> {
  await api.delete('/masters/company/logo')
  bumpVersion(companyId)
}

/** Pull the API's own message out of a failed request, falling back to something readable. */
export function logoErrorMessage(e: any): string {
  return e?.response?.data?.error ?? (e?.response ? 'The server rejected the logo.' : 'Could not reach the server — check your connection and try again.')
}
