import type { Invoice } from '@/types/global'

export type ManualInvoiceScheduleSnapshot = {
  rows?: Array<{
    milestone_id?: string
    completionTerms?: string
    completion_terms?: string
    amount?: number
  }>
  paid_milestone_ids?: string[]
  milestone_ready_for_payment?: string[]
  deposit?: { balance_due?: string }
}

export function parseInvoiceScheduleSnapshot(invoice: Invoice | null): ManualInvoiceScheduleSnapshot | null {
  const raw = invoice?.schedule_snapshot
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as ManualInvoiceScheduleSnapshot
}

/** Balance is on a retainer — due only when the contractor requests payment. */
export function isRetainerBalanceInvoice(invoice: Invoice | null): boolean {
  const snap = parseInvoiceScheduleSnapshot(invoice)
  if (!snap?.rows?.length) return false
  const balanceRow = snap.rows.find((r) => String(r.milestone_id) === 'manual-balance')
  if (!balanceRow) return false
  const terms = balanceRow.completionTerms || balanceRow.completion_terms
  return terms === 'on_request'
}

export type RetainerBalanceUiState = {
  depositPaid: boolean
  balanceReleased: boolean
  balancePaid: boolean
  balanceAmount: number
  canRequestBalance: boolean
}

export function retainerBalanceUiState(invoice: Invoice | null): RetainerBalanceUiState | null {
  if (!isRetainerBalanceInvoice(invoice)) return null
  const snap = parseInvoiceScheduleSnapshot(invoice)!
  const paid = (snap.paid_milestone_ids ?? []).map(String)
  const ready = (snap.milestone_ready_for_payment ?? []).map(String)
  const balanceRow = snap.rows!.find((r) => String(r.milestone_id) === 'manual-balance')
  const balanceAmount = Number(balanceRow?.amount) || 0
  const depositPaid = paid.includes('manual-deposit')
  const balancePaid = paid.includes('manual-balance')
  const balanceReleased = ready.includes('manual-balance')
  const st = String(invoice?.status ?? '').toLowerCase()
  const sent = st === 'sent' || st === 'viewed' || st === 'overdue'
  const canRequestBalance = sent && depositPaid && !balanceReleased && !balancePaid
  return { depositPaid, balanceReleased, balancePaid, balanceAmount, canRequestBalance }
}
