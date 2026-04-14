import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { estimatesApi } from '@/api/estimates'
import { settingsApi } from '@/api/settings'
import type { Invoice, Job, CompanyProfile, EstimateLineItem } from '@/types/global'
import type { EstimateWithLines } from '@/api/estimates'
import { lineItemsFromInvoice, attachmentSummariesFromInvoice } from '@/lib/invoiceLineItems'
import { ConvertToInvoiceFlow } from './ConvertToInvoiceFlow'
import { SendEstimateInvoice } from './SendEstimateInvoice'
import { EstimateInvoiceFormView } from './EstimateInvoiceFormView'
import { shouldUseMockEstimates, getMockEstimateWithLines, getMockInvoice } from '@/data/mockEstimatesData'

interface DocumentDetailModalProps {
  type: 'estimate' | 'invoice'
  id: string
  jobs: Job[]
  onClose: () => void
  onConvertToInvoice?: (estimateId: string) => void
  /** Called after send (estimate/invoice) so parent can refresh pipeline */
  onSent?: () => void
}

export function DocumentDetailModal({
  type,
  id,
  jobs,
  onClose,
  onConvertToInvoice,
  onSent,
}: DocumentDetailModalProps) {
  const navigate = useNavigate()
  const [estimate, setEstimate] = useState<EstimateWithLines | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConvert, setShowConvert] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', onOutside, true)
    return () => document.removeEventListener('click', onOutside, true)
  }, [menuOpen])

  const refreshEstimate = () => {
    if (type !== 'estimate') return
    if (shouldUseMockEstimates()) {
      setEstimate(getMockEstimateWithLines(id))
      return
    }
    estimatesApi.getEstimate(id).then(setEstimate).catch(() => setEstimate(null))
  }

  const refreshInvoice = () => {
    if (type !== 'invoice') return
    if (shouldUseMockEstimates()) {
      setInvoice(getMockInvoice(id))
      return
    }
    estimatesApi.getInvoice(id).then(setInvoice).catch(() => setInvoice(null))
  }

  useEffect(() => {
    if (shouldUseMockEstimates()) {
      if (type === 'estimate') {
        setEstimate(getMockEstimateWithLines(id))
        setInvoice(null)
      } else {
        setInvoice(getMockInvoice(id))
        setEstimate(null)
      }
      setCompany({
        name: 'Jake Donahue Construction',
        phone: '801-555-0192',
        email: 'jake@jdconstruction.com',
        licenseNumber: 'BC-228841',
        address: { line1: '', city: '', state: '', zip: '' },
      })
      setLoading(false)
      return
    }
    const docPromise = type === 'estimate' ? estimatesApi.getEstimate(id) : estimatesApi.getInvoice(id)
    const settingsPromise = settingsApi.getSettings().then((s) => s.company ?? null).catch(() => null)
    Promise.all([docPromise, settingsPromise])
      .then(([docData, companyData]) => {
        if (type === 'estimate') {
          setEstimate(docData as EstimateWithLines)
          setInvoice(null)
        } else {
          setInvoice(docData as Invoice)
          setEstimate(null)
        }
        setCompany(companyData)
      })
      .catch(() => {
        if (type === 'estimate') setEstimate(null)
        else setInvoice(null)
      })
      .finally(() => setLoading(false))
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

  const previewLineItems = useMemo((): EstimateLineItem[] => {
    if (type === 'estimate' && estimate) return estimate.line_items ?? []
    if (type === 'invoice' && invoice) return lineItemsFromInvoice(invoice)
    return []
  }, [type, estimate, invoice])

  const invoiceAttachmentSummaries = useMemo(() => {
    if (type === 'invoice' && invoice) return attachmentSummariesFromInvoice(invoice)
    return []
  }, [type, invoice])

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
        className="projects-card document-detail-modal__card"
        style={{
          padding: 24,
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="action-row document-detail-modal__header" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 className="page-title" style={{ margin: 0 }}>
            {type === 'estimate' ? 'Estimate' : 'Invoice'} details
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }} ref={menuRef}>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="document-detail-modal__menu-trigger"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Actions"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <div className="document-detail-modal__menu" role="menu">
                  <button type="button" role="menuitem" className="document-detail-modal__menu-item" onClick={() => { setMenuOpen(false); window.print() }}>
                    Print
                  </button>
                  <button type="button" role="menuitem" className="document-detail-modal__menu-item" onClick={() => { setMenuOpen(false); setShowSend(true) }}>
                    Send to recipients
                  </button>
                  {type === 'estimate' && estimate && (estimate.status === 'draft' || estimate.status === 'sent') && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="document-detail-modal__menu-item"
                        disabled={updatingStatus}
                        onClick={async () => {
                          setMenuOpen(false)
                          if (shouldUseMockEstimates()) {
                            setEstimate((prev) => (prev ? { ...prev, status: 'accepted' as const } : null))
                            onSent?.()
                            return
                          }
                          setUpdatingStatus(true)
                          try {
                            await estimatesApi.updateEstimate(id, { status: 'accepted' })
                          refreshEstimate()
                          onSent?.()
                        } finally {
                          setUpdatingStatus(false)
                        }
                      }}
                    >
                      {updatingStatus ? 'Updating…' : 'Mark as accepted'}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="document-detail-modal__menu-item"
                      disabled={updatingStatus}
                      onClick={async () => {
                        setMenuOpen(false)
                        if (shouldUseMockEstimates()) {
                          setEstimate((prev) => (prev ? { ...prev, status: 'declined' as const } : null))
                          onSent?.()
                          return
                        }
                        setUpdatingStatus(true)
                        try {
                          await estimatesApi.updateEstimate(id, { status: 'declined' })
                          refreshEstimate()
                          onSent?.()
                        } finally {
                          setUpdatingStatus(false)
                        }
                      }}
                    >
                      Mark as declined
                    </button>
                    </>
                  )}
                  {type === 'estimate' && estimate?.status === 'accepted' && estimate.job_id && (
                    <button
                      type="button"
                      role="menuitem"
                      className="document-detail-modal__menu-item"
                      onClick={() => {
                        setMenuOpen(false)
                        const jid = estimate.job_id as string
                        navigate(`/projects/${jid}?editEstimate=${encodeURIComponent(estimate.id)}`)
                        onClose()
                      }}
                    >
                      Edit line items &amp; pricing
                    </button>
                  )}
                  {type === 'estimate' && estimate?.status === 'accepted' && (
                    <button type="button" role="menuitem" className="document-detail-modal__menu-item" onClick={() => { setMenuOpen(false); setShowConvert(true) }}>
                      Convert to invoice
                    </button>
                  )}
                  {type === 'invoice' && invoice && invoice.status !== 'paid' && (
                    <button
                      type="button"
                      role="menuitem"
                      className="document-detail-modal__menu-item"
                      disabled={markingPaid}
                      onClick={async () => {
                        setMenuOpen(false)
                        if (shouldUseMockEstimates()) {
                          setInvoice((prev) => (prev ? { ...prev, status: 'paid' as const, paid_at: new Date().toISOString() } : null))
                          onSent?.()
                          return
                        }
                        setMarkingPaid(true)
                        try {
                          await estimatesApi.updateInvoice(id, { status: 'paid', paid_at: new Date().toISOString() })
                          refreshInvoice()
                          onSent?.()
                        } finally {
                          setMarkingPaid(false)
                        }
                      }}
                    >
                      {markingPaid ? 'Updating…' : 'Mark as paid'}
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="document-detail-modal__menu-item document-detail-modal__menu-item--danger"
                    disabled={deleting}
                    onClick={async () => {
                      const docLabel = type === 'estimate' ? 'estimate' : 'invoice'
                      if (!window.confirm(`Delete this ${docLabel}? This cannot be undone.`)) return
                      setMenuOpen(false)
                      setDeleting(true)
                      try {
                        if (type === 'estimate') {
                          if (shouldUseMockEstimates()) {
                            setEstimate(null)
                          } else {
                            await estimatesApi.deleteEstimate(id)
                          }
                        } else {
                          if (shouldUseMockEstimates()) {
                            setInvoice(null)
                          } else {
                            await estimatesApi.deleteInvoice(id)
                          }
                        }
                        onSent?.()
                        onClose()
                      } catch (err) {
                        console.error(err)
                      } finally {
                        setDeleting(false)
                      }
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="document-detail-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
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
                lineItems={previewLineItems}
                total={Number(total)}
                dueDate={type === 'invoice' && invoice ? invoice.due_date ?? undefined : undefined}
                embedded
                variant="elevated"
                company={company}
                attachments={invoiceAttachmentSummaries}
                invoiceIdForAttachments={type === 'invoice' ? id : null}
              />
            </div>
            {type === 'estimate' && estimate && (
              <div style={{ marginBottom: 16 }}>
                {(Number(estimate.invoiced_amount) || 0) > 0 && (
                  <p className="dashboard-app timeline-val" style={{ marginBottom: 8 }}>
                    Invoiced: ${(Number(estimate.invoiced_amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} of ${Number(estimate.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                )}
                {(estimate.status === 'draft' || estimate.status === 'declined') && (
                  <div className="estimate-detail-suggestion">
                    <span className="estimate-detail-suggestion__text">
                      {estimate.status === 'declined'
                        ? 'Estimate was declined. Mark as accepted to convert to invoice.'
                        : 'Accept the estimate first to convert it to an invoice.'}
                    </span>
                    {estimate.status === 'declined' && (
                      <button
                        type="button"
                        className="btn btn-ghost estimate-detail-suggestion__btn"
                        disabled={updatingStatus}
                        onClick={async () => {
                        if (shouldUseMockEstimates()) {
                          setEstimate((prev) => (prev ? { ...prev, status: 'accepted' as const } : null))
                          onSent?.()
                          return
                        }
                        setUpdatingStatus(true)
                        try {
                          await estimatesApi.updateEstimate(id, { status: 'accepted' })
                          refreshEstimate()
                          onSent?.()
                        } finally {
                          setUpdatingStatus(false)
                        }
                      }}
                    >
                      Mark as accepted
                    </button>
                    )}
                  </div>
                )}
              </div>
            )}
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
          lineItems={previewLineItems}
          attachments={invoiceAttachmentSummaries}
          invoiceIdForAttachments={type === 'invoice' ? id : null}
          onClose={() => setShowSend(false)}
          onSent={() => {
            setShowSend(false)
            onSent?.()
          }}
        />
      )}
    </div>
  )
}
