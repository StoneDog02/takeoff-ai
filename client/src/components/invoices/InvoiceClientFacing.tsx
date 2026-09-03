import { useState, useCallback, useMemo, type CSSProperties } from 'react'
import { api, type InvoicePortalResponse, type InvoicePortalPaymentOptions } from '@/api/client'
import { API_BASE } from '@/api/config'
import { openOwnerInvoiceAttachment } from '@/lib/openOwnerInvoiceAttachment'
import { formatPortalCurrency, formatPortalDate } from '@/components/estimates/EstimateClientFacingDocument'
import { depositDisplayFromPortalRows } from '@/lib/invoiceDepositDisplay'
import { InvoiceDepositScheduleSection } from '@/components/invoices/InvoiceDepositScheduleSection'

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

type PaymentMethodKey = 'cash' | 'check' | 'ach' | 'card'

const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  cash: 'Cash',
  check: 'Check',
  ach: 'ACH / wire transfer',
  card: 'Card',
}

type InvoiceClientFacingProps = {
  data: InvoicePortalResponse
  overdueDays?: number | null
  /** Portal: Pay column + schedule hint. Document viewer: readonly table. */
  interactiveSchedule: boolean
  /** Public invoice link token — opens attachment URLs via portal (no auth). */
  portalToken?: string | null
  /** In-app viewer: authenticated attachment download links. */
  invoiceIdForAttachments?: string | null
}

/**
 * Shared client invoice layout: public portal and in-app document viewer.
 * Template + accent come from `data.branding` (saved in Settings → Branding).
 */
function attachmentHref(
  portalToken: string | null | undefined,
  invoiceId: string | null | undefined,
  attachmentId: string
): string {
  if (portalToken) {
    return `${API_BASE}/invoices/portal/${encodeURIComponent(portalToken)}/attachment/${encodeURIComponent(attachmentId)}`
  }
  if (invoiceId) {
    return `${API_BASE}/invoices/${encodeURIComponent(invoiceId)}/attachments/${encodeURIComponent(attachmentId)}/view`
  }
  return '#'
}

const defaultPaymentOptions: InvoicePortalPaymentOptions = {
  cash: true,
  check: true,
  ach: true,
  card: false,
  check_instructions: null,
  ach_instructions: null,
  cash_note: null,
}

export function InvoiceClientFacing({
  data,
  overdueDays,
  interactiveSchedule,
  portalToken,
  invoiceIdForAttachments,
}: InvoiceClientFacingProps) {
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodKey | null>(null)
  const [payValidationError, setPayValidationError] = useState<string | null>(null)
  const [offlinePayNotice, setOfflinePayNotice] = useState<string | null>(null)
  const pay = data.payment_options ?? defaultPaymentOptions
  const company = data.company

  const availableMethods = useMemo(() => {
    const methods: PaymentMethodKey[] = []
    if (pay.cash) methods.push('cash')
    if (pay.check) methods.push('check')
    if (pay.ach) methods.push('ach')
    if (pay.card && portalToken) methods.push('card')
    return methods
  }, [pay.cash, pay.check, pay.ach, pay.card, portalToken])

  const methodDetail = useCallback(
    (method: PaymentMethodKey): string => {
      if (method === 'cash') {
        return (
          pay.cash_note?.trim() ||
          'Coordinate with your contractor for in-person cash payment if they accept it.'
        )
      }
      if (method === 'check') {
        return (
          pay.check_instructions?.trim() ||
          `Mail or deliver a check payable to ${company?.name?.trim() || 'the contractor'} using the address on this invoice, unless they gave you other instructions.`
        )
      }
      if (method === 'ach') {
        return (
          pay.ach_instructions?.trim() ||
          'Request bank routing and account details from your contractor if you prefer ACH or wire.'
        )
      }
      return 'Secure checkout by Stripe. If your contractor connected a Stripe account, funds route to them; otherwise payment is processed through the platform for their payout.'
    },
    [pay.cash_note, pay.check_instructions, pay.ach_instructions, company?.name]
  )

  const startCardCheckout = useCallback(async () => {
    if (!portalToken) {
      window.alert('Card payment is not available on this page.')
      return
    }
    setCheckoutLoading(true)
    setOfflinePayNotice(null)
    try {
      const { url } = await api.invoicePortal.createCheckoutSession(portalToken)
      if (url) {
        window.location.href = url
        return
      }
      window.alert('Could not start card payment.')
    } catch (e) {
      console.error(e)
      window.alert(e instanceof Error ? e.message : 'Could not start card payment.')
    } finally {
      setCheckoutLoading(false)
    }
  }, [portalToken])

  const handlePay = useCallback(
    (opts?: { label?: string; amount?: number }) => {
      setOfflinePayNotice(null)
      if (!selectedPaymentMethod) {
        setPayValidationError('Choose how you’d like to pay')
        document.getElementById('invoice-pay-heading')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      setPayValidationError(null)

      if (selectedPaymentMethod === 'card') {
        void startCardCheckout()
        return
      }

      const scheduleLen = data.schedule_rows?.length ?? 0
      const dueNow = Number(data.amount_due_now) || 0
      const amount =
        opts?.amount != null
          ? opts.amount
          : scheduleLen > 0 && dueNow > 0
            ? dueNow
            : Number(data.total_amount) || 0
      const portion =
        opts?.label != null
          ? `${opts.label} (${formatPortalCurrency(opts.amount ?? amount)})`
          : `invoice balance (${formatPortalCurrency(amount)})`
      const methodLabel = PAYMENT_METHOD_LABELS[selectedPaymentMethod]
      const to = company?.email?.trim() || ''
      const subject = `Payment (${methodLabel}): ${data.projectName} — ${shortInvoiceRef(data.invoice_id)}`
      const body = [
        `I will pay via ${methodLabel} for: ${portion}.`,
        `Invoice reference: ${shortInvoiceRef(data.invoice_id)}`,
        `Amount: ${formatPortalCurrency(amount)}`,
        '',
        'Please confirm when you receive payment.',
      ].join('\n')

      if (to) {
        window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        setOfflinePayNotice(
          `Follow the ${methodLabel.toLowerCase()} instructions above, then send the email to your contractor if your mail app opens.`
        )
        return
      }

      setOfflinePayNotice(
        `Use the ${methodLabel.toLowerCase()} instructions above to complete payment. Your contractor has not listed an email on this invoice for confirmation.`
      )
    },
    [selectedPaymentMethod, startCardCheckout, data, company?.email]
  )

  const { primaryColor, secondaryColor, invoiceTemplateStyle: tpl } = resolveInvoiceBranding(data)
  const lineItems = data.line_items ?? []
  const accentVars: CSSProperties = {
    ['--invoice-accent' as string]: primaryColor,
    ['--invoice-accent-secondary' as string]: secondaryColor,
  }
  const st = String(data.status).toLowerCase()
  const invoicePaid = st === 'paid'
  const showProgress = (data.schedule_rows?.length ?? 0) > 0
  const depositDisplay = useMemo(
    () => depositDisplayFromPortalRows(data.schedule_rows, data.total_amount),
    [data.schedule_rows, data.total_amount]
  )
  const isManualDeposit = depositDisplay != null
  const openStatus = st === 'sent' || st === 'viewed' ? 'Open' : st

  const showPaymentSection =
    !invoicePaid &&
    (availableMethods.length > 0 ||
      !!(pay.check_instructions && pay.check_instructions.trim()) ||
      !!(pay.ach_instructions && pay.ach_instructions.trim()) ||
      !!(pay.cash_note && pay.cash_note.trim()))

  const canSelectPayMethod = interactiveSchedule && !invoicePaid && availableMethods.length > 0
  const showSingleInvoicePay =
    canSelectPayMethod && !showProgress && (Number(data.total_amount) || 0) > 0

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
              {depositDisplay && !invoicePaid ? (
                <div className="invoice-portal-summary__row invoice-portal-summary__row--emph">
                  <span>Deposit required ({depositDisplay.depositPct}%)</span>
                  <span className="invoice-portal-summary__value">
                    {formatPortalCurrency(depositDisplay.depositAmount)}
                  </span>
                </div>
              ) : null}
              <div className="invoice-portal-summary__row">
                <span>Payment schedule</span>
                <span className="invoice-portal-summary__value">
                  {isManualDeposit ? 'Deposit + balance' : `${data.schedule_rows.length} milestones`}
                </span>
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

        {depositDisplay ? (
          <InvoiceDepositScheduleSection
            display={depositDisplay}
            variant="portal"
            scheduleRows={data.schedule_rows}
          />
        ) : null}

        {showPaymentSection ? (
          <section className="invoice-portal-pay" aria-labelledby="invoice-pay-heading">
            <h2 id="invoice-pay-heading" className="invoice-portal-schedule__title">
              How to pay
            </h2>
            {canSelectPayMethod ? (
              <>
                <p className="invoice-portal-schedule__hint">
                  Choose a payment method, then use Pay on the amount due.
                </p>
                <div
                  className="invoice-portal-pay__grid"
                  role="radiogroup"
                  aria-labelledby="invoice-pay-heading"
                  aria-required="true"
                >
                  {availableMethods.map((method) => {
                    const selected = selectedPaymentMethod === method
                    const inputId = `invoice-pay-method-${method}`
                    return (
                      <label
                        key={method}
                        htmlFor={inputId}
                        className={`invoice-portal-pay__method invoice-portal-pay__method--selectable${
                          selected ? ' invoice-portal-pay__method--selected' : ''
                        }`}
                      >
                        <span className="invoice-portal-pay__method-head">
                          <input
                            id={inputId}
                            type="radio"
                            name="invoice-payment-method"
                            value={method}
                            checked={selected}
                            onChange={() => {
                              setSelectedPaymentMethod(method)
                              setPayValidationError(null)
                              setOfflinePayNotice(null)
                            }}
                          />
                          <span className="invoice-portal-pay__method-title">
                            {PAYMENT_METHOD_LABELS[method]}
                          </span>
                        </span>
                        {selected ? (
                          <p className="invoice-portal-pay__detail">{methodDetail(method)}</p>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
                {payValidationError ? (
                  <p className="invoice-portal-pay__error" role="alert">
                    {payValidationError}
                  </p>
                ) : null}
                {offlinePayNotice ? (
                  <p className="invoice-portal-pay__notice" role="status">
                    {offlinePayNotice}
                  </p>
                ) : null}
                {showSingleInvoicePay ? (
                  <div className="invoice-portal-pay__actions">
                    <button
                      type="button"
                      className="invoice-portal-pay__card-btn"
                      disabled={checkoutLoading}
                      onClick={() => handlePay({ amount: Number(data.total_amount) || 0 })}
                    >
                      {checkoutLoading
                        ? 'Redirecting…'
                        : selectedPaymentMethod === 'card'
                          ? 'Pay with card'
                          : `Pay ${formatPortalCurrency(Number(data.total_amount) || 0)}`}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="invoice-portal-pay__grid">
                {pay.cash ? (
                  <div className="invoice-portal-pay__method">
                    <h3>Cash</h3>
                    <p className="invoice-portal-pay__detail">{methodDetail('cash')}</p>
                  </div>
                ) : null}
                {pay.check ? (
                  <div className="invoice-portal-pay__method">
                    <h3>Check</h3>
                    <p className="invoice-portal-pay__detail">{methodDetail('check')}</p>
                  </div>
                ) : null}
                {pay.ach ? (
                  <div className="invoice-portal-pay__method">
                    <h3>ACH / wire transfer</h3>
                    <p className="invoice-portal-pay__detail">{methodDetail('ach')}</p>
                  </div>
                ) : null}
                {pay.card ? (
                  <div className="invoice-portal-pay__method">
                    <h3>Card</h3>
                    <p className="invoice-portal-pay__detail">{methodDetail('card')}</p>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {showProgress && (
          <section className="invoice-portal-schedule" aria-labelledby="invoice-schedule-heading">
            <h2 id="invoice-schedule-heading" className="invoice-portal-schedule__title">
              {isManualDeposit ? 'Payment status' : 'Payment schedule'}
            </h2>
            {interactiveSchedule ? (
              <p className="invoice-portal-schedule__hint">
                {isManualDeposit
                  ? 'Pay the portion marked Due Now. Your contractor will request the balance when it is due.'
                  : <>Pay only the milestones marked <strong>Due Now</strong>. Upcoming payments are shown for your reference.</>}
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
                <span role="columnheader">{isManualDeposit ? 'Payment' : 'Phase'}</span>
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
                            disabled={checkoutLoading}
                            onClick={() => handlePay({ label: row.label, amount: row.amount })}
                          >
                            {checkoutLoading ? '…' : 'Pay now'}
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

        {lineItems.length > 0 && (
          <section className="invoice-portal-lines" aria-labelledby="invoice-lines-heading">
            <h2 id="invoice-lines-heading" className="invoice-portal-schedule__title">
              Line items
            </h2>
            <div className="invoice-portal-lines-table">
              {tpl === 'detailed'
                ? (() => {
                    const bySection = new Map<string | null, typeof lineItems>()
                    for (const li of lineItems) {
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
                : lineItems.map((li) => (
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

        {!showProgress && lineItems.length === 0 && (
          <p className="invoice-portal-empty-lines">No line items on file for this invoice.</p>
        )}

        {data.notes || (data.attachments && data.attachments.length > 0) ? (
          <section className="invoice-portal-notes">
            <h3 className="invoice-portal-notes__title">Notes</h3>
            {data.notes ? <p className="invoice-portal-notes__body">{data.notes}</p> : null}
            {data.attachments && data.attachments.length > 0 ? (
              <div className="invoice-portal-notes__attachments">
                <p className="invoice-portal-notes__attachments-label">Supporting documents</p>
                <ul className="invoice-portal-notes__attachments-list">
                  {data.attachments.map((a) => (
                    <li key={a.id}>
                      {portalToken ? (
                        <a
                          href={attachmentHref(portalToken, invoiceIdForAttachments, a.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="invoice-portal-notes__attachment-link"
                        >
                          {a.label}
                        </a>
                      ) : invoiceIdForAttachments ? (
                        <button
                          type="button"
                          className="invoice-portal-notes__attachment-link estimate-doc__attachment-btn"
                          onClick={() => void openOwnerInvoiceAttachment(invoiceIdForAttachments, a.id)}
                        >
                          {a.label}
                        </button>
                      ) : (
                        <span className="invoice-portal-notes__attachment-link">{a.label}</span>
                      )}
                      <span className="invoice-portal-notes__attachment-hint"> (opens in new tab)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
