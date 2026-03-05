import { useEffect, useState, useMemo, useCallback } from 'react'
import { estimatesApi } from '@/api/estimates'
import { useMockRevenue, getMockRevenueData } from '@/data/mockRevenueData'
import type { Job, Invoice, JobExpense, JobSpendSummary } from '@/types/global'
import type {
  RevenueFiltersState,
  RevenueSummary,
  RevenueByJobRow,
  RevenueTrendPoint,
  ExpenditureByCategoryRow,
} from '@/types/revenue'
import { RevenueFilters } from '@/components/revenue/RevenueFilters'
import { RevenueSummaryCards } from '@/components/revenue/RevenueSummaryCards'
import { RevenueTrendChart } from '@/components/revenue/RevenueTrendChart'
import { RevenueByJobTable, type JobTableRow } from '@/components/revenue/RevenueByJobTable'
import { ExpenditureByCategoryChart } from '@/components/revenue/ExpenditureByCategoryChart'
import { RevenueExport } from '@/components/revenue/RevenueExport'
import type { ExpenseCategory } from '@/types/global'
import { dayjs, toISODate } from '@/lib/date'

const CATEGORY_ORDER: ExpenseCategory[] = ['materials', 'labor', 'equipment', 'misc']

function defaultFilters(): RevenueFiltersState {
  const startOfMonth = dayjs().startOf('month')
  return {
    dateFrom: toISODate(startOfMonth),
    dateTo: toISODate(dayjs()),
    jobId: '',
  }
}

function isInRange(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr) return false
  const d = dateStr.slice(0, 10)
  return d >= from && d <= to
}

export function RevenuePage() {
  const isDemo = useMockRevenue()
  const [filters, setFilters] = useState<RevenueFiltersState>(defaultFilters)
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [spendSummaries, setSpendSummaries] = useState<JobSpendSummary[]>([])
  const [jobExpenses, setJobExpenses] = useState<JobExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** True when we fell back to mock data after an API error */
  const [showingMockFallback, setShowingMockFallback] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShowingMockFallback(false)

    if (isDemo) {
      const mock = getMockRevenueData(filters.jobId || undefined)
      setJobs(mock.jobs)
      setInvoices(mock.invoices)
      setSpendSummaries(mock.spendSummaries)
      setJobExpenses(mock.jobExpenses)
      setLoading(false)
      setFilters((prev) => {
        const ytdFrom = toISODate(dayjs().startOf('year'))
        const ytdTo = toISODate(dayjs())
        if (prev.dateFrom === ytdFrom && prev.dateTo === ytdTo) return prev
        return { ...prev, dateFrom: ytdFrom, dateTo: ytdTo }
      })
      return
    }

    Promise.all([
      estimatesApi.getJobs(),
      filters.jobId
        ? estimatesApi.getInvoices(filters.jobId)
        : estimatesApi.getInvoices(),
      estimatesApi.getJobSpendSummaries(),
      filters.jobId
        ? estimatesApi.getJobExpenses(filters.jobId)
        : Promise.resolve([]),
    ])
      .then(([jobsList, invList, summaries, expenses]) => {
        if (!cancelled) {
          setJobs(jobsList)
          setInvoices(invList)
          setSpendSummaries(summaries)
          setJobExpenses(expenses)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data')
          const mock = getMockRevenueData(filters.jobId || undefined)
          setJobs(mock.jobs)
          setInvoices(mock.invoices)
          setSpendSummaries(mock.spendSummaries)
          setJobExpenses(mock.jobExpenses)
          setShowingMockFallback(true)
          setFilters((prev) => {
            const ytdFrom = toISODate(dayjs().startOf('year'))
            const ytdTo = toISODate(dayjs())
            if (prev.dateFrom === ytdFrom && prev.dateTo === ytdTo) return prev
            return { ...prev, dateFrom: ytdFrom, dateTo: ytdTo }
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filters.jobId, isDemo])

  const jobMap = useMemo(() => {
    const m: Record<string, string> = {}
    jobs.forEach((j) => {
      m[j.id] = j.name
    })
    return m
  }, [jobs])

  const { from, to } = useMemo(() => ({
    from: filters.dateFrom,
    to: filters.dateTo,
  }), [filters.dateFrom, filters.dateTo])

  const paidInvoices = useMemo(() => {
    return invoices.filter((i) => i.status === 'paid')
  }, [invoices])

  const revenueInRange = useMemo(() => {
    return paidInvoices
      .filter((i) => isInRange(i.paid_at ?? i.created_at, from, to))
      .reduce((sum, i) => sum + Number(i.total_amount), 0)
  }, [paidInvoices, from, to])

  const now = dayjs()
  const ytdFrom = now.startOf('year').format('YYYY-MM-DD')
  const ytdTo = toISODate(now)
  const ytdRevenue = useMemo(() => {
    return paidInvoices
      .filter((i) => isInRange(i.paid_at ?? i.created_at, ytdFrom, ytdTo))
      .reduce((sum, i) => sum + Number(i.total_amount), 0)
  }, [paidInvoices, ytdFrom, ytdTo])

  const startOfCurrentMonth = useMemo(() => toISODate(dayjs().startOf('month')), [])
  const endOfCurrentMonth = toISODate(now)
  const currentMonthRevenue = useMemo(() => {
    return paidInvoices
      .filter((i) =>
        isInRange(i.paid_at ?? i.created_at, startOfCurrentMonth, endOfCurrentMonth)
      )
      .reduce((sum, i) => sum + Number(i.total_amount), 0)
  }, [paidInvoices, startOfCurrentMonth, endOfCurrentMonth])

  const expensesInRange = useMemo(() => {
    if (jobExpenses.length > 0) {
      return jobExpenses
        .filter((e) => isInRange(e.created_at, from, to))
        .reduce((sum, e) => sum + Number(e.amount), 0)
    }
    const jobIds = new Set(jobs.map((j) => j.id))
    return spendSummaries
      .filter((s) => jobIds.has(s.job_id))
      .reduce((sum, s) => sum + Number(s.total_spend), 0)
  }, [jobExpenses, from, to, spendSummaries, jobs])

  const summary: RevenueSummary = useMemo(
    () => ({
      ytdRevenue,
      currentMonthRevenue,
      grossRevenue: revenueInRange,
      totalExpenses: expensesInRange,
      netProfit: revenueInRange - expensesInRange,
    }),
    [
      ytdRevenue,
      currentMonthRevenue,
      revenueInRange,
      expensesInRange,
    ]
  )

  const spendByJob = useMemo(() => {
    const m: Record<string, number> = {}
    spendSummaries.forEach((s) => {
      m[s.job_id] = Number(s.total_spend)
    })
    return m
  }, [spendSummaries])

  const trendData: RevenueTrendPoint[] = useMemo(() => {
    const byMonth: Record<string, { revenue: number; expenses: number }> = {}
    paidInvoices.forEach((i) => {
      const d = (i.paid_at ?? i.created_at ?? '').slice(0, 7)
      if (!d || d.length < 7) return
      if (!byMonth[d]) byMonth[d] = { revenue: 0, expenses: 0 }
      if (isInRange((i.paid_at ?? i.created_at) ?? '', from, to)) {
        byMonth[d].revenue += Number(i.total_amount)
      }
    })
    if (jobExpenses.length > 0) {
      jobExpenses.forEach((e) => {
        const d = (e.created_at ?? '').slice(0, 7)
        if (!d || d.length < 7) return
        if (!byMonth[d]) byMonth[d] = { revenue: 0, expenses: 0 }
        if (isInRange(e.created_at, from, to)) {
          byMonth[d].expenses += Number(e.amount)
        }
      })
    }
    const start = dayjs(from).startOf('month')
    const end = dayjs(to).startOf('month')
    const points: RevenueTrendPoint[] = []
    let cur = start
    while (cur.isBefore(end) || cur.isSame(end, 'month')) {
      const key = cur.format('YYYY-MM')
      const rev = byMonth[key]?.revenue ?? 0
      const exp = byMonth[key]?.expenses ?? 0
      points.push({
        month: key,
        year: cur.year(),
        label: cur.format('MMM YYYY'),
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
      })
      cur = cur.add(1, 'month')
    }
    return points
  }, [paidInvoices, from, to, filters.jobId, jobExpenses])

  const chartSubtitle = useMemo(() => {
    const fromLabel = dayjs(filters.dateFrom).format('MMM YYYY')
    const toLabel = dayjs(filters.dateTo).format('MMM YYYY')
    const jobLabel = filters.jobId ? jobMap[filters.jobId] ?? 'Job' : 'All jobs'
    return `${fromLabel} – ${toLabel} · ${jobLabel}`
  }, [filters.dateFrom, filters.dateTo, filters.jobId, jobMap])

  const revenueByJob: RevenueByJobRow[] = useMemo(() => {
    const byJob: Record<string, number> = {}
    paidInvoices
      .filter((i) => isInRange(i.paid_at ?? i.created_at, from, to))
      .forEach((i) => {
        const jid = i.job_id
        if (!byJob[jid]) byJob[jid] = 0
        byJob[jid] += Number(i.total_amount)
      })
    const list = Object.entries(byJob).map(([jobId, revenue]) => ({
      jobId,
      jobName: jobMap[jobId] ?? jobId.slice(0, 8),
      revenue,
    }))
    list.sort((a, b) => b.revenue - a.revenue)
    return list
  }, [paidInvoices, from, to, jobMap])

  const jobTableRows: JobTableRow[] = useMemo(() => {
    return revenueByJob.map((r) => {
      const cost = spendByJob[r.jobId] ?? 0
      return {
        jobId: r.jobId,
        jobName: r.jobName,
        revenue: r.revenue,
        profit: r.revenue - cost,
        status: 'active' as const,
      }
    })
  }, [revenueByJob, spendByJob])

  const expenditureByCategory: ExpenditureByCategoryRow[] = useMemo(() => {
    const byCat: Record<string, number> = {}
    if (filters.jobId) {
      jobExpenses
        .filter((e) => isInRange(e.created_at, from, to))
        .forEach((e) => {
          const c = e.category
          byCat[c] = (byCat[c] ?? 0) + Number(e.amount)
        })
    } else {
      spendSummaries.forEach((s) => {
        const bc = s.by_category ?? {}
        CATEGORY_ORDER.forEach((cat) => {
          const v = Number(bc[cat] ?? 0)
          if (v > 0) byCat[cat] = (byCat[cat] ?? 0) + v
        })
      })
    }
    return CATEGORY_ORDER.filter((c) => (byCat[c] ?? 0) > 0).map((category) => ({
      category,
      amount: byCat[category] ?? 0,
    }))
  }, [filters.jobId, jobExpenses, from, to, spendSummaries])

  const downloadCSV = useCallback(() => {
    const rows: string[][] = [
      ['Revenue summary', ''],
      ['Date range', `${from} to ${to}`],
      ['YTD Revenue', summary.ytdRevenue.toString()],
      ['Current month revenue', summary.currentMonthRevenue.toString()],
      ['Period revenue', summary.grossRevenue.toString()],
      ['Total expenses', summary.totalExpenses.toString()],
      ['Net profit', summary.netProfit.toString()],
      [],
      ['Revenue by job', 'Amount'],
      ...revenueByJob.map((r) => [r.jobName, r.revenue.toString()]),
      [],
      ['Expenditure by category', 'Amount'],
      ...expenditureByCategory.map((r) => [r.category, r.amount.toString()]),
    ]
    const csv = rows
      .map((row) =>
        row
          .map((cell) =>
            /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
          )
          .join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `revenue-summary-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [from, to, summary, revenueByJob, expenditureByCategory])

  const downloadPDF = useCallback(async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    let y = 16
    const line = (text: string, opts?: { font?: string; size?: number }) => {
      doc.setFontSize(opts?.size ?? 10)
      if (opts?.font) doc.setFont('helvetica', opts.font)
      doc.text(text, 14, y)
      y += 6
    }
    doc.setFont('helvetica', 'bold')
    line('Revenue summary', { size: 14 })
    doc.setFont('helvetica', 'normal')
    y += 4
    line(`Date range: ${from} to ${to}`)
    line(`YTD revenue: $${summary.ytdRevenue.toLocaleString()}`)
    line(`Current month: $${summary.currentMonthRevenue.toLocaleString()}`)
    line(`Period revenue: $${summary.grossRevenue.toLocaleString()}`)
    line(`Total expenses: $${summary.totalExpenses.toLocaleString()}`)
    line(`Net profit: $${summary.netProfit.toLocaleString()}`)
    y += 6
    doc.setFont('helvetica', 'bold')
    line('Revenue by job')
    doc.setFont('helvetica', 'normal')
    revenueByJob.slice(0, 10).forEach((r) => {
      line(`${r.jobName}: $${r.revenue.toLocaleString()}`)
    })
    y += 6
    doc.setFont('helvetica', 'bold')
    line('Expenditure by category')
    doc.setFont('helvetica', 'normal')
    expenditureByCategory.forEach((r) => {
      line(`${r.category}: $${r.amount.toLocaleString()}`)
    })
    doc.save(`revenue-summary-${from}-${to}.pdf`)
  }, [from, to, summary, revenueByJob, expenditureByCategory])

  if (loading && jobs.length === 0) {
    return (
      <div className="dashboard-app revenue-page min-h-full">
        <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
          <div className="dashboard-page-header mb-6">
            <h1 className="dashboard-title">Revenue</h1>
          </div>
          <div className="page-content">
            <p className="text-muted dark:text-white-dim">Loading…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-app revenue-page min-h-full">
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
        <div className="dashboard-page-header mb-6 flex justify-between items-center w-full">
          <h1 className="dashboard-title">Revenue</h1>
          <RevenueExport onExportCSV={downloadCSV} onExportPDF={downloadPDF} />
        </div>
        <RevenueFilters filters={filters} jobs={jobs} onFiltersChange={setFilters} />

        <div className="page-content">
        {isDemo && (
          <div
            className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200"
            role="status"
          >
            Showing <strong>demo data</strong>. Remove <code className="rounded bg-black/10 dark:bg-white/10 px-1">?demo=1</code> from the URL to use real data.
          </div>
        )}
        {showingMockFallback && (
          <div
            className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200"
            role="status"
          >
            API unavailable (<strong>{error}</strong>). Showing <strong>demo data</strong> so you can see the layout. Fix the backend or use <code className="rounded bg-black/10 dark:bg-white/10 px-1">?demo=1</code> to always use demo data.
          </div>
        )}
        {error && !showingMockFallback && (
          <div
            className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300 mb-4"
            role="alert"
          >
            {error}
          </div>
        )}
        <RevenueSummaryCards summary={summary} activeJobsCount={revenueByJob.length} />
        <RevenueTrendChart
          data={trendData}
          chartSubtitle={chartSubtitle}
          periodTotals={{
            revenue: summary.grossRevenue,
            expenses: summary.totalExpenses,
            profit: summary.netProfit,
          }}
        />
        <div className="bottom-grid">
          <RevenueByJobTable rows={jobTableRows} summary={summary} />
          <ExpenditureByCategoryChart data={expenditureByCategory} />
        </div>
        </div>
      </div>
    </div>
  )
}
