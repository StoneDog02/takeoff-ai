/**
 * Revenue module: filter state and computed summary shapes.
 * Shared types (Job, Invoice, JobExpense, etc.) live in @/types/global.
 */

export interface RevenueFiltersState {
  dateFrom: string
  dateTo: string
  jobId: string
  /** Placeholder for when employee/team API exists */
  employeeId?: string
  teamId?: string
}

export interface RevenueSummary {
  ytdRevenue: number
  currentMonthRevenue: number
  grossRevenue: number
  totalExpenses: number
  netProfit: number
}

export interface RevenueByJobRow {
  jobId: string
  jobName: string
  revenue: number
}

export interface RevenueTrendPoint {
  month: string
  year: number
  label: string
  revenue: number
  expenses?: number
  profit?: number
}

export interface ExpenditureByCategoryRow {
  category: string
  amount: number
}
