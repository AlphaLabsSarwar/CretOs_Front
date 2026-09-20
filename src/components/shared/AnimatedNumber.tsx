import { useEffect, useRef, useState } from 'react'

// Counts from the previous value up (or down) to the new one whenever `value`
// changes — used for dashboard KPIs so a number refresh (e.g. the 30s/60s
// auto-refetch) reads as "ticking up" rather than an abrupt jump.
export default function AnimatedNumber({
  value,
  format = (n: number) => String(n),
  duration = 700,
  className = '',
}: {
  value: number | null | undefined
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(value ?? 0)
  const fromRef = useRef(value ?? 0)
  const frameRef = useRef<number>()

  useEffect(() => {
    if (value == null) return
    const from = fromRef.current
    const to = value
    if (from === to) return
    const start = performance.now()

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (value == null) return <span className={className}>—</span>
  return <span className={className}>{format(display)}</span>
}
