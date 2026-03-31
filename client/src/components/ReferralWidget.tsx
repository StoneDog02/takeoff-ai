import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDeleteReferralModal } from '@/components/ConfirmDeleteReferralModal'
import { Gift, Copy, Check, Loader2, Mail, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { callEdgeFunctionJson } from '@/lib/edgeFunctions'
import { API_BASE } from '@/api/config'
import { getSessionAuthHeaders } from '@/api/authHeaders'
import { SectionHeader, Card, CardHeader, CardBody, Label, Input, Btn } from '@/components/settings/SettingsPrimitives'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

type ReferralCreditsRow = {
  credits_remaining: number
  total_earned: number
  total_used: number
}

type ReferralHistoryRow = {
  id: string
  referee_email: string | null
  referee_id: string | null
  status: string
  created_at: string
  completed_at: string | null
  invite_email_opened_at?: string | null
  signed_up_at?: string | null
}

function ReferralStatusBadges({ row }: { row: ReferralHistoryRow }) {
  const completed = row.status === 'completed'
  const viewed = !!row.invite_email_opened_at
  const signedUp = !!(row.referee_id || row.signed_up_at)

  if (completed) {
    return (
      <div className="mt-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(22,163,74,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[#15803d] dark:text-[var(--green)]">
          <Check size={12} strokeWidth={2.5} aria-hidden />
          Completed
        </span>
      </div>
    )
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {viewed ? (
        <span className="inline-flex items-center gap-0.5 rounded-md bg-[rgba(59,130,246,0.12)] px-1.5 py-0.5 text-[10px] font-semibold text-[#1d4ed8] dark:text-blue-300">
          <Check size={10} strokeWidth={3} aria-hidden />
          Viewed
        </span>
      ) : (
        <span className="inline-flex items-center rounded-md bg-[rgba(234,179,8,0.15)] px-1.5 py-0.5 text-[10px] font-semibold text-[#b45309] dark:text-[var(--orange)]">
          Invite sent
        </span>
      )}
      {signedUp ? (
        <span className="inline-flex items-center gap-0.5 rounded-md bg-[rgba(22,163,74,0.12)] px-1.5 py-0.5 text-[10px] font-semibold text-[#15803d] dark:text-[var(--green)]">
          <Check size={10} strokeWidth={3} aria-hidden />
          Signed up
        </span>
      ) : (
        <span className="inline-flex items-center rounded-md bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
          Awaiting signup
        </span>
      )}
    </div>
  )
}

function appBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return '—'
  }
}

export function ReferralWidget() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [credits, setCredits] = useState<ReferralCreditsRow | null>(null)
  const [history, setHistory] = useState<ReferralHistoryRow[]>([])
  const [copyState, setCopyState] = useState<'code' | 'link' | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [referralToDelete, setReferralToDelete] = useState<ReferralHistoryRow | null>(null)
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null)
  const [historyNotice, setHistoryNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const historyNoticeClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inviteMessageClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent
    if (!supabase) {
      setError('Supabase is not configured.')
      if (!silent) setLoading(false)
      return
    }
    if (!silent) setError(null)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      setError('Sign in to view your referral program.')
      if (!silent) setLoading(false)
      return
    }
    const userId = session.user.id

    const { data: fnData, errorMessage: fnErr } = await callEdgeFunctionJson<{
      code?: string
      error?: string
    }>('generate-referral-code', { method: 'GET' })
    if (fnErr) {
      const hint =
        fnErr.startsWith('Network error') || /failed to fetch/i.test(fnErr)
          ? import.meta.env.DEV
            ? ' Restart the Vite dev server after env changes. Edge calls use `/functions/v1` → proxied to Supabase (same-origin in dev). You can also unregister the service worker (Application → Service Workers) or try a private window.'
            : ' Try a hard refresh or unregister the service worker for this site. If it persists, set VITE_SUPABASE_ANON_KEY to the legacy anon (JWT) from Supabase → Settings → API.'
          : ' If the function is missing, run `supabase functions deploy generate-referral-code` for this project.'
      setError(`${fnErr}${hint}`)
      if (!silent) setLoading(false)
      return
    }
    const payload = fnData as { code?: string; error?: string } | null
    if (payload?.error || !payload?.code) {
      setError(typeof payload?.error === 'string' ? payload.error : 'Could not load referral code.')
      if (!silent) setLoading(false)
      return
    }
    setCode(payload.code)

    const [creditsRes, historyRes] = await Promise.all([
      supabase
        .from('referral_credits')
        .select('credits_remaining, total_earned, total_used')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('referrals')
        .select('id, referee_email, referee_id, status, created_at, completed_at, invite_email_opened_at, signed_up_at')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false }),
    ])

    if (creditsRes.error) {
      console.error('[ReferralWidget] referral_credits:', creditsRes.error)
      setError('Could not load referral credits.')
    } else {
      setCredits(
        creditsRes.data
          ? {
              credits_remaining: creditsRes.data.credits_remaining ?? 0,
              total_earned: creditsRes.data.total_earned ?? 0,
              total_used: creditsRes.data.total_used ?? 0,
            }
          : { credits_remaining: 0, total_earned: 0, total_used: 0 }
      )
    }

    if (historyRes.error) {
      console.error('[ReferralWidget] referrals:', historyRes.error)
      setError((prev) => prev ?? 'Could not load referral history.')
    } else {
      setHistory((historyRes.data as ReferralHistoryRow[]) ?? [])
    }

    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    return () => {
      if (historyNoticeClearTimerRef.current) {
        clearTimeout(historyNoticeClearTimerRef.current)
        historyNoticeClearTimerRef.current = null
      }
      if (inviteMessageClearTimerRef.current) {
        clearTimeout(inviteMessageClearTimerRef.current)
        inviteMessageClearTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!referralToDelete) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || deletingId) return
      setReferralToDelete(null)
      setDeleteModalError(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [referralToDelete, deletingId])

  const referralLink = code ? `${appBaseUrl()}/?ref=${encodeURIComponent(code)}` : ''

  const clearInviteMessageTimer = () => {
    if (inviteMessageClearTimerRef.current) {
      clearTimeout(inviteMessageClearTimerRef.current)
      inviteMessageClearTimerRef.current = null
    }
  }

  const copyToClipboard = async (which: 'code' | 'link', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState(which)
      window.setTimeout(() => setCopyState(null), 2000)
    } catch {
      clearInviteMessageTimer()
      setInviteMessage({ type: 'err', text: 'Could not copy to clipboard.' })
    }
  }

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    const email = inviteEmail.trim().toLowerCase()
    if (!email.includes('@')) {
      clearInviteMessageTimer()
      setInviteMessage({ type: 'err', text: 'Enter a valid email address.' })
      return
    }
    setInviteLoading(true)
    clearInviteMessageTimer()
    setInviteMessage(null)
    try {
      const authHeaders = await getSessionAuthHeaders()
      const res = await fetch(`${API_BASE}/referrals/send-invite`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        message?: string
        code?: string
      }
      if (!res.ok) {
        setInviteMessage({
          type: 'err',
          text:
            (typeof body?.error === 'string' && body.error) ||
            (res.status === 401 ? 'Sign in again, then try sending the invite.' : 'Invite failed.'),
        })
        return
      }
      if (body?.success) {
        clearInviteMessageTimer()
        setInviteMessage({
          type: 'ok',
          text: body.message || 'We sent an email with a sign-up link that includes your referral.',
        })
        inviteMessageClearTimerRef.current = setTimeout(() => {
          setInviteMessage(null)
          inviteMessageClearTimerRef.current = null
        }, 3000)
        setInviteEmail('')
        await loadData({ silent: true })
      } else {
        setInviteMessage({ type: 'err', text: body?.error || 'Unexpected response from server.' })
      }
    } catch (err) {
      setInviteMessage({ type: 'err', text: err instanceof Error ? err.message : 'Invite failed.' })
    } finally {
      setInviteLoading(false)
    }
  }

  const closeDeleteModal = () => {
    if (deletingId) return
    setReferralToDelete(null)
    setDeleteModalError(null)
  }

  const confirmDeleteReferral = async () => {
    if (!supabase || !referralToDelete) return
    const rowId = referralToDelete.id
    setDeletingId(rowId)
    setDeleteModalError(null)
    setHistoryNotice(null)
    try {
      const authHeaders = await getSessionAuthHeaders()
      const res = await fetch(`${API_BASE}/referrals/${encodeURIComponent(rowId)}`, {
        method: 'DELETE',
        headers: { ...authHeaders },
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setDeleteModalError(
          body.error || (res.status === 404 ? 'Referral not found.' : 'Could not delete referral.')
        )
        return
      }
      setReferralToDelete(null)
      if (history.length <= 1) {
        setHistory([])
      } else {
        setHistory((prev) => prev.filter((r) => r.id !== rowId))
      }
      setHistoryNotice({ type: 'ok', text: 'Referral removed.' })
      if (historyNoticeClearTimerRef.current) clearTimeout(historyNoticeClearTimerRef.current)
      historyNoticeClearTimerRef.current = setTimeout(() => {
        setHistoryNotice(null)
        historyNoticeClearTimerRef.current = null
      }, 3000)
    } catch (err) {
      setDeleteModalError(err instanceof Error ? err.message : 'Could not delete referral.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="py-2">
        <LoadingSkeleton variant="inline" lines={6} />
      </div>
    )
  }

  if (!supabase) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.
      </p>
    )
  }

  return (
    <>
      <SectionHeader
        title="Referrals"
        desc="Share your code. When someone subscribes, you both earn credits. Each credit applies a 10% discount on a future subscription invoice."
      />

      {error && (
        <div
          className="mb-4 rounded-lg border border-[color:var(--red-border)] bg-[rgba(192,57,43,0.08)] px-3 py-2.5 text-[13px] text-[var(--red)] dark:text-[var(--red-light)]"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-[color:var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow)]">
        <Card style={{ marginBottom: 0, border: 'none', boxShadow: 'none', background: 'transparent' }}>
        <CardBody className="!pt-5">
          <div className="mb-4 flex flex-wrap items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f0ede8] dark:bg-[var(--bg-hover)]"
              aria-hidden
            >
              <Gift size={22} strokeWidth={1.75} className="text-[#b91c1c] dark:text-[var(--red-light)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold text-[#111] dark:text-[var(--text-primary)]">
                Discount credits queued
              </div>
              <p className="mt-1 text-[13px] leading-normal text-[#9ca3af] dark:text-[var(--text-muted)]">
                <span className="font-semibold text-[#111] dark:text-[var(--text-primary)]">
                  {credits?.credits_remaining ?? 0}
                </span>{' '}
                month{credits?.credits_remaining === 1 ? '' : 's'} of 10% off ready to apply on your next eligible
                billing cycle (after your free trial). Earned: {credits?.total_earned ?? 0} · Used:{' '}
                {credits?.total_used ?? 0}
              </p>
            </div>
          </div>
        </CardBody>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow)]">
        <Card style={{ marginBottom: 0, border: 'none', boxShadow: 'none', background: 'transparent' }}>
          <CardHeader title="Your referral code" />
          <CardBody>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 rounded-lg border border-[color:var(--border)] bg-[var(--bg-raised)] px-3 py-2.5 font-mono text-[15px] font-semibold tracking-wide text-[var(--text-primary)]">
                {code ?? '—'}
              </div>
              <Btn
                type="button"
                variant="outline"
                disabled={!code}
                className="shrink-0 whitespace-nowrap sm:w-auto"
                onClick={() => code && copyToClipboard('code', code)}
              >
                {copyState === 'code' ? (
                  <>
                    <Check size={16} className="mr-1.5 inline" strokeWidth={2.5} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} className="mr-1.5 inline" strokeWidth={2} />
                    Copy code
                  </>
                )}
              </Btn>
            </div>
          </CardBody>
        </Card>
        </div>

        <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow)]">
        <Card style={{ marginBottom: 0, border: 'none', boxShadow: 'none', background: 'transparent' }}>
          <CardHeader title="Referral link" />
          <CardBody>
            <p className="mb-2 text-[12px] text-[var(--text-muted)]">Based on your current app URL.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 break-all rounded-lg border border-[color:var(--border)] bg-[var(--bg-raised)] px-3 py-2.5 text-[13px] text-[var(--text-secondary)]">
                {referralLink || '—'}
              </div>
              <Btn
                type="button"
                variant="outline"
                disabled={!referralLink}
                className="shrink-0 whitespace-nowrap sm:w-auto"
                onClick={() => referralLink && copyToClipboard('link', referralLink)}
              >
                {copyState === 'link' ? (
                  <>
                    <Check size={16} className="mr-1.5 inline" strokeWidth={2.5} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} className="mr-1.5 inline" strokeWidth={2} />
                    Copy link
                  </>
                )}
              </Btn>
            </div>
          </CardBody>
        </Card>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-[color:var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow)]">
      <Card style={{ marginBottom: 0, border: 'none', boxShadow: 'none', background: 'transparent' }}>
        <CardHeader
          title="Email invite"
          desc="We’ll email them a sign-up link with your referral already applied—no need to copy the code."
        />
        <CardBody>
          <form onSubmit={submitInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label>Email</Label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviteLoading}
                className="dark:border-[color:var(--border)] dark:bg-[var(--bg-hover)] dark:text-[var(--text-primary)]"
              />
            </div>
            <Btn type="submit" disabled={inviteLoading} className="w-full shrink-0 sm:w-auto">
              {inviteLoading ? (
                <>
                  <Loader2 size={16} className="mr-2 inline animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail size={16} className="mr-2 inline" strokeWidth={2} />
                  Send invite
                </>
              )}
            </Btn>
          </form>
          {inviteMessage && (
            <p
              className={`mt-3 text-[13px] ${inviteMessage.type === 'ok' ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}
              role="status"
            >
              {inviteMessage.text}
            </p>
          )}
        </CardBody>
      </Card>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow)]">
      <Card style={{ marginBottom: 0, border: 'none', boxShadow: 'none', background: 'transparent' }}>
        <CardHeader
          title="Referrals sent"
          desc="Invite history. “Viewed” uses a tracking image when the email is opened (some clients block this). “Signed up” updates when they create an account with your link."
        />
        <CardBody className="!px-0 !pb-0">
          {history.length === 0 ? (
            <p className="px-6 pb-6 text-[13px] text-[var(--text-muted)]">No referrals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[color:var(--border)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-6 py-2.5">Invite & progress</th>
                    <th className="px-6 py-2.5">Created</th>
                    <th className="px-6 py-2.5">Completed</th>
                    <th className="w-px px-4 py-2.5 text-right sm:px-6"> </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => {
                    const emailLabel =
                      row.referee_email?.trim() ||
                      (row.referee_id ? 'Registered user' : '—')
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[color:var(--border)] last:border-0 hover:bg-[var(--bg-hover)]/50"
                      >
                        <td className="px-6 py-3 text-[var(--text-primary)]">
                          <div className="font-medium">{emailLabel}</div>
                          <ReferralStatusBadges row={row} />
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-[var(--text-secondary)]">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-[var(--text-secondary)]">
                          {row.status === 'completed' ? formatDate(row.completed_at) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right sm:px-6">
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[var(--bg-raised)] text-[var(--text-muted)] transition hover:border-[color:var(--red-border)] hover:bg-[rgba(192,57,43,0.06)] hover:text-[var(--red)] dark:hover:text-[var(--red-light)]"
                            aria-label={`Delete referral ${emailLabel}`}
                            disabled={deletingId === row.id}
                            onClick={() => {
                              setDeleteModalError(null)
                              setReferralToDelete(row)
                            }}
                          >
                            {deletingId === row.id ? (
                              <Loader2 size={16} className="animate-spin" strokeWidth={2} />
                            ) : (
                              <Trash2 size={16} strokeWidth={2} />
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {historyNotice && (
            <p
              className={`px-6 pb-4 text-[13px] ${historyNotice.type === 'ok' ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}
              role="status"
            >
              {historyNotice.text}
            </p>
          )}
        </CardBody>
      </Card>
      </div>

      {referralToDelete && (
        <ConfirmDeleteReferralModal
          row={referralToDelete}
          onClose={closeDeleteModal}
          onConfirm={confirmDeleteReferral}
          isDeleting={deletingId === referralToDelete.id}
          error={deleteModalError}
        />
      )}
    </>
  )
}
