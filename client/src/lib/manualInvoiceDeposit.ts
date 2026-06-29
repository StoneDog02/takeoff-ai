/** Terms anchored to invoice sent date (manual deposit schedules). */
export type ManualInvoiceDepositDueTerm =
  | 'on_invoice_sent'
  | 'net_15_from_sent'
  | 'net_30_from_sent'
  | 'net_45_from_sent'
  | 'net_60_from_sent'
  | 'net_90_from_sent'

/** Balance can use date-based terms or stay on retainer until the contractor requests payment. */
export type ManualInvoiceBalanceDueTerm = ManualInvoiceDepositDueTerm | 'on_request'

export const MANUAL_INVOICE_DEPOSIT_DUE_TERM_OPTIONS: { value: ManualInvoiceDepositDueTerm; label: string }[] = [
  { value: 'on_invoice_sent', label: 'Upon receipt (when invoice is sent)' },
  { value: 'net_15_from_sent', label: '15 days from invoice date' },
  { value: 'net_30_from_sent', label: '30 days from invoice date' },
  { value: 'net_45_from_sent', label: '45 days from invoice date' },
  { value: 'net_60_from_sent', label: '60 days from invoice date' },
  { value: 'net_90_from_sent', label: '90 days from invoice date' },
]

export const MANUAL_INVOICE_BALANCE_DUE_TERM_OPTIONS: { value: ManualInvoiceBalanceDueTerm; label: string }[] = [
  { value: 'on_request', label: 'When I request payment (retainer — recommended)' },
  ...MANUAL_INVOICE_DEPOSIT_DUE_TERM_OPTIONS,
]

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type ManualDepositScheduleRow = {
  milestone_id: string
  label: string
  amount: number
  mode: 'on_completion'
  completionTerms: ManualInvoiceDepositDueTerm | ManualInvoiceBalanceDueTerm
}

export function buildManualDepositScheduleRows(
  total: number,
  depositPct: number,
  depositTerms: ManualInvoiceDepositDueTerm,
  balanceTerms: ManualInvoiceBalanceDueTerm
): ManualDepositScheduleRow[] {
  const pct = Math.min(100, Math.max(0, depositPct))
  if (pct <= 0 || pct >= 100) return []
  const t = round2(Math.max(0, total))
  const depositAmt = round2(t * (pct / 100))
  const balanceAmt = round2(t - depositAmt)
  if (depositAmt <= 0 || balanceAmt <= 0) return []
  return [
    {
      milestone_id: 'manual-deposit',
      label: `Deposit (${pct}%)`,
      amount: depositAmt,
      mode: 'on_completion',
      completionTerms: depositTerms,
    },
    {
      milestone_id: 'manual-balance',
      label: 'Balance',
      amount: balanceAmt,
      mode: 'on_completion',
      completionTerms: balanceTerms,
    },
  ]
}

export function manualDepositTermLabel(term: ManualInvoiceDepositDueTerm): string {
  return MANUAL_INVOICE_DEPOSIT_DUE_TERM_OPTIONS.find((o) => o.value === term)?.label ?? term
}

export function manualBalanceTermLabel(term: ManualInvoiceBalanceDueTerm): string {
  return MANUAL_INVOICE_BALANCE_DUE_TERM_OPTIONS.find((o) => o.value === term)?.label ?? term
}
