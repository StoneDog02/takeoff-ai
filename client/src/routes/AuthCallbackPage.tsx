import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe } from '@/api/me'
import { supabase } from '@/lib/supabaseClient'
import { useSubscription } from '@/contexts/SubscriptionContext'
import {
  hasAnyPendingSignupBilling,
  tryCompletePendingSignupSubscription,
  waitForSubscriptionRowVisible,
} from '@/lib/pendingSignupSubscription'

const REDIRECT_DELAY_MS = 2500

/** Wait until Supabase has persisted a session (PKCE / hash exchange can take several seconds). */
async function waitForSession(maxWaitMs = 15000): Promise<boolean> {
  if (!supabase) return false
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.access_token) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

/**
 * Handles redirect after Supabase email confirmation.
 * Shows a "Verified" screen, then auto-redirects to dashboard.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { refreshSubscription } = useSubscription()
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!supabase) {
      setError('Auth is not configured.')
      return
    }

    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const searchParams = new URLSearchParams(window.location.search)
    // Implicit flow: #access_token=… — PKCE / server-side: ?code=… (Supabase exchanges on load)
    const hasImplicitTokens = hashParams.has('access_token')
    const hasPkceCode = searchParams.has('code')

    if (hashParams.get('error')) {
      setError(hashParams.get('error_description') || hashParams.get('error') || 'Confirmation failed.')
      return
    }

    if (searchParams.get('error')) {
      setError(searchParams.get('error_description') || searchParams.get('error') || 'Confirmation failed.')
      return
    }

    if (hasImplicitTokens || hasPkceCode) {
      void (async () => {
        const ok = await waitForSession()
        if (!ok) {
          setError('Could not establish a session. Try signing in.')
          return
        }
        const hadPendingBilling = await hasAnyPendingSignupBilling()
        // Email-confirmation signups: single-flight pending completion (see pendingSignupSubscription).
        try {
          await tryCompletePendingSignupSubscription()
        } catch {
          // non-fatal — AuthContext also awaits the same single-flight run
        }
        if (hadPendingBilling) {
          await waitForSubscriptionRowVisible(18000)
        }
        // Row can exist before React Query / realtime; reload billing gates without a full page refresh.
        await refreshSubscription()
        setVerified(true)
        redirectTimeoutRef.current = setTimeout(() => {
          void refreshSubscription()
            .catch(() => {})
            .finally(() => {
              getMe()
                .then((me) => {
                  if (me.type === 'employee') navigate('/employee/clock', { replace: true })
                  else navigate('/dashboard', { replace: true })
                })
                .catch(() => navigate('/dashboard', { replace: true }))
            })
        }, REDIRECT_DELAY_MS)
      })()
      return () => {
        if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current)
      }
    }

    navigate('/sign-in', { replace: true })
  }, [navigate, refreshSubscription])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white p-6">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/sign-in', { replace: true })}
            className="text-sm underline text-white/80 hover:text-white"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  if (verified) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white p-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-6"
          style={{ background: 'rgba(76, 175, 80, 0.2)', border: '2px solid #4caf50', color: '#81c784' }}
        >
          ✓
        </div>
        <h1 className="text-2xl font-semibold mb-2">Email verified</h1>
        <p className="text-white/70 text-center max-w-sm mb-8">
          Your account is verified. Taking you to your dashboard…
        </p>
        <button
          type="button"
          onClick={() => {
            getMe()
              .then((me) => {
                if (me.type === 'employee') navigate('/employee/clock', { replace: true })
                else navigate('/dashboard', { replace: true })
              })
              .catch(() => navigate('/dashboard', { replace: true }))
          }}
          className="text-sm underline text-white/80 hover:text-white"
        >
          Go now
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white">
      <p className="text-white/80">Confirming your email…</p>
    </div>
  )
}
