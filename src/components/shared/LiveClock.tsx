import { useEffect, useState } from 'react'

const pad = (n: number) => String(n).padStart(2, '0')

// 21/09/2026 10:32:48 AM — day-first, 12-hour, seconds, upper-case AM/PM.
// (Intl's en-GB gives lower-case "am"/"pm", so this is formatted by hand.)
function format(d: Date) {
  const h = d.getHours()
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(h % 12 || 12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${h < 12 ? 'AM' : 'PM'}`
}

// Ticks on the wall-clock second (not a drifting setInterval), in the
// viewer's local timezone. tabular-nums keeps the width fixed as digits change.
export default function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    timer = setTimeout(tick, 1000 - (Date.now() % 1000))
    return () => clearTimeout(timer)
  }, [])

  return (
    <time dateTime={now.toISOString()} className={className}>
      {format(now)}
    </time>
  )
}
