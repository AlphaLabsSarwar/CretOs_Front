// Small spinning-drum icon for inline/button contexts (e.g. "Saving...")
// where the full RmcLoader truck would be too large.
export default function InlineLoader({ className = '', size = 13 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-loader ${className}`}
      style={{ transformOrigin: 'center' }}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
