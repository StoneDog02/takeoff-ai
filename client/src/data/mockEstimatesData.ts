/**
 * Mock data for Estimates & Invoices so you can see the full UI without a backend.
 * Set USE_MOCK_ESTIMATES to false to use the real API again.
 */
import type {
  Job,
  Estimate,
  EstimateLineItem,
  Invoice,
  CustomProduct,
  JobExpense,
  JobSpendSummary,
  PipelineItem,
  JobReceiptsMeta,
} from '@/types/global'
import type { EstimateWithLines } from '@/api/estimates'

export const USE_MOCK_ESTIMATES = true

const past = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()

// ——— Jobs (projects as jobs) ———
export const MOCK_JOBS: Job[] = [
  { id: 'job-kitchen', name: 'Kitchen Remodel – 123 Main St', created_at: past(60) },
  { id: 'job-bath', name: 'Master Bath Renovation – 442 Oak St', created_at: past(45) },
  { id: 'job-office', name: 'Office Build-Out – Suite 200', created_at: past(30) },
  { id: 'job-addition', name: 'Second-Story Addition – 88 Pine Rd', created_at: past(90) },
  { id: 'job-deck', name: 'Deck & Patio – 55 Maple Dr', created_at: past(120) },
]

// ——— Custom Products & Services ———
export const MOCK_CUSTOM_PRODUCTS: CustomProduct[] = [
  {
    id: 'prod-labor',
    user_id: 'user-1',
    name: 'Labor – General',
    description: 'Hourly labor, skilled',
    unit: 'hr',
    default_unit_price: 85,
    item_type: 'service',
    created_at: past(100),
  },
  {
    id: 'prod-demolition',
    user_id: 'user-1',
    name: 'Demolition',
    description: 'Demo and haul-away',
    unit: 'hr',
    default_unit_price: 65,
    item_type: 'service',
    created_at: past(95),
  },
  {
    id: 'prod-cabinets',
    user_id: 'user-1',
    name: 'Custom cabinets',
    description: 'Framed, paint-grade',
    unit: 'lf',
    default_unit_price: 320,
    item_type: 'product',
    created_at: past(90),
  },
  {
    id: 'prod-counter',
    user_id: 'user-1',
    name: 'Quartz countertop',
    description: 'Installed, template to finish',
    unit: 'sf',
    default_unit_price: 95,
    item_type: 'product',
    created_at: past(85),
  },
  {
    id: 'prod-tile',
    user_id: 'user-1',
    name: 'Tile install',
    description: 'Floor or wall, materials extra',
    unit: 'sf',
    default_unit_price: 18,
    item_type: 'service',
    created_at: past(80),
  },
  {
    id: 'prod-plumb',
    user_id: 'user-1',
    name: 'Plumbing – rough-in',
    description: 'Per fixture',
    unit: 'ea',
    default_unit_price: 450,
    item_type: 'service',
    created_at: past(75),
  },
]

// ——— Line items for estimates (for detail view) ———
const MOCK_LINE_ITEMS: Record<string, EstimateLineItem[]> = {
  'est-1': [
    { id: 'li-1a', estimate_id: 'est-1', product_id: 'prod-demolition', description: 'Demolition', quantity: 16, unit: 'hr', unit_price: 65, total: 1040, section: 'Demolition' },
    { id: 'li-1b', estimate_id: 'est-1', product_id: 'prod-cabinets', description: 'Custom cabinets', quantity: 24, unit: 'lf', unit_price: 320, total: 7680, section: 'Cabinets' },
    { id: 'li-1c', estimate_id: 'est-1', product_id: 'prod-counter', description: 'Quartz countertop', quantity: 45, unit: 'sf', unit_price: 95, total: 4275, section: 'Counters' },
    { id: 'li-1d', estimate_id: 'est-1', product_id: 'prod-tile', description: 'Tile install', quantity: 80, unit: 'sf', unit_price: 18, total: 1440, section: 'Flooring' },
    { id: 'li-1e', estimate_id: 'est-1', product_id: 'prod-labor', description: 'Labor – General', quantity: 40, unit: 'hr', unit_price: 85, total: 3400, section: null },
  ],
  'est-2': [
    { id: 'li-2a', estimate_id: 'est-2', product_id: 'prod-plumb', description: 'Plumbing – rough-in', quantity: 4, unit: 'ea', unit_price: 450, total: 1800, section: 'Rough-in' },
    { id: 'li-2b', estimate_id: 'est-2', product_id: 'prod-tile', description: 'Tile install', quantity: 120, unit: 'sf', unit_price: 18, total: 2160, section: 'Tile' },
    { id: 'li-2c', estimate_id: 'est-2', product_id: null, description: 'Vanity and mirror', quantity: 1, unit: 'ea', unit_price: 1200, total: 1200, section: null },
  ],
  'est-3': [
    { id: 'li-3a', estimate_id: 'est-3', product_id: 'prod-labor', description: 'Labor – General', quantity: 80, unit: 'hr', unit_price: 85, total: 6800, section: null },
    { id: 'li-3b', estimate_id: 'est-3', product_id: null, description: 'Framing and drywall', quantity: 1, unit: 'lump', unit_price: 4500, total: 4500, section: null },
  ],
  'est-4': [
    { id: 'li-4a', estimate_id: 'est-4', product_id: 'prod-demolition', description: 'Demolition', quantity: 8, unit: 'hr', unit_price: 65, total: 520, section: 'Demolition' },
    { id: 'li-4b', estimate_id: 'est-4', product_id: 'prod-labor', description: 'Labor – General', quantity: 24, unit: 'hr', unit_price: 85, total: 2040, section: null },
  ],
  'est-5': [
    { id: 'li-5a', estimate_id: 'est-5', product_id: null, description: 'Design consultation', quantity: 2, unit: 'hr', unit_price: 150, total: 300, section: null },
  ],
}

// ——— Estimates ———
export const MOCK_ESTIMATES: Estimate[] = [
  {
    id: 'est-1',
    job_id: 'job-kitchen',
    title: 'Kitchen remodel – full',
    status: 'accepted',
    total_amount: 17835,
    invoiced_amount: 8000,
    recipient_emails: ['client@example.com'],
    created_at: past(25),
    updated_at: past(2),
    sent_at: past(20),
  },
  {
    id: 'est-2',
    job_id: 'job-bath',
    title: 'Master bath – tile and fixtures',
    status: 'sent',
    total_amount: 5160,
    invoiced_amount: 0,
    recipient_emails: ['homeowner@example.com'],
    created_at: past(14),
    updated_at: past(5),
    sent_at: past(3),
  },
  {
    id: 'est-3',
    job_id: 'job-addition',
    title: 'Second-story addition – Phase 1',
    status: 'accepted',
    total_amount: 11300,
    invoiced_amount: 11300,
    recipient_emails: ['builder@example.com'],
    created_at: past(40),
    updated_at: past(10),
    sent_at: past(35),
  },
  {
    id: 'est-4',
    job_id: 'job-deck',
    title: 'Deck demo and prep',
    status: 'draft',
    total_amount: 2560,
    recipient_emails: [],
    created_at: past(5),
    updated_at: past(1),
  },
  {
    id: 'est-5',
    job_id: 'job-office',
    title: 'Office design consult',
    status: 'declined',
    total_amount: 300,
    recipient_emails: ['tenant@example.com'],
    created_at: past(60),
    updated_at: past(55),
    sent_at: past(58),
  },
]

// ——— Invoices ———
export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    estimate_id: 'est-1',
    job_id: 'job-kitchen',
    status: 'paid',
    total_amount: 8000,
    recipient_emails: ['client@example.com'],
    created_at: past(15),
    updated_at: past(8),
    sent_at: past(14),
    paid_at: past(8),
    due_date: past(10).slice(0, 10),
  },
  {
    id: 'inv-2',
    estimate_id: 'est-3',
    job_id: 'job-addition',
    status: 'paid',
    total_amount: 11300,
    recipient_emails: ['builder@example.com'],
    created_at: past(30),
    updated_at: past(12),
    sent_at: past(28),
    paid_at: past(12),
    due_date: past(20).slice(0, 10),
  },
  {
    id: 'inv-3',
    estimate_id: 'est-1',
    job_id: 'job-kitchen',
    status: 'sent',
    total_amount: 5000,
    recipient_emails: ['client@example.com'],
    created_at: past(4),
    updated_at: past(2),
    sent_at: past(2),
    due_date: past(30).slice(0, 10),
  },
  {
    id: 'inv-4',
    estimate_id: 'est-1',
    job_id: 'job-kitchen',
    status: 'overdue',
    total_amount: 2835,
    recipient_emails: ['client@example.com'],
    created_at: past(35),
    updated_at: past(32),
    sent_at: past(33),
    due_date: past(25).slice(0, 10),
  },
]

// ——— Job expenses (receipts & spend) ———
export const MOCK_JOB_EXPENSES: JobExpense[] = [
  { id: 'exp-1', job_id: 'job-kitchen', amount: 420, category: 'materials', description: 'Lumber and fasteners', created_at: past(12), billable: true, vendor: 'Home Depot' },
  { id: 'exp-2', job_id: 'job-kitchen', amount: 185, category: 'subs', description: 'Sub – electrician', created_at: past(10), billable: false, vendor: 'ABC Electric' },
  { id: 'exp-3', job_id: 'job-kitchen', amount: 90, category: 'equipment', description: 'Tool rental', created_at: past(8), billable: false, vendor: 'Sunbelt Rentals' },
  { id: 'exp-4', job_id: 'job-kitchen', amount: 340, category: 'materials', description: 'Cabinet hardware', created_at: past(6), billable: true, vendor: "Lowe's" },
  { id: 'exp-5', job_id: 'job-kitchen', amount: 680, category: 'labor', description: 'Framing crew – day 1', created_at: past(5), billable: true, vendor: 'Internal' },
  { id: 'exp-6', job_id: 'job-kitchen', amount: 680, category: 'labor', description: 'Framing crew – day 2', created_at: past(4), billable: true, vendor: 'Internal' },
  { id: 'exp-7', job_id: 'job-kitchen', amount: 890, category: 'materials', description: 'Drywall sheets', created_at: past(3), billable: true, vendor: '84 Lumber' },
  { id: 'exp-8', job_id: 'job-kitchen', amount: 210, category: 'materials', description: 'Paint & primer', created_at: past(2), billable: true, vendor: 'Sherwin-Williams' },
  { id: 'exp-9', job_id: 'job-bath', amount: 620, category: 'materials', description: 'Tile and thinset', created_at: past(6) },
  { id: 'exp-10', job_id: 'job-bath', amount: 340, category: 'materials', description: 'Vanity and faucet', created_at: past(4) },
  { id: 'exp-11', job_id: 'job-addition', amount: 1200, category: 'materials', description: 'Framing package', created_at: past(25) },
  { id: 'exp-12', job_id: 'job-addition', amount: 450, category: 'labor', description: 'Crane day', created_at: past(22) },
]

// ——— Job budget & progress (for Budget vs Actual, change-order alert) ———
export const MOCK_JOB_RECEIPTS_META: Record<string, JobReceiptsMeta> = {
  'job-kitchen': {
    estimateTotal: 17835,
    pctComplete: 60,
    budget: {
      Labor: { allocated: 5200, color: 'var(--est-amber)', bg: 'var(--est-amber-light)' },
      Materials: { allocated: 9800, color: 'var(--blue)', bg: 'var(--blue-glow)' },
      Equipment: { allocated: 1200, color: 'var(--orange)', bg: 'rgba(199, 107, 26, 0.12)' },
      Subs: { allocated: 1635, color: 'var(--red-light)', bg: 'var(--red-glow-soft)' },
    },
  },
  'job-deck': {
    estimateTotal: 2560,
    pctComplete: 20,
    budget: {
      Labor: { allocated: 800, color: 'var(--est-amber)', bg: 'var(--est-amber-light)' },
      Materials: { allocated: 1500, color: 'var(--blue)', bg: 'var(--blue-glow)' },
      Equipment: { allocated: 260, color: 'var(--orange)', bg: 'rgba(199, 107, 26, 0.12)' },
    },
  },
}

export const MOCK_JOB_SPEND_SUMMARIES: JobSpendSummary[] = [
  { job_id: 'job-kitchen', total_spend: 695, by_category: { materials: 420, labor: 185, equipment: 90 } },
  { job_id: 'job-bath', total_spend: 960, by_category: { materials: 960 } },
  { job_id: 'job-addition', total_spend: 1650, by_category: { materials: 1200, labor: 450 } },
]

// ——— Helpers for detail views ———
export function getMockEstimateWithLines(id: string): EstimateWithLines | null {
  const est = MOCK_ESTIMATES.find((e) => e.id === id)
  if (!est) return null
  const line_items = MOCK_LINE_ITEMS[id] ?? []
  return { ...est, line_items }
}

export function getMockInvoice(id: string): Invoice | null {
  return MOCK_INVOICES.find((i) => i.id === id) ?? null
}

export function getMockJobExpensesByJob(jobId: string): JobExpense[] {
  return MOCK_JOB_EXPENSES.filter((e) => e.job_id === jobId)
}

export function getMockSpendSummaryByJob(jobId: string): JobSpendSummary | null {
  return MOCK_JOB_SPEND_SUMMARIES.find((s) => s.job_id === jobId) ?? null
}

// ——— Pipeline: milestones for progress invoicing (mock) ———
export const MOCK_ESTIMATE_MILESTONES: Record<string, PipelineItem['milestones']> = {
  'est-1': [
    { label: 'Deposit (30%)', pct: 30, amount: 5350.5, status: 'invoiced' },
    { label: 'Rough-in (40%)', pct: 40, amount: 7134, status: 'pending' },
    { label: 'Completion (30%)', pct: 30, amount: 5350.5, status: 'pending' },
  ],
}
