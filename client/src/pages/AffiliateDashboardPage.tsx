import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getAffiliatePortalSummary,
  postAffiliatePortalSendInvite,
  type AffiliatePortalSummary,
} from '@/api/affiliatePortal'
import { Card, CardBody, CardHeader } from '@/components/settings/SettingsPrimitives'

function formatMoney(cents: number) {
  const n = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return '—'
  }
}

export function AffiliateDashboardPage() {
  const [data, setData] = useState<AffiliatePortalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const inviteOkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const s = await getAffiliatePortalSummary()
    setData(s)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  useEffect(() => {
    return () => {
      if (inviteOkTimerRef.current) clearTimeout(inviteOkTimerRef.current)
    }
  }, [])

  if (loading) {
    return <p className="text-[var(--text-muted)] text-sm">Loading your dashboard…</p>
  }
  if (error || !data) {
    return (
      <div className="p-4 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
        {error || 'Something went wrong'}
      </div>
    )
  }

  const { affiliate, referral_code, referral_share_url, signup_count, completed_referrals, commission_cents_total, referrals } = data
  const tracksCommission = affiliate.tracks_commission !== false

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">Hi, {affiliate.name}</h2>
        <p className="text-sm text-[var(--text-muted)]">
          {tracksCommission
            ? 'Track sign-ups that used your code and commissions accrued from their paid subscriptions.'
            : 'Share your link or email invites—sign-ups are attributed to your referral code.'}
        </p>
      </div>

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${tracksCommission ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Referral code</div>
          <div className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)] tracking-wider">
            {referral_code ?? '—'}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Sign-ups</div>
          <div className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{signup_count}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Completed (paid cycle)</div>
          <div className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{completed_referrals}</div>
        </div>
        {tracksCommission && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Accrued commission</div>
            <div className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{formatMoney(commission_cents_total)}</div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader
          title="Share link"
          desc="Anyone who registers through this link will be attributed to your code."
        />
        <CardBody>
          {referral_share_url ? (
            <div className="flex flex-wrap gap-2 items-center">
              <code className="text-sm break-all bg-[var(--bg-muted)] px-3 py-2 rounded-lg flex-1 min-w-0">{referral_share_url}</code>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => navigator.clipboard.writeText(referral_share_url).catch(() => {})}
              >
                Copy
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Share URL unavailable (app URL not configured on server).</p>
          )}
          {tracksCommission && affiliate.commission_percent != null && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Your rate: {affiliate.commission_percent}% of eligible subscription invoice amounts.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Invite by email"
          desc="We’ll email them a sign-up link that includes your referral code—the same experience as when a customer invites a friend from Settings."
        />
        <CardBody>
          {!affiliate.active ? (
            <p className="text-sm text-[var(--text-muted)]">Your partner account is inactive; invites are disabled.</p>
          ) : (
            <form
              className="flex flex-col sm:flex-row gap-3 sm:items-end max-w-xl"
              onSubmit={async (e) => {
                e.preventDefault()
                const email = inviteEmail.trim().toLowerCase()
                if (!email.includes('@')) {
                  setInviteMessage({ type: 'err', text: 'Enter a valid email address.' })
                  return
                }
                setInviteLoading(true)
                setInviteMessage(null)
                if (inviteOkTimerRef.current) {
                  clearTimeout(inviteOkTimerRef.current)
                  inviteOkTimerRef.current = null
                }
                try {
                  const result = await postAffiliatePortalSendInvite(email)
                  setInviteMessage({
                    type: 'ok',
                    text: result.message || 'We sent an email with a sign-up link that includes your referral.',
                  })
                  setInviteEmail('')
                  await load()
                  inviteOkTimerRef.current = setTimeout(() => {
                    setInviteMessage(null)
                    inviteOkTimerRef.current = null
                  }, 4000)
                } catch (err) {
                  setInviteMessage({
                    type: 'err',
                    text: err instanceof Error ? err.message : 'Could not send invite.',
                  })
                } finally {
                  setInviteLoading(false)
                }
              }}
            >
              <div className="flex-1 min-w-0">
                <label htmlFor="aff-invite-email" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Recipient email
                </label>
                <input
                  id="aff-invite-email"
                  type="email"
                  className="input w-full"
                  placeholder="prospect@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviteLoading}
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="btn btn-primary shrink-0" disabled={inviteLoading}>
                {inviteLoading ? 'Sending…' : 'Send invite'}
              </button>
            </form>
          )}
          {inviteMessage && (
            <p
              className={`text-sm mt-3 ${inviteMessage.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}
              role={inviteMessage.type === 'err' ? 'alert' : undefined}
            >
              {inviteMessage.text}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Referred sign-ups" desc="Email from invite or sign-up; status updates when they complete a paid billing cycle." />
        <CardBody style={{ padding: 0 }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm admin-users-table">
              <thead>
                <tr>
                  <th className="text-left">Email</th>
                  <th className="text-left">Signed up</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Completed</th>
                </tr>
              </thead>
              <tbody>
                {referrals.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-[var(--text-muted)]">
                      No referrals yet. Share your link or send an email invite above.
                    </td>
                  </tr>
                )}
                {referrals.map((r) => (
                  <tr key={r.id}>
                    <td>{r.referee_email || '—'}</td>
                    <td>{formatDate(r.signed_up_at)}</td>
                    <td className="capitalize">{r.status || '—'}</td>
                    <td>{formatDate(r.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
