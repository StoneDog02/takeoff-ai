import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageCircleQuestion } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/api/client'

type SupportType = 'bug' | 'feature' | 'question'

const TYPE_OPTIONS: { type: SupportType; label: string }[] = [
  { type: 'bug', label: '🐛 Bug Report' },
  { type: 'feature', label: '💡 Feature Request' },
  { type: 'question', label: '💬 Question' },
]

const PLACEHOLDERS: Record<SupportType, string> = {
  bug: 'Describe what happened and what you expected…',
  feature: 'What would make BuildOS better for you?',
  question: 'How can we help?',
}

export type SupportBubbleConnectionStatus = {
  isOnline: boolean
  syncing: boolean
}

export function SupportBubble({
  connectionStatus,
}: {
  connectionStatus?: SupportBubbleConnectionStatus
}) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<SupportType>('bug')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successEmail, setSuccessEmail] = useState<string | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const resetForm = useCallback(() => {
    clearCloseTimer()
    setSuccessEmail(null)
    setMessage('')
    setType('bug')
  }, [clearCloseTimer])

  const handleClose = useCallback(() => {
    resetForm()
    setOpen(false)
  }, [resetForm])

  const toggle = useCallback(() => {
    setOpen((o) => {
      if (o) resetForm()
      return !o
    })
  }, [resetForm])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current
      if (!root || root.contains(e.target as Node)) return
      handleClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, handleClose])

  useEffect(() => {
    return () => clearCloseTimer()
  }, [clearCloseTimer])

  useEffect(() => {
    if (successEmail == null || !open) return
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      setSuccessEmail(null)
      setMessage('')
      setType('bug')
      closeTimerRef.current = null
    }, 3000)
    return () => clearCloseTimer()
  }, [successEmail, open, clearCloseTimer])

  if (loading || !user) return null

  const sessionUser = user

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await api.support.create({
        type,
        message: trimmed,
        page_url: window.location.href,
        page_title: document.title,
      })
      setSuccessEmail(sessionUser.email?.trim() || '')
    } catch {
      setSubmitting(false)
      return
    }
    setSubmitting(false)
  }

  const reportingPath = location.pathname + (location.search || '')

  return (
    <div ref={rootRef} className="support-bubble-root" aria-live="polite">
      <button
        type="button"
        className={`support-bubble-btn${open ? ' open' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? 'Close support' : 'Open support'}
        onClick={toggle}
      >
        <MessageCircleQuestion size={22} strokeWidth={2.25} aria-hidden />
        {connectionStatus ? (
          <span
            className={`offline-status-dot${
              connectionStatus.syncing
                ? ' offline-status-dot--syncing'
                : connectionStatus.isOnline
                  ? ' offline-status-dot--online'
                  : ' offline-status-dot--offline'
            }`}
            title={
              connectionStatus.syncing
                ? 'Syncing…'
                : connectionStatus.isOnline
                  ? 'Online'
                  : 'Offline'
            }
            aria-hidden
          />
        ) : null}
      </button>

      <div
        className={`support-bubble-panel${open ? ' support-bubble-panel--open support-bubble-panel-enter' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="support-bubble-title"
        aria-hidden={!open}
      >
        <div className="support-bubble-header">
          <h2 id="support-bubble-title">Send us a message</h2>
          <p>We&apos;ll get back to you via email</p>
          <button type="button" className="support-bubble-header-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>

        {successEmail != null ? (
          <div className="support-bubble-success">
            <span>
              ✓ Message sent! We&apos;ll follow up at {successEmail || 'your email'}.
            </span>
          </div>
        ) : (
          <>
            <div className="support-bubble-type-pills">
              {TYPE_OPTIONS.map(({ type: t, label }) => {
                const active = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    className={`support-type-pill${active ? ' active' : ''}`}
                    onClick={() => setType(t)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <form className="support-bubble-form" onSubmit={handleSubmit}>
              <textarea
                className="support-bubble-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={PLACEHOLDERS[type]}
                rows={4}
              />
              <p className="support-bubble-page-ref">
                Reporting from: <span title={reportingPath}>{reportingPath}</span>
              </p>
              <button
                type="submit"
                className="support-bubble-submit"
                disabled={!message.trim() || submitting}
              >
                {submitting ? 'Sending…' : 'Send Message →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
