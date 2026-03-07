import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AuthPageLayout } from '@/components/landing/AuthPageLayout'
import { validateInviteToken, acceptInvite } from '@/api/invites'
import { supabase } from '@/lib/supabaseClient'

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [email, setEmail] = useState<string | null>(null)
  const [valid, setValid] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      setValid(false)
      return
    }
    validateInviteToken(token).then((res) => {
      setValid(res.valid)
      setEmail(res.email ?? null)
    }).catch(() => setValid(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await acceptInvite(token, password)
      if (!supabase) throw new Error('Supabase not configured')
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email!, password })
      if (signInErr) throw signInErr
      navigate('/employee/clock', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up account')
    } finally {
      setLoading(false)
    }
  }

  if (valid === null) {
    return (
      <AuthPageLayout>
        <div className="w-full max-w-[420px] animate-[fadeUp_0.6s_ease_both] text-center text-white-dim">
          Checking invite…
        </div>
      </AuthPageLayout>
    )
  }

  if (!valid || !token) {
    return (
      <AuthPageLayout>
        <div className="w-full max-w-[420px] animate-[fadeUp_0.6s_ease_both]">
          <div className="bg-dark-3 border border-border-dark rounded-2xl p-8 md:p-10 shadow-[0_0_0_1px_var(--color-border-dark),0_24px_48px_rgba(0,0,0,0.4)]">
            <h1 className="font-sora text-2xl md:text-3xl font-bold text-landing-white tracking-tight mb-2">
              Invalid or expired invite
            </h1>
            <p className="text-white-dim text-sm">
              This invite link is invalid or has expired. Ask your employer to send a new invite.
            </p>
            <a href="/sign-in" className="mt-6 inline-block text-accent-hover font-medium hover:underline text-sm">
              Go to sign in
            </a>
          </div>
        </div>
      </AuthPageLayout>
    )
  }

  return (
    <AuthPageLayout>
      <div className="w-full max-w-[420px] animate-[fadeUp_0.6s_ease_both]">
        <div className="bg-dark-3 border border-border-dark rounded-2xl p-8 md:p-10 shadow-[0_0_0_1px_var(--color-border-dark),0_24px_48px_rgba(0,0,0,0.4)]">
          <h1 className="font-sora text-2xl md:text-3xl font-bold text-landing-white tracking-tight mb-2">
            Set your password
          </h1>
          <p className="text-white-dim text-sm mb-8">
            Create a password for <strong className="text-landing-white">{email}</strong> to access the employee portal.
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-accent/15 border border-accent/30 text-red-200 text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-landing-white mb-1.5">
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
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-landing-white mb-1.5">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-dark-4 border border-border-dark rounded-lg text-landing-white placeholder:text-white-dim focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-lg font-sora font-semibold text-[15px] bg-accent text-white shadow-[0_0_20px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-[0_4px_30px_var(--color-accent-glow)] disabled:opacity-50 disabled:pointer-events-none disabled:transform-none transition-all"
            >
              {loading ? 'Setting up…' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </AuthPageLayout>
  )
}
