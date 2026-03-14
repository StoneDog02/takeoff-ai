import { useState, useCallback, useEffect } from 'react'
import { dayjs } from '@/lib/date'
import { STATUS_CONFIG } from '@/data/revenueSeedData'
import type { TrendPeriodKey } from '@/data/revenueSeedData'
import { RevenueAreaChart } from '@/components/revenue/RevenueAreaChart'
import { RevenueDonutChart } from '@/components/revenue/RevenueDonutChart'
import { RevenueExport } from '@/components/revenue/RevenueExport'
import { useRevenueLiveData } from '@/hooks/useRevenueLiveData'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0)
const marginColor = (p: number) => (p >= 30 ? '#10B981' : p >= 15 ? '#F59E0B' : '#EF4444')
const marginBg = (p: number) => (p >= 30 ? '#ECFDF5' : p >= 15 ? '#FFFBEB' : '#FEF2F2')

function getDefaultDates(period: TrendPeriodKey): { from: string; to: string } {
  const now = dayjs()
  if (period === 'This month') {
    return {
      from: now.startOf('month').format('MM/DD/YYYY'),
      to: now.endOf('month').format('MM/DD/YYYY'),
    }
  }
  if (period === 'Full year') {
    return {
      from: now.startOf('year').format('MM/DD/YYYY'),
      to: now.endOf('year').format('MM/DD/YYYY'),
    }
  }
  return {
    from: now.startOf('year').format('MM/DD/YYYY'),
    to: now.format('MM/DD/YYYY'),
  }
}

export function RevenuePage() {
  const [period, setPeriod] = useState<TrendPeriodKey>('YTD')
  const [jobFilter, setJobFilter] = useState('')
  const [viewMode, setViewMode] = useState<'overview' | 'margin'>('overview')
  const [showComparison, setShowComparison] = useState(false)
  const defaultDates = getDefaultDates('YTD')
  const [fromDate, setFromDate] = useState(defaultDates.from)
  const [toDate, setToDate] = useState(defaultDates.to)

  const { jobs: JOBS, trendData: chartData, cashflow: CASHFLOW, expenditure: EXPENDITURE, lastYear, loading, error } = useRevenueLiveData({
    jobFilter: jobFilter || 'All jobs',
    period,
    fromDate,
    toDate,
  })

  useEffect(() => {
    const { from, to } = getDefaultDates(period)
    setFromDate(from)
    setToDate(to)
  }, [period])

  const comparisonData = period === 'Full year' ? lastYear : null
  const lastPoint = chartData[chartData.length - 1]
  const totalRev = lastPoint?.revenue ?? 0
  const totalExp = lastPoint?.expenses ?? 0
  const netProfit = lastPoint?.profit ?? 0
  const marginPct = pct(netProfit, totalRev)
  const currentMonth =
    chartData.length > 1
      ? (chartData[chartData.length - 1]?.revenue ?? 0) - (chartData[chartData.length - 2]?.revenue ?? 0)
      : chartData[0]?.revenue ?? 0

  const cashflowMax = CASHFLOW[0].amount + CASHFLOW[1].amount + CASHFLOW[2].amount
  const activeJobsCount = JOBS.filter((j) => j.status === 'active').length
  const totalExpenditure = EXPENDITURE.reduce((s, d) => s + d.amount, 0)
  const largestCategory = [...EXPENDITURE].sort((a, b) => b.amount - a.amount)[0]
  const jobFilterLabel = jobFilter ? (JOBS.find((j) => j.id === jobFilter)?.name ?? jobFilter) : 'All jobs'

  const downloadCSV = useCallback(() => {
    const rows: string[][] = [
      ['Revenue summary', ''],
      ['Period', period],
      ['Date range', `${fromDate} to ${toDate}`],
      ['YTD Revenue', String(totalRev)],
      ['Current month', String(currentMonth)],
      ['Net profit', String(netProfit)],
      ['Margin %', String(marginPct)],
      [],
      ['Revenue by job', 'Invoiced', 'Collected', 'Margin %'],
      ...JOBS.map((j) => [
        j.name,
        String(j.invoiced),
        String(j.collected),
        String(j.collected > 0 ? pct(j.collected - j.expenses, j.collected) : '—'),
      ]),
      [],
      ['Expenditure', 'Amount'],
      ...EXPENDITURE.map((d) => [d.category, String(d.amount)]),
    ]
    const csv = rows
      .map((row) =>
        row
          .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
          .join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `revenue-summary-${fromDate}-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [period, fromDate, toDate, totalRev, currentMonth, netProfit, marginPct, JOBS, EXPENDITURE])

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
    line(`Period: ${period}`)
    line(`Date range: ${fromDate} to ${toDate}`)
    line(`YTD revenue: ${fmt(totalRev)}`)
    line(`Current month: ${fmt(currentMonth)}`)
    line(`Net profit: ${fmt(netProfit)}`)
    line(`Margin: ${marginPct}%`)
    y += 6
    doc.setFont('helvetica', 'bold')
    line('Revenue by job')
    doc.setFont('helvetica', 'normal')
    JOBS.forEach((j) => {
      line(`${j.name}: Invoiced ${fmt(j.invoiced)} · Collected ${fmt(j.collected)}`)
    })
    y += 6
    doc.setFont('helvetica', 'bold')
    line('Expenditure by category')
    doc.setFont('helvetica', 'normal')
    EXPENDITURE.forEach((d) => line(`${d.category}: ${fmt(d.amount)}`))
    doc.save(`revenue-summary-${fromDate}-${toDate}.pdf`)
  }, [period, fromDate, toDate, totalRev, currentMonth, netProfit, marginPct, JOBS, EXPENDITURE])

  if (loading) {
    return (
      <div className="dashboard-app revenue-page min-h-full">
        <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 pt-6 pb-12">
          <div className="revenue-overhaul-header">
            <div>
              <div className="revenue-overhaul-breadcrumb">Finance</div>
              <h1 className="dashboard-title revenue-overhaul-title">Revenue</h1>
            </div>
          </div>
          <div className="py-12">
            <LoadingSkeleton variant="page" className="min-h-[30vh]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-app revenue-page min-h-full">
        <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 pt-6 pb-12">
        {error && (
          <div
            className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
            role="alert"
          >
            {error}
          </div>
        )}
        {/* ── HEADER ── */}
        <div className="revenue-overhaul-header">
          <div>
            <div className="revenue-overhaul-breadcrumb">Finance</div>
            <h1 className="dashboard-title revenue-overhaul-title">Revenue</h1>
          </div>
          <div className="revenue-overhaul-header-actions">
            <div className="revenue-overhaul-date-wrap">
              <span className="revenue-overhaul-date-label">From</span>
              <input
                type="text"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="revenue-overhaul-date-input"
              />
              <span className="revenue-overhaul-date-arrow">→</span>
              <input
                type="text"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="revenue-overhaul-date-input"
              />
            </div>
            <div className="revenue-overhaul-pills">
              {(['This month', 'YTD', 'Full year'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`revenue-overhaul-pill ${period === p ? 'active' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="revenue-overhaul-select"
            >
              <option value="">All jobs</option>
              {JOBS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
            <RevenueExport onExportCSV={downloadCSV} onExportPDF={downloadPDF} />
          </div>
        </div>

        {/* ── KPI CARDS ── */}
        <div className="revenue-overhaul-kpi-row">
          {/* Net Profit — hero card */}
          <div className="revenue-overhaul-kpi-card revenue-overhaul-kpi-hero">
            <div
              className="revenue-overhaul-kpi-bar"
              style={{ background: marginColor(marginPct) }}
            />
            <div className="revenue-overhaul-kpi-hero-inner">
              <div>
                <div className="revenue-overhaul-kpi-label">Net Profit</div>
                <div className="revenue-overhaul-kpi-value-hero">{fmt(netProfit)}</div>
                <div className="revenue-overhaul-kpi-meta">
                  <span>Revenue {fmt(totalRev)}</span>
                  <span className="revenue-overhaul-dot">·</span>
                  <span>Expenses {fmt(totalExp)}</span>
                </div>
              </div>
              <div className="revenue-overhaul-kpi-margin-wrap">
                <div
                  className="revenue-overhaul-margin-badge"
                  style={{
                    background: marginBg(marginPct),
                    borderColor: marginColor(marginPct) + '30',
                  }}
                >
                  <div
                    className="revenue-overhaul-margin-value"
                    style={{ color: marginColor(marginPct) }}
                  >
                    {marginPct}%
                  </div>
                  <div
                    className="revenue-overhaul-margin-label"
                    style={{ color: marginColor(marginPct) }}
                  >
                    Margin
                  </div>
                </div>
                <div className="revenue-overhaul-margin-status">
                  {marginPct >= 30 ? '🟢 Healthy' : marginPct >= 15 ? '🟡 Watch' : '🔴 Low'}
                </div>
              </div>
            </div>
          </div>

          <div className="revenue-overhaul-kpi-card">
            <div className="revenue-overhaul-kpi-bar revenue-overhaul-kpi-bar-blue" />
            <div className="revenue-overhaul-kpi-label">YTD Revenue</div>
            <div className="revenue-overhaul-kpi-value">{fmt(totalRev)}</div>
            <span className="revenue-overhaul-badge-up">↑ +12.1%</span>
          </div>

          <div className="revenue-overhaul-kpi-card">
            <div className="revenue-overhaul-kpi-bar revenue-overhaul-kpi-bar-purple" />
            <div className="revenue-overhaul-kpi-label">Current Month</div>
            <div className="revenue-overhaul-kpi-value">
              {fmt(currentMonth > 0 ? currentMonth : (chartData[0]?.revenue ?? 0))}
            </div>
            <span className="revenue-overhaul-kpi-meta-small">this month</span>
          </div>

          <div className="revenue-overhaul-kpi-card">
            <div className="revenue-overhaul-kpi-bar revenue-overhaul-kpi-bar-amber" />
            <div className="revenue-overhaul-kpi-label">Active Jobs</div>
            <div className="revenue-overhaul-kpi-value">{activeJobsCount}</div>
            <span className="revenue-overhaul-kpi-meta-small">of {JOBS.length} projects</span>
          </div>
        </div>

        {/* ── CASH FLOW STRIP ── */}
        <div className="revenue-overhaul-card revenue-overhaul-cashflow">
          <div className="revenue-overhaul-cashflow-head">
            <div>
              <span className="revenue-overhaul-cashflow-title">Cash Flow Pipeline</span>
              <span className="revenue-overhaul-cashflow-sub">
                Collected → Invoiced → In Estimate
              </span>
            </div>
            <span className="revenue-overhaul-cashflow-total">{fmt(cashflowMax)} total pipeline</span>
          </div>
          <div className="revenue-overhaul-cashflow-bar">
            {CASHFLOW.map((c, i) => (
              <div
                key={i}
                className="revenue-overhaul-cashflow-segment"
                style={{ width: `${cashflowMax > 0 ? pct(c.amount, cashflowMax) : 0}%`, background: c.color }}
              />
            ))}
          </div>
          <div className="revenue-overhaul-cashflow-legend">
            {CASHFLOW.map((c, i) => (
              <div key={i} className="revenue-overhaul-cashflow-legend-item">
                <div
                  className="revenue-overhaul-cashflow-dot"
                  style={{ background: c.color }}
                />
                <span className="revenue-overhaul-cashflow-legend-label">{c.label}</span>
                <span className="revenue-overhaul-cashflow-legend-val">{fmt(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TREND CHART ── */}
        <div className="revenue-overhaul-card revenue-overhaul-trend">
          <div className="revenue-overhaul-trend-head">
            <div>
              <div className="revenue-overhaul-trend-title">Revenue & Profit Trend</div>
              <div className="revenue-overhaul-trend-sub">
                {period} · {jobFilterLabel}
              </div>
            </div>
            <div className="revenue-overhaul-trend-controls">
              <div className="revenue-overhaul-view-toggle">
                {(
                  [
                    ['overview', 'Overview'],
                    ['margin', 'Margin %'],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setViewMode(v)}
                    className={`revenue-overhaul-view-btn ${viewMode === v ? 'active' : ''}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {period === 'Full year' && (
                <label className="revenue-overhaul-compare-label">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowComparison((s) => !s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setShowComparison((s) => !s)
                      }
                    }}
                    className={`revenue-overhaul-toggle ${showComparison ? 'on' : ''}`}
                  >
                    <div className="revenue-overhaul-toggle-thumb" />
                  </div>
                  vs last year
                </label>
              )}
              {viewMode === 'overview' && (
                <div className="revenue-overhaul-legend">
                  {[
                    { label: 'Revenue', color: '#3B82F6', dash: false },
                    { label: 'Expenses', color: '#EF4444', dash: true },
                    { label: 'Net Profit', color: '#10B981', dash: false },
                    ...(showComparison && period === 'Full year'
                      ? [{ label: 'Last year', color: '#CBD5E1', dash: true }]
                      : []),
                  ].map((l, i) => (
                    <div key={i} className="revenue-overhaul-legend-item">
                      <svg width="20" height="10">
                        <line
                          x1="0"
                          y1="5"
                          x2="20"
                          y2="5"
                          stroke={l.color}
                          strokeWidth="2"
                          strokeDasharray={l.dash ? '4 3' : 'none'}
                        />
                      </svg>
                      <span>{l.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <RevenueAreaChart
            data={chartData.length > 0 ? chartData : [{ label: '—', revenue: 0, expenses: 0, profit: 0 }]}
            showComparison={showComparison}
            comparisonData={comparisonData}
            viewMode={viewMode}
          />
        </div>

        {/* ── BOTTOM ROW ── */}
        <div className="revenue-overhaul-bottom mb-10">
          {/* Revenue by Job */}
          <div className="revenue-overhaul-card revenue-overhaul-jobs-card">
            <div className="revenue-overhaul-card-head">
              <div className="revenue-overhaul-card-title">Revenue by Job</div>
              <div className="revenue-overhaul-card-sub">YTD performance across active projects</div>
            </div>
            <div className="revenue-overhaul-jobs-thead">
              {['JOB', 'INVOICED', 'COLLECTED', 'MARGIN'].map((h) => (
                <div
                  key={h}
                  className={`revenue-overhaul-jobs-th ${h === 'JOB' ? '' : 'right'}`}
                >
                  {h}
                </div>
              ))}
            </div>
            {JOBS.map((j, i) => {
              const jMargin =
                j.expenses > 0 ? pct(j.collected - j.expenses, j.collected || 1) : 0
              const invoicedPct = pct(j.invoiced, j.contractValue)
              const st = STATUS_CONFIG[j.status]
              return (
                <div
                  key={j.id}
                  className={`revenue-overhaul-job-row ${i < JOBS.length - 1 ? 'border' : ''}`}
                >
                  <div className="revenue-overhaul-job-grid">
                    <div className="revenue-overhaul-job-cell-main">
                      <div
                        className="revenue-overhaul-job-avatar"
                        style={{ background: j.color + '20', color: j.color }}
                      >
                        {j.initials}
                      </div>
                      <div>
                        <div className="revenue-overhaul-job-name">{j.name}</div>
                        <span
                          className="revenue-overhaul-job-status"
                          style={{ background: st.bg, color: st.color }}
                        >
                          {st.label}
                        </span>
                      </div>
                    </div>
                    <div className="revenue-overhaul-job-cell right">{fmt(j.invoiced)}</div>
                    <div className="revenue-overhaul-job-cell right">{fmt(j.collected)}</div>
                    <div className="revenue-overhaul-job-cell right">
                      {j.collected > 0 ? (
                        <span
                          className="revenue-overhaul-job-margin"
                          style={{ color: marginColor(jMargin) }}
                        >
                          {jMargin}%
                        </span>
                      ) : (
                        <span className="revenue-overhaul-job-margin-na">—</span>
                      )}
                    </div>
                  </div>
                  <div className="revenue-overhaul-job-progress-wrap">
                    <div className="revenue-overhaul-job-progress-track">
                      <div
                        className="revenue-overhaul-job-progress-fill"
                        style={{ width: `${invoicedPct}%`, background: j.color }}
                      />
                    </div>
                    <div className="revenue-overhaul-job-progress-label">
                      {invoicedPct}% of {fmt(j.contractValue)} contract invoiced
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="revenue-overhaul-jobs-footer">
              <span className="revenue-overhaul-jobs-footer-label">Totals</span>
              <span className="revenue-overhaul-jobs-footer-val right">
                {fmt(JOBS.reduce((s, j) => s + j.invoiced, 0))}
              </span>
              <span className="revenue-overhaul-jobs-footer-val right green">
                {fmt(JOBS.reduce((s, j) => s + j.collected, 0))}
              </span>
              <span className="revenue-overhaul-jobs-footer-val right">—</span>
            </div>
          </div>

          {/* Expenditure Breakdown */}
          <div className="revenue-overhaul-card revenue-overhaul-exp-card">
            <div className="revenue-overhaul-card-head">
              <div className="revenue-overhaul-card-title">Expenditure Breakdown</div>
              <div className="revenue-overhaul-card-sub">Where the money&apos;s going</div>
            </div>
            <div className="revenue-overhaul-exp-body">
              <RevenueDonutChart data={EXPENDITURE} />
              <div className="revenue-overhaul-exp-summary">
                <div>
                  <div className="revenue-overhaul-exp-summary-label">Total Expenditure</div>
                  <div className="revenue-overhaul-exp-summary-value">{fmt(totalExpenditure)}</div>
                </div>
                <div className="revenue-overhaul-exp-summary-right">
                  <div className="revenue-overhaul-exp-summary-label">Largest Category</div>
                  <div
                    className="revenue-overhaul-exp-summary-cat"
                    style={{ color: largestCategory?.color }}
                  >
                    {largestCategory?.category}
                  </div>
                  <div className="revenue-overhaul-exp-summary-pct">
                    {pct(largestCategory?.amount ?? 0, totalExpenditure)}% of spend
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
