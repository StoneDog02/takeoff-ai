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
        await estimatesApi.sendEstimate(documentId, emails)
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
      className="dashboard-app"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
      }}
      onClick={onClose}
    >
      <div
        className="projects-card"
        style={{
          padding: 24,
          maxWidth: 500,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="page-title" style={{ marginBottom: 16 }}>
          Send {type}
        </h2>
        <label className="dashboard-app" style={{ display: 'block', marginBottom: 16 }}>
          <span className="section-title" style={{ display: 'block', marginBottom: 4 }}>
            Recipient emails (comma or space separated)
          </span>
          <textarea
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            placeholder="email1@example.com, email2@example.com"
            rows={3}
            className="dashboard-app"
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 7,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowPreview((p) => !p)}
          >
            {showPreview ? 'Hide preview' : 'Preview'}
          </button>
        </div>
        {showPreview && (
          <div style={{ marginBottom: 16 }}>
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
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
