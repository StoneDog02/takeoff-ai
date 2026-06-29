import type { InvoicePortalScheduleRow } from '@/api/client'
import { formatPortalCurrency } from '@/components/estimates/EstimateClientFacingDocument'
import type { InvoiceDepositDisplay } from '@/lib/invoiceDepositDisplay'

type ScheduleRowView = Pick<InvoicePortalScheduleRow, 'label' | 'amount' | 'due_display' | 'status'>

function formatMoney(n: number): string {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type InvoiceDepositScheduleSectionProps = {
  display: InvoiceDepositDisplay
  variant?: 'elevated' | 'portal' | 'compact'
  scheduleRows?: ScheduleRowView[]
}

export function InvoiceDepositScheduleSection({
  display,
  variant = 'elevated',
  scheduleRows,
}: InvoiceDepositScheduleSectionProps) {
  const pctLabel = Number.isInteger(display.depositPct)
    ? String(display.depositPct)
    : display.depositPct.toFixed(1)

  const lead = (
    <>
      This invoice requires a <strong>{pctLabel}% deposit</strong> ({formatMoney(display.depositAmount)}) before the
      remaining balance ({formatMoney(display.balanceAmount)}) is due.
      {display.isRetainerBalance ? ' The balance stays on retainer until your contractor requests payment.' : null}
    </>
  )

  if (variant === 'compact') {
    return (
      <div className="invoice-deposit-schedule invoice-deposit-schedule--compact">
        <div className="invoice-deposit-schedule__headline">
          {pctLabel}% deposit required · {formatMoney(display.depositAmount)} due now
        </div>
        <div className="invoice-deposit-schedule__sub">
          Balance {formatMoney(display.balanceAmount)} — {display.balanceDueLabel}
        </div>
      </div>
    )
  }

  if (variant === 'portal') {
    return (
      <section className="invoice-deposit-schedule invoice-deposit-schedule--portal" aria-labelledby="invoice-deposit-heading">
        <h2 id="invoice-deposit-heading" className="invoice-portal-schedule__title">
          Deposit &amp; payment schedule
        </h2>
        <p className="invoice-deposit-schedule__lead">{lead}</p>
        <div className="invoice-deposit-schedule__cards">
          <div className="invoice-deposit-schedule__card invoice-deposit-schedule__card--deposit">
            <span className="invoice-deposit-schedule__card-label">Deposit ({pctLabel}%)</span>
            <span className="invoice-deposit-schedule__card-amount">{formatPortalCurrency(display.depositAmount)}</span>
            <span className="invoice-deposit-schedule__card-due">{display.depositDueLabel}</span>
            {scheduleRows?.[0]?.status ? (
              <span className={`invoice-deposit-schedule__status invoice-deposit-schedule__status--${scheduleRows[0].status}`}>
                {scheduleRows[0].status === 'paid' ? 'Paid' : scheduleRows[0].status === 'due_now' ? 'Due now' : 'Upcoming'}
              </span>
            ) : null}
          </div>
          <div className="invoice-deposit-schedule__card">
            <span className="invoice-deposit-schedule__card-label">Balance</span>
            <span className="invoice-deposit-schedule__card-amount">{formatPortalCurrency(display.balanceAmount)}</span>
            <span className="invoice-deposit-schedule__card-due">{display.balanceDueLabel}</span>
            {scheduleRows?.[1]?.status ? (
              <span className={`invoice-deposit-schedule__status invoice-deposit-schedule__status--${scheduleRows[1].status}`}>
                {scheduleRows[1].status === 'paid' ? 'Paid' : scheduleRows[1].status === 'due_now' ? 'Due now' : 'Upcoming'}
              </span>
            ) : null}
          </div>
        </div>
        <p className="invoice-deposit-schedule__total-note">
          Invoice total (line items below): {formatPortalCurrency(display.totalAmount)}
        </p>
      </section>
    )
  }

  return (
    <section className="estimate-doc__payment-schedule" aria-labelledby="estimate-doc-payment-schedule">
      <h3 id="estimate-doc-payment-schedule" className="estimate-doc__terms-title">
        PAYMENT SCHEDULE
      </h3>
      <p className="estimate-doc__payment-schedule-lead">{lead}</p>
      <div className="estimate-doc__table-wrap">
        <table className="estimate-doc__table estimate-doc__table--payment-schedule">
          <thead>
            <tr>
              <th>PAYMENT</th>
              <th className="estimate-doc__th-amount">AMOUNT</th>
              <th>DUE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Deposit ({pctLabel}%)</td>
              <td className="estimate-doc__num estimate-doc__amount">{formatMoney(display.depositAmount)}</td>
              <td>{display.depositDueLabel}</td>
            </tr>
            <tr>
              <td>Balance</td>
              <td className="estimate-doc__num estimate-doc__amount">{formatMoney(display.balanceAmount)}</td>
              <td>{display.balanceDueLabel}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="estimate-doc__payment-schedule-note">
        Line items below total {formatMoney(display.totalAmount)} — the deposit and balance above split that amount.
      </p>
    </section>
  )
}
