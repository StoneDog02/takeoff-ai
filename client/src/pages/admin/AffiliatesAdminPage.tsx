import { useCallback, useEffect, useState } from 'react'
import {
  createAdminAffiliate,
  deleteAdminAffiliate,
  getAdminAffiliates,
  patchAdminAffiliate,
  type AdminAffiliate,
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
            commission accrues as a percentage of each paid subscription invoice (Stripe).
          </p>
        </div>

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
            desc="Signups with a completed first paid cycle count toward completed referrals. Commission totals sum Stripe accruals."
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
                      <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && affiliates.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
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
      <td>{a.signup_count}</td>
      <td>{a.completed_referrals}</td>
      <td>
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
      </td>
      <td>{formatMoney(a.commission_cents_total)}</td>
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
