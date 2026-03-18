import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type BidPortalResponse } from '@/api/client'

const RESPONDED_STATUSES = ['bid_received', 'awarded', 'declined'] as const

function formatPortalDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

function LoadingSpinner() {
  return (
    <div className="bid-portal-spinner" aria-label="Loading">
      <div className="bid-portal-spinner__dot" />
      <div className="bid-portal-spinner__dot" />
      <div className="bid-portal-spinner__dot" />
    </div>
  )
}

function AlreadyRespondedView({ data }: { data: BidPortalResponse }) {
  return (
    <div className="bid-portal-card">
      <div className="bid-portal-card__body">
        <h2 className="bid-portal-title">Your bid has been received</h2>
        <p className="bid-portal-message">We&apos;ll be in touch.</p>
        <div className="bid-portal-meta">
          <span className="bid-portal-meta__project">{data.projectName}</span>
          <span className="bid-portal-meta__trade">{data.tradeName}</span>
        </div>
      </div>
    </div>
  )
}

function BidSubmittedConfirmation() {
  return (
    <div className="bid-portal-card bid-portal-card--success">
      <div className="bid-portal-card__body">
        <h2 className="bid-portal-title">Bid submitted successfully.</h2>
        <p className="bid-portal-message">The GC will review and be in touch.</p>
      </div>
    </div>
  )
}

function BidDeclinedConfirmation() {
  return (
    <div className="bid-portal-card">
      <div className="bid-portal-card__body">
        <h2 className="bid-portal-title">You&apos;ve declined this bid request.</h2>
      </div>
    </div>
  )
}

function ActiveBidView({
  data,
  token,
  onSubmitted,
  onDeclined,
}: {
  data: BidPortalResponse
  token: string
  onSubmitted: () => void
  onDeclined: () => void
}) {
  const viewedRef = useRef(false)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [availability, setAvailability] = useState('')
  const [quoteFile, setQuoteFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || viewedRef.current) return
    viewedRef.current = true
    api.bids.markViewed(token).catch(() => {})
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const num = Number.parseFloat(amount.replace(/[,$]/g, ''))
    if (Number.isNaN(num) || num < 0) {
      setFormError('Please enter a valid bid amount.')
      return
    }
    setSubmitting(true)
    try {
      await api.bids.submitBid(token, {
        amount: num,
        notes: notes.trim() || undefined,
        availability: availability.trim() || undefined,
        quoteFile: quoteFile || undefined,
      })
      onSubmitted()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const sentDate = formatPortalDate(data.dispatched_at)
  const deadlineDate = formatPortalDate(data.response_deadline)

  const handleDecline = async () => {
    setFormError(null)
    setDeclining(true)
    try {
      await api.bids.declineBid(token)
      setShowDeclineConfirm(false)
      onDeclined()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to decline. Try again.')
    } finally {
      setDeclining(false)
    }
  }

  return (
    <div className="bid-portal-cards bid-portal-cards--layout">
      <div className="bid-portal-cards__main">
        {/* Header card */}
        <div className="bid-portal-card bid-portal-card--header">
          <div className="bid-portal-card__body">
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
          </div>
        </div>

        {/* Scope of Work card */}
        <div className="bid-portal-card">
          <div className="bid-portal-card__body">
            <h3 className="bid-portal-scope__heading">What you&apos;re bidding on</h3>
            <p className="bid-portal-scope__subheading">
              The following quantities were extracted from the project plans. Your bid should cover all items listed for
              this trade.
            </p>
            {(() => {
              const scopeItems = Array.isArray(data.scope_items) ? data.scope_items : []
              const tradeLabel = data.trade_name || data.tradeName || 'This trade'
              if (scopeItems.length > 0) {
                const n = scopeItems.length
                const countLine = `${n === 1 ? '1 line item' : `${n} line items`} · ${tradeLabel}`
                return (
                  <>
                    <p className="bid-portal-scope-count">{countLine}</p>
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
                                {Number.isFinite(Number(item.quantity))
                                  ? Number(item.quantity).toLocaleString()
                                  : '—'}
                              </td>
                              <td className="bid-portal-scope-table__unit">{item.unit || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              }
              return (
                <div className="bid-portal-scope__empty-block">
                  <p className="bid-portal-scope__empty-title">Scope to be confirmed</p>
                  <p className="bid-portal-scope__empty-text">
                    The GC has not yet run a takeoff. Contact them directly for scope details.
                  </p>
                  {data.gc_name ? (
                    <p className="bid-portal-scope__gc-name">
                      <span className="bid-portal-scope__gc-label">General contractor:</span> {data.gc_name}
                    </p>
                  ) : null}
                </div>
              )
            })()}
            <p className="bid-portal-scope-disclaimer">
              Quantities are for reference only and should be verified against the project plans. Contact the GC with any
              questions.
            </p>
          </div>
        </div>

        {(data.gc_name || data.gc_email) && (
          <div className="bid-portal-contact-bar" role="note">
            <span>Questions about this scope? Contact</span>
            {data.gc_email ? (
              <a
                href={`mailto:${data.gc_email}?subject=${encodeURIComponent(
                  `Bid question — ${data.project_name || data.projectName || 'Project'}`
                )}`}
                className="bid-portal-contact-bar__link"
              >
                {data.gc_name?.trim() || data.gc_email}
              </a>
            ) : (
              <span className="bid-portal-contact-bar__name">{data.gc_name}</span>
            )}
          </div>
        )}
      </div>

      <aside className="bid-portal-cards__aside">
        <div className="bid-portal-card bid-portal-card--bid">
          <div className="bid-portal-card__body">
            <h3 className="bid-portal-form__title">Your bid</h3>
            <form onSubmit={handleSubmit} className="bid-portal-form">
            {formError && (
              <div className="bid-portal-form__error" role="alert">
                {formError}
              </div>
            )}
            <label className="bid-portal-form__label">
              Bid amount <span className="bid-portal-form__required">*</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bid-portal-form__input bid-portal-form__input--currency"
                required
              />
            </label>
            <label className="bid-portal-form__label">
              Notes / qualifications
              <span className="bid-portal-form__hint">What&apos;s included, exclusions, lead time, payment terms…</span>
              <textarea
                placeholder="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bid-portal-form__input bid-portal-form__textarea"
                rows={4}
              />
            </label>
            <label className="bid-portal-form__label">
              Attach quote PDF
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setQuoteFile(e.target.files?.[0] ?? null)}
                className="bid-portal-form__file"
              />
              {quoteFile && <span className="bid-portal-form__file-name">{quoteFile.name}</span>}
            </label>
            <label className="bid-portal-form__label">
              Availability
              <span className="bid-portal-form__hint">Estimated start date or lead time</span>
              <input
                type="text"
                placeholder="e.g. 2 weeks, March 15"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                className="bid-portal-form__input"
              />
            </label>
            <div className="bid-portal-form__actions">
              <button type="submit" className="bid-portal-btn bid-portal-btn--primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit bid'}
              </button>
              <button
                type="button"
                className="bid-portal-btn bid-portal-btn--ghost"
                onClick={() => setShowDeclineConfirm(true)}
                disabled={submitting || declining}
              >
                Decline to bid
              </button>
            </div>
          </form>
          </div>
        </div>
      </aside>

      {/* Decline confirmation */}
      {showDeclineConfirm && (
        <div className="bid-portal-modal-overlay" onClick={() => setShowDeclineConfirm(false)} role="dialog" aria-modal="true" aria-labelledby="decline-title">
          <div className="bid-portal-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="decline-title" className="bid-portal-modal__title">Decline to bid?</h2>
            <p className="bid-portal-modal__text">The general contractor will be notified. You can&apos;t submit a bid after declining.</p>
            <div className="bid-portal-modal__actions">
              <button type="button" className="bid-portal-btn bid-portal-btn--ghost" onClick={() => setShowDeclineConfirm(false)} disabled={declining}>
                Cancel
              </button>
              <button type="button" className="bid-portal-btn bid-portal-btn--danger" onClick={handleDecline} disabled={declining}>
                {declining ? 'Declining…' : 'Yes, decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type ConfirmationType = 'submitted' | 'declined' | null

export function BidPortal() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<BidPortalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmationType>(null)

  const fetchPortal = () => {
    if (!token) return
    setError(null)
    setLoading(true)
    api.bids
      .getPortal(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!token) {
      setError('Invalid link')
      setLoading(false)
      return
    }
    setConfirmation(null)
    fetchPortal()
  }, [token])

  return (
    <div className="bid-portal bid-portal--page">
      <div className="bid-portal__inner">
        {loading && (
          <div className="bid-portal-loading">
            <LoadingSpinner />
          </div>
        )}
        {error && !loading && (
          <div className="bid-portal-card">
            <div className="bid-portal-card__body">
              <h2 className="bid-portal-title">Invalid or expired link</h2>
              <p className="bid-portal-message">{error}</p>
            </div>
          </div>
        )}
        {data && !loading && !error && (
          <>
            {confirmation === 'submitted' && <BidSubmittedConfirmation />}
            {confirmation === 'declined' && <BidDeclinedConfirmation />}
            {!confirmation && RESPONDED_STATUSES.includes(data.status as (typeof RESPONDED_STATUSES)[number]) && (
              data.status === 'declined' ? <BidDeclinedConfirmation /> : <AlreadyRespondedView data={data} />
            )}
            {!confirmation && !RESPONDED_STATUSES.includes(data.status as (typeof RESPONDED_STATUSES)[number]) && (
              <ActiveBidView
                data={data}
                token={token!}
                onSubmitted={() => setConfirmation('submitted')}
                onDeclined={() => setConfirmation('declined')}
              />
            )}
          </>
        )}
      </div>
      <footer className="bid-portal-footer">
        <span className="bid-portal-footer__text">Powered by BuildOS</span>
      </footer>
    </div>
  )
}
