import type { CSSProperties } from 'react'
import type { InvoicePortalResponse, InvoicePortalScheduleRow } from '@/api/client'
import { formatPortalCurrency, formatPortalDate } from '@/components/estimates/EstimateClientFacingDocument'

export type InvoiceTemplateStyle = 'standard' | 'minimal' | 'detailed'

const BRANDING_HEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/

function brandingHex(raw: string | undefined | null, fallback: string): string {
  const t = raw?.trim() || ''
  return BRANDING_HEX.test(t) ? t : fallback
}

export function resolveInvoiceBranding(data: InvoicePortalResponse): {
  primaryColor: string
  secondaryColor: string
  invoiceTemplateStyle: InvoiceTemplateStyle
} {
  const b = data.branding
  const primaryColor = brandingHex(b?.primaryColor, '#b91c1c')
  const secondaryColor = brandingHex(b?.secondaryColor, '#1e293b')
  const s = b?.invoiceTemplateStyle
  const invoiceTemplateStyle: InvoiceTemplateStyle =
    s === 'minimal' || s === 'detailed' ? s : 'standard'
  return { primaryColor, secondaryColor, invoiceTemplateStyle }
}

function formatSentAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function shortInvoiceRef(id: string): string {
  const t = id?.replace(/-/g, '') || ''
  return t.length >= 8 ? t.slice(0, 8).toUpperCase() : id || '—'
}

function invoiceStatusBadgeClass(status: string): string {
  const s = String(status).toLowerCase()
  if (s === 'paid') return 'invoice-portal-badge invoice-portal-badge--paid'
  if (s === 'due_now') return 'invoice-portal-badge invoice-portal-badge--due'
  return 'invoice-portal-badge invoice-portal-badge--upcoming'
}

function invoiceStatusLabel(status: string): string {
  const s = String(status).toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'due_now') return 'Due Now'
  return 'Upcoming'
}

function handlePayMilestone(data: InvoicePortalResponse, row: InvoicePortalScheduleRow) {
  const subject = encodeURIComponent(`Payment: ${data.projectName} — ${row.label}`)
  const body = encodeURIComponent(
    `Please apply this payment toward: ${row.label} (${formatPortalCurrency(row.amount)}).\n\n`
  )
  window.location.href = `mailto:?subject=${subject}&body=${body}`
}

type InvoiceClientFacingProps = {
  data: InvoicePortalResponse
  overdueDays?: number | null
  /** Portal: Pay column + schedule hint. Document viewer: readonly table. */
  interactiveSchedule: boolean
}

/**
 * Shared client invoice layout: public portal and in-app document viewer.
 * Template + accent come from `data.branding` (saved in Settings → Branding).
 */
export function InvoiceClientFacing({ data, overdueDays, interactiveSchedule }: InvoiceClientFacingProps) {
  const { primaryColor, secondaryColor, invoiceTemplateStyle: tpl } = resolveInvoiceBranding(data)
  const accentVars: CSSProperties = {
    ['--invoice-accent' as string]: primaryColor,
    ['--invoice-accent-secondary' as string]: secondaryColor,
  }
  const st = String(data.status).toLowerCase()
  const invoicePaid = st === 'paid'
  const showProgress = data.invoice_kind === 'progress_series' && (data.schedule_rows?.length ?? 0) > 0
  const company = data.company
  const openStatus = st === 'sent' || st === 'viewed' ? 'Open' : st

  const headerStandard = (
    <>
      {company?.logoUrl ? (
        <img src={company.logoUrl} alt="" className="portal-company-logo invoice-portal-header__logo mx-auto" />
      ) : null}
      <p className="invoice-portal-header__eyebrow">Invoice</p>
      {company?.name?.trim() ? <p className="invoice-portal-header__gc">{company.name.trim()}</p> : null}
      <h1 className="invoice-portal-header__title">{data.projectName ?? 'Invoice'}</h1>
      {data.address ? <p className="invoice-portal-header__address">{data.address}</p> : null}
      {data.clientName ? <p className="invoice-portal-header__client">{data.clientName}</p> : null}
    </>
  )

  const headerMinimal = (
    <div className="invoice-portal-header__minimal-wrap">
      {company?.logoUrl ? (
        <img src={company.logoUrl} alt="" className="portal-company-logo invoice-portal-header__logo-minimal" />
      ) : null}
      <div className="invoice-portal-header__minimal-text">
        <h1 className="invoice-portal-header__title invoice-portal-header__title--minimal">{data.projectName ?? 'Invoice'}</h1>
        {company?.name?.trim() ? <p className="invoice-portal-header__gc invoice-portal-header__gc--minimal">{company.name.trim()}</p> : null}
        {data.clientName ? <p className="invoice-portal-header__client invoice-portal-header__client--minimal">{data.clientName}</p> : null}
      </div>
    </div>
  )
  const headerMinimalBlock = (
    <>
      {headerMinimal}
      {data.address ? <p className="invoice-portal-header__address invoice-portal-header__address--minimal">{data.address}</p> : null}
    </>
  )

  const headerDetailed = (
    <>
      {headerStandard}
      <div className="invoice-portal-header__meta" role="group" aria-label="Invoice details">
        <div className="invoice-portal-header__meta-item">
          <span className="invoice-portal-header__meta-label">Reference</span>
          <span className="invoice-portal-header__meta-value">{shortInvoiceRef(data.invoice_id)}</span>
        </div>
        <div className="invoice-portal-header__meta-item">
          <span className="invoice-portal-header__meta-label">Issued</span>
          <span className="invoice-portal-header__meta-value">{formatSentAt(data.sent_at)}</span>
        </div>
        <div className="invoice-portal-header__meta-item">
          <span className="invoice-portal-header__meta-label">Due</span>
          <span className="invoice-portal-header__meta-value">
            {showProgress ? 'Per schedule' : data.due_date ? formatPortalDate(data.due_date) : '—'}
          </span>
        </div>
        <div className="invoice-portal-header__meta-item">
          <span className="invoice-portal-header__meta-label">Status</span>
          <span className="invoice-portal-header__meta-value">{invoicePaid ? 'Paid' : openStatus}</span>
        </div>
      </div>
      {(company?.phone || company?.email || company?.website || company?.licenseNumber || company?.addressLine) && (
        <div className="invoice-portal-header__company-contact">
          {company.phone ? (
            <div>
              <span className="invoice-portal-header__contact-label">Phone</span> {company.phone}
            </div>
          ) : null}
          {company.email ? (
            <div>
              <span className="invoice-portal-header__contact-label">Email</span> {company.email}
            </div>
          ) : null}
          {company.website ? (
            <div>
              <span className="invoice-portal-header__contact-label">Web</span> {company.website}
            </div>
          ) : null}
          {company.licenseNumber ? (
            <div>
              <span className="invoice-portal-header__contact-label">License</span> {company.licenseNumber}
            </div>
          ) : null}
          {company.addressLine ? <div className="invoice-portal-header__company-address">{company.addressLine}</div> : null}
        </div>
      )}
    </>
  )

  return (
    <>
      <div className="invoice-portal__top-accent" style={{ background: primaryColor }} aria-hidden />
      <header className={`invoice-portal-header invoice-portal-header--${tpl}`} style={accentVars}>
        {tpl === 'minimal' ? headerMinimalBlock : tpl === 'detailed' ? headerDetailed : headerStandard}
      </header>

      <div className={`invoice-portal-body invoice-portal-body--${tpl}`} style={accentVars}>
        <div className="invoice-portal-summary">
          <div className="invoice-portal-summary__row">
            <span>Status</span>
            <span className="invoice-portal-summary__value">{invoicePaid ? 'Paid' : openStatus}</span>
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
          {overdueDays != null && overdueDays > 0 && !invoicePaid ? (
            <div className="invoice-portal-summary__row">
              <span>Days past due</span>
              <span className="invoice-portal-summary__value tabular-nums">{overdueDays}</span>
            </div>
          ) : null}
        </div>

        {showProgress && (
          <section className="invoice-portal-schedule" aria-labelledby="invoice-schedule-heading">
            <h2 id="invoice-schedule-heading" className="invoice-portal-schedule__title">
              Payment schedule
            </h2>
            {interactiveSchedule ? (
              <p className="invoice-portal-schedule__hint">
                Pay only the milestones marked <strong>Due Now</strong>. Upcoming payments are shown for your reference.
              </p>
            ) : null}
            <div
              className={`invoice-portal-schedule-table ${interactiveSchedule ? '' : 'document-viewer-invoice-schedule--readonly'}`}
              role="table"
            >
              <div
                className={`invoice-portal-schedule-table__head ${interactiveSchedule ? '' : 'document-viewer-invoice-schedule__head'}`}
                role="row"
              >
                <span role="columnheader">Phase</span>
                <span role="columnheader">Amount</span>
                <span role="columnheader">Due</span>
                <span role="columnheader">Status</span>
                {interactiveSchedule ? (
                  <span role="columnheader" className="invoice-portal-schedule-table__head-pay">
                    Pay
                  </span>
                ) : null}
              </div>
              {data.schedule_rows.map((row) => {
                const muted = row.status === 'upcoming' && !invoicePaid
                const canPay = interactiveSchedule && !invoicePaid && row.status === 'due_now'
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
                      <span className={invoiceStatusBadgeClass(row.status)}>{invoiceStatusLabel(row.status)}</span>
                    </span>
                    {interactiveSchedule ? (
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
                    ) : null}
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
              {tpl === 'detailed'
                ? (() => {
                    const bySection = new Map<string | null, typeof data.line_items>()
                    for (const li of data.line_items) {
                      const key = li.section ?? null
                      const list = bySection.get(key) ?? []
                      list.push(li)
                      bySection.set(key, list)
                    }
                    const sections = Array.from(bySection.entries())
                    return sections.map(([sec, items]) => (
                      <div key={sec ?? '_default'} className="invoice-portal-lines-section">
                        {sec ? <div className="invoice-portal-lines-section__title">{sec}</div> : null}
                        {items.map((li) => (
                          <div key={li.id} className="invoice-portal-lines-table__row">
                            <div>
                              <div className="invoice-portal-lines-table__desc">{li.description}</div>
                              <div className="invoice-portal-lines-table__meta">
                                {li.quantity} × {formatPortalCurrency(li.unit_price)} {li.unit}
                              </div>
                            </div>
                            <div className="invoice-portal-lines-table__total">{formatPortalCurrency(li.total)}</div>
                          </div>
                        ))}
                      </div>
                    ))
                  })()
                : data.line_items.map((li) => (
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
    </>
  )
}

/** Template modifier class + accent CSS variable for the outer invoice shell. */
export function invoicePortalShellClassAndStyle(data: InvoicePortalResponse): {
  className: string
  style: CSSProperties
} {
  const { primaryColor, secondaryColor, invoiceTemplateStyle } = resolveInvoiceBranding(data)
  return {
    className: `invoice-portal--tpl-${invoiceTemplateStyle}`,
    style: {
      ['--invoice-accent' as string]: primaryColor,
      ['--invoice-accent-secondary' as string]: secondaryColor,
    },
  }
}
