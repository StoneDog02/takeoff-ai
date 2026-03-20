import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type InvoicePortalResponse } from '@/api/client'
import { formatPortalCurrency } from '@/components/estimates/EstimateClientFacingDocument'

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

function statusBadgeClass(status: string): string {
  const s = String(status).toLowerCase()
  if (s === 'paid') return 'invoice-portal-badge invoice-portal-badge--paid'
  if (s === 'due_now') return 'invoice-portal-badge invoice-portal-badge--due'
  return 'invoice-portal-badge invoice-portal-badge--upcoming'
}

function statusLabel(status: string): string {
  const s = String(status).toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'due_now') return 'Due Now'
  return 'Upcoming'
}

function handlePayMilestone(data: InvoicePortalResponse, row: { label: string; amount: number }) {
  const subject = encodeURIComponent(`Payment: ${data.projectName} — ${row.label}`)
  const body = encodeURIComponent(
    `Please apply this payment toward: ${row.label} (${formatPortalCurrency(row.amount)}).\n\n`
  )
  window.location.href = `mailto:?subject=${subject}&body=${body}`
}

/**
 * Public invoice page at /invoice/:token — milestone schedule for progress invoices, or line items for simple invoices.
 */
export function InvoicePortal() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<InvoicePortalResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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
    api.invoicePortal
      .get(token)
      .then((res) => {
        if (cancelled) return
        setData(res)
        setError(null)
        if (!viewedFiredRef.current) {
          viewedFiredRef.current = true
          api.invoicePortal.markViewed(token).catch(() => {})
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
    return () => {
      cancelled = true
    }
  }, [token])

  const st = data ? String(data.status).toLowerCase() : ''
  const invoicePaid = st === 'paid'
  const showProgress = data?.invoice_kind === 'progress_series' && (data.schedule_rows?.length ?? 0) > 0

  return (
    <div className="estimate-portal estimate-portal--page invoice-portal">
      <div className="estimate-portal__inner">
        <header className="invoice-portal-header">
          <p className="invoice-portal-header__eyebrow">Invoice</p>
          <h1 className="invoice-portal-header__title">{data?.projectName ?? 'Invoice'}</h1>
          {data?.address ? <p className="invoice-portal-header__address">{data.address}</p> : null}
          {data?.clientName ? (
            <p className="invoice-portal-header__client">
              {data.clientName}
            </p>
          ) : null}
        </header>

        {loading && <LoadingSpinner />}
        {error && !loading && (
          <div className="estimate-portal-card">
            <div className="estimate-portal-card__body">
              <h2 className="estimate-portal-title">Invalid or expired link</h2>
              <p className="estimate-portal-message">{error}</p>
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="invoice-portal-body">
            <div className="invoice-portal-summary">
              <div className="invoice-portal-summary__row">
                <span>Status</span>
                <span className="invoice-portal-summary__value">{invoicePaid ? 'Paid' : st === 'sent' || st === 'viewed' ? 'Open' : st}</span>
              </div>
              {showProgress ? (
                <>
                  <div className="invoice-portal-summary__row">
                    <span>Payment schedule</span>
                    <span className="invoice-portal-summary__value">{data.schedule_rows.length} milestones</span>
                  </div>
                  {!invoicePaid && (data.amount_due_now ?? 0) > 0 && (
                    <div className="invoice-portal-summary__row invoice-portal-summary__row--emph">
                      <span>Due now</span>
                      <span className="invoice-portal-summary__value">{formatPortalCurrency(data.amount_due_now ?? 0)}</span>
                    </div>
                  )}
                  <div className="invoice-portal-summary__row">
                    <span>Invoice total</span>
                    <span className="invoice-portal-summary__value">{formatPortalCurrency(data.total_amount)}</span>
                  </div>
                </>
              ) : (
                <div className="invoice-portal-summary__row invoice-portal-summary__row--emph">
                  <span>Amount due</span>
                  <span className="invoice-portal-summary__value">{formatPortalCurrency(data.total_amount)}</span>
                </div>
              )}
              {data.due_date && !showProgress && (
                <div className="invoice-portal-summary__row">
                  <span>Due date</span>
                  <span className="invoice-portal-summary__value">{data.due_date}</span>
                </div>
              )}
            </div>

            {showProgress && (
              <section className="invoice-portal-schedule" aria-labelledby="invoice-schedule-heading">
                <h2 id="invoice-schedule-heading" className="invoice-portal-schedule__title">
                  Payment schedule
                </h2>
                <p className="invoice-portal-schedule__hint">
                  Pay only the milestones marked <strong>Due Now</strong>. Upcoming payments are shown for your reference.
                </p>
                <div className="invoice-portal-schedule-table" role="table">
                  <div className="invoice-portal-schedule-table__head" role="row">
                    <span role="columnheader">Phase</span>
                    <span role="columnheader">Amount</span>
                    <span role="columnheader">Due</span>
                    <span role="columnheader">Status</span>
                    <span role="columnheader" className="invoice-portal-schedule-table__head-pay">
                      Pay
                    </span>
                  </div>
                  {data.schedule_rows.map((row) => {
                    const muted = row.status === 'upcoming' && !invoicePaid
                    const canPay = !invoicePaid && row.status === 'due_now'
                    return (
                      <div
                        key={`${row.milestone_id}-${row.label}`}
                        className={`invoice-portal-schedule-table__row ${muted ? 'invoice-portal-schedule-table__row--muted' : ''}`}
                        role="row"
                      >
                        <span className="invoice-portal-schedule-table__cell" role="cell">
                          {row.label}
                        </span>
                        <span className="invoice-portal-schedule-table__cell" role="cell">
                          {formatPortalCurrency(row.amount)}
                        </span>
                        <span className="invoice-portal-schedule-table__cell invoice-portal-schedule-table__due" role="cell">
                          {row.due_display}
                        </span>
                        <span className="invoice-portal-schedule-table__cell" role="cell">
                          <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>
                        </span>
                        <span className="invoice-portal-schedule-table__cell invoice-portal-schedule-table__pay" role="cell">
                          {canPay ? (
                            <button
                              type="button"
                              className="estimate-portal-btn estimate-portal-btn--primary invoice-portal-pay-btn"
                              onClick={() => handlePayMilestone(data, row)}
                            >
                              Pay now
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="estimate-portal-btn invoice-portal-pay-btn invoice-portal-pay-btn--disabled"
                              disabled
                              title={
                                invoicePaid
                                  ? 'This invoice is paid.'
                                  : row.status === 'upcoming'
                                    ? 'Payment is not requested yet for this milestone.'
                                    : '—'
                              }
                            >
                              Pay now
                            </button>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {!showProgress && data.line_items.length > 0 && (
              <section className="invoice-portal-lines" aria-labelledby="invoice-lines-heading">
                <h2 id="invoice-lines-heading" className="invoice-portal-schedule__title">
                  Line items
                </h2>
                <div className="invoice-portal-lines-table">
                  {data.line_items.map((li) => (
                    <div key={li.id} className="invoice-portal-lines-table__row">
                      <div>
                        <div className="invoice-portal-lines-table__desc">{li.description}</div>
                        <div className="invoice-portal-lines-table__meta">
                          {li.quantity} × {formatPortalCurrency(li.unit_price)} {li.unit}
                          {li.section ? ` · ${li.section}` : ''}
                        </div>
                      </div>
                      <div className="invoice-portal-lines-table__total">{formatPortalCurrency(li.total)}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!showProgress && data.line_items.length === 0 && (
              <p className="invoice-portal-empty-lines">No line items on file for this invoice.</p>
            )}

            {data.notes ? (
              <section className="invoice-portal-notes">
                <h3 className="invoice-portal-notes__title">Notes</h3>
                <p className="invoice-portal-notes__body">{data.notes}</p>
              </section>
            ) : null}
            {data.terms ? (
              <section className="invoice-portal-notes">
                <h3 className="invoice-portal-notes__title">Terms</h3>
                <p className="invoice-portal-notes__body">{data.terms}</p>
              </section>
            ) : null}
          </div>
        )}
      </div>
      <footer className="estimate-portal-footer">
        <span className="estimate-portal-footer__text">Powered by BuildOS</span>
      </footer>
    </div>
  )
}
