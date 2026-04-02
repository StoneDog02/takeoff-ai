import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type EstimatePortalResponse } from '@/api/client'
import {
  EstimateClientFacingDocument,
  formatPortalCurrency,
} from '@/components/estimates/EstimateClientFacingDocument'

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
  const isCo = data.portal_document_kind === 'change_order'
  return (
    <div className="estimate-portal-card estimate-portal-card--success">
      <div className="estimate-portal-card__body">
        <h2 className="estimate-portal-title">
          {isCo ? "You've approved this change order." : "You've approved this estimate."}
        </h2>
        <p className="estimate-portal-message">{data.gcName} will be in touch to get started.</p>
        <div className="estimate-portal-meta">
          <span className="estimate-portal-meta__project">{data.projectName}</span>
          <span className="estimate-portal-meta__total">{formatPortalCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  )
}

function DeclinedView({ data }: { data: EstimatePortalResponse }) {
  const isCo = data.portal_document_kind === 'change_order'
  return (
    <div className="estimate-portal-card">
      <div className="estimate-portal-card__body">
        <h2 className="estimate-portal-title">
          {isCo ? "You've declined this change order." : "You've declined this estimate."}
        </h2>
        <div className="estimate-portal-meta">
          <span className="estimate-portal-meta__project">{data.projectName}</span>
          <span className="estimate-portal-meta__total">{formatPortalCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  )
}

/** Full-page green success after approving. */
function ApprovedSuccessPage({ data }: { data: EstimatePortalResponse }) {
  const isCo = data.portal_document_kind === 'change_order'
  return (
    <div className="estimate-portal-card estimate-portal-card--success estimate-portal-success-page">
      <div className="estimate-portal-card__body">
        <div className="estimate-portal-success-page__icon">✓</div>
        <h2 className="estimate-portal-title">{isCo ? 'Change Order Approved!' : 'Estimate Approved!'}</h2>
        <p className="estimate-portal-message estimate-portal-success-page__project">{data.projectName}</p>
        <p className="estimate-portal-message estimate-portal-success-page__total">{formatPortalCurrency(data.total)}</p>
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
  const isCo = data.portal_document_kind === 'change_order'
  return (
    <div className="estimate-portal-card">
      <div className="estimate-portal-card__body">
        <h2 className="estimate-portal-title">Feedback sent</h2>
        <p className="estimate-portal-message">
          Your feedback has been sent. {data.gcName} will review and send a revised {isCo ? 'change order' : 'estimate'}.
        </p>
      </div>
    </div>
  )
}

/** Neutral confirmation after declining. */
function DeclinedConfirmPage({ data }: { data: EstimatePortalResponse }) {
  const isCo = data.portal_document_kind === 'change_order'
  return (
    <div className="estimate-portal-card">
      <div className="estimate-portal-card__body">
        <h2 className="estimate-portal-title">{isCo ? 'Change order declined' : 'Estimate declined'}</h2>
        <p className="estimate-portal-message">{data.gcName} has been notified.</p>
        <div className="estimate-portal-meta">
          <span className="estimate-portal-meta__project">{data.projectName}</span>
          <span className="estimate-portal-meta__total">{formatPortalCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  )
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
  const [acceptanceChecked, setAcceptanceChecked] = useState(false)

  const handleApprove = async () => {
    if (!acceptanceChecked) return
    setActionError(null)
    setApproving(true)
    try {
      await api.estimatePortal.approve(token, { acceptanceAcknowledged: true })
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

  const portalKind = data.portal_document_kind ?? 'estimate'

  return (
    <>
      <EstimateClientFacingDocument
        company={data.company}
        companyDisplayName={data.company?.name?.trim() || data.gcName || 'Your Estimate'}
        portalDocumentKind={portalKind}
        estimateNumber={data.estimate_number}
        dateIssued={data.date_issued ?? data.sent_at}
        expiryDate={data.expiry_date}
        clientName={data.clientName || '—'}
        clientAddress={data.clientAddress || data.address}
        projectName={data.projectName}
        projectAddress={data.address}
        lineItems={data.line_items}
        total={data.total}
        milestones={data.milestones}
        notes={data.notes}
        terms={data.terms}
        sectionNotes={data.section_notes ?? null}
        sectionWorkTypes={data.section_work_types ?? null}
        estimateGroupsMeta={data.estimate_groups_meta ?? null}
      />

      <div className="estimate-portal-acceptance--in-flow">
        <label className="estimate-portal-acceptance__label" htmlFor="estimate-portal-acceptance-cb">
          <input
            id="estimate-portal-acceptance-cb"
            type="checkbox"
            className="estimate-portal-acceptance__checkbox"
            checked={acceptanceChecked}
            onChange={(e) => setAcceptanceChecked(e.target.checked)}
          />
          <span>
            {portalKind === 'change_order' ? (
              <>
                I have reviewed this change order, including the line items, total price, notes, and terms above, and I
                agree to the additional scope and pricing shown.
              </>
            ) : (
              <>
                I have reviewed this estimate, including the line items, total price, notes, and terms above, and I agree
                to proceed at the stated price and scope.
              </>
            )}
          </span>
        </label>
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
              This will notify {data.gcName} that you&apos;ve declined this{' '}
              {data.portal_document_kind === 'change_order' ? 'change order' : 'estimate'}.
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
              disabled={approving || !acceptanceChecked}
            >
              {approving
                ? 'Approving…'
                : data.portal_document_kind === 'change_order'
                  ? 'Approve Change Order'
                  : 'Approve Estimate'}
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
