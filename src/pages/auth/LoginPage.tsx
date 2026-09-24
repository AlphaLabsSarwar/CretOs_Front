import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Eye, EyeOff, Lock, Mail, MapPin, Phone, User } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { authStore } from '@/store/auth'
import { permissionsStore } from '@/store/permissions'

type Mode = 'signin' | 'signup'

// The panel slid out of view stays in the DOM (for the slide animation), so
// take it out of the tab order and the accessibility tree. `inert` isn't in
// React 18's typings yet, hence the spread.
const offscreen = (hidden: boolean) => (hidden ? { 'aria-hidden': true, inert: '' } : {})

const FIELD = 'w-full rounded-[10px] border border-gray-200 text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-accent focus:shadow-[0_0_0_3px_rgba(232,99,10,.12)]'

function IconField({ icon: Icon, small, className, ...props }: { icon: React.ElementType; small?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon size={small ? 14 : 16} className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400', small ? 'left-3' : 'left-[13px]')} />
      <input {...props} className={cn(FIELD, small ? 'h-[42px] pl-[34px] pr-3 text-[13px]' : 'h-[46px] pl-[38px] pr-3.5 text-sm', className)} />
    </div>
  )
}

/** Left-hand hero: a batching yard — silos, a mixer truck driving the route,
 *  a bulker filling, a loader scooping and a tipper dumping. Pure CSS motion;
 *  `motion-reduce` freezes it for people who've asked for less movement. */
function YardScene() {
  const wheel = 'absolute rounded-full bg-[#1B140C]'
  return (
    <div aria-hidden="true" className="relative mt-6 h-[430px] [&_*]:motion-reduce:!animate-none">
      {/* Silos */}
      <div className="absolute bottom-0 left-[30px] h-[150px] w-11 rounded-t-lg bg-white/[0.14]" />
      <div className="absolute bottom-[150px] left-[30px] h-0 w-0 border-x-[22px] border-b-[20px] border-x-transparent border-b-white/[0.14]" />
      <div className="absolute bottom-0 left-[90px] h-[110px] w-9 rounded-t-[7px] bg-white/[0.11]" />
      <div className="absolute bottom-[110px] left-[90px] h-0 w-0 border-x-[18px] border-b-[16px] border-x-transparent border-b-white/[0.11]" />

      {/* Plant output bars */}
      <div className="absolute bottom-9 left-[170px] flex items-end gap-2">
        {[34, 50, 26, 60].map((h, i) => (
          <span key={i} className="w-[9px] origin-bottom animate-bar-rise rounded-[3px] bg-accent" style={{ height: h, animationDelay: `${i * 0.3}s` }} />
        ))}
      </div>

      {/* Delivery route + the mixer truck driving it */}
      <svg width="470" height="260" className="absolute left-0 top-[110px]">
        <path d="M10,232 C 120,180 220,150 300,150 S 430,190 470,120" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.5" strokeDasharray="1 10" strokeLinecap="round" />
      </svg>
      <div
        className="absolute left-0 top-[110px] h-[34px] w-14 animate-drive-path"
        style={{ offsetPath: "path('M10,232 C 120,180 220,150 300,150 S 430,190 470,120')" }}
      >
        <span className="absolute bottom-0 left-0 h-[22px] w-14 rounded-[5px] bg-[#F4E9DD]" />
        <span className="absolute bottom-5 left-0.5 h-3 w-5 rounded-t bg-[#F4E9DD]" />
        <span
          className="absolute bottom-[19px] left-6 h-[26px] w-[26px] animate-drum-slow rounded-full"
          style={{ background: 'conic-gradient(from 0deg,#3A2410 0 12%,#E8630A 12% 25%,#3A2410 25% 37%,#E8630A 37% 50%,#3A2410 50% 62%,#E8630A 62% 75%,#3A2410 75% 87%,#E8630A 87% 100%)' }}
        />
        <span className={cn(wheel, '-bottom-1 left-1.5 h-[9px] w-[9px]')} />
        <span className={cn(wheel, '-bottom-1 left-10 h-[9px] w-[9px]')} />
      </div>

      {/* Dust */}
      {[[250, 70, 8, 0.5, 0], [270, 60, 6, 0.4, 1], [290, 75, 5, 0.4, 2]].map(([l, b, s, o, d]) => (
        <span key={l} className="absolute animate-dust-drift rounded-full" style={{ left: l, bottom: b, width: s, height: s, background: `rgba(255,255,255,${o})`, animationDelay: `${d}s` }} />
      ))}

      {/* Ground */}
      <span className="absolute bottom-0 left-0 right-5 h-0.5 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.18)_15%,rgba(255,255,255,.18)_85%,transparent)]" />

      {/* Cement bulker, filling */}
      <div className="absolute bottom-0 left-[150px] h-[54px] w-24">
        <span className="absolute bottom-4 left-0 h-[30px] w-[78px] rounded-[15px] bg-white/[0.15]" />
        <span className="absolute bottom-5 left-[5px] h-[22px] w-[68px] animate-fill-pulse rounded-[11px] bg-accent" />
        <span className="absolute bottom-3.5 left-[78px] h-[18px] w-3.5 rounded-r bg-white/[0.15]" />
        <span className={cn(wheel, '-bottom-[3px] left-3.5 h-[9px] w-[9px]')} />
        <span className={cn(wheel, '-bottom-[3px] left-[58px] h-[9px] w-[9px]')} />
        <span className="absolute bottom-[38px] left-0 flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.05em] text-white/55">
          <span className="h-[5px] w-[5px] animate-soft-pulse rounded-full bg-green-500" />Loading
        </span>
      </div>

      {/* Wheel loader */}
      <div className="absolute bottom-0 left-[288px] h-[60px] w-[84px]">
        <span className="absolute bottom-3.5 left-6 h-0 w-0 border-x-[20px] border-b-[16px] border-x-transparent border-b-white/[0.12]" />
        <span className="absolute bottom-4 left-[26px] h-4 w-[22px] rounded-[3px] bg-white/[0.18]" />
        <div className="absolute bottom-4 left-2 h-1.5 w-[34px] origin-[15%_85%] animate-scoop-arm rounded-[3px] bg-white/[0.18]">
          <span className="absolute -left-2.5 -top-1.5 h-3.5 w-3.5 origin-right animate-bucket-tilt rounded-b-md border-[3px] border-t-0 border-white/[0.22]" />
        </div>
        <span className={cn(wheel, '-bottom-[3px] left-[22px] h-[11px] w-[11px]')} />
        <span className={cn(wheel, '-bottom-[3px] left-11 h-[11px] w-[11px]')} />
      </div>

      {/* Tipper, dumping */}
      <div className="absolute bottom-0 left-[400px] h-[60px] w-[100px]">
        <span className="absolute bottom-3.5 left-0 h-[22px] w-6 rounded-t bg-white/[0.16]" />
        <div className="absolute bottom-3.5 left-[22px] h-[26px] w-14 origin-[8%_100%] animate-tip-bed rounded-[3px_8px_4px_3px] bg-white/[0.16]">
          {[[-2, -6, 5, 0.2], [6, -4, 4, 0.6], [14, -2, 4, 1]].map(([r, t, s, d]) => (
            <span key={r} className="absolute animate-fall-bit rounded-full bg-accent" style={{ right: r, top: t, width: s, height: s, animationDelay: `${d}s` }} />
          ))}
        </div>
        <span className={cn(wheel, '-bottom-[3px] left-[9px] h-[11px] w-[11px]')} />
        <span className={cn(wheel, '-bottom-[3px] left-16 h-[11px] w-[11px]')} />
        <span className={cn(wheel, '-bottom-[3px] left-20 h-[11px] w-[11px]')} />
      </div>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const signin = mode === 'signin'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      const { token, user } = res.data.data
      authStore.setAuth(token, user)
      const modules = await permissionsStore.refresh()
      // Land on the workspace launcher, unless the user has no granted
      // modules at all — then it would be empty, so fall back to the
      // operator's Quick Dispatch screen (always reachable regardless of
      // module permissions).
      navigate(modules.length ? '/home' : '/quick-dispatch')
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  // There is no self-serve sign-up endpoint: accounts are created by a
  // company admin (Masters → Users). The form collects the details and says so
  // plainly rather than pretending to register anyone.
  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault()
    setRequestSent(true)
  }

  const label = 'mb-1.5 block text-xs font-medium text-slate-600'
  const smallLabel = 'mb-[5px] block text-[11px] font-medium text-slate-600'
  const primary = 'flex h-[46px] w-full items-center justify-center rounded-[10px] bg-accent text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60'

  return (
    <div className="flex min-h-screen animate-fade-slide-up bg-white font-sans">
      {/* Hero — hidden on small screens, where the form is the whole page. */}
      <div className="relative hidden w-[760px] max-w-[53%] shrink-0 overflow-hidden bg-[linear-gradient(135deg,#1B140C_0%,#3A2410_45%,#CF560A_100%)] px-12 py-11 text-white lg:block">
        <div className="relative z-[2] flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-base font-extrabold">C</span>
          <span className="text-xl font-extrabold tracking-[-0.01em]">CretOS</span>
        </div>
        <YardScene />
        <p className="relative z-[2] mt-3 max-w-[460px] text-[30px] font-extrabold leading-[1.25] tracking-[-0.01em]">Run every load, plant, and payment in one place.</p>
        <p className="relative z-[2] mt-3 text-sm text-white/65">Batching, dispatch and billing for ready-mix plants on CretOS.</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-base font-extrabold text-white">C</span>
            <span className="text-xl font-extrabold text-slate-900">CretOS</span>
          </div>

          {/* Segmented toggle */}
          <div role="tablist" aria-label="Sign in or create account" className="relative mx-auto mb-8 h-11 w-[264px] rounded-full bg-[#F1F0EC] p-[3px]">
            <span
              className="absolute left-[3px] top-[3px] h-[calc(100%-6px)] w-[calc(50%-3px)] rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,.12)] transition-transform duration-[280ms] ease-out"
              style={{ transform: `translateX(${signin ? '0%' : '100%'})` }}
            />
            {(['signin', 'signup'] as const).map(m => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn('relative z-[1] h-full w-1/2 text-[13px] font-semibold transition-colors', mode === m ? 'text-slate-900' : 'text-slate-400')}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <div className="overflow-hidden">
            <div className="flex w-[200%] transition-transform duration-[320ms] ease-out" style={{ transform: `translateX(${signin ? '0%' : '-50%'})` }}>
              {/* Sign in */}
              <form onSubmit={handleLogin} className="w-1/2 pr-6" {...offscreen(!signin)}>
                <h1 className="text-2xl font-extrabold tracking-[-0.01em] text-slate-900">Welcome back</h1>
                <p className="mb-6 mt-1.5 text-[13px] text-slate-400">Sign in to your CretOS workspace.</p>

                {error && (
                  <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
                )}

                <label htmlFor="login-email" className={label}>Work email</label>
                <div className="mb-4">
                  <IconField id="login-email" icon={Mail} type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
                </div>

                <label htmlFor="login-password" className={label}>Password</label>
                <div className="relative mb-[22px]">
                  <IconField id="login-password" icon={Lock} type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pr-[38px]" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <button type="submit" disabled={loading} className={primary}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>

                <p className="mt-5 text-center text-xs text-slate-400">
                  New to CretOS?{' '}
                  <button type="button" onClick={() => setMode('signup')} className="font-medium text-accent hover:underline">Request access</button>
                </p>
              </form>

              {/* Create account (access request) */}
              <form onSubmit={handleRequest} className="w-1/2 pl-6" {...offscreen(signin)}>
                <h1 className="text-2xl font-extrabold tracking-[-0.01em] text-slate-900">Create your account</h1>
                <p className="mb-5 mt-1.5 text-[13px] text-slate-400">Set up your plant&rsquo;s CretOS workspace.</p>

                {requestSent ? (
                  <div role="status" className="rounded-[10px] border border-accent/30 bg-accent-light px-4 py-3 text-[13px] leading-relaxed text-slate-700">
                    <p className="font-semibold text-slate-900">Almost there</p>
                    CretOS accounts are created by your company admin. Share these details with them and ask them to add you under <span className="font-medium">Masters → Users</span>. You can then sign in with the email they register.
                  </div>
                ) : (
                  <>
                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div><label htmlFor="su-company" className={smallLabel}>Company name</label><IconField id="su-company" small icon={Building2} required placeholder="RMC Builders" /></div>
                      <div><label htmlFor="su-role" className={smallLabel}>Role</label><IconField id="su-role" small icon={User} placeholder="Plant Admin" /></div>
                    </div>
                    <label htmlFor="su-email" className={smallLabel}>Work email</label>
                    <div className="mb-3"><IconField id="su-email" small icon={Mail} type="email" required placeholder="you@company.com" /></div>
                    <div className="mb-[18px] grid grid-cols-2 gap-3">
                      <div><label htmlFor="su-mobile" className={smallLabel}>Mobile number</label><IconField id="su-mobile" small icon={Phone} type="tel" placeholder="+91 90000 00000" /></div>
                      <div><label htmlFor="su-plant" className={smallLabel}>Plant location</label><IconField id="su-plant" small icon={MapPin} placeholder="City" /></div>
                    </div>
                    <button type="submit" className={primary}>Create account</button>
                  </>
                )}
                <p className="mt-4 text-center text-xs text-slate-400">
                  Already on CretOS?{' '}
                  <button type="button" onClick={() => setMode('signin')} className="font-medium text-accent hover:underline">Sign in</button>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
