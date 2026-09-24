import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#E8630A', hover: '#CF560A', light: '#FDF0E8', soft: '#FDBA74' },
        page: '#F7F8FA',
        // Live Tracking "command center" surfaces (the one dark screen).
        command: { bg: '#0B0D11', panel: '#101216', map: '#0D1016' },
        sidebar: { bg: '#111318', text: '#A1A8B4', active: '#FFFFFF', item: '#1E2028' },
        status: { active: '#16A34A', pending: '#D97706', closed: '#6B7280', error: '#DC2626' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      keyframes: {
        'wheel-spin': { to: { transform: 'rotate(360deg)' } },
        'drum-spin': { to: { transform: 'rotate(360deg)' } },
        'truck-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        'truck-roll-in': {
          '0%': { transform: 'translateX(-40px)', opacity: '0' },
          '60%': { opacity: '1' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'pour-sweep': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'fade-slide-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'count-in': {
          '0%': { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'dust-puff': {
          '0%': { transform: 'scale(0.4) translateX(0)', opacity: '0.5' },
          '100%': { transform: 'scale(1.4) translateX(-10px)', opacity: '0' },
        },
        'truck-drive': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-2px) rotate(-0.7deg)' },
          '50%': { transform: 'translateY(-3.5px) rotate(0deg)' },
          '75%': { transform: 'translateY(-1px) rotate(0.7deg)' },
        },
        'road-scroll': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '-24px 0' },
        },
        'exhaust-rise': {
          '0%': { transform: 'translateY(0) scale(0.5)', opacity: '0.55' },
          '100%': { transform: 'translateY(-14px) scale(1.4)', opacity: '0' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.15', transform: 'scale(0.9)' },
          '50%': { opacity: '0.4', transform: 'scale(1.08)' },
        },
        'speed-line': {
          '0%': { transform: 'translateX(6px)', opacity: '0' },
          '30%': { opacity: '0.7' },
          '100%': { transform: 'translateX(-26px)', opacity: '0' },
        },
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '40%': { transform: 'translateY(-3px)', opacity: '1' },
        },
        // Sign-in hero: the batching-yard scene (see pages/auth/LoginPage.tsx).
        'bar-rise': { '0%, 100%': { transform: 'scaleY(.35)' }, '50%': { transform: 'scaleY(1)' } },
        'dust-drift': {
          '0%': { opacity: '0', transform: 'translate(0,0) scale(.6)' },
          '30%': { opacity: '.55' },
          '100%': { opacity: '0', transform: 'translate(-22px,-30px) scale(1.3)' },
        },
        'drive-path': { to: { offsetDistance: '100%' } },
        'tip-bed': { '0%, 35%, 100%': { transform: 'rotate(0deg)' }, '55%, 80%': { transform: 'rotate(-22deg)' } },
        'fall-bit': {
          '0%': { opacity: '0', transform: 'translate(0,0)' },
          '10%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translate(-6px,26px)' },
        },
        'scoop-arm': { '0%, 100%': { transform: 'rotate(0deg)' }, '50%': { transform: 'rotate(9deg)' } },
        'bucket-tilt': { '0%, 100%': { transform: 'rotate(0deg)' }, '50%': { transform: 'rotate(-14deg)' } },
        'fill-pulse': { '0%, 100%': { opacity: '.35' }, '50%': { opacity: '1' } },
        'soft-pulse': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '.35' } },
      },
      animation: {
        spin: 'wheel-spin 0.8s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'wheel-spin': 'wheel-spin 0.6s linear infinite',
        'drum-spin': 'drum-spin 2.2s linear infinite',
        'truck-bob': 'truck-bob 1.1s ease-in-out infinite',
        'truck-roll-in': 'truck-roll-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pour-sweep': 'pour-sweep 1.4s linear infinite',
        'fade-slide-up': 'fade-slide-up 0.28s ease-out',
        'count-in': 'count-in 0.4s ease-out',
        'dust-puff': 'dust-puff 0.6s ease-out infinite',
        'truck-drive': 'truck-drive 0.9s ease-in-out infinite',
        'road-scroll': 'road-scroll 0.5s linear infinite',
        'exhaust-rise': 'exhaust-rise 1.3s ease-out infinite',
        'glow-pulse': 'glow-pulse 2.2s ease-in-out infinite',
        'speed-line': 'speed-line 0.7s ease-out infinite',
        'dot-bounce': 'dot-bounce 1.2s ease-in-out infinite',
        'drum-slow': 'drum-spin 5s linear infinite',
        'bar-rise': 'bar-rise 2.6s ease-in-out infinite',
        'dust-drift': 'dust-drift 3.2s ease-out infinite',
        'drive-path': 'drive-path 9s linear infinite',
        'tip-bed': 'tip-bed 4.5s ease-in-out infinite',
        'fall-bit': 'fall-bit 4.5s ease-in-out infinite',
        'scoop-arm': 'scoop-arm 3.4s ease-in-out infinite',
        'bucket-tilt': 'bucket-tilt 3.4s ease-in-out infinite',
        'fill-pulse': 'fill-pulse 2.2s ease-in-out infinite',
        'soft-pulse': 'soft-pulse 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
