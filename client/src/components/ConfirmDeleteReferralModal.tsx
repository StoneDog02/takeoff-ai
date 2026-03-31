import { Trash2 } from 'lucide-react'

export type ReferralDeleteTarget = {
  id: string
  referee_email: string | null
  referee_id: string | null
  status: string
  invite_email_opened_at?: string | null
  signed_up_at?: string | null
}

interface ConfirmDeleteReferralModalProps {
  row: ReferralDeleteTarget
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
  error?: string | null
}

function rowLabel(row: ReferralDeleteTarget): string {
  return row.referee_email?.trim() || (row.referee_id ? 'Registered user' : '—')
}

/**
 * Styled confirmation for removing a referral row (settings / Referrals sent).
 */
export function ConfirmDeleteReferralModal({
  row,
  onClose,
  onConfirm,
  isDeleting,
  error,
}: ConfirmDeleteReferralModalProps) {
  const label = rowLabel(row)
  const isPending = row.status !== 'completed'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={() => {
        if (!isDeleting) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-referral-title"
    >
      <div
        className="max-w-md w-full rounded-2xl border border-[color:var(--border)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow)] dark:border-[color:var(--border)] dark:bg-[var(--bg-raised)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(185,28,28,0.12)] text-[#b91c1c] dark:bg-[rgba(192,57,43,0.2)] dark:text-[var(--red-light)]"
            aria-hidden
          >
            <Trash2 size={22} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="delete-referral-title"
              className="text-lg font-bold text-[#111] dark:text-[var(--text-primary)]"
            >
              Remove this referral?
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">{label}</span>
              {isPending ? (
                <span className="ml-1.5 rounded-md bg-[rgba(234,179,8,0.15)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#b45309] dark:text-[var(--orange)]">
                  Pending
                </span>
              ) : (
                <span className="ml-1.5 rounded-md bg-[rgba(22,163,74,0.12)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#15803d] dark:text-[var(--green)]">
                  Completed
                </span>
              )}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
              This removes the row from your list. If the invite was still pending, you can send a new invite to the
              same address. Credits already earned on your account are not changed.
            </p>
            {error && (
              <p className="mt-3 text-sm text-[var(--red)] dark:text-[var(--red-light)]" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg border border-[color:var(--border)] bg-[var(--bg-raised)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-50 dark:border-[color:var(--border)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#991b1b] disabled:opacity-50 dark:bg-[var(--red)] dark:hover:opacity-90"
          >
            {isDeleting ? 'Removing…' : 'Remove referral'}
          </button>
        </div>
      </div>
    </div>
  )
}
