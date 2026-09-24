// ─── Mappls (MapmyIndia) Web SDK loader ──────────────────────────────────
// Same pattern as loadGoogleMaps.ts: injects the script tag once and caches
// the promise. Needs VITE_MAPPLS_KEY (see .env.example) — a Mappls static
// key / access token from https://auth.mappls.com/console, ideally restricted
// to this site's domain. Without a key (or if the SDK fails to load) this
// resolves to null, and callers fall back to the OpenStreetMap map.
// Typed as `any` deliberately — Mappls ships no TypeScript typings.
let loadPromise: Promise<any> | null = null

export const MAPPLS_KEY = (import.meta.env.VITE_MAPPLS_KEY as string | undefined)?.trim() || null

export function loadMappls(): Promise<any> {
  if (!MAPPLS_KEY) return Promise.resolve(null)
  const w = window as any
  if (w.mappls?.Map) return Promise.resolve(w.mappls)

  if (!loadPromise) {
    loadPromise = new Promise(resolve => {
      const script = document.createElement('script')
      script.src = `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(MAPPLS_KEY)}/map_sdk?v=3.0&layer=vector`
      script.async = true
      script.onload = () => resolve(w.mappls?.Map ? w.mappls : null)
      script.onerror = () => { loadPromise = null; resolve(null) }
      document.head.appendChild(script)
    })
  }
  return loadPromise
}
