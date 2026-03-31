import { useCallback, useEffect, useState } from 'react'
import {
  createFinancialConnectionsSession,
  getFinancialConnectionsStatus,
  syncFinancialConnections,
  type FinancialConnectionsAccount,
} from '@/api/financialConnections'
import { isStripeConfigured, stripePromise } from '@/lib/stripe'
import { supabase } from '@/lib/supabaseClient'

type CollectFcFn = (opts: {
  clientSecret: string
}) => Promise<{
  error?: { message?: string }
  financialConnectionsSession?: { accounts?: { id: string }[] }
}>

/**
 * Optional Financial Connections link (Stripe.js collect flow — not Card Element).
 * Signup: pass email only; persistence runs after account creation (see SignUpPage sync).
 * Settings: uses session token and syncs to Supabase after a successful link.
 */
export function LinkBankAccountPanel({
  variant,
  signupEmail,
}: {
  variant: 'signup' | 'settings'
  signupEmail?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<FinancialConnectionsAccount[]>([])
  const [signupLinked, setSignupLinked] = useState(false)

  const loadStatus = useCallback(async () => {
    if (variant !== 'settings' || !supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    try {
      const { accounts: list } = await getFinancialConnectionsStatus(session.access_token)
      setAccounts(list)
    } catch {
      setAccounts([])
    }
  }, [variant])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const runLink = async () => {
    setError(null)
    if (!isStripeConfigured || !stripePromise) {
      setError('Stripe is not configured.')
      return
    }
    const stripe = await stripePromise
    if (!stripe) {
      setError('Stripe failed to load.')
      return
    }
    const collect = stripe.collectFinancialConnectionsAccounts as unknown as
      | CollectFcFn
      | undefined
    if (typeof collect !== 'function') {
      setError('Update @stripe/stripe-js to use bank linking.')
      return
    }

    setBusy(true)
    try {
      let accessToken: string | null = null
      if (variant === 'settings' && supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        accessToken = session?.access_token ?? null
        if (!accessToken) {
          setError('You need to be signed in.')
          setBusy(false)
          return
        }
      }

      const email =
        variant === 'signup' ? signupEmail?.trim() : undefined
      if (variant === 'signup' && !email) {
        setError('Email is required to link your bank.')
        setBusy(false)
        return
      }

      const { client_secret } = await createFinancialConnectionsSession({
        accessToken,
        email,
      })

      const result = await collect.call(stripe, { clientSecret: client_secret })
      if (result.error) {
        setError(result.error.message || 'Bank linking was cancelled or failed.')
        setBusy(false)
        return
      }

      const linked = (result.financialConnectionsSession?.accounts?.length ?? 0) > 0
      if (variant === 'signup') {
        setSignupLinked(linked)
        setBusy(false)
        return
      }

      if (accessToken) {
        const { accounts: synced } = await syncFinancialConnections(accessToken)
        setAccounts(synced)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (!isStripeConfigured) {
    return variant === 'signup' ? null : (
      <p className="text-[13px] text-[#9ca3af]">
        Bank linking is unavailable until Stripe keys are configured.
      </p>
    )
  }

  if (variant === 'signup') {
    return (
      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${'#EBEBEB'}`,
          background: '#fff',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 6 }}>
          Optional: Link bank for transactions
        </div>
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px', lineHeight: 1.5 }}>
          Connect your business bank securely through Stripe to import transactions on the Transactions
          page. You can skip this and connect later in Settings → Integrations.
        </p>
        {error && (
          <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>{error}</div>
        )}
        {signupLinked ? (
          <div style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>
            Bank linked — we&apos;ll attach it to your account after signup completes.
          </div>
        ) : (
          <button
            type="button"
            onClick={runLink}
            disabled={busy}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #1A1A1A',
              background: '#fff',
              color: '#1A1A1A',
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.75 : 1,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {busy ? 'Opening bank link…' : 'Link bank account'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}
      {accounts.length > 0 ? (
        <ul className="mb-4 list-none space-y-2 p-0">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[13px]"
            >
              <span className="font-semibold text-[var(--text-primary)]">
                {a.institution_name || a.display_name || 'Linked account'}
              </span>
              {a.last4 ? (
                <span className="text-[var(--text-muted)]"> · ·{a.last4}</span>
              ) : null}
              {a.status ? (
                <span className="ml-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  {a.status}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-[13px] leading-snug text-[#9ca3af]">
          No bank accounts linked yet. Link a US account to pull read-only transaction data into
          Transactions.
        </p>
      )}
      <button
        type="button"
        onClick={runLink}
        disabled={busy}
        className="rounded-lg border border-[#111] bg-white px-4 py-2 text-[13px] font-semibold text-[#111] transition-opacity hover:bg-[#fafafa] disabled:cursor-wait disabled:opacity-70 dark:border-[var(--border)] dark:bg-[var(--bg-surface)] dark:text-[var(--text-primary)] dark:hover:bg-[var(--bg-hover)]"
      >
        {busy ? 'Opening Stripe…' : accounts.length > 0 ? 'Link another account' : 'Link bank account'}
      </button>
      {accounts.length > 0 ? (
        <p className="mt-3 text-[11px] text-[#9ca3af]">
          Managed by Stripe Financial Connections. Read-only transaction access only.
        </p>
      ) : null}
    </div>
  )
}
