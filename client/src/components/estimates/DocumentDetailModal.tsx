import { useState, useEffect } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Invoice, Job } from '@/types/global'
import type { EstimateWithLines } from '@/api/estimates'
import { ConvertToInvoiceFlow } from './ConvertToInvoiceFlow'
import { SendEstimateInvoice } from './SendEstimateInvoice'
import { EstimateInvoiceFormView } from './EstimateInvoiceFormView'
import { USE_MOCK_ESTIMATES, getMockEstimateWithLines, getMockInvoice } from '@/data/mockEstimatesData'

interface DocumentDetailModalProps {
  type: 'estimate' | 'invoice'
  id: string
  jobs: Job[]
  onClose: () => void
  onConvertToInvoice?: (estimateId: string) => void
}

export function DocumentDetailModal({
  type,
  id,
  jobs,
  onClose,
  onConvertToInvoice,
}: DocumentDetailModalProps) {
  const [estimate, setEstimate] = useState<EstimateWithLines | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConvert, setShowConvert] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const refreshEstimate = () => {
    if (type !== 'estimate') return
    if (USE_MOCK_ESTIMATES) {
      setEstimate(getMockEstimateWithLines(id))
      return
    }
    estimatesApi.getEstimate(id).then(setEstimate).catch(() => setEstimate(null))
  }

  useEffect(() => {
    if (USE_MOCK_ESTIMATES) {
      if (type === 'estimate') {
        setEstimate(getMockEstimateWithLines(id))
        setInvoice(null)
      } else {
        setInvoice(getMockInvoice(id))
        setEstimate(null)
      }
      setLoading(false)
      return
    }
    if (type === 'estimate') {
      estimatesApi
        .getEstimate(id)
        .then(setEstimate)
        .catch(() => setEstimate(null))
        .finally(() => setLoading(false))
    } else {
      estimatesApi
        .getInvoice(id)
        .then(setInvoice)
        .catch(() => setInvoice(null))
        .finally(() => setLoading(false))
    }
  }, [type, id])

  const jobName =
    (estimate && jobs.find((j) => j.id === estimate.job_id)?.name) ||
    (invoice && jobs.find((j) => j.id === invoice.job_id)?.name) ||
    '—'

  const doc = type === 'estimate' ? estimate : invoice
  const total =
    type === 'estimate'
      ? estimate?.total_amount ?? 0
      : invoice?.total_amount ?? 0
  const status = doc?.status ?? '—'
  const recipientEmails =
    type === 'estimate'
      ? (estimate?.recipient_emails ?? [])
      : (invoice?.recipient_emails ?? [])

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
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="projects-card"
        style={{
          padding: 24,
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="action-row" style={{ marginBottom: 16 }}>
          <h2 className="page-title" style={{ margin: 0 }}>
            {type === 'estimate' ? 'Estimate' : 'Invoice'} details
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => window.print()}
              title="Print"
            >
              Print
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        {loading ? (
          <p className="dashboard-app text-secondary">Loading…</p>
        ) : !doc ? (
          <p className="dashboard-app" style={{ color: 'var(--red-light)' }}>
            Not found
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <EstimateInvoiceFormView
                type={type}
                documentId={id}
                jobName={jobName}
                date={doc.created_at}
                status={status}
                recipientEmails={recipientEmails}
                lineItems={type === 'estimate' && estimate ? estimate.line_items ?? [] : []}
                total={Number(total)}
                dueDate={type === 'invoice' && invoice ? invoice.due_date ?? undefined : undefined}
                embedded
              />
            </div>
            {type === 'estimate' && estimate && (
              <div style={{ marginBottom: 16 }}>
                {(Number(estimate.invoiced_amount) || 0) > 0 && (
                  <p className="dashboard-app timeline-val" style={{ marginBottom: 8 }}>
                    Invoiced: ${(Number(estimate.invoiced_amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} of ${Number(estimate.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                )}
                {(estimate.status === 'draft' || estimate.status === 'sent') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={updatingStatus}
                      onClick={async () => {
                        if (USE_MOCK_ESTIMATES) {
                          setEstimate((prev) => (prev ? { ...prev, status: 'accepted' as const } : null))
                          return
                        }
                        setUpdatingStatus(true)
                        try {
                          await estimatesApi.updateEstimate(id, { status: 'accepted' })
                          refreshEstimate()
                        } finally {
                          setUpdatingStatus(false)
                        }
                      }}
                    >
                      {updatingStatus ? 'Updating…' : 'Mark as accepted'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={updatingStatus}
                      onClick={async () => {
                        if (USE_MOCK_ESTIMATES) {
                          setEstimate((prev) => (prev ? { ...prev, status: 'declined' as const } : null))
                          return
                        }
                        setUpdatingStatus(true)
                        try {
                          await estimatesApi.updateEstimate(id, { status: 'declined' })
                          refreshEstimate()
                        } finally {
                          setUpdatingStatus(false)
                        }
                      }}
                    >
                      Mark as declined
                    </button>
                  </div>
                )}
                {estimate.status === 'accepted' && (
                  <div style={{ marginBottom: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setShowConvert(true)}
                    >
                      Convert to invoice
                    </button>
                  </div>
                )}
                {(estimate.status === 'draft' || estimate.status === 'declined') && (
                  <>
                    <p className="dashboard-app timeline-val" style={{ marginBottom: 8 }}>
                      {estimate.status === 'declined'
                        ? 'Estimate was declined. Mark as accepted to convert to invoice.'
                        : 'Accept the estimate first to convert it to an invoice.'}
                    </p>
                    {estimate.status === 'declined' && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={updatingStatus}
                        onClick={async () => {
                          if (USE_MOCK_ESTIMATES) {
                            setEstimate((prev) => (prev ? { ...prev, status: 'accepted' as const } : null))
                            return
                          }
                          setUpdatingStatus(true)
                          try {
                            await estimatesApi.updateEstimate(id, { status: 'accepted' })
                            refreshEstimate()
                          } finally {
                            setUpdatingStatus(false)
                          }
                        }}
                      >
                        Mark as accepted
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowSend(true)}
              >
                Send to recipients
              </button>
            </div>
          </>
        )}
      </div>
      {showConvert && type === 'estimate' && estimate && (
        <ConvertToInvoiceFlow
          estimateId={id}
          estimate={estimate}
          onClose={() => setShowConvert(false)}
          onConverted={() => {
            setShowConvert(false)
            refreshEstimate()
            onConvertToInvoice?.(id)
          }}
        />
      )}
      {showSend && doc && (
        <SendEstimateInvoice
          type={type}
          documentId={id}
          document={doc}
          jobName={jobName}
          total={Number(total)}
          lineItems={type === 'estimate' && estimate ? estimate.line_items : []}
          onClose={() => setShowSend(false)}
          onSent={() => setShowSend(false)}
        />
      )}
    </div>
  )
}
