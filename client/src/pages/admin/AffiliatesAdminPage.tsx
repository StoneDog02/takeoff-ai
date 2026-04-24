import { useCallback, useEffect, useState } from 'react'
import {
  createAdminAffiliate,
  deleteAdminAffiliate,
  getAdminAffiliates,
  getAdminMyInvite,
  patchAdminAffiliate,
  postAdminMyInviteSendInvite,
  provisionAdminMyInvite,
  type AdminAffiliate,
  type AdminMyInviteResponse,
} from '@/api/admin'
import { Card, CardBody, CardHeader } from '@/components/settings/SettingsPrimitives'

function formatMoney(cents: number, currency = 'USD') {
  const n = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n / 100)
}

function signupLink(code: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/sign-up?ref=${encodeURIComponent(code)}`
}

export function AffiliatesAdminPage() {
  const [affiliates, setAffiliates] = useState<AdminAffiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [myInvite, setMyInvite] = useState<AdminMyInviteResponse | null>(null)
  const [myInviteLoading, setMyInviteLoading] = useState(true)
  const [provisionLoading, setProvisionLoading] = useState(false)
  const [provisionName, setProvisionName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteNotice, setInviteNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    commissionPercent: '20',
  })

  const load = useCallback(async () => {
    setError(null)
    const data = await getAdminAffiliates()
    setAffiliates(data.affiliates)
  }, [])

  const loadMyInvite = useCallback(async () => {
    const m = await getAdminMyInvite()
    setMyInvite(m)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load affiliates')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  useEffect(() => {
    let cancelled = false
    setMyInviteLoading(true)
    loadMyInvite()
      .catch(() => {
        if (!cancelled) setMyInvite(null)
      })
      .finally(() => {
        if (!cancelled) setMyInviteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadMyInvite])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const pct = Number(form.commissionPercent)
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError('Commission must be between 0 and 100%.')
      return
    }
    setCreating(true)
    try {
      const result = await createAdminAffiliate({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        commission_rate: pct / 100,
      })
      setForm({ name: '', email: '', phone: '', commissionPercent: '20' })
      await load()
      if (result.welcome_email_sent === false) {
        setNotice(
          'Affiliate created, but the welcome email was not sent. Set RESEND_API_KEY and INVITE_EMAIL_FROM on the API server.'
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create affiliate')
    } finally {
      setCreating(false)
    }
  }

  async function saveCommissionPct(id: string, percentStr: string) {
    const pct = Number(percentStr)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return
    setError(null)
    try {
      await patchAdminAffiliate(id, { commission_rate: pct / 100 })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update commission')
    }
  }

  async function removeAffiliate(a: AdminAffiliate) {
    const ok = window.confirm(
      `Remove partner "${a.name}" (${a.email})?\n\nThis permanently deletes their referral code, all referral rows and commission history for this program, and their partner portal login if they already set a password. Referred customer accounts are not deleted.`
    )
    if (!ok) return
    setError(null)
    try {
      await deleteAdminAffiliate(a.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove affiliate')
    }
  }

  return (
    <div className="admin-page min-h-full">
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
        <div className="page-header">
          <h1 className="page-title">Affiliates</h1>
          <p className="page-sub">
            Create referral codes for partners. Signups use the same <code className="text-[13px]">?ref=</code> flow;
            commission accrues as a percentage of each paid subscription invoice (Stripe). Admins can use{' '}
            <strong>Your invite</strong> below for a personal code (invite-only, no commission) without the partner
            portal.
          </p>
        </div>

        <Card style={{ marginBottom: 24 }}>
          <CardHeader
            title="Your invite"
            desc="Your own referral link and email invites. Invite-only means no commission is tracked for your code—you still appear in the partners list if you have a partner record."
          />
          <CardBody>
            {myInviteLoading && (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>Loading…</p>
            )}
            {!myInviteLoading && myInvite && !myInvite.has_invite && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
                  You don&apos;t have a personal referral code yet. Create one to copy a sign-up link or email invites
                  from this page (no commission).
                </p>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Display name (optional)</span>
                  <input
                    className="input"
                    value={provisionName}
                    onChange={(e) => setProvisionName(e.target.value)}
                    placeholder="e.g. Stoney Harward"
                    autoComplete="name"
                  />
                </label>
                <div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={provisionLoading}
                    onClick={async () => {
                      setError(null)
                      setInviteNotice(null)
                      setProvisionLoading(true)
                      try {
                        await provisionAdminMyInvite({
                          name: provisionName.trim() || undefined,
                        })
                        setProvisionName('')
                        await loadMyInvite()
                        await load()
                        setNotice('Your personal invite code is ready.')
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Could not create invite')
                      } finally {
                        setProvisionLoading(false)
                      }
                    }}
                  >
                    {provisionLoading ? 'Creating…' : 'Create my invite link'}
                  </button>
                </div>
              </div>
            )}
            {!myInviteLoading && myInvite && myInvite.has_invite && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {!myInvite.affiliate.active && (
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--red, #b91c1c)' }}>
                    Your partner record is inactive; turn it on in the table below or ask another admin.
                  </p>
                )}
                {myInvite.affiliate.tracks_commission !== false && myInvite.commission_percent != null && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      gap: '8px 12px',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'var(--bg-muted, #f4f4f5)',
                      border: '1px solid var(--border, #e4e4e7)',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your commission rate</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                      {myInvite.commission_percent}%
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: '1 1 100%' }}>
                      of eligible paid subscription invoice amounts attributed to your code.
                    </span>
                  </div>
                )}
                {myInvite.affiliate.tracks_commission === false && (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                    Invite-only: no commission percentage is shown or accrued for your code.
                  </p>
                )}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Referral code</div>
                  <code
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      letterSpacing: '0.06em',
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    {myInvite.referral_code ?? '—'}
                  </code>
                </div>
                {myInvite.referral_share_url ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <code
                      style={{
                        flex: '1 1 200px',
                        fontSize: 12,
                        wordBreak: 'break-all',
                        background: 'var(--bg-muted, #f4f4f5)',
                        padding: '8px 10px',
                        borderRadius: 8,
                      }}
                    >
                      {myInvite.referral_share_url}
                    </code>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        navigator.clipboard.writeText(myInvite.referral_share_url!).catch(() => {})
                      }
                    >
                      Copy link
                    </button>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                    Share URL unavailable until PUBLIC_APP_URL (or equivalent) is set on the API server.
                  </p>
                )}
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Sign-ups: {myInvite.signup_count} · Completed paid cycle: {myInvite.completed_referrals}
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Email an invite</div>
                  <form
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', maxWidth: 520 }}
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const email = inviteEmail.trim().toLowerCase()
                      if (!email.includes('@')) {
                        setInviteNotice({ type: 'err', text: 'Enter a valid email.' })
                        return
                      }
                      setInviteLoading(true)
                      setInviteNotice(null)
                      try {
                        const r = await postAdminMyInviteSendInvite(email)
                        setInviteNotice({
                          type: 'ok',
                          text: r.message || 'Invite sent.',
                        })
                        setInviteEmail('')
                        await loadMyInvite()
                        await load()
                      } catch (err) {
                        setInviteNotice({
                          type: 'err',
                          text: err instanceof Error ? err.message : 'Could not send invite.',
                        })
                      } finally {
                        setInviteLoading(false)
                      }
                    }}
                  >
                    <label style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Recipient</span>
                      <input
                        className="input"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={inviteLoading || !myInvite.affiliate.active}
                        autoComplete="email"
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={inviteLoading || !myInvite.affiliate.active}
                    >
                      {inviteLoading ? 'Sending…' : 'Send invite'}
                    </button>
                  </form>
                  {inviteNotice && (
                    <p
                      style={{
                        marginTop: 10,
                        marginBottom: 0,
                        fontSize: 13,
                        color: inviteNotice.type === 'ok' ? 'var(--green-700, #15803d)' : 'var(--red, #b91c1c)',
                      }}
                    >
                      {inviteNotice.text}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: 'var(--red-light, #fef2f2)',
              borderRadius: 8,
              color: 'var(--red, #b91c1c)',
            }}
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: 'var(--amber-light, #fffbeb)',
              borderRadius: 8,
              color: 'var(--amber-900, #92400e)',
            }}
          >
            {notice}
          </div>
        )}

        <Card style={{ marginBottom: 24 }}>
          <CardHeader title="New affiliate" desc="Generates a unique referral code and signup link." />
          <CardBody>
            <form
              onSubmit={handleCreate}
              style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', alignItems: 'end' }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Name</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  autoComplete="name"
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Email</span>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  autoComplete="email"
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Phone</span>
                <input
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  autoComplete="tel"
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Commission %</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.commissionPercent}
                  onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))}
                  required
                />
              </label>
              <div>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create affiliate'}
                </button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Partners"
            desc="Partner signed up means they finished the partner-portal password flow (linked auth). Referred customer signups use the code column. Completed = first paid cycle; commission sums Stripe accruals."
          />
          <CardBody style={{ padding: 0 }}>
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Code / link</th>
                    <th>Partner signed up</th>
                    <th>Signups</th>
                    <th>Completed</th>
                    <th>Commission %</th>
                    <th>Accrued</th>
                    <th style={{ width: 100 }}> </th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && affiliates.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                        No affiliates yet
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    affiliates.map((a) => (
                      <AffiliateRow
                        key={a.id}
                        affiliate={a}
                        onSaveCommission={saveCommissionPct}
                        onRemove={() => removeAffiliate(a)}
                      />
                    ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function AffiliateRow({
  affiliate: a,
  onSaveCommission,
  onRemove,
}: {
  affiliate: AdminAffiliate
  onSaveCommission: (id: string, percentStr: string) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const tracksCommission = a.tracks_commission !== false
  const [pctDraft, setPctDraft] = useState(String(Math.round((a.commission_rate ?? 0) * 1000) / 10))
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    setPctDraft(String(Math.round((a.commission_rate ?? 0) * 1000) / 10))
  }, [a.commission_rate, a.id])

  const code = a.referral_code
  const link = code ? signupLink(code) : ''

  return (
    <tr>
      <td>{a.name}</td>
      <td>{a.email}</td>
      <td>{a.phone || '—'}</td>
      <td style={{ maxWidth: 280 }}>
        {code ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <code style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' }}>{code}</code>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => navigator.clipboard.writeText(link).catch(() => {})}
              >
                Copy link
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => navigator.clipboard.writeText(code).catch(() => {})}
              >
                Copy code
              </button>
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: a.portal_signed_up === true ? 'var(--green-700, #15803d)' : 'var(--text-muted)',
          }}
        >
          {a.portal_signed_up === true ? 'Yes' : 'No'}
        </span>
      </td>
      <td>{a.signup_count}</td>
      <td>{a.completed_referrals}</td>
      <td>
        {tracksCommission ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              step={0.5}
              style={{ width: 88, padding: '6px 8px', fontSize: 13 }}
              value={pctDraft}
              onChange={(e) => setPctDraft(e.target.value)}
              disabled={saving || !a.active}
              aria-label="Commission percent"
            />
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving || !a.active}
              onClick={async () => {
                setSaving(true)
                try {
                  await onSaveCommission(a.id, pctDraft)
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? '…' : 'Save'}
            </button>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }} title="No commission tracking for this partner">
            Invite-only
          </span>
        )}
      </td>
      <td>{tracksCommission ? formatMoney(a.commission_cents_total) : '—'}</td>
      <td>
        <button
          type="button"
          className="btn btn-sm"
          style={{ color: 'var(--red, #b91c1c)' }}
          disabled={removing}
          onClick={async () => {
            setRemoving(true)
            try {
              await onRemove()
            } finally {
              setRemoving(false)
            }
          }}
        >
          {removing ? '…' : 'Remove'}
        </button>
      </td>
    </tr>
  )
}
