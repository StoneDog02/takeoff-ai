import { useState, useEffect, useMemo } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Job, Invoice, Estimate, JobExpense, JobSpendSummary } from '@/types/global'
import { dayjs } from '@/lib/date'
import type {
  TrendPeriodKey,
  TrendPoint,
  LastYearPoint,
  RevenueJobRow,
  ExpenditureRow,
  CashflowRow,
  JobStatusKey,
} from '@/data/revenueSeedData'

const JOB_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899']
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  materials: { label: 'Materials', color: '#3B82F6', bg: '#DBEAFE' },
  labor: { label: 'Labor', color: '#F59E0B', bg: '#FEF3C7' },
  equipment: { label: 'Equipment', color: '#8B5CF6', bg: '#EDE9FE' },
  subs: { label: 'Subs', color: '#EC4899', bg: '#FCE7F3' },
  misc: { label: 'Other', color: '#9CA3AF', bg: '#F3F4F6' },
}
const CASHFLOW_CONFIG: CashflowRow[] = [
  { label: 'Collected', amount: 0, color: '#10B981', bg: '#ECFDF5' },
  { label: 'Invoiced', amount: 0, color: '#3B82F6', bg: '#EFF6FF' },
  { label: 'In Estimate', amount: 0, color: '#9CA3AF', bg: '#F9FAFB' },
]

function parseDate(s: string): string {
  const d = dayjs(s, 'MM/DD/YYYY', true)
  if (!d.isValid()) return dayjs().format('YYYY-MM-DD')
  return d.format('YYYY-MM-DD')
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function mapStatus(s: string | undefined): JobStatusKey {
  if (!s) return 'active'
  const lower = s.toLowerCase().replace(/_/g, '-')
  if (['active', 'planning', 'completed', 'on-hold'].includes(lower)) return lower as JobStatusKey
  return 'active'
}

export interface UseRevenueLiveDataParams {
  jobFilter: string
  period: TrendPeriodKey
  fromDate: string
  toDate: string
}

export interface RevenueLiveDataResult {
  jobs: RevenueJobRow[]
  trendData: TrendPoint[]
  cashflow: CashflowRow[]
  expenditure: ExpenditureRow[]
  lastYear: LastYearPoint[] | null
  loading: boolean
  error: string | null
}

export function useRevenueLiveData({
  jobFilter,
  period,
  fromDate,
  toDate,
}: UseRevenueLiveDataParams): RevenueLiveDataResult {
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [jobExpenses, setJobExpenses] = useState<JobExpense[]>([])
  const [summaries, setSummaries] = useState<JobSpendSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const from = parseDate(fromDate)
  const to = parseDate(toDate)
  const jobId = jobFilter === 'All jobs' || !jobFilter ? undefined : jobFilter

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      estimatesApi.getJobs(),
      estimatesApi.getInvoices(jobId),
      estimatesApi.getEstimates(jobId),
      estimatesApi.getJobExpenses(jobId),
      estimatesApi.getJobSpendSummaries(),
    ])
      .then(([jobsList, invList, estList, expList, sumList]) => {
        if (cancelled) return
        setJobs(jobsList)
        setInvoices(invList)
        setEstimates(estList)
        setJobExpenses(expList)
        setSummaries(sumList)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load revenue data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [jobId])

  const derived = useMemo(() => {
    const paidInvoices = invoices.filter((i) => i.status === 'paid')
    const summaryByJob = Object.fromEntries(summaries.map((s) => [s.job_id, s]))
    const estimatesByJob: Record<string, number> = {}
    const invoicedByJob: Record<string, number> = {}
    const collectedByJob: Record<string, number> = {}
    estimates.forEach((e) => {
      estimatesByJob[e.job_id] = (estimatesByJob[e.job_id] ?? 0) + Number(e.total_amount ?? 0)
    })
    invoices.forEach((i) => {
      const amt = Number(i.total_amount ?? 0)
      invoicedByJob[i.job_id] = (invoicedByJob[i.job_id] ?? 0) + amt
      if (i.status === 'paid') collectedByJob[i.job_id] = (collectedByJob[i.job_id] ?? 0) + amt
    })

    const derivedJobs: RevenueJobRow[] = jobs.map((j, i) => {
      const sum = summaryByJob[j.id]
      const contractValue = j.estimated_value ?? estimatesByJob[j.id] ?? 0
      const invoiced = invoicedByJob[j.id] ?? 0
      const collected = collectedByJob[j.id] ?? 0
      const expenses = sum ? Number(sum.total_spend) : 0
      return {
        id: j.id,
        name: j.name,
        client: j.client_name ?? '—',
        initials: getInitials(j.name),
        color: JOB_COLORS[i % JOB_COLORS.length],
        contractValue: Number(contractValue),
        invoiced,
        collected,
        expenses,
        status: mapStatus(j.status),
      }
    })

    const isInRange = (dateStr: string | undefined, fromVal: string, toVal: string) => {
      if (!dateStr) return false
      const d = dateStr.slice(0, 10)
      return d >= fromVal && d <= toVal
    }

    const byMonth: Record<string, { revenue: number; expenses: number }> = {}
    paidInvoices.forEach((i) => {
      const d = (i.paid_at ?? i.created_at ?? '').slice(0, 7)
      if (!d || !isInRange(i.paid_at ?? i.created_at, from, to)) return
      if (!byMonth[d]) byMonth[d] = { revenue: 0, expenses: 0 }
      byMonth[d].revenue += Number(i.total_amount ?? 0)
    })
    jobExpenses.forEach((e) => {
      const d = (e.created_at ?? '').slice(0, 7)
      if (!d || !isInRange(e.created_at, from, to)) return
      if (!byMonth[d]) byMonth[d] = { revenue: 0, expenses: 0 }
      byMonth[d].expenses += Number(e.amount ?? 0)
    })

    const start = dayjs(from).startOf('month')
    const end = dayjs(to).startOf('month')
    const trendData: TrendPoint[] = []
    const byDay: Record<string, { revenue: number; expenses: number }> = {}
    if (period === 'This month') {
      const dayStart = dayjs(from).startOf('day')
      const dayEnd = dayjs(to).startOf('day')
      paidInvoices.forEach((i) => {
        const dateVal = (i.paid_at ?? i.created_at ?? '').slice(0, 10)
        if (!dateVal || !isInRange(i.paid_at ?? i.created_at, from, to)) return
        if (!byDay[dateVal]) byDay[dateVal] = { revenue: 0, expenses: 0 }
        byDay[dateVal].revenue += Number(i.total_amount ?? 0)
      })
      jobExpenses.forEach((e) => {
        const dateVal = (e.created_at ?? '').slice(0, 10)
        if (!dateVal || !isInRange(e.created_at, from, to)) return
        if (!byDay[dateVal]) byDay[dateVal] = { revenue: 0, expenses: 0 }
        byDay[dateVal].expenses += Number(e.amount ?? 0)
      })
      let cur = dayStart
      while (cur.isBefore(dayEnd) || cur.isSame(dayEnd, 'day')) {
        const key = cur.format('YYYY-MM-DD')
        const data = byDay[key] ?? { revenue: 0, expenses: 0 }
        trendData.push({
          label: cur.format('MMM D'),
          revenue: data.revenue,
          expenses: data.expenses,
          profit: data.revenue - data.expenses,
        })
        cur = cur.add(1, 'day')
      }
    } else {
      let cur = start
      while (cur.isBefore(end) || cur.isSame(end, 'month')) {
        const key = cur.format('YYYY-MM')
        const data = byMonth[key] ?? { revenue: 0, expenses: 0 }
        trendData.push({
          label: cur.format('MMM'),
          revenue: data.revenue,
          expenses: data.expenses,
          profit: data.revenue - data.expenses,
        })
        cur = cur.add(1, 'month')
      }
    }

    const totalCollected = paidInvoices.reduce((s, i) => s + Number(i.total_amount ?? 0), 0)
    const invoicedNotPaid = invoices.filter(
      (i) => i.status !== 'paid' && i.status !== 'draft'
    )
    const totalInvoiced = invoicedNotPaid.reduce((s, i) => s + Number(i.total_amount ?? 0), 0)
    const totalEstimateAmount = estimates.reduce((s, e) => s + Number(e.total_amount ?? 0), 0)
    const totalInvoicedAmount = invoices.reduce((s, i) => s + Number(i.total_amount ?? 0), 0)
    const inEstimate = Math.max(0, totalEstimateAmount - totalInvoicedAmount)
    const cashflow: CashflowRow[] = [
      { ...CASHFLOW_CONFIG[0], amount: totalCollected },
      { ...CASHFLOW_CONFIG[1], amount: totalInvoiced },
      { ...CASHFLOW_CONFIG[2], amount: inEstimate },
    ]

    const catOrder = ['materials', 'labor', 'equipment', 'subs', 'misc'] as const
    const byCat: Record<string, number> = {}
    const summariesToUse = jobId ? summaries.filter((s) => s.job_id === jobId) : summaries
    summariesToUse.forEach((s) => {
      const bc = s.by_category ?? {}
      catOrder.forEach((cat) => {
        const v = Number(bc[cat] ?? 0)
        if (v > 0) byCat[cat] = (byCat[cat] ?? 0) + v
      })
    })
    const expenditure: ExpenditureRow[] = catOrder
      .filter((c) => (byCat[c] ?? 0) > 0)
      .map((cat) => {
        const config = CATEGORY_CONFIG[cat] ?? { label: cat, color: '#9CA3AF', bg: '#F3F4F6' }
        return {
          category: config.label,
          amount: byCat[cat] ?? 0,
          color: config.color,
          bg: config.bg,
        }
      })
    if (expenditure.length === 0 && summariesToUse.length > 0) {
      catOrder.forEach((cat) => {
        expenditure.push({
          category: (CATEGORY_CONFIG[cat] ?? { label: cat }).label,
          amount: 0,
          color: (CATEGORY_CONFIG[cat] ?? {}).color ?? '#9CA3AF',
          bg: (CATEGORY_CONFIG[cat] ?? {}).bg ?? '#F3F4F6',
        })
      })
    }

    const prevYear = dayjs().year() - 1
    let lastYear: LastYearPoint[] | null = null
    if (period === 'Full year') {
      const prevYearPaid = paidInvoices.filter((i) => {
        const paid = i.paid_at ?? ''
        return paid.slice(0, 4) === String(prevYear)
      })
      const byMonthPrev: Record<string, number> = {}
      prevYearPaid.forEach((i) => {
        const d = (i.paid_at ?? '').slice(0, 7)
        if (!d) return
        byMonthPrev[d] = (byMonthPrev[d] ?? 0) + Number(i.total_amount ?? 0)
      })
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      lastYear = months.map((label, i) => {
        const key = `${prevYear}-${String(i + 1).padStart(2, '0')}`
        return { label, revenue: byMonthPrev[key] ?? 0 }
      })
    }

    return {
      jobs: derivedJobs,
      trendData,
      cashflow,
      expenditure,
      lastYear,
    }
  }, [jobs, invoices, estimates, jobExpenses, summaries, from, to, period])

  return {
    ...derived,
    loading,
    error,
  }
}
