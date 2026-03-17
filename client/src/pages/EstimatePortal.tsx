import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type EstimatePortalResponse } from '@/api/client'
import { dayjs } from '@/lib/date'

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = dayjs(iso)
  return d.isValid() ? d.format('MMM D, YYYY') : '—'
}

function LoadingSpinner() {
  return (
    <div className="estimate-portal-loading">
      <div className="estimate-portal-spinner" aria-label="Loading">
        <div className="estimate-portal-spinner__dot" />
        <div className="estimate-portal-spinner__dot" />
        <div className="estimate-portal-spinner__dot" />
      </div>
    </div>
  )
}

function AcceptedView({ data }: { data: EstimatePortalResponse }) {
  return (
    <div className="estimate-portal-card estimate-portal-card--success">
      <div className="estimate-portal-card__body">
        <h2 className="estimate-portal-title">You&apos;ve approved this estimate.</h2>
        <p className="estimate-portal-message">{data.gcName} will be in touch to get started.</p>
        <div className="estimate-portal-meta">
          <span className="estimate-portal-meta__project">{data.projectName}</span>
          <span className="estimate-portal-meta__total">{formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  )
}

function DeclinedView({ data }: { data: EstimatePortalResponse }) {
  return (
    <div className="estimate-portal-card">
      <div className="estimate-portal-card__body">
        <h2 className="estimate-portal-title">You&apos;ve declined this estimate.</h2>
        <div className="estimate-portal-meta">
          <span className="estimate-portal-meta__project">{data.projectName}</span>
          <span className="estimate-portal-meta__total">{formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  )
}

/** Full-page green success after approving. */
function ApprovedSuccessPage({ data }: { data: EstimatePortalResponse }) {
  return (
    <div className="estimate-portal-card estimate-portal-card--success estimate-portal-success-page">
      <div className="estimate-portal-card__body">
        <div className="estimate-portal-success-page__icon">✓</div>
        <h2 className="estimate-portal-title">Estimate Approved!</h2>
        <p className="estimate-portal-message estimate-portal-success-page__project">{data.projectName}</p>
        <p className="estimate-portal-message estimate-portal-success-page__total">{formatCurrency(data.total)}</p>
        <div className="estimate-portal-success-page__next">
          <span className="estimate-portal-success-page__next-icon" aria-hidden>📅</span>
          <p className="estimate-portal-message">
            What happens next: {data.gcName} will contact you shortly to schedule a start date.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Confirmation after requesting changes. */
function ChangesSentPage({ data }: { data: EstimatePortalResponse }) {
  return (
    <div className="estimate-portal-card">
      <div className="estimate-portal-card__body">
        <h2 className="estimate-portal-title">Feedback sent</h2>
        <p className="estimate-portal-message">
          Your feedback has been sent. {data.gcName} will review and send a revised estimate.
        </p>
      </div>
    </div>
  )
}

/** Neutral confirmation after declining. */
function DeclinedConfirmPage({ data }: { data: EstimatePortalResponse }) {
  return (
    <div className="estimate-portal-card">
      <div className="estimate-portal-card__body">
        <h2 className="estimate-portal-title">Estimate declined</h2>
        <p className="estimate-portal-message">{data.gcName} has been notified.</p>
        <div className="estimate-portal-meta">
          <span className="estimate-portal-meta__project">{data.projectName}</span>
          <span className="estimate-portal-meta__total">{formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  )
}

/** Group line items by section for table. */
function groupBySection(
  items: EstimatePortalResponse['line_items']
): { section: string | null; items: EstimatePortalResponse['line_items'] }[] {
  const bySection = new Map<string | null, EstimatePortalResponse['line_items']>()
  for (const item of items) {
    const section = (item.section && item.section.trim()) || null
    if (!bySection.has(section)) bySection.set(section, [])
    bySection.get(section)!.push(item)
  }
  const order = Array.from(bySection.keys()).sort((a, b) => {
    if (a == null) return 1
    if (b == null) return -1
    return a.localeCompare(b)
  })
  return order.map((section) => ({ section, items: bySection.get(section)! }))
}

/** Active state: full estimate review with hero, table, notes, action bar. */
function ActiveReviewView({
  data,
  token,
  onApproved,
  onChangesSent,
  onDeclined,
}: {
  data: EstimatePortalResponse
  token: string
  onApproved: () => void
  onChangesSent: () => void
  onDeclined: () => void
}) {
  const [approving, setApproving] = useState(false)
  const [showRequestChanges, setShowRequestChanges] = useState(false)
  const [changesMessage, setChangesMessage] = useState('')
  const [sendingChanges, setSendingChanges] = useState(false)
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const subtotal = data.line_items.reduce((sum, i) => sum + Number(i.total), 0)
  const grouped = groupBySection(data.line_items)
  const hasMilestones = data.milestones && data.milestones.length > 0

  const handleApprove = async () => {
    setActionError(null)
    setApproving(true)
    try {
      await api.estimatePortal.approve(token)
      onApproved()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not approve.')
    } finally {
      setApproving(false)
    }
  }

  const handleSendRequestChanges = async () => {
    setActionError(null)
    setSendingChanges(true)
    try {
      await api.estimatePortal.requestChanges(token, changesMessage)
      setShowRequestChanges(false)
      setChangesMessage('')
      onChangesSent()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not send.')
    } finally {
      setSendingChanges(false)
    }
  }

  const handleDeclineConfirm = async () => {
    setActionError(null)
    setDeclining(true)
    try {
      await api.estimatePortal.decline(token)
      setShowDeclineConfirm(false)
      onDeclined()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not decline.')
    } finally {
      setDeclining(false)
    }
  }

  return (
    <>
      <div className="estimate-portal-doc estimate-doc--elevated">
        {/* Hero header */}
        <div className="estimate-doc__hero">
          <div className="estimate-doc__hero-left">
            <h1 className="estimate-doc__company-name estimate-portal-doc__company-name">
              {data.company || data.gcName}
            </h1>
          </div>
          <div className="estimate-doc__hero-right">
            <span className="estimate-doc__status-badge">ESTIMATE</span>
            {data.estimate_number && <span className="estimate-doc__doc-title">{data.estimate_number}</span>}
            <span className="estimate-doc__hero-contact">
              Date issued: {formatDate(data.date_issued ?? data.sent_at)}
              {data.expiry_date && (
                <>
                  <span className="estimate-doc__hero-sep"> · </span>
                  Expires: {formatDate(data.expiry_date)}
                </>
              )}
            </span>
          </div>
        </div>
        {/* Two-column: client left, project right */}
        <div className="estimate-doc__meta">
          <div className="estimate-doc__meta-item">
            <span className="estimate-doc__meta-label">Client</span>
            <span className="estimate-doc__meta-value">{data.clientName || '—'}</span>
            {(data.clientAddress || data.address) && (
              <span className="estimate-doc__terms-text" style={{ marginTop: 4 }}>
                {data.clientAddress || data.address}
              </span>
            )}
          </div>
          <div className="estimate-doc__meta-item">
            <span className="estimate-doc__meta-label">Project</span>
            <span className="estimate-doc__meta-value">{data.projectName}</span>
            {data.address && (
              <span className="estimate-doc__terms-text" style={{ marginTop: 4 }}>
                {data.address}
              </span>
            )}
          </div>
        </div>
        {/* Line items table */}
        <div className="estimate-doc__table-wrap">
          <table className="estimate-doc__table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="estimate-doc__th-qty">Qty</th>
                <th className="estimate-doc__th-unit">Unit</th>
                <th className="estimate-doc__th-rate">Unit price</th>
                <th className="estimate-doc__th-amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ section, items }) => (
                <React.Fragment key={section ?? '__none'}>
                  {section != null && (
                    <tr className="estimate-doc__section-row">
                      <td colSpan={5} className="estimate-doc__section-header">
                        {section}
                      </td>
                    </tr>
                  )}
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description || '—'}</td>
                      <td className="estimate-doc__td-qty estimate-doc__num">{item.quantity}</td>
                      <td className="estimate-doc__td-unit">{item.unit}</td>
                      <td className="estimate-doc__td-rate estimate-doc__num">{formatCurrency(item.unit_price)}</td>
                      <td className="estimate-doc__amount estimate-doc__num">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {/* Subtotal / total bar */}
        <div className="estimate-doc__summary">
          <div className="estimate-doc__summary-row">
            <span className="estimate-doc__summary-label">Subtotal</span>
            <span className="estimate-doc__summary-value estimate-doc__num">{formatCurrency(subtotal)}</span>
          </div>
        </div>
        <div className="estimate-doc__total-bar-wrap">
          <div className="estimate-doc__total-bar">
            <span className="estimate-doc__total-bar-label">Total</span>
            <span className="estimate-doc__total-bar-value estimate-doc__num">{formatCurrency(data.total)}</span>
          </div>
        </div>
        {/* Payment schedule */}
        {hasMilestones && (
          <div className="estimate-portal-milestones">
            <h3 className="estimate-portal-milestones__title">Payment Schedule</h3>
            <ul className="estimate-portal-milestones__list">
              {data.milestones.map((m, i) => (
                <li key={i} className="estimate-portal-milestones__item">
                  <span className="estimate-portal-milestones__label">{m.label}</span>
                  {m.percentage != null && (
                    <span className="estimate-portal-milestones__pct">{m.percentage}%</span>
                  )}
                  <span className="estimate-portal-milestones__amount">{formatCurrency(m.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Notes/Terms */}
        {(data.notes || data.terms) && (
          <div className="estimate-doc__terms">
            {data.notes && (
              <>
                <div className="estimate-doc__terms-title">Notes</div>
                <div className="estimate-doc__terms-text">{data.notes}</div>
              </>
            )}
            {data.terms && (
              <>
                <div className="estimate-doc__terms-title" style={{ marginTop: data.notes ? 16 : 0 }}>Terms</div>
                <div className="estimate-doc__terms-text">{data.terms}</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Request changes inline */}
      {showRequestChanges && (
        <div className="estimate-portal-request-changes">
          <label className="estimate-portal-request-changes__label">What would you like changed?</label>
          <textarea
            className="estimate-portal-request-changes__input"
            value={changesMessage}
            onChange={(e) => setChangesMessage(e.target.value)}
            placeholder="Describe the changes you need..."
            rows={4}
          />
          <div className="estimate-portal-request-changes__actions">
            <button
              type="button"
              className="estimate-portal-btn estimate-portal-btn--primary"
              onClick={handleSendRequestChanges}
              disabled={sendingChanges}
            >
              {sendingChanges ? 'Sending…' : 'Send Request'}
            </button>
            <button
              type="button"
              className="estimate-portal-btn estimate-portal-btn--ghost"
              onClick={() => { setShowRequestChanges(false); setChangesMessage(''); setActionError(null) }}
              disabled={sendingChanges}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Decline confirmation overlay */}
      {showDeclineConfirm && (
        <div
          className="estimate-portal-modal-overlay"
          onClick={() => !declining && setShowDeclineConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="estimate-portal-decline-title"
        >
          <div className="estimate-portal-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="estimate-portal-decline-title" className="estimate-portal-modal__title">
              Are you sure?
            </h2>
            <p className="estimate-portal-modal__text">
              This will notify {data.gcName} that you&apos;ve declined.
            </p>
            <div className="estimate-portal-modal__actions">
              <button
                type="button"
                className="estimate-portal-btn estimate-portal-btn--ghost"
                onClick={() => setShowDeclineConfirm(false)}
                disabled={declining}
              >
                Cancel
              </button>
              <button
                type="button"
                className="estimate-portal-btn estimate-portal-btn--danger"
                onClick={handleDeclineConfirm}
                disabled={declining}
              >
                {declining ? 'Declining…' : 'Yes, decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action bar — sticky bottom */}
      <div className="estimate-portal-action-bar">
        <div className="estimate-portal-action-bar__inner">
          {actionError && (
            <p className="estimate-portal-action-bar__error" role="alert">
              {actionError}
            </p>
          )}
          <div className="estimate-portal-action-bar__actions">
            <button
              type="button"
              className="estimate-portal-btn estimate-portal-btn--primary estimate-portal-action-bar__approve"
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? 'Approving…' : 'Approve Estimate'}
            </button>
            <button
              type="button"
              className="estimate-portal-btn estimate-portal-btn--ghost"
              onClick={() => { setShowRequestChanges(true); setActionError(null) }}
              disabled={approving || declining}
            >
              Request Changes
            </button>
            <button
              type="button"
              className="estimate-portal-action-bar__decline"
              onClick={() => setShowDeclineConfirm(true)}
              disabled={approving || declining}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Public estimate approval portal at /estimate/:token.
 * Standalone full-page layout — no sidebar, topbar, or auth. Client/homeowner reviews and approves the estimate.
 */
export function EstimatePortal() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<EstimatePortalResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionResult, setActionResult] = useState<'approved' | 'changes_sent' | 'declined' | null>(null)
  const viewedFiredRef = useRef(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing link.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api.estimatePortal
      .get(token)
      .then((res) => {
        if (cancelled) return
        setData(res)
        setError(null)
        if (!viewedFiredRef.current) {
          viewedFiredRef.current = true
          api.estimatePortal.markViewed(token).catch(() => {})
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Invalid or expired link.')
        setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  const showActiveReview =
    data &&
    !loading &&
    data.status !== 'accepted' &&
    data.status !== 'declined' &&
    actionResult === null

  return (
    <div className="estimate-portal estimate-portal--page">
      <div className={`estimate-portal__inner ${showActiveReview ? 'estimate-portal__inner--with-actions' : ''}`}>
        {loading && <LoadingSpinner />}
        {error && !loading && (
          <div className="estimate-portal-card">
            <div className="estimate-portal-card__body">
              <h2 className="estimate-portal-title">Invalid or expired link</h2>
              <p className="estimate-portal-message">{error}</p>
            </div>
          </div>
        )}
        {data && !loading && actionResult === 'approved' && <ApprovedSuccessPage data={data} />}
        {data && !loading && actionResult === 'changes_sent' && <ChangesSentPage data={data} />}
        {data && !loading && actionResult === 'declined' && <DeclinedConfirmPage data={data} />}
        {data && !loading && data.status === 'accepted' && actionResult === null && <AcceptedView data={data} />}
        {data && !loading && data.status === 'declined' && actionResult === null && <DeclinedView data={data} />}
        {token && showActiveReview && data && (
          <ActiveReviewView
            data={data}
            token={token}
            onApproved={() => setActionResult('approved')}
            onChangesSent={() => setActionResult('changes_sent')}
            onDeclined={() => setActionResult('declined')}
          />
        )}
      </div>
      <footer className="estimate-portal-footer">
        <span className="estimate-portal-footer__text">Powered by BuildOS</span>
      </footer>
    </div>
  )
}
