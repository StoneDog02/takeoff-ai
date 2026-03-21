import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { api, type SupportMessage } from '@/api/client'
import { formatDateTime, formatRelative } from '@/lib/date'
import { Bug, Lightbulb, MessageCircle } from 'lucide-react'

type StatusFilter = 'all' | 'new' | 'seen' | 'in_progress' | 'resolved'
type TypeFilter = 'all' | 'bug' | 'feature' | 'question'

function previewText(s: string, max = 60) {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

/** Prefer stored user_name; otherwise derive a readable name from email local part. */
function resolvedUserDisplayName(m: Pick<SupportMessage, 'user_name' | 'user_email'>) {
  const n = m.user_name?.trim()
  if (n) return n
  const e = m.user_email?.trim()
  if (e?.includes('@')) {
    const local = e.split('@')[0] ?? ''
    if (local) {
      return local
        .replace(/[._]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    }
  }
  return '—'
}

function priorityDotClassName(p: string) {
  const k = ['low', 'normal', 'high', 'critical'].includes(p) ? p : 'normal'
  return `support-priority-dot support-priority-dot--${k}`
}

function TypeIcon({ type }: { type: string }) {
  if (type === 'bug')
    return <Bug size={16} style={{ color: '#dc2626' }} aria-hidden />
  if (type === 'feature')
    return <Lightbulb size={16} style={{ color: '#3b82f6' }} aria-hidden />
  return <MessageCircle size={16} style={{ color: '#16a34a' }} aria-hidden />
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function typeToastLabel(type: string) {
  switch (type) {
    case 'bug':
      return 'Bug Report'
    case 'feature':
      return 'Feature Request'
    case 'question':
      return 'Question'
    case 'other':
      return 'Other'
    default:
      return 'Support'
  }
}

export function SupportInboxPage() {
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [newCount, setNewCount] = useState(0)
  const [notesDraft, setNotesDraft] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [newMsgToast, setNewMsgToast] = useState<{ id: string; name: string; typeLabel: string } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  )

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [listRes, countRes] = await Promise.all([
        api.support.list({
          status: statusFilter,
          type: typeFilter,
          q: debouncedSearch || undefined,
        }),
        api.support.getNewCount(),
      ])
      setMessages(listRes.messages)
      setNewCount(countRes.count)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, debouncedSearch])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const msgId = searchParams.get('msg')
    if (!msgId) return
    if (messages.some((m) => m.id === msgId)) {
      setSelectedId(msgId)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, messages, setSearchParams])

  useEffect(() => {
    if (!newMsgToast) return
    const t = window.setTimeout(() => setNewMsgToast(null), 8000)
    return () => window.clearTimeout(t)
  }, [newMsgToast])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('support_inbox_list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        () => {
          load()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: 'status=eq.new',
        },
        (payload) => {
          const row = payload.new as SupportMessage
          if (!row?.id) return
          const display = resolvedUserDisplayName(row)
          const name = display !== '—' ? display : 'Someone'
          setNewMsgToast({ id: row.id, name, typeLabel: typeToastLabel(row.type) })
        }
      )
      .subscribe()
    return () => {
      if (supabase) void supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    if (selected) setNotesDraft(selected.admin_notes ?? '')
  }, [selected?.id, selected?.admin_notes])

  const markSeenIfNew = async (msg: SupportMessage) => {
    if (msg.status !== 'new') return
    try {
      const updated = await api.support.update(msg.id, { status: 'seen' })
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
      const { count } = await api.support.getNewCount()
      setNewCount(count)
    } catch {
      /* ignore */
    }
  }

  const handleSelect = (msg: SupportMessage) => {
    setSelectedId(msg.id)
    void markSeenIfNew(msg)
  }

  const patchMessage = (updated: SupportMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }

  async function saveNotes() {
    if (!selected) return
    setNotesSaving(true)
    try {
      const updated = await api.support.update(selected.id, { admin_notes: notesDraft })
      patchMessage(updated)
    } finally {
      setNotesSaving(false)
    }
  }

  async function setStatus(status: SupportMessage['status']) {
    if (!selected) return
    const updated = await api.support.update(selected.id, { status })
    patchMessage(updated)
    const { count } = await api.support.getNewCount()
    setNewCount(count)
  }

  async function setPriority(priority: SupportMessage['priority']) {
    if (!selected) return
    const updated = await api.support.update(selected.id, { priority })
    patchMessage(updated)
  }

  async function markResolved() {
    if (!selected) return
    const updated = await api.support.update(selected.id, { status: 'resolved' })
    patchMessage(updated)
    const { count } = await api.support.getNewCount()
    setNewCount(count)
  }

  const mailtoHref = selected?.user_email
    ? (() => {
        const subject = 'Re: Your BuildOS support request'
        const body = `Hi,\n\nThanks for contacting us about your support request.\n\n\n\n— The BuildOS team`
        return `mailto:${encodeURIComponent(selected.user_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      })()
    : ''

  return (
    <div className="admin-page min-h-full">
      {newMsgToast ? (
        <div className="support-inbox-new-toast" role="status" aria-live="polite">
          <span>
            New support message from {newMsgToast.name} — {newMsgToast.typeLabel}
          </span>
          <Link
            to={`/admin/support?msg=${encodeURIComponent(newMsgToast.id)}`}
            onClick={() => setNewMsgToast(null)}
          >
            View →
          </Link>
        </div>
      ) : null}
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6 flex flex-col flex-1 min-h-0">
        <div className="page-header">
          <h1 className="page-title">Support Inbox</h1>
          <p className="page-sub">Review and respond to user-submitted feedback</p>
        </div>

        {newCount > 0 && (
          <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: 'var(--red, #c0392b)' }}>
            {newCount} unread message{newCount === 1 ? '' : 's'}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          {(['all', 'new', 'seen', 'in_progress', 'resolved'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-sm"
              onClick={() => setStatusFilter(s)}
              style={{
                fontWeight: statusFilter === s ? 700 : 500,
                background: statusFilter === s ? 'var(--red-glow-soft)' : 'var(--bg-surface)',
                borderColor: statusFilter === s ? 'var(--red-border)' : 'var(--border)',
              }}
            >
              {s === 'all' ? 'All' : statusLabel(s)}
            </button>
          ))}
          <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          {(['all', 'bug', 'feature', 'question'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="btn btn-sm"
              onClick={() => setTypeFilter(t)}
              style={{
                fontWeight: typeFilter === t ? 700 : 500,
                background: typeFilter === t ? 'var(--red-glow-soft)' : 'var(--bg-surface)',
                borderColor: typeFilter === t ? 'var(--red-border)' : 'var(--border)',
              }}
            >
              {t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <input
            type="search"
            placeholder="Search messages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              marginLeft: 'auto',
              minWidth: 200,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              fontSize: 13,
              background: 'var(--bg-surface)',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              background: 'var(--red-glow-soft)',
              borderRadius: 8,
              color: 'var(--red)',
            }}
          >
            {error}
          </div>
        )}

        <div className="support-inbox-layout flex-1 min-h-0">
          <div className="support-inbox-list">
            {loading ? (
              <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading…</div>
            ) : messages.length === 0 ? (
              <div style={{ padding: 24, color: 'var(--text-muted)' }}>No messages match.</div>
            ) : (
              messages.map((msg) => {
                const active = msg.id === selectedId
                const isNew = msg.status === 'new'
                return (
                  <button
                    key={msg.id}
                    type="button"
                    className={`support-inbox-row${active ? ' selected' : ''}${isNew ? ' new' : ''}`}
                    onClick={() => handleSelect(msg)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <TypeIcon type={msg.type} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                          {resolvedUserDisplayName(msg).slice(0, 48)}
                          {msg.user_email ? (
                            <span style={{ display: 'block', fontSize: 10 }}>{msg.user_email}</span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                          {previewText(msg.message)}
                        </div>
                        {msg.page_url ? (
                          <div
                            style={{
                              fontSize: 10,
                              color: 'var(--text-muted)',
                              marginTop: 6,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {msg.page_url}
                          </div>
                        ) : null}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: 'var(--bg-base)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {statusLabel(msg.status)}
                          </span>
                          <span className={priorityDotClassName(msg.priority)} title={msg.priority} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            {formatRelative(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="support-inbox-detail">
            {!selected ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Select a message to view details.</div>
            ) : (
              <>
                <div className="support-message-card">
                  <div className="support-message-text">{selected.message}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>
                    User
                  </div>
                  <div className="support-meta-grid">
                    <div className="support-meta-item">
                      <div className="support-meta-label">Name</div>
                      <div className="support-meta-value">{resolvedUserDisplayName(selected)}</div>
                    </div>
                    <div className="support-meta-item">
                      <div className="support-meta-label">Email</div>
                      <div className="support-meta-value">{selected.user_email || '—'}</div>
                    </div>
                    <div className="support-meta-item">
                      <div className="support-meta-label">Organization</div>
                      <div className="support-meta-value">
                        <code style={{ fontSize: 12 }}>{selected.organization_id || '—'}</code>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>
                    Technical
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    {selected.page_url ? (
                      <div style={{ marginBottom: 8 }}>
                        <strong>Page:</strong>{' '}
                        <a href={selected.page_url} target="_blank" rel="noreferrer">
                          {selected.page_url}
                        </a>
                      </div>
                    ) : (
                      <div>
                        <strong>Page:</strong> —
                      </div>
                    )}
                    {selected.page_title ? (
                      <div>
                        <strong>Title:</strong> {selected.page_title}
                      </div>
                    ) : null}
                    <div>
                      <strong>Submitted:</strong> {formatDateTime(selected.created_at)} ({formatRelative(selected.created_at)})
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Status
                    <select
                      value={selected.status}
                      onChange={(e) => void setStatus(e.target.value as SupportMessage['status'])}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
                    >
                      <option value="new">New</option>
                      <option value="seen">Seen</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Priority
                    <select
                      value={selected.priority}
                      onChange={(e) => void setPriority(e.target.value as SupportMessage['priority'])}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Admin notes (internal)</div>
                  <textarea
                    className="support-admin-notes"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    style={{ marginBottom: 8 }}
                  />
                  <button type="button" className="btn btn-sm" onClick={() => void saveNotes()} disabled={notesSaving}>
                    {notesSaving ? 'Saving…' : 'Save Notes'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                  {selected.user_email ? (
                    <a className="btn btn-sm" href={mailtoHref} style={{ textDecoration: 'none' }}>
                      Reply via Email
                    </a>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => void markResolved()}
                  style={{
                    background: '#15803d',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Mark Resolved
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
