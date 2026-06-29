import type { Invoice } from '@/types/global'
import type { InvoicePortalScheduleRow } from '@/api/client'
import {
  manualBalanceTermLabel,
  manualDepositTermLabel,
  type ManualInvoiceBalanceDueTerm,
  type ManualInvoiceDepositDueTerm,
} from '@/lib/manualInvoiceDeposit'

export type InvoiceDepositDisplay = {
  depositPct: number
  depositAmount: number
  balanceAmount: number
  totalAmount: number
  depositDueLabel: string
  balanceDueLabel: string
  isRetainerBalance: boolean
}

function parseScheduleSnapshot(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown
      return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return null
}

function depositPctFromLabel(label: string, snap: Record<string, unknown>): number {
  const fromMeta = snap.deposit
  if (fromMeta && typeof fromMeta === 'object' && !Array.isArray(fromMeta)) {
    const pct = Number((fromMeta as Record<string, unknown>).pct)
    if (Number.isFinite(pct) && pct > 0) return pct
  }
  const m = String(label || '').match(/(\d+(?:\.\d+)?)\s*%/)
  if (m) return parseFloat(m[1])
  return 0
}

function dueLabelFromSnap(
  snap: Record<string, unknown>,
  key: 'deposit_due' | 'balance_due',
  fallback: string
): string {
  const dep = snap.deposit
  if (dep && typeof dep === 'object' && !Array.isArray(dep)) {
    const term = (dep as Record<string, unknown>)[key]
    if (term === 'on_request') return manualBalanceTermLabel('on_request')
    if (typeof term === 'string' && term.startsWith('net_')) {
      return key === 'balance_due'
        ? manualBalanceTermLabel(term as ManualInvoiceBalanceDueTerm)
        : manualDepositTermLabel(term as ManualInvoiceDepositDueTerm)
    }
    if (term === 'on_invoice_sent') return manualDepositTermLabel('on_invoice_sent')
  }
  return fallback
}

/** Deposit split stored on a manual invoice (`schedule_snapshot.rows`). */
export function getInvoiceDepositDisplay(
  invoice: Pick<Invoice, 'schedule_snapshot' | 'total_amount'> | null | undefined
): InvoiceDepositDisplay | null {
  const snap = parseScheduleSnapshot(invoice?.schedule_snapshot)
  if (!snap) return null
  const rows = Array.isArray(snap.rows) ? snap.rows : []
  const depositRow = rows.find((r) => String((r as Record<string, unknown>).milestone_id) === 'manual-deposit') as
    | Record<string, unknown>
    | undefined
  const balanceRow = rows.find((r) => String((r as Record<string, unknown>).milestone_id) === 'manual-balance') as
    | Record<string, unknown>
    | undefined
  if (!depositRow || !balanceRow) return null

  const depositAmount = Number(depositRow.amount) || 0
  const balanceAmount = Number(balanceRow.amount) || 0
  if (depositAmount <= 0 || balanceAmount <= 0) return null

  const depositPct = depositPctFromLabel(String(depositRow.label ?? ''), snap)
  const balanceTerms = String(balanceRow.completionTerms ?? balanceRow.completion_terms ?? '')

  return {
    depositPct: depositPct > 0 ? depositPct : Math.round((depositAmount / (depositAmount + balanceAmount)) * 100),
    depositAmount,
    balanceAmount,
    totalAmount: Number(invoice?.total_amount) || depositAmount + balanceAmount,
    depositDueLabel: dueLabelFromSnap(snap, 'deposit_due', 'Upon receipt'),
    balanceDueLabel: dueLabelFromSnap(
      snap,
      'balance_due',
      balanceTerms === 'on_request' ? manualBalanceTermLabel('on_request') : 'Per schedule'
    ),
    isRetainerBalance: balanceTerms === 'on_request',
  }
}

export function depositDisplayFromPortalRows(
  scheduleRows: InvoicePortalScheduleRow[] | undefined,
  totalAmount: number
): InvoiceDepositDisplay | null {
  if (!scheduleRows?.length) return null
  const depositRow = scheduleRows.find((r) => r.milestone_id === 'manual-deposit')
  const balanceRow = scheduleRows.find((r) => r.milestone_id === 'manual-balance')
  if (!depositRow || !balanceRow) return null
  const depositPct = depositPctFromLabel(depositRow.label, {})
  return {
    depositPct:
      depositPct > 0
        ? depositPct
        : Math.round((depositRow.amount / (depositRow.amount + balanceRow.amount)) * 100),
    depositAmount: depositRow.amount,
    balanceAmount: balanceRow.amount,
    totalAmount: totalAmount,
    depositDueLabel: depositRow.due_display,
    balanceDueLabel: balanceRow.due_display,
    isRetainerBalance: balanceRow.completion_terms === 'on_request',
  }
}

export function buildDepositDisplayPreview(
  total: number,
  depositPct: number,
  depositDue: ManualInvoiceDepositDueTerm,
  balanceDue: ManualInvoiceBalanceDueTerm,
  depositAmount: number,
  balanceAmount: number
): InvoiceDepositDisplay {
  return {
    depositPct,
    depositAmount,
    balanceAmount,
    totalAmount: total,
    depositDueLabel: manualDepositTermLabel(depositDue),
    balanceDueLabel: manualBalanceTermLabel(balanceDue),
    isRetainerBalance: balanceDue === 'on_request',
  }
}
