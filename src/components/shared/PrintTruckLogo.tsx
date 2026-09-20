// ─── Static print-header truck mark ─────────────────────────────────────────
// A non-animated version of RmcLoader's mixer truck (same orange cab/drum,
// dark chassis, peach window/seam highlights) for the top-right corner of
// printed documents (Tax Invoice, Ledger Statement) — carrying the app's one
// distinctive visual motif into paper output, where RmcLoader's motion
// obviously can't go. Faces right, same as the loader.
export default function PrintTruckLogo({ width = 84 }: { width?: number }) {
  return (
    <div style={{ transform: 'scaleX(-1)' }}>
      <svg viewBox="0 0 260 120" width={width} xmlns="http://www.w3.org/2000/svg">
        {/* exhaust stack */}
        <rect x="71" y="16" width="4" height="24" rx="1" fill="#6B7280" />

        {/* cab */}
        <path d="M6,96 L6,64 L16,46 L30,38 L52,38 L62,46 L70,46 L70,96 Z" fill="#E8630A" />
        <path d="M18,50 L30,42 L50,42 L56,50 L56,64 L18,64 Z" fill="#FDF0E8" />
        <rect x="9" y="80" width="1.4" height="12" fill="#FDF0E8" opacity="0.7" />
        <rect x="12.5" y="80" width="1.4" height="12" fill="#FDF0E8" opacity="0.7" />

        {/* chassis frame */}
        <rect x="68" y="88" width="172" height="8" fill="#4B5563" />
        <path d="M82,88 L90,70 L94,70 L88,88 Z" fill="#374151" />
        <path d="M100,88 L106,72 L110,72 L106,88 Z" fill="#374151" />

        {/* fenders over the rear tandem wheels */}
        <path d="M170,88 Q200,64 232,88" stroke="#374151" strokeWidth="5" fill="none" />

        {/* mixer drum */}
        <path d="M70,72 L80,42 L110,28 L170,22 L220,28 L244,44 L248,62 L232,80 L150,86 L95,84 Z" fill="#CF560A" />
        <path d="M70,72 L80,42 L110,28 L170,22 L220,28 L244,44 L248,62 L232,80 L150,86 L95,84 Z" fill="none" stroke="#FFB98A" strokeWidth="0.8" opacity="0.5" />

        {/* rear hanging chute + support chain */}
        <path d="M243,55 L248,60 L243,64 L248,68" stroke="#374151" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M236,66 L254,70 L248,100 L240,96 Z" fill="#374151" />

        {/* wheels (static) */}
        {[46, 186, 214].map(cx => (
          <g key={cx}>
            <circle cx={cx} cy={96} r={15} fill="#1F2937" />
            <circle cx={cx} cy={96} r={6} fill="#E8630A" />
          </g>
        ))}
      </svg>
    </div>
  )
}
