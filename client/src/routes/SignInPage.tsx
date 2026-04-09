import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMe } from '@/api/me'
import { AuthPageLayout } from '@/components/landing/AuthPageLayout'
import { supabase } from '@/lib/supabaseClient'

export function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (!supabase) {
        setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const message =
          error.message === 'Email not confirmed'
            ? 'Email not confirmed. For local development, turn off "Confirm email" in Supabase Dashboard → Authentication → Providers → Email, or confirm your email via the link sent to your inbox.'
            : error.message
        setError(message)
        setLoading(false)
        return
      }
      try {
        const me = await getMe()
        if (me.type === 'employee') navigate('/employee/clock', { replace: true })
        else if (me.type === 'affiliate') navigate('/affiliate', { replace: true })
        else if (me.isAdmin) {
          try {
            sessionStorage.removeItem('takeoff-admin-preview')
          } catch {
            // ignore
          }
          navigate('/admin', { replace: true })
        } else navigate('/dashboard', { replace: true })
      } catch {
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageLayout>
      <div className="w-full max-w-[420px] animate-[fadeUp_0.6s_ease_both]">
        <div className="bg-dark-3 border border-border-dark rounded-2xl p-8 md:p-10 shadow-[0_0_0_1px_var(--color-border-dark),0_24px_48px_rgba(0,0,0,0.4)]">
          <h1 className="font-sora text-2xl md:text-3xl font-bold text-landing-white tracking-tight mb-2">
            Sign in
          </h1>
          <p className="text-white-dim text-sm mb-8">
            Sign in to your account to continue.
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-accent/15 border border-accent/30 text-red-200 text-sm">
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-landing-white mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-dark-4 border border-border-dark rounded-lg text-landing-white placeholder:text-white-dim focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-landing-white mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-dark-4 border border-border-dark rounded-lg text-landing-white placeholder:text-white-dim focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-lg font-sora font-semibold text-[15px] bg-accent text-white shadow-[0_0_20px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-[0_4px_30px_var(--color-accent-glow)] disabled:opacity-50 disabled:pointer-events-none disabled:transform-none transition-all"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-sm text-white-dim text-center">
            Don&apos;t have an account?{' '}
            <Link
              to="/sign-up"
              className="text-accent-hover font-medium hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </AuthPageLayout>
  )
}
