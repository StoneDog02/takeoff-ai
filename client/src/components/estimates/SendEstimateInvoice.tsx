import { useState } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { EstimateLineItem } from '@/types/global'
import type { InvoiceDepositDisplay } from '@/lib/invoiceDepositDisplay'
import { EstimateInvoiceFormView } from './EstimateInvoiceFormView'

interface SendEstimateInvoiceProps {
  type: 'estimate' | 'invoice'
  documentId: string
  document: {
    recipient_emails?: string[]
    created_at?: string
    status?: string
    due_date?: string
  }
  /** Current project client email — preferred over saved document recipients when set. */
  projectClientEmail?: string | null
  jobName: string
  total: number
  lineItems: EstimateLineItem[]
  attachments?: { id: string; label: string }[]
  invoiceIdForAttachments?: string | null
  depositSchedule?: InvoiceDepositDisplay | null
  onClose: () => void
  onSent: () => void
}

export function SendEstimateInvoice({
  type,
  documentId,
  document,
  projectClientEmail,
  jobName,
  total,
  lineItems,
  attachments = [],
  invoiceIdForAttachments = null,
  depositSchedule = null,
  onClose,
  onSent,
}: SendEstimateInvoiceProps) {
  const initialEmails = (() => {
    const projectEmail = projectClientEmail?.trim() ?? ''
    if (projectEmail) return projectEmail
    return (document.recipient_emails ?? []).join(', ')
  })()
  const [emailsText, setEmailsText] = useState(initialEmails)
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const emails = emailsText
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean)

  const handleSend = async () => {
    if (emails.length === 0) return
    setSending(true)
    setSendError(null)
    try {
      if (type === 'estimate') {
        await estimatesApi.sendEstimate(documentId, { recipient_emails: emails })
      } else {
        await estimatesApi.sendInvoice(documentId, emails)
      }
      onSent()
    } catch (err) {
      console.error(err)
      setSendError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="send-estimate-invoice-overlay"
      onClick={onClose}
    >
      <div
        className="send-estimate-invoice-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-estimate-invoice-title"
      >
        <h2 id="send-estimate-invoice-title" className="send-estimate-invoice-modal__title">
          Send {type}
        </h2>
        {type === 'invoice' ? (
          <p className="send-estimate-invoice-modal__hint" style={{ marginTop: 0, marginBottom: 12 }}>
            The first address below gets an email with a secure link to your customer invoice portal (same idea as estimate and change-order links).
          </p>
        ) : null}

        <div className="send-estimate-invoice-modal__scroll">
          <div className="send-estimate-invoice-modal__field">
            <label htmlFor="send-recipient-emails" className="send-estimate-invoice-modal__label">
              Recipient emails
            </label>
            <p className="send-estimate-invoice-modal__hint">
              Separate multiple addresses with commas or spaces
            </p>
            <textarea
              id="send-recipient-emails"
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              rows={3}
              className="send-estimate-invoice-modal__input"
              autoComplete="off"
              aria-label="Recipient email addresses"
            />
          </div>

          <div className="send-estimate-invoice-modal__preview-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowPreview((p) => !p)}
            >
              {showPreview ? 'Hide preview' : 'Preview'}
            </button>
          </div>

          {showPreview && (
            <div className="send-estimate-invoice-modal__preview">
              <EstimateInvoiceFormView
                type={type}
                documentId={documentId}
                jobName={jobName}
                date={document.created_at ?? ''}
                status={document.status ?? '—'}
                recipientEmails={emails.length > 0 ? emails : document.recipient_emails ?? []}
                lineItems={lineItems}
                total={total}
                dueDate={document.due_date}
                embedded
                attachments={attachments}
                invoiceIdForAttachments={invoiceIdForAttachments}
                depositSchedule={type === 'invoice' ? depositSchedule : null}
              />
            </div>
          )}
        </div>

        {sendError ? (
          <p className="send-estimate-invoice-modal__hint" style={{ color: 'var(--red-light, #c0392b)', margin: '0 0 12px' }} role="alert">
            {sendError}
          </p>
        ) : null}

        <div className="send-estimate-invoice-modal__actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSend}
            disabled={sending || emails.length === 0}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
