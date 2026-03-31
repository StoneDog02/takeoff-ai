import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Percent } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

type BannerState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'credit'; creditsRemaining: number; trialing: boolean }
  | { kind: 'referred'; trialing: boolean }

const DISMISS_KEY = 'referral_discount_banner_dismissed'

/**
 * Shows when the user has referral credits (10% off next subscription invoice) or joined via a referral
 * and is still pending their first billing cycle.
 */
export function ReferralDiscountBanner({ className = 'mb-4' }: { className?: string }) {
  const [state, setState] = useState<BannerState>({ kind: 'loading' })
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const load = useCallback(async () => {
    if (!supabase) {
      setState({ kind: 'idle' })
      return
    }
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) {
      setState({ kind: 'idle' })
      return
    }

    const [creditsRes, referralAsRefereeRes, subRes] = await Promise.all([
      supabase
        .from('referral_credits')
        .select('credits_remaining')
        .eq('user_id', uid)
        .maybeSingle(),
      supabase
        .from('referrals')
        .select('id, status')
        .eq('referee_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('subscriptions').select('status').eq('user_id', uid).maybeSingle(),
    ])

    const creditsRemaining = Math.max(0, Number(creditsRes.data?.credits_remaining ?? 0))
    const trialing = (subRes.data?.status ?? '').toLowerCase() === 'trialing'
    const referredPending = referralAsRefereeRes.data?.status === 'pending'

    if (creditsRemaining > 0) {
      setState({ kind: 'credit', creditsRemaining, trialing })
      return
    }

    if (referredPending) {
      setState({ kind: 'referred', trialing })
      return
    }

    setState({ kind: 'idle' })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  if (state.kind === 'loading' || state.kind === 'idle') return null
  if (dismissed) return null

  const trialNote = state.trialing
    ? ' After your free trial, when your first subscription invoice is generated, '
    : ' When your next subscription invoice is generated, '

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  if (state.kind === 'credit') {
    const plural = state.creditsRemaining === 1 ? 'credit' : 'credits'
    return (
      <div
        className={`flex flex-col gap-2 rounded-xl border border-[rgba(22,163,74,0.35)] bg-[rgba(22,163,74,0.08)] px-4 py-3 dark:border-[rgba(34,197,94,0.35)] dark:bg-[rgba(34,197,94,0.1)] sm:flex-row sm:items-start sm:justify-between ${className}`}
        role="status"
      >
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(22,163,74,0.2)] text-[#15803d] dark:bg-[rgba(34,197,94,0.2)] dark:text-[var(--green)]"
            aria-hidden
          >
            <Percent size={20} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-[#14532d] dark:text-[var(--green)]">Referral discount active</p>
            <p className="mt-0.5 text-[13px] leading-snug text-[#166534] dark:text-[var(--text-secondary)]">
              You have <strong>{state.creditsRemaining}</strong> referral {plural} saved.
              {trialNote}
              <strong>10% off</strong> is applied on that subscription invoice (not the $0 trial invoice). See{' '}
              <Link to="/settings?section=referrals" className="font-semibold underline underline-offset-2">
                Settings → Referrals
              </Link>
              .
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="self-end text-[12px] font-semibold text-[#166534] underline decoration-[#166534]/40 underline-offset-2 hover:decoration-[#166534] dark:text-[var(--text-muted)] sm:self-center"
        >
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-[color:var(--border)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow)] sm:flex-row sm:items-start sm:justify-between ${className}`}
      role="status"
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(185,28,28,0.1)] text-[#b91c1c] dark:bg-[rgba(192,57,43,0.15)] dark:text-[var(--red-light)]"
          aria-hidden
        >
          <Gift size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-[var(--text-primary)]">You joined with a referral</p>
          <p className="mt-0.5 text-[13px] leading-snug text-[var(--text-muted)]">
            Your account is linked to a referral.{trialNote}
            a <strong>10% discount</strong> can apply on that subscription invoice when referral credits are available.
            Details in{' '}
            <Link to="/settings?section=referrals" className="font-semibold text-[var(--text-primary)] underline underline-offset-2">
              Settings → Referrals
            </Link>
            .
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="self-end text-[12px] font-semibold text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-primary)] sm:self-center"
      >
        Dismiss
      </button>
    </div>
  )
}
