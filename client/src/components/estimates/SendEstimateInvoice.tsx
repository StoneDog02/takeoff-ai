import { useState } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { EstimateLineItem } from '@/types/global'
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
  jobName: string
  total: number
  lineItems: EstimateLineItem[]
  onClose: () => void
  onSent: () => void
}

export function SendEstimateInvoice({
  type,
  documentId,
  document,
  jobName,
  total,
  lineItems,
  onClose,
  onSent,
}: SendEstimateInvoiceProps) {
  const [emailsText, setEmailsText] = useState(
    (document.recipient_emails ?? []).join(', ')
  )
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)

  const emails = emailsText
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean)

  const handleSend = async () => {
    if (emails.length === 0) return
    setSending(true)
    try {
      if (type === 'estimate') {
        await estimatesApi.sendEstimate(documentId, { recipient_emails: emails })
      } else {
        await estimatesApi.sendInvoice(documentId, emails)
      }
      onSent()
    } catch (err) {
      console.error(err)
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
                recipientEmails={document.recipient_emails ?? []}
                lineItems={lineItems}
                total={total}
                dueDate={document.due_date}
                embedded
              />
            </div>
          )}
        </div>

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
