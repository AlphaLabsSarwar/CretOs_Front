// ─── Google Maps JS API loader ───────────────────────────────────────────
// Injects the script tag once and caches the in-flight/completed promise so
// multiple components (currently just TrackPage, potentially others later)
// mounting around the same time don't each add their own <script> tag.
// Needs VITE_GOOGLE_MAPS_JS_KEY set (see .env.example) — a Maps JavaScript
// API key from Google Cloud Console, ideally restricted to this site's
// domain. Without a key, this resolves to null and callers should just skip
// rendering a map rather than showing a broken one.
// Typed as `any` deliberately — this codebase doesn't have the
// @types/google.maps package installed, and pulling it in just for this one
// util isn't worth it. Callers use the runtime Google Maps JS API directly.
let loadPromise: Promise<any> | null = null

export function loadGoogleMaps(): Promise<any> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_JS_KEY as string | undefined
  if (!apiKey) return Promise.resolve(null)

  if (typeof window !== 'undefined' && (window as any).google?.maps) {
    return Promise.resolve((window as any).google)
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
      script.async = true
      script.onload = () => resolve((window as any).google ?? null)
      script.onerror = () => resolve(null)
      document.head.appendChild(script)
    })
  }
  return loadPromise
}
