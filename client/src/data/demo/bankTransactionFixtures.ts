/**
 * Mock bank account + transactions for public demo (Financials → Transactions & Reports).
 * Persisted in sessionStorage so tagging edits flow to Reports during the demo session.
 */
import { dayjs } from '@/lib/date'
import { MOCK_PROJECTS } from '@/data/mockProjectsData'
import { DEMO_CONTRACTOR_USER_UUID } from '@/data/demo/demoIds'

export const DEMO_BANK_SESSION_KEY = 'takeoff-demo-bank-tx-v1'
/** Stripe Financial Connections–style id (masked as ••••1001 in UI). */
export const DEMO_BANK_ACCOUNT_ID = 'fca_1DemoBusinessChecking'

export interface DemoBankTransactionRow {
  id: string
  user_id: string
  account_id: string
  merchant_name: string
  amount: number
  is_debit: boolean
  transaction_date: string
  job_id: string | null
  expense_type: string | null
  is_payroll: boolean
  receipt_url: string | null
  notes: string | null
  stripe_transaction_id: string | null
  stripe_status: string | null
  created_at: string
}

function d(daysAgo: number): string {
  return dayjs().subtract(daysAgo, 'day').format('YYYY-MM-DD')
}

function buildSeedRows(): DemoBankTransactionRow[] {
  const uid = DEMO_CONTRACTOR_USER_UUID
  const acct = DEMO_BANK_ACCOUNT_ID
  const now = dayjs().toISOString()
  const rows: Omit<DemoBankTransactionRow, 'id' | 'created_at'>[] = [
    {
      user_id: uid,
      account_id: acct,
      merchant_name: 'Home Depot #4421',
      amount: 847.23,
      is_debit: true,
      transaction_date: d(1),
      job_id: null,
      expense_type: null,
      is_payroll: false,
      receipt_url: null,
      notes: null,
      stripe_transaction_id: 'txn_demo_001',
      stripe_status: 'posted',
    },
    {
      user_id: uid,
      account_id: acct,
      merchant_name: 'Ferguson Plumbing Supply',
      amount: 1240.5,
      is_debit: true,
      transaction_date: d(2),
      job_id: 'demo',
      expense_type: 'Materials',
      is_payroll: false,
      receipt_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      notes: 'Rough-in valves and PEX',
      stripe_transaction_id: 'txn_demo_002',
      stripe_status: 'posted',
    },
    {
      user_id: uid,
      account_id: acct,
      merchant_name: 'Amazon Business',
      amount: 186.4,
      is_debit: true,
      transaction_date: d(0),
      job_id: null,
      expense_type: null,
      is_payroll: false,
      receipt_url: null,
      notes: null,
      stripe_transaction_id: 'txn_demo_003',
      stripe_status: 'posted',
    },
    {
      user_id: uid,
      account_id: acct,
      merchant_name: 'ADP Payroll',
      amount: 8420.0,
      is_debit: true,
      transaction_date: d(4),
      job_id: 'demo',
      expense_type: 'Payroll',
      is_payroll: true,
      receipt_url: null,
      notes: 'Biweekly payroll — field + office',
      stripe_transaction_id: 'txn_demo_004',
      stripe_status: 'posted',
    },
    {
      user_id: uid,
      account_id: acct,
      merchant_name: 'Sunbelt Rentals',
      amount: 412.75,
      is_debit: true,
      transaction_date: d(3),
      job_id: 'mock-bath',
      expense_type: 'Equipment',
      is_payroll: false,
      receipt_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      notes: 'Tile saw + generator weekend',
      stripe_transaction_id: 'txn_demo_005',
      stripe_status: 'posted',
    },
    {
      user_id: uid,
      account_id: acct,
      merchant_name: 'Customer deposit — ACH return',
      amount: 250.0,
      is_debit: false,
      transaction_date: d(5),
      job_id: null,
      expense_type: null,
      is_payroll: false,
      receipt_url: null,
      notes: 'NSF reversal',
      stripe_transaction_id: 'txn_demo_006',
      stripe_status: 'posted',
    },
    {
      user_id: uid,
      account_id: acct,
      merchant_name: 'Local Lumber & Millwork',
      amount: 2180.0,
      is_debit: true,
      transaction_date: d(6),
      job_id: 'mock-addition',
      expense_type: 'Materials',
      is_payroll: false,
      receipt_url: null,
      notes: 'LVL + joist hangers',
      stripe_transaction_id: 'txn_demo_007',
      stripe_status: 'posted',
    },
    {
      user_id: uid,
      account_id: acct,
      merchant_name: 'Shell Fleet',
      amount: 94.12,
      is_debit: true,
      transaction_date: d(2),
      job_id: null,
      expense_type: null,
      is_payroll: false,
      receipt_url: null,
      notes: null,
      stripe_transaction_id: 'txn_demo_008',
      stripe_status: 'posted',
    },
    {
      user_id: uid,
      account_id: acct,
      merchant_name: 'Office Depot',
      amount: 163.89,
      is_debit: true,
      transaction_date: d(8),
      job_id: 'mock-office',
      expense_type: 'Overhead',
      is_payroll: false,
      receipt_url: 'https://example.com',
      notes: 'Site office supplies',
      stripe_transaction_id: 'txn_demo_009',
      stripe_status: 'posted',
    },
    {
      user_id: uid,
      account_id: acct,
      merchant_name: 'ABC Electric Supply',
      amount: 675.0,
      is_debit: true,
      transaction_date: d(7),
      job_id: null,
      expense_type: null,
      is_payroll: false,
      receipt_url: null,
      notes: null,
      stripe_transaction_id: 'txn_demo_010',
      stripe_status: 'posted',
    },
  ]

  const ids = [
    'c1111111-1111-4111-8111-111111111101',
    'c1111111-1111-4111-8111-111111111102',
    'c1111111-1111-4111-8111-111111111103',
    'c1111111-1111-4111-8111-111111111104',
    'c1111111-1111-4111-8111-111111111105',
    'c1111111-1111-4111-8111-111111111106',
    'c1111111-1111-4111-8111-111111111107',
    'c1111111-1111-4111-8111-111111111108',
    'c1111111-1111-4111-8111-111111111109',
    'c1111111-1111-4111-8111-11111111110a',
  ]
  return rows.map((r, i) => ({
    ...r,
    id: ids[i]!,
    created_at: now,
  }))
}

export function getDemoTransactionJobs(): { id: string; name: string }[] {
  return MOCK_PROJECTS.map((p) => ({ id: p.id, name: p.name }))
}

/** Static invoice totals for Reports (invoiced column); aligns with financials demo jobs. */
export function getDemoInvoiceRowsForReports(): { job_id: string; total_amount: number }[] {
  return [
    { job_id: 'demo', total_amount: 48500 },
    { job_id: 'mock-bath', total_amount: 14200 },
    { job_id: 'mock-addition', total_amount: 62800 },
    { job_id: 'mock-office', total_amount: 22000 },
    { job_id: 'mock-roof', total_amount: 19600 },
  ]
}

export function getInitialDemoBankRows(): DemoBankTransactionRow[] {
  return buildSeedRows().map((r) => ({ ...r }))
}

function parseStored(): DemoBankTransactionRow[] | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(DEMO_BANK_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoBankTransactionRow[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function loadDemoBankRowsFromSession(): DemoBankTransactionRow[] {
  const stored = parseStored()
  if (stored?.length) return stored.map((r) => ({ ...r }))
  const fresh = getInitialDemoBankRows()
  persistDemoBankRows(fresh)
  return fresh
}

export function persistDemoBankRows(rows: DemoBankTransactionRow[]): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(DEMO_BANK_SESSION_KEY, JSON.stringify(rows))
  } catch {
    // ignore
  }
}

export function clearDemoBankTransactionSession(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(DEMO_BANK_SESSION_KEY)
  } catch {
    // ignore
  }
}
