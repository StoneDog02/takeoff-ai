import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  requiredText?: string
  value: string
  onValueChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'default'
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  requiredText,
  value,
  onValueChange,
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmDialogProps) {
  if (!open) return null
  const canConfirm = !requiredText || value === requiredText

  return (
    <div
      className="dashboard-app"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        padding: 20,
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="teams-card"
        style={{
          maxWidth: 420,
          width: '100%',
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="teams-section-title" style={{ marginBottom: 12 }}>
          {title}
        </h2>
        <div className="teams-muted" style={{ marginBottom: 20 }}>
          {message}
        </div>
        {requiredText && (
          <div className="teams-form-row" style={{ marginBottom: 20 }}>
            <label htmlFor="confirm-input" className="teams-label">
              Type {requiredText} to confirm
            </label>
            <input
              id="confirm-input"
              type="text"
              className="teams-input"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={requiredText}
              autoComplete="off"
            />
          </div>
        )}
        <div className="teams-form-actions" style={{ marginTop: 24, marginBottom: 0 }}>
          <button type="button" className="teams-btn teams-btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={variant === 'danger' ? 'teams-btn teams-btn-primary' : 'teams-btn teams-btn-primary'}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
