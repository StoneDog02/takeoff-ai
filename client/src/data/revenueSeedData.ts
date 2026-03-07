/**
 * Seed data for Revenue page (reference overhaul).
 * Used when demo=1 or as fallback; can later be replaced by API data.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export type TrendPeriodKey = 'This month' | 'YTD' | 'Full year'

export interface TrendPoint {
  label: string
  revenue: number
  expenses: number
  profit: number
}

export interface LastYearPoint {
  label: string
  revenue: number
}

export const TREND_DATA: Record<TrendPeriodKey, TrendPoint[]> = {
  'This month': [
    { label: 'Mar 1', revenue: 5000, expenses: 3200, profit: 1800 },
    { label: 'Mar 2', revenue: 5000, expenses: 3200, profit: 1800 },
    { label: 'Mar 3', revenue: 8200, expenses: 4100, profit: 4100 },
    { label: 'Mar 4', revenue: 8200, expenses: 4300, profit: 3900 },
    { label: 'Mar 5', revenue: 12400, expenses: 6800, profit: 5600 },
    { label: 'Mar 6', revenue: 17835, expenses: 9500, profit: 8335 },
  ],
  YTD: [
    { label: 'Jan', revenue: 142000, expenses: 98000, profit: 44000 },
    { label: 'Feb', revenue: 168000, expenses: 112000, profit: 56000 },
    { label: 'Mar', revenue: 184200, expenses: 121000, profit: 63200 },
  ],
  'Full year': [
    { label: 'Jan', revenue: 142000, expenses: 98000, profit: 44000 },
    { label: 'Feb', revenue: 168000, expenses: 112000, profit: 56000 },
    { label: 'Mar', revenue: 184200, expenses: 121000, profit: 63200 },
    { label: 'Apr', revenue: 201000, expenses: 134000, profit: 67000 },
    { label: 'May', revenue: 220000, expenses: 148000, profit: 72000 },
    { label: 'Jun', revenue: 198000, expenses: 138000, profit: 60000 },
    { label: 'Jul', revenue: 235000, expenses: 155000, profit: 80000 },
    { label: 'Aug', revenue: 218000, expenses: 144000, profit: 74000 },
    { label: 'Sep', revenue: 242000, expenses: 161000, profit: 81000 },
    { label: 'Oct', revenue: 229000, expenses: 152000, profit: 77000 },
    { label: 'Nov', revenue: 258000, expenses: 168000, profit: 90000 },
    { label: 'Dec', revenue: 244000, expenses: 158000, profit: 86000 },
  ],
}

export const LAST_YEAR: Record<string, LastYearPoint[]> = {
  'Full year': [
    { label: 'Jan', revenue: 118000 },
    { label: 'Feb', revenue: 135000 },
    { label: 'Mar', revenue: 152000 },
    { label: 'Apr', revenue: 170000 },
    { label: 'May', revenue: 185000 },
    { label: 'Jun', revenue: 162000 },
    { label: 'Jul', revenue: 198000 },
    { label: 'Aug', revenue: 183000 },
    { label: 'Sep', revenue: 204000 },
    { label: 'Oct', revenue: 191000 },
    { label: 'Nov', revenue: 217000 },
    { label: 'Dec', revenue: 205000 },
  ],
}

export type JobStatusKey = 'active' | 'planning' | 'completed' | 'on-hold'

export interface RevenueJobRow {
  id: string
  name: string
  client: string
  initials: string
  color: string
  contractValue: number
  invoiced: number
  collected: number
  expenses: number
  status: JobStatusKey
}

export const JOBS: RevenueJobRow[] = [
  { id: 'PRJ-001', name: 'Kitchen Remodel', client: 'Savannah Nguyen', initials: 'SN', color: '#F59E0B', contractValue: 48200, invoiced: 22835, collected: 17835, expenses: 9500, status: 'active' },
  { id: 'PRJ-002', name: 'Office Build-Out', client: 'Jordan Lee', initials: 'JL', color: '#3B82F6', contractValue: 125000, invoiced: 0, collected: 0, expenses: 2100, status: 'planning' },
  { id: 'PRJ-003', name: 'Bathroom Renovation', client: 'Alexis Kim', initials: 'AK', color: '#10B981', contractValue: 22400, invoiced: 22400, collected: 22400, expenses: 19800, status: 'completed' },
  { id: 'PRJ-004', name: 'Exterior Siding', client: 'Morgan Reed', initials: 'MR', color: '#EF4444', contractValue: 67500, invoiced: 0, collected: 0, expenses: 1200, status: 'on-hold' },
]

export interface ExpenditureRow {
  category: string
  amount: number
  color: string
  bg: string
}

export const EXPENDITURE: ExpenditureRow[] = [
  { category: 'Labor', amount: 9840, color: '#F59E0B', bg: '#FEF3C7' },
  { category: 'Materials', amount: 14620, color: '#3B82F6', bg: '#DBEAFE' },
  { category: 'Equipment', amount: 2100, color: '#8B5CF6', bg: '#EDE9FE' },
  { category: 'Subs', amount: 5940, color: '#EC4899', bg: '#FCE7F3' },
  { category: 'Other', amount: 1000, color: '#9CA3AF', bg: '#F3F4F6' },
]

export interface CashflowRow {
  label: string
  amount: number
  color: string
  bg: string
}

export const CASHFLOW: CashflowRow[] = [
  { label: 'Collected', amount: 40235, color: '#10B981', bg: '#ECFDF5' },
  { label: 'Invoiced', amount: 22835, color: '#3B82F6', bg: '#EFF6FF' },
  { label: 'In Estimate', amount: 47060, color: '#9CA3AF', bg: '#F9FAFB' },
]

export const STATUS_CONFIG: Record<JobStatusKey, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#10B981', bg: '#ECFDF5' },
  planning: { label: 'Planning', color: '#3B82F6', bg: '#EFF6FF' },
  completed: { label: 'Completed', color: '#9CA3AF', bg: '#F9FAFB' },
  'on-hold': { label: 'On Hold', color: '#EF4444', bg: '#FEF2F2' },
}

export { MONTHS }
