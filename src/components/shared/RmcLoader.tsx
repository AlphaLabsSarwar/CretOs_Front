import { useId } from 'react'

// ─── Themed loading state ────────────────────────────────────────────────
// A branded-orange concrete-mixer truck, facing right (driving forward),
// on a scrolling road — rolling wheel tread, a spinning drum (diagonal
// seams sweep inside a clip so the drum reads as rotating), bouncing
// suspension, exhaust puffs, trailing dust and motion lines, with a soft
// pulsing glow behind it. Used everywhere the app previously showed a bare
// spinner or "Loading..." text. `size` controls scale; `label` is the
// caption underneath (pass null to omit it for tight spaces).
const SIZES = {
  sm: { width: 72, wrap: 'py-4', text: 'text-[11px]', road: 40 },
  md: { width: 108, wrap: 'py-8', text: 'text-xs', road: 60 },
  lg: { width: 160, wrap: 'py-14', text: 'text-sm', road: 88 },
}

const WHEELS = [46, 186, 214]

function Wheel({ cx }: { cx: number }) {
  const cy = 96
  const r = 15
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1F2937" />
      <g style={{ transformOrigin: `${cx}px ${cy}px` }} className="animate-wheel-spin">
        {[0, 72, 144, 216, 288].map(angle => (
          <rect key={angle} x={cx - 1} y={cy - r} width="2" height="6" fill="#9CA3AF" opacity="0.8" transform={`rotate(${angle} ${cx} ${cy})`} />
        ))}
        <circle cx={cx} cy={cy} r="6" fill="#E8630A" />
      </g>
    </g>
  )
}

function LoadingLabel({ label, className }: { label: string; className: string }) {
  // Splits a trailing "..." off the label so the dots can animate in sequence
  // independent of the static text.
  const base = label.replace(/\.+$/, '')
  return (
    <p className={`flex items-center gap-0.5 text-gray-400 ${className}`}>
      {base}
      <span className="flex items-end gap-[1px]">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="inline-block h-1 w-1 rounded-full bg-current animate-dot-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </p>
  )
}

export default function RmcLoader({
  size = 'md',
  label = 'Loading',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg'
  label?: string | null
  className?: string
}) {
  const s = SIZES[size]
  const clipId = `rmc-drum-clip-${useId()}`
  return (
    <div className={`flex flex-col items-center justify-center gap-2.5 ${s.wrap} ${className}`}>
      <div className="relative" style={{ width: s.width }}>
        {/* pulsing glow behind the truck */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/30 blur-lg animate-glow-pulse"
          style={{ width: s.width * 0.7, height: s.width * 0.32 }}
        />

        {/* motion / speed lines trailing behind the truck (rear is now on the left) */}
        <div className="absolute left-0 top-[42%] flex flex-col gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="block h-[1.5px] rounded-full bg-gray-300 animate-speed-line"
              style={{ width: s.width * 0.14, animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>

        <div className="relative animate-truck-drive" style={{ transformOrigin: '50% 90%' }}>
          {/* mirrored so the truck faces right (drives forward, toward the label) */}
          <div style={{ transform: 'scaleX(-1)' }}>
            <svg viewBox="0 0 260 120" width={s.width} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <clipPath id={clipId}>
                  <path d="M70,72 L80,42 L110,28 L170,22 L220,28 L244,44 L248,62 L232,80 L150,86 L95,84 Z" />
                </clipPath>
              </defs>

              {/* road shadow */}
              <ellipse cx="140" cy="112" rx="112" ry="4.5" fill="#E5E7EB" />

              {/* exhaust stack + rising puffs */}
              <rect x="71" y="16" width="4" height="24" rx="1" fill="#6B7280" />
              <circle cx="73" cy="15" r="2.4" fill="#D1D5DB" className="animate-exhaust-rise" />
              <circle cx="73" cy="15" r="1.9" fill="#D1D5DB" className="animate-exhaust-rise" style={{ animationDelay: '0.45s' }} />

              {/* cab */}
              <path d="M6,96 L6,64 L16,46 L30,38 L52,38 L62,46 L70,46 L70,96 Z" fill="#E8630A" />
              <path d="M18,50 L30,42 L50,42 L56,50 L56,64 L18,64 Z" fill="#FDF0E8" />
              {/* grille slats */}
              <rect x="9" y="80" width="1.4" height="12" fill="#FDF0E8" opacity="0.7" />
              <rect x="12.5" y="80" width="1.4" height="12" fill="#FDF0E8" opacity="0.7" />

              {/* chassis frame */}
              <rect x="68" y="88" width="172" height="8" fill="#4B5563" />
              {/* drum support struts */}
              <path d="M82,88 L90,70 L94,70 L88,88 Z" fill="#374151" />
              <path d="M100,88 L106,72 L110,72 L106,88 Z" fill="#374151" />

              {/* fenders over the rear tandem wheels */}
              <path d="M170,88 Q200,64 232,88" stroke="#374151" strokeWidth="5" fill="none" />

              {/* mixer drum */}
              <path d="M70,72 L80,42 L110,28 L170,22 L220,28 L244,44 L248,62 L232,80 L150,86 L95,84 Z" fill="#CF560A" />
              {/* rotating seam sweep, clipped to the drum silhouette so it reads as spinning */}
              <g clipPath={`url(#${clipId})`}>
                <g style={{ transformOrigin: '159px 55px' }} className="animate-drum-spin">
                  <path d="M70,5 L100,5 L60,105 L30,105 Z" fill="#FDF0E8" opacity="0.8" />
                  <path d="M140,5 L170,5 L130,105 L100,105 Z" fill="#FDF0E8" opacity="0.55" />
                  <path d="M210,5 L240,5 L200,105 L170,105 Z" fill="#FDF0E8" opacity="0.35" />
                </g>
              </g>
              {/* drum rim highlight */}
              <path d="M70,72 L80,42 L110,28 L170,22 L220,28 L244,44 L248,62 L232,80 L150,86 L95,84 Z" fill="none" stroke="#FFB98A" strokeWidth="0.8" opacity="0.5" />

              {/* rear hanging chute + support chain */}
              <path d="M243,55 L248,60 L243,64 L248,68" stroke="#374151" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M236,66 L254,70 L248,100 L240,96 Z" fill="#374151" />

              {WHEELS.map(cx => <Wheel key={cx} cx={cx} />)}

              {/* dust puffs behind the front wheel */}
              <circle cx="26" cy="102" r="3.4" fill="#D1D5DB" className="animate-dust-puff" />
              <circle cx="22" cy="99" r="2.3" fill="#D1D5DB" className="animate-dust-puff" style={{ animationDelay: '0.2s' }} />
              <circle cx="18" cy="103" r="1.8" fill="#D1D5DB" className="animate-dust-puff" style={{ animationDelay: '0.35s' }} />
            </svg>
          </div>
        </div>

        {/* scrolling dashed road */}
        <div
          className="mt-1 h-[3px] overflow-hidden rounded-full"
          style={{ width: s.road, marginLeft: (s.width - s.road) / 2 }}
        >
          <div
            className="h-full animate-road-scroll"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, #D1D5DB 0px, #D1D5DB 8px, transparent 8px, transparent 20px)',
              backgroundSize: '24px 100%',
            }}
          />
        </div>
      </div>
      {label !== null && <LoadingLabel label={label} className={s.text} />}
    </div>
  )
}
