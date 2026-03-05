import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthPageLayout } from '@/components/landing/AuthPageLayout'

export function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setConfirmPasswordError(null)
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { supabase } = await import('@/lib/supabaseClient')
      if (!supabase) {
        setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageLayout showSignInLink>
      <div className="w-full max-w-[420px] animate-[fadeUp_0.6s_ease_both]">
        <div className="bg-dark-3 border border-border-dark rounded-2xl p-8 md:p-10 shadow-[0_0_0_1px_var(--color-border-dark),0_24px_48px_rgba(0,0,0,0.4)]">
          <h1 className="font-sora text-2xl md:text-3xl font-bold text-landing-white tracking-tight mb-2">
            Create an account
          </h1>
          <p className="text-white-dim text-sm mb-8">
            Sign up to start creating takeoffs and build lists.
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
                minLength={6}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-dark-4 border border-border-dark rounded-lg text-landing-white placeholder:text-white-dim focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                placeholder="••••••••"
              />
              <p className="mt-1.5 text-xs text-white-dim">At least 6 characters</p>
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-landing-white mb-1.5"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (confirmPasswordError) setConfirmPasswordError(null)
                }}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-dark-4 border border-border-dark rounded-lg text-landing-white placeholder:text-white-dim focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                placeholder="••••••••"
              />
              {confirmPasswordError && (
                <p className="mt-1.5 text-sm text-red-200">
                  {confirmPasswordError}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-lg font-sora font-semibold text-[15px] bg-accent text-white shadow-[0_0_20px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-[0_4px_30px_var(--color-accent-glow)] disabled:opacity-50 disabled:pointer-events-none disabled:transform-none transition-all"
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>
          <p className="mt-6 text-sm text-white-dim text-center">
            Already have an account?{' '}
            <Link
              to="/sign-in"
              className="text-accent-hover font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthPageLayout>
  )
}
