/**
 * Mock data for the Revenue page. Use ?demo=1 on /financials to load this data
 * or it loads automatically when the API fails (fallback).
 */
import type { Job, Invoice, JobSpendSummary, JobExpense } from '@/types/global'
import type { ExpenseCategory } from '@/types/global'
import { dayjs } from '@/lib/date'

const JOB_IDS = {
  riverside: 'mock-rev-riverside',
  parkAve: 'mock-rev-parkave',
  savannah: 'mock-rev-savannah',
  lakefront: 'mock-rev-lakefront',
  downtown: 'mock-rev-downtown',
} as const

/** Jobs (projects) for revenue demo */
export const MOCK_REVENUE_JOBS: Job[] = [
  { id: JOB_IDS.riverside, name: 'Riverside Custom Home', client_name: 'Chen Family', created_at: '2024-06-01T00:00:00Z' },
  { id: JOB_IDS.parkAve, name: 'Park Ave Remodel', client_name: 'R. Blackwood', created_at: '2024-08-15T00:00:00Z' },
  { id: JOB_IDS.savannah, name: 'Savannah Nguyen Kitchen', client_name: 'S. Nguyen', created_at: '2024-09-01T00:00:00Z' },
  { id: JOB_IDS.lakefront, name: 'Lakefront Addition', client_name: 'Torres Family', created_at: '2024-07-01T00:00:00Z' },
  { id: JOB_IDS.downtown, name: 'Downtown Loft', client_name: 'M. Yarnell', created_at: '2024-10-01T00:00:00Z' },
]

/** Realistic monthly revenue per job (12 months). YTD totals ~$387k, ~$88.5k, ~$54.5k, ~$61.4k, ~$41k. */
const MONTHLY_REVENUE_BY_JOB: Record<string, number[]> = {
  [JOB_IDS.riverside]: [28400, 31800, 35800, 38500, 42100, 44600, 35200, 29800, 31400, 38900, 46200, 45300],
  [JOB_IDS.parkAve]: [18200, 21500, 22800, 24100, 19800, 18500, 17200, 18900, 20500, 22200, 23800, 18500],
  [JOB_IDS.savannah]: [11200, 12800, 14200, 13100, 11800, 13500, 14900, 13200, 12100, 13800, 12900, 13400],
  [JOB_IDS.lakefront]: [14800, 16200, 17800, 16500, 15200, 16800, 15500, 14200, 15800, 17200, 16100, 15700],
  [JOB_IDS.downtown]: [8900, 10200, 11800, 10500, 9200, 10800, 11200, 9600, 10400, 11100, 10700, 10900],
}

function buildInvoices(): Invoice[] {
  const list: Invoice[] = []
  let id = 0
  const year = dayjs().year()
  for (const [jobId, amounts] of Object.entries(MONTHLY_REVENUE_BY_JOB)) {
    amounts.forEach((amount, monthIndex) => {
      if (amount <= 0) return
      const month = monthIndex + 1
      const paidAt = `${year}-${String(month).padStart(2, '0')}-01T14:00:00Z`
      list.push({
        id: `mock-inv-${id++}`,
        estimate_id: `mock-est-${jobId}-${month}`,
        job_id: jobId,
        status: 'paid',
        total_amount: amount,
        recipient_emails: ['client@example.com'],
        created_at: `${year}-${String(month).padStart(2, '0')}-01T10:00:00Z`,
        updated_at: paidAt,
        paid_at: paidAt,
        due_date: `${year}-${String(month).padStart(2, '0')}-28`,
      })
    })
  }
  return list
}

export const MOCK_REVENUE_INVOICES: Invoice[] = buildInvoices()

/** Spend per job (cost). Totals match sum of MONTHLY_EXPENSES_BY_JOB; categories give ~21% margin. */
export const MOCK_REVENUE_SPEND_SUMMARIES: JobSpendSummary[] = [
  { job_id: JOB_IDS.riverside, total_spend: 308800, by_category: { materials: 142000, labor: 112400, equipment: 32800, misc: 21600 } },
  { job_id: JOB_IDS.parkAve, total_spend: 72400, by_category: { materials: 34800, labor: 28600, equipment: 5200, misc: 3800 } },
  { job_id: JOB_IDS.savannah, total_spend: 43510, by_category: { materials: 20900, labor: 17500, equipment: 2900, misc: 2210 } },
  { job_id: JOB_IDS.lakefront, total_spend: 47980, by_category: { materials: 23100, labor: 18000, equipment: 4800, misc: 2080 } },
  { job_id: JOB_IDS.downtown, total_spend: 24000, by_category: { materials: 12100, labor: 8900, equipment: 2000, misc: 1000 } },
]

/** Monthly expense amounts per job (12 months) that sum to total_spend. Used to build JobExpense[] with created_at. */
const MONTHLY_EXPENSES_BY_JOB: Record<string, number[]> = {
  [JOB_IDS.riverside]: [22100, 24800, 27200, 29400, 32600, 34800, 27100, 22900, 24600, 30100, 36400, 36800],
  [JOB_IDS.parkAve]: [5900, 6200, 6500, 6100, 5800, 6000, 5900, 6100, 5900, 6200, 6000, 5800],
  [JOB_IDS.savannah]: [3200, 3600, 3800, 3500, 3700, 3900, 3600, 3500, 3700, 3600, 3620, 3590],
  [JOB_IDS.lakefront]: [3800, 4100, 4300, 4000, 3900, 4100, 3900, 4000, 3980, 4010, 3990, 4020],
  [JOB_IDS.downtown]: [1900, 2000, 2100, 1950, 2050, 1980, 1990, 2010, 2000, 2020, 1980, 2020],
}

function buildJobExpensesForJob(jobId: string): JobExpense[] {
  const amounts = MONTHLY_EXPENSES_BY_JOB[jobId]
  if (!amounts) return []
  const categories: ExpenseCategory[] = ['materials', 'labor', 'equipment', 'misc']
  const list: JobExpense[] = []
  let id = 0
  const year = dayjs().year()
  for (let month = 1; month <= 12; month++) {
    const total = amounts[month - 1] ?? 0
    if (total <= 0) continue
    const parts = [0.42, 0.35, 0.12, 0.11].map((p) => Math.round(total * p))
    const diff = total - parts.reduce((a, b) => a + b, 0)
    if (diff !== 0) parts[0] += diff
    parts.forEach((amount, i) => {
      if (amount <= 0) return
      list.push({
        id: `mock-exp-${jobId}-${id++}`,
        job_id: jobId,
        amount,
        category: categories[i],
        description: `${categories[i]} – ${month}/${year}`,
        created_at: `${year}-${String(month).padStart(2, '0')}-${Math.min(10 + i * 5, 28)}T09:00:00Z`,
      })
    })
  }
  return list
}

const ALL_JOB_EXPENSES: JobExpense[] = [
  ...buildJobExpensesForJob(JOB_IDS.riverside),
  ...buildJobExpensesForJob(JOB_IDS.parkAve),
  ...buildJobExpensesForJob(JOB_IDS.savannah),
  ...buildJobExpensesForJob(JOB_IDS.lakefront),
  ...buildJobExpensesForJob(JOB_IDS.downtown),
]

export const MOCK_REVENUE_JOB_EXPENSES: Record<string, JobExpense[]> = {
  [JOB_IDS.riverside]: buildJobExpensesForJob(JOB_IDS.riverside),
  [JOB_IDS.parkAve]: buildJobExpensesForJob(JOB_IDS.parkAve),
  [JOB_IDS.savannah]: buildJobExpensesForJob(JOB_IDS.savannah),
  [JOB_IDS.lakefront]: buildJobExpensesForJob(JOB_IDS.lakefront),
  [JOB_IDS.downtown]: buildJobExpensesForJob(JOB_IDS.downtown),
}

/** Check if we should use mock revenue data (e.g. ?demo=1) */
export function useMockRevenue(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('demo') === '1'
}

/** Load all mock data. When jobId is set, returns that job's expenses only; otherwise all jobs' expenses so trend chart has revenue + expenses + profit for "All jobs". */
export function getMockRevenueData(jobId?: string): {
  jobs: Job[]
  invoices: Invoice[]
  spendSummaries: JobSpendSummary[]
  jobExpenses: JobExpense[]
} {
  return {
    jobs: MOCK_REVENUE_JOBS,
    invoices: MOCK_REVENUE_INVOICES,
    spendSummaries: MOCK_REVENUE_SPEND_SUMMARIES,
    jobExpenses: jobId && MOCK_REVENUE_JOB_EXPENSES[jobId] ? MOCK_REVENUE_JOB_EXPENSES[jobId] : ALL_JOB_EXPENSES,
  }
}
