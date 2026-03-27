import { useEffect } from 'react'

interface ConfirmDeleteDailyLogModalProps {
  open: boolean
  /** Display label for the log date, e.g. formatted MM/DD/YYYY */
  logDateLabel: string
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
  error?: string | null
}

export function ConfirmDeleteDailyLogModal({
  open,
  logDateLabel,
  onClose,
  onConfirm,
  isDeleting,
  error,
}: ConfirmDeleteDailyLogModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isDeleting, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-daily-log-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border shadow-2xl"
        style={{
          maxWidth: 420,
          borderColor: 'var(--border)',
          background: 'var(--bg-surface)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4 p-6">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{
              background: 'var(--red-glow-soft)',
              color: 'var(--red)',
            }}
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="delete-daily-log-title" className="m-0 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Delete daily log?
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {logDateLabel}
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              This removes the log entry for this day. It cannot be undone. Photos stay in the project gallery but are no longer linked to this log date.
            </p>
            {error ? (
              <p className="mt-3 text-sm leading-snug text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <div
          className="flex justify-end gap-2 border-t px-6 py-4"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
              background: 'transparent',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--red)' }}
          >
            {isDeleting ? 'Deleting…' : 'Delete log'}
          </button>
        </div>
      </div>
    </div>
  )
}
