import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Cross-fading route layers ───────────────────────────────────────────
// Renders the current screen, and — for a moment after it changes — the
// previous one on top of it, fading out, so navigation reads as one screen
// handing over to the next instead of a hard cut.
//
// The leaving screen is the *same mounted instance* (layers are keyed by
// `layerKey`, and the switch is derived during render so React never unmounts
// it in between), frozen on the value it had — typically its location — so it
// neither reloads nor re-renders as the next page. It's removed once its exit
// animation has run.

interface Layer<T> { key: string; value: T; leaving: boolean; offset: number }

const EXIT_MS = 220

export default function TransitionLayers<T>({
  layerKey, value, render, leavingClassName, getOffset,
}: {
  layerKey: string
  value: T
  render: (value: T) => React.ReactNode
  /** Extra classes for a leaving layer (positioning + exit animation). */
  leavingClassName: string
  /** Scroll offset to pin a leaving layer at, read before the new page resets scroll. */
  getOffset?: () => number
}) {
  const [layers, setLayers] = useState<Layer<T>[]>(() => [{ key: layerKey, value, leaving: false, offset: 0 }])
  const current = layers[layers.length - 1]

  // What the current layer last showed *on screen*, so it leaves exactly as
  // it was. Recorded on commit, never during render: React may render the next
  // route and throw that render away (a transition waiting on a lazy page,
  // StrictMode's double render), and a render-time write would leak the
  // *new* route into the leaving layer.
  const committed = useRef({ key: layerKey, value })
  useLayoutEffect(() => {
    if (current.key === layerKey) committed.current = { key: layerKey, value }
  })

  if (current.key !== layerKey) {
    // Render-phase derived state: React discards this pass and re-renders
    // straight away, so the old layer's instance survives the switch.
    const offset = getOffset?.() ?? 0
    setLayers(ls => [
      ...ls.filter(l => l.key !== layerKey).map(l => (l.key === current.key ? { ...l, value: committed.current.key === l.key ? committed.current.value : l.value, leaving: true, offset } : l)),
      { key: layerKey, value, leaving: false, offset: 0 },
    ])
  }

  const leavingCount = layers.filter(l => l.leaving).length
  useEffect(() => {
    if (!leavingCount) return
    const t = setTimeout(() => setLayers(ls => ls.filter(l => !l.leaving)), EXIT_MS)
    return () => clearTimeout(t)
  }, [leavingCount])

  return (
    <>
      {layers.map(l => (
        <div
          key={l.key}
          aria-hidden={l.leaving || undefined}
          className={cn(l.leaving && leavingClassName)}
          style={l.leaving && l.offset ? { top: -l.offset } : undefined}
        >
          {render(l.leaving ? l.value : l.key === layerKey ? value : l.value)}
        </div>
      ))}
    </>
  )
}
