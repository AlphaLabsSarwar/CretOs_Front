import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { authStore } from '@/store/auth'
import { permissionsStore } from '@/store/permissions'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      const { token, user } = res.data.data
      authStore.setAuth(token, user)
      const modules = await permissionsStore.refresh()
      // Land on Dashboard if granted, otherwise the operator's Quick Dispatch
      // screen (always reachable regardless of module permissions) — this
      // way an OPERATOR who's been granted the full dashboard by an admin
      // lands there instead of being force-routed to Quick Dispatch.
      navigate(modules.includes('dashboard') ? '/dashboard' : '/quick-dispatch')
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sidebar-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">CretOS</h1>
            <p className="text-sidebar-text text-xs">RMC Operations Platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl p-6 shadow-2xl">
          <h2 className="text-gray-900 font-semibold text-base mb-1">Sign in</h2>
          <p className="text-gray-500 text-xs mb-5">Enter your credentials to continue</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="field-label">Email</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="admin@cretos.in"
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full h-9 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sidebar-text text-xs mt-4">
          Powered by Alphalabs
        </p>
      </div>
    </div>
  )
}
