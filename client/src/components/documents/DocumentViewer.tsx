import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type BidPortalResponse, type DocumentViewerResponse } from '@/api/client'
import type { PaperTrailDocument } from '@/types/global'
import {
  EstimateClientFacingDocument,
  formatPortalCurrency,
  formatPortalDate,
} from '@/components/estimates/EstimateClientFacingDocument'
import {
  documentTypeLabel,
  downloadDocumentPdf,
  formatMoney,
  statusBadgeClass,
  statusDisplayLabel,
} from '@/lib/paperTrailDocumentUi'
import {
  InvoiceClientFacing,
  invoicePortalShellClassAndStyle,
} from '@/components/invoices/InvoiceClientFacing'

function formatPortalDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function receiptMediaKind(url: string): 'pdf' | 'image' | 'other' {
  const u = url.toLowerCase()
  if (u.includes('.pdf') || u.includes('type=application%2Fpdf')) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(u)) return 'image'
  return 'other'
}

function formatBidPortalDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

function DocumentViewerBidReadOnly({ data }: { data: BidPortalResponse }) {
  const sentDate = formatBidPortalDate(data.dispatched_at)
  const deadlineDate = formatBidPortalDate(data.response_deadline)
  const scopeItems = Array.isArray(data.scope_items) ? data.scope_items : []
  const tradeLabel = data.trade_name || data.tradeName || 'This trade'

  return (
    <div className="bid-portal-cards bid-portal-cards--layout document-viewer-bid">
      <div className="bid-portal-cards__main">
        <div className="bid-portal-card bid-portal-card--header">
          <div className="bid-portal-card__body">
            {data.company?.logoUrl ? (
              <img src={data.company.logoUrl} alt="" className="portal-company-logo bid-portal-header__logo" />
            ) : null}
            <h1 className="bid-portal-header__project">{data.projectName}</h1>
            {(data.address || data.project_address) && (
              <p className="bid-portal-header__address">{data.project_address || data.address}</p>
            )}
            {(data.gc_name || sentDate || deadlineDate) && (
              <div className="bid-portal-header__meta">
                <div className="bid-portal-meta-row">
                  {data.gc_name ? (
                    <span className="bid-portal-meta-row__item">
                      <span className="bid-portal-meta-row__label">Issued by:</span>
                      {data.gc_name}
                    </span>
                  ) : null}
                  {sentDate ? (
                    <span className="bid-portal-meta-row__item">
                      <span className="bid-portal-meta-row__label">Sent:</span>
                      {sentDate}
                    </span>
                  ) : null}
                  {deadlineDate ? (
                    <span className="bid-portal-meta-row__item">
                      <span className="bid-portal-meta-row__label">Respond by:</span>
                      <span className="bid-portal-meta-row__deadline">{deadlineDate}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            <p className="bid-portal-header__trade">{data.trade_name || data.tradeName}</p>
            <p className="bid-portal-header__sub text-[var(--text-muted)] text-sm mt-1 m-0">
              Subcontractor: <strong>{data.sub_name || data.subName || '—'}</strong>
            </p>
          </div>
        </div>

        <div className="bid-portal-card">
          <div className="bid-portal-card__body">
            <h3 className="bid-portal-scope__heading">Scope of work</h3>
            <p className="bid-portal-scope__subheading">
              Quantities from the project takeoff for this trade. The sub&apos;s bid and notes appear in the panel on the
              right.
            </p>
            {scopeItems.length > 0 ? (
              <>
                <p className="bid-portal-scope-count">
                  {scopeItems.length === 1 ? '1 line item' : `${scopeItems.length} line items`} · {tradeLabel}
                </p>
                <div className="bid-portal-scope-table-wrap">
                  <table className="bid-portal-scope-table">
                    <thead>
                      <tr>
                        <th scope="col">Description</th>
                        <th scope="col" className="bid-portal-scope-table__qty">
                          Qty
                        </th>
                        <th scope="col" className="bid-portal-scope-table__unit">
                          Unit
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scopeItems.map((item, i) => (
                        <tr key={i} className="bid-portal-scope-row">
                          <td className="bid-portal-scope-table__desc">{item.description || '—'}</td>
                          <td className="bid-portal-scope-table__qty">
                            {Number.isFinite(Number(item.quantity)) ? Number(item.quantity).toLocaleString() : '—'}
                          </td>
                          <td className="bid-portal-scope-table__unit">{item.unit || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="bid-portal-scope__empty-block">
                <p className="bid-portal-scope__empty-title">Scope to be confirmed</p>
                <p className="bid-portal-scope__empty-text">
                  No takeoff lines matched this trade package. The subcontractor may have bid from package notes or plans.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="bid-portal-cards__aside">
        <div className="bid-portal-card bid-portal-card--bid">
          <div className="bid-portal-card__body">
            <h3 className="bid-portal-form__title">Submitted bid</h3>
            <dl className="document-viewer-bid-dl m-0">
              <div className="document-viewer-bid-dl__row">
                <dt>Amount</dt>
                <dd className="m-0 font-semibold tabular-nums">
                  {data.bid_amount != null && Number.isFinite(Number(data.bid_amount))
                    ? formatPortalCurrency(Number(data.bid_amount))
                    : '—'}
                </dd>
              </div>
              <div className="document-viewer-bid-dl__row">
                <dt>Notes</dt>
                <dd className="m-0 text-[var(--text-secondary)] whitespace-pre-wrap">{data.notes?.trim() || '—'}</dd>
              </div>
              {data.availability ? (
                <div className="document-viewer-bid-dl__row">
                  <dt>Availability</dt>
                  <dd className="m-0">{data.availability}</dd>
                </div>
              ) : null}
              {data.attachment_url ? (
                <div className="document-viewer-bid-dl__row">
                  <dt>Attachment</dt>
                  <dd className="m-0">
                    <a href={data.attachment_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)]">
                      View file
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </aside>
    </div>
  )
}

export function DocumentViewer({
  documentId,
  onClose,
}: {
  documentId: string | null
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bundle, setBundle] = useState<DocumentViewerResponse | null>(null)
  const [pdfWorking, setPdfWorking] = useState(false)
  const [resendWorking, setResendWorking] = useState(false)
  const [resendNote, setResendNote] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) {
      setBundle(null)
      setError(null)
      setLoading(false)
      setResendNote(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setResendNote(null)
    api.documents
      .getViewer(documentId)
      .then((b) => {
        if (!cancelled) {
          setBundle(b)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load')
          setBundle(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [documentId])

  const doc = bundle?.document
  const viewer = bundle?.viewer

  const pdfProjectName = doc?.project_name?.trim() || (doc?.project_id ? 'Project' : 'Unlinked')

  const onDownloadPdf = useCallback(async () => {
    if (!doc) return
    setPdfWorking(true)
    try {
      await downloadDocumentPdf(doc as PaperTrailDocument, pdfProjectName)
    } catch (e) {
      console.error(e)
    } finally {
      setPdfWorking(false)
    }
  }, [doc, pdfProjectName])

  const canResend = useMemo(() => {
    if (!doc?.source_id) return false
    const t = doc.document_type
    return t === 'estimate' || t === 'invoice' || t === 'bid_package'
  }, [doc])

  const onResend = useCallback(async () => {
    if (!documentId || !canResend) return
    setResendWorking(true)
    setResendNote(null)
    try {
      const r = await api.documents.resend(documentId)
      if (r.emailed === false) {
        setResendNote('No email on file; portal link is in the server log.')
      } else {
        setResendNote('Portal email sent.')
      }
    } catch (e) {
      setResendNote(e instanceof Error ? e.message : 'Could not send.')
    } finally {
      setResendWorking(false)
    }
  }, [documentId, canResend])

  const banners = useMemo(() => {
    if (!viewer) return []
    const out: { key: string; className: string; text: string }[] = []
    if (viewer.type === 'estimate') {
      const d = viewer.data
      const st = (d.status || '').toLowerCase()
      if (st === 'accepted' && d.actioned_at) {
        out.push({
          key: 'est',
          className: 'documents-status-banner documents-status-banner--success',
          text: `Approved by client on ${formatPortalDate(d.actioned_at)}`,
        })
      } else if (st === 'declined') {
        out.push({ key: 'est', className: 'documents-status-banner documents-status-banner--danger', text: 'Declined' })
      } else {
        out.push({
          key: 'est',
          className: 'documents-status-banner documents-status-banner--warning',
          text: 'Awaiting approval',
        })
      }
    } else if (viewer.type === 'invoice') {
      const d = viewer.data
      const st = (d.status || '').toLowerCase()
      if (st === 'paid') {
        const when = d.paid_at || d.sent_at
        out.push({
          key: 'inv',
          className: 'documents-status-banner documents-status-banner--success',
          text: `Paid on ${formatPortalDateTime(when)} · ${formatMoney(d.total_amount)}`,
        })
      } else if ((viewer.overdue_days != null && viewer.overdue_days > 0) || st === 'overdue') {
        const days = viewer.overdue_days != null && viewer.overdue_days > 0 ? viewer.overdue_days : null
        out.push({
          key: 'inv',
          className: 'documents-status-banner documents-status-banner--danger',
          text: days != null ? `Overdue · ${days} days past due` : 'Overdue',
        })
      } else {
        out.push({
          key: 'inv',
          className: 'documents-status-banner documents-status-banner--warning',
          text: 'Payment pending',
        })
      }
    } else if (viewer.type === 'bid_package') {
      const d = viewer.data
      const st = (d.status || '').toLowerCase()
      if (d.project_cancelled) {
        out.push({
          key: 'bid-cancel',
          className: 'documents-status-banner documents-status-banner--danger',
          text: 'This project was cancelled.',
        })
      }
      if (st === 'declined') {
        out.push({ key: 'bid', className: 'documents-status-banner documents-status-banner--danger', text: 'Declined' })
      } else if (st === 'awarded') {
        out.push({ key: 'bid', className: 'documents-status-banner documents-status-banner--success', text: 'Awarded' })
      } else if (st === 'bid_received') {
        const amt =
          d.bid_amount != null && Number.isFinite(Number(d.bid_amount))
            ? formatPortalCurrency(Number(d.bid_amount))
            : '—'
        out.push({
          key: 'bid',
          className: 'documents-status-banner documents-status-banner--success',
          text: `Bid received · ${amt}`,
        })
      } else {
        out.push({
          key: 'bid',
          className: 'documents-status-banner documents-status-banner--warning',
          text: 'Awaiting response',
        })
      }
    }
    return out
  }, [viewer])

  if (!documentId || typeof document === 'undefined') return null

  const body = (
    <div
      className="documents-viewer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Document viewer"
      onClick={onClose}
    >
      <div className="documents-viewer-inner" onClick={(e) => e.stopPropagation()}>
        <header className="documents-viewer-toolbar">
          <div className="documents-viewer-toolbar__main">
            <h2 className="documents-viewer-toolbar__title">{doc?.title || 'Document'}</h2>
            {doc?.document_type ? (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {documentTypeLabel(doc.document_type)}
              </span>
            ) : null}
            {doc?.status ? (
              <span className={statusBadgeClass(doc.status)}>{statusDisplayLabel(doc.status)}</span>
            ) : null}
          </div>
        </header>

        <div className="documents-viewer-scroll">
          {loading && <p className="documents-viewer-loading">Loading…</p>}
          {error && !loading && <p className="documents-viewer-error">{error}</p>}

          {viewer && !loading && viewer.type === 'estimate' && (
            <div className="estimate-portal estimate-portal--page document-viewer-portal-page">
              {banners.map((b) => (
                <div key={b.key} className={b.className} role="status">
                  {b.text}
                </div>
              ))}
              <div className="documents-viewer-inline-actions">
                <button type="button" className="documents-btn text-[13px]" onClick={() => void onDownloadPdf()} disabled={!doc || pdfWorking}>
                  {pdfWorking ? '…' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  className="documents-btn documents-btn-primary text-[13px]"
                  onClick={() => void onResend()}
                  disabled={!doc || !canResend || resendWorking}
                >
                  {resendWorking ? 'Sending…' : 'Send again'}
                </button>
                <button type="button" className="documents-btn documents-viewer-inline-close" onClick={onClose} aria-label="Close">
                  ×
                </button>
              </div>
              {resendNote ? <p className="documents-viewer-inline-note">{resendNote}</p> : null}
              {viewer.change_order_reference?.description ? (
                <p className="document-viewer-co-ref mx-auto max-w-[920px] px-4 text-sm text-[var(--text-secondary)] m-0 mb-2">
                  Linked change order: {viewer.change_order_reference.description}
                  {viewer.change_order_reference.amount != null
                    ? ` · ${formatPortalCurrency(Number(viewer.change_order_reference.amount))}`
                    : ''}
                </p>
              ) : null}
              <div className="estimate-portal__inner">
                <EstimateClientFacingDocument
                  company={viewer.data.company}
                  companyDisplayName={viewer.data.company?.name?.trim() || viewer.data.gcName || 'Your Estimate'}
                  portalDocumentKind={viewer.data.portal_document_kind ?? 'estimate'}
                  estimateNumber={viewer.data.estimate_number}
                  dateIssued={viewer.data.date_issued ?? viewer.data.sent_at}
                  expiryDate={viewer.data.expiry_date}
                  clientName={viewer.data.clientName || '—'}
                  clientAddress={viewer.data.clientAddress || viewer.data.address}
                  projectName={viewer.data.projectName}
                  projectAddress={viewer.data.address}
                  lineItems={viewer.data.line_items}
                  total={viewer.data.total}
                  milestones={viewer.data.milestones}
                  notes={viewer.data.notes}
                  terms={viewer.data.terms}
                  sectionNotes={viewer.data.section_notes ?? null}
                  sectionWorkTypes={viewer.data.section_work_types ?? null}
                  estimateGroupsMeta={viewer.data.estimate_groups_meta ?? null}
                />
              </div>
            </div>
          )}

          {viewer && !loading && viewer.type === 'invoice' && (() => {
            const invShell = invoicePortalShellClassAndStyle(viewer.data)
            return (
            <div
              className={`estimate-portal estimate-portal--page invoice-portal document-viewer-portal-page ${invShell.className}`}
              style={invShell.style}
            >
              {banners.map((b) => (
                <div key={b.key} className={b.className} role="status">
                  {b.text}
                </div>
              ))}
              <div className="documents-viewer-inline-actions">
                <button type="button" className="documents-btn text-[13px]" onClick={() => void onDownloadPdf()} disabled={!doc || pdfWorking}>
                  {pdfWorking ? '…' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  className="documents-btn documents-btn-primary text-[13px]"
                  onClick={() => void onResend()}
                  disabled={!doc || !canResend || resendWorking}
                >
                  {resendWorking ? 'Sending…' : 'Send again'}
                </button>
                <button type="button" className="documents-btn documents-viewer-inline-close" onClick={onClose} aria-label="Close">
                  ×
                </button>
              </div>
              {resendNote ? <p className="documents-viewer-inline-note">{resendNote}</p> : null}
              <div className="estimate-portal__inner">
                <InvoiceClientFacing
                  data={viewer.data}
                  overdueDays={viewer.overdue_days}
                  interactiveSchedule={false}
                />
              </div>
            </div>
            )
          })()}

          {viewer && !loading && viewer.type === 'bid_package' && (
            <div className="bid-portal bid-portal--page document-viewer-bid-wrap">
              {banners.map((b) => (
                <div key={b.key} className={b.className} role="status">
                  {b.text}
                </div>
              ))}
              <div className="documents-viewer-inline-actions">
                <button type="button" className="documents-btn text-[13px]" onClick={() => void onDownloadPdf()} disabled={!doc || pdfWorking}>
                  {pdfWorking ? '…' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  className="documents-btn documents-btn-primary text-[13px]"
                  onClick={() => void onResend()}
                  disabled={!doc || !canResend || resendWorking}
                >
                  {resendWorking ? 'Sending…' : 'Send again'}
                </button>
                <button type="button" className="documents-btn documents-viewer-inline-close" onClick={onClose} aria-label="Close">
                  ×
                </button>
              </div>
              {resendNote ? <p className="documents-viewer-inline-note">{resendNote}</p> : null}
              <div className="bid-portal__inner document-viewer-bid-inner">
                <DocumentViewerBidReadOnly data={viewer.data} />
              </div>
            </div>
          )}

          {viewer && !loading && viewer.type === 'change_order' && (
            <div className="document-viewer-portal-page document-viewer-co">
              <div className="estimate-portal-doc estimate-doc--elevated document-viewer-co-doc">
                <div className="estimate-doc__hero">
                  <div className="estimate-doc__hero-left">
                    <h1 className="estimate-doc__company-name">Change Order #{viewer.data.co_number_suffix}</h1>
                  </div>
                  <div className="estimate-doc__hero-right">
                    <span className="estimate-doc__status-badge">CHANGE ORDER</span>
                  </div>
                </div>
                <div className="estimate-doc__meta">
                  <div className="estimate-doc__meta-item">
                    <span className="estimate-doc__meta-label">Scope</span>
                    <span className="estimate-doc__meta-value">{viewer.data.title}</span>
                  </div>
                  <div className="estimate-doc__meta-item">
                    <span className="estimate-doc__meta-label">Project</span>
                    <span className="estimate-doc__meta-value">{viewer.data.project_name || '—'}</span>
                  </div>
                  <div className="estimate-doc__meta-item">
                    <span className="estimate-doc__meta-label">Reference</span>
                    <span className="estimate-doc__meta-value">
                      {viewer.data.reference_estimate_number
                        ? `Accepted estimate ${viewer.data.reference_estimate_number}`
                        : 'Accepted project estimate'}
                    </span>
                  </div>
                </div>
                <div className="document-viewer-co-grid">
                  <div className="document-viewer-co-stat">
                    <span className="document-viewer-co-stat__label">Budget impact (predicted)</span>
                    <span className="document-viewer-co-stat__value tabular-nums">
                      {viewer.data.predicted != null ? formatMoney(viewer.data.predicted) : formatMoney(viewer.data.total_amount)}
                    </span>
                  </div>
                  {viewer.data.category ? (
                    <div className="document-viewer-co-stat">
                      <span className="document-viewer-co-stat__label">Category</span>
                      <span className="document-viewer-co-stat__value">{viewer.data.category}</span>
                    </div>
                  ) : null}
                  {viewer.data.unit ? (
                    <div className="document-viewer-co-stat">
                      <span className="document-viewer-co-stat__label">Unit</span>
                      <span className="document-viewer-co-stat__value">{viewer.data.unit}</span>
                    </div>
                  ) : null}
                  {viewer.data.source ? (
                    <div className="document-viewer-co-stat">
                      <span className="document-viewer-co-stat__label">Source</span>
                      <span className="document-viewer-co-stat__value">{viewer.data.source}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {viewer && !loading && viewer.type === 'receipt' && (
            <div className="document-viewer-portal-page document-viewer-receipt">
              {viewer.data.file_url?.trim() ? (
                <div className="document-viewer-receipt-media">
                  {receiptMediaKind(viewer.data.file_url) === 'pdf' ? (
                    <iframe title="Receipt PDF" src={viewer.data.file_url} className="document-viewer-receipt-iframe" />
                  ) : receiptMediaKind(viewer.data.file_url) === 'image' ? (
                    <img src={viewer.data.file_url} alt="Receipt" className="document-viewer-receipt-img" />
                  ) : (
                    <a href={viewer.data.file_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)]">
                      Open receipt file
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-[var(--text-muted)]">No file attached to this receipt.</p>
              )}
              <div className="document-viewer-receipt-meta">
                <h3 className="document-viewer-receipt-meta__title">Logged details</h3>
                <dl className="document-viewer-receipt-dl">
                  <div>
                    <dt>Vendor</dt>
                    <dd>{viewer.data.vendor || '—'}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{viewer.data.date || '—'}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatMoney(viewer.data.total_amount)}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{viewer.data.category || '—'}</dd>
                  </div>
                  <div className="document-viewer-receipt-dl--wide">
                    <dt>Description</dt>
                    <dd>{viewer.data.description || '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {viewer && !loading && viewer.type === 'generic' && (
            <div className="document-viewer-portal-page document-viewer-generic">
              <pre className="document-viewer-generic-pre">{JSON.stringify(viewer.data, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(body, document.body)
}
