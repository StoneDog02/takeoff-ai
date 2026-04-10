import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { completeAffiliateSetup, validateAffiliateSetupToken } from '@/api/affiliatePortal'
import { AuthPageLayout } from '@/components/landing/AuthPageLayout'

export function AffiliateSetupPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const [loading, setLoading] = useState(true)
  const [valid, setValid] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [commissionPct, setCommissionPct] = useState<number | null>(null)
  const [tracksCommission, setTracksCommission] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setValid(false)
      setError('Missing setup link. Open the link from your welcome email.')
      return
    }
    let cancelled = false
    validateAffiliateSetupToken(token)
      .then((r) => {
        if (cancelled) return
        if (r.valid) {
          setValid(true)
          setName(r.name ?? '')
          setEmail(r.email ?? '')
          setCommissionPct(r.commission_percent ?? null)
          setTracksCommission(r.tracks_commission !== false)
        } else {
          setValid(false)
          setError(r.error || 'This link is invalid or has already been used.')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not validate link. Try again later.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await completeAffiliateSetup(token, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageLayout>
      <div className="w-full max-w-[440px] animate-[fadeUp_0.6s_ease_both]">
        <div className="bg-dark-3 border border-border-dark rounded-2xl p-8 md:p-10 shadow-[0_0_0_1px_var(--color-border-dark),0_24px_48px_rgba(0,0,0,0.4)]">
          <h1 className="font-sora text-2xl md:text-3xl font-bold text-landing-white tracking-tight mb-2">
            Partner portal
          </h1>
          <p className="text-white-dim text-sm mb-8">
            {tracksCommission
              ? 'Create a password to view sign-ups and commissions for your referral code.'
              : 'Create a password to view sign-ups and send invites with your referral code.'}
          </p>

          {loading && <p className="text-white-dim text-sm">Checking your link…</p>}

          {!loading && !valid && error && (
            <div className="p-3 rounded-lg bg-accent/15 border border-accent/30 text-red-200 text-sm mb-4">{error}</div>
          )}

          {!loading && valid && !done && (
            <>
              <div className="mb-6 p-4 rounded-xl bg-dark-4 border border-border-dark text-sm">
                <p className="text-landing-white font-medium mb-1">{name}</p>
                <p className="text-white-dim">{email}</p>
                {commissionPct != null && (
                  <p className="text-white-dim mt-2">
                    Commission rate: <span className="text-landing-white font-semibold">{commissionPct}%</span>
                  </p>
                )}
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 rounded-lg bg-accent/15 border border-accent/30 text-red-200 text-sm">{error}</div>
                )}
                <div>
                  <label htmlFor="pw" className="block text-sm font-medium text-landing-white mb-1.5">
                    Password
                  </label>
                  <input
                    id="pw"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 bg-dark-4 border border-border-dark rounded-lg text-landing-white placeholder:text-white-dim focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                <div>
                  <label htmlFor="pw2" className="block text-sm font-medium text-landing-white mb-1.5">
                    Confirm password
                  </label>
                  <input
                    id="pw2"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 bg-dark-4 border border-border-dark rounded-lg text-landing-white placeholder:text-white-dim focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-lg bg-accent text-white font-semibold text-sm hover:opacity-95 disabled:opacity-50"
                >
                  {submitting ? 'Creating account…' : 'Create password & activate'}
                </button>
              </form>
            </>
          )}

          {done && (
            <div className="space-y-4">
              <p className="text-landing-white text-sm leading-relaxed">
                You&apos;re all set. Sign in with <strong className="text-landing-white">{email}</strong> and your new
                password to open your partner dashboard.
              </p>
              <Link
                to="/sign-in"
                className="block w-full text-center py-3.5 rounded-lg bg-accent text-white font-semibold text-sm hover:opacity-95"
              >
                Sign in
              </Link>
            </div>
          )}

          <p className="mt-8 text-center text-white-dim text-sm">
            <Link to="/sign-in" className="text-accent hover:underline">
              Already have a password? Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthPageLayout>
  )
}
