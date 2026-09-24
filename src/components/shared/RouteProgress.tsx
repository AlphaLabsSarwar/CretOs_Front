import { useEffect, useRef, useState } from 'react'
import { useRouteLoading } from '@/lib/routeProgress'

// Slim accent bar across the top of the viewport while a page's code is
// downloading. It waits 120ms before appearing (fast loads show nothing),
// creeps towards 90% while waiting, then completes and fades out.
export default function RouteProgress() {
  const loading = useRouteLoading()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const clear = () => { timers.current.forEach(t => clearTimeout(t)); timers.current = [] }
    clear()
    if (loading) {
      timers.current.push(window.setTimeout(() => {
        setVisible(true)
        setWidth(15)
        let w = 15
        const creep = () => {
          w = Math.min(90, w + (90 - w) * 0.12)
          setWidth(w)
          timers.current.push(window.setTimeout(creep, 200))
        }
        timers.current.push(window.setTimeout(creep, 200))
      }, 120))
    } else if (visible) {
      setWidth(100)
      timers.current.push(window.setTimeout(() => { setVisible(false); setWidth(0) }, 320))
    }
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `visible` is read, not a trigger
  }, [loading])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[2000] h-[2.5px] transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full bg-accent shadow-[0_0_10px_rgba(232,99,10,.6)] transition-[width] duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
