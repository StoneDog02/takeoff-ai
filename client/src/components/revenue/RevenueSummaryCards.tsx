import type { RevenueSummary } from '@/types/revenue'

interface RevenueSummaryCardsProps {
  summary: RevenueSummary
  activeJobsCount: number
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function RevenueSummaryCards({ summary, activeJobsCount }: RevenueSummaryCardsProps) {
  const { ytdRevenue, currentMonthRevenue, netProfit } = summary
  const marginPercent =
    summary.grossRevenue > 0
      ? ((netProfit / summary.grossRevenue) * 100).toFixed(1)
      : '0'

  return (
    <div className="kpi-row">
      <div className="kpi-card revenue">
        <div className="kpi-label">YTD Revenue</div>
        <div className="kpi-value">{formatCurrency(ytdRevenue)}</div>
        <div className="kpi-meta">
          <span className="kpi-delta flat">Period</span>
          <span>filtered range</span>
        </div>
        <svg className="kpi-sparkline" width="80" height="44" viewBox="0 0 80 44" aria-hidden>
          <polyline
            points="0,38 13,30 26,32 39,20 52,24 65,12 80,8"
            fill="none"
            stroke="var(--blue)"
            strokeWidth="2"
          />
        </svg>
      </div>
      <div className="kpi-card month">
        <div className="kpi-label">Current Month</div>
        <div className="kpi-value">{formatCurrency(currentMonthRevenue)}</div>
        <div className="kpi-meta">
          <span className="kpi-delta flat">Period</span>
          <span>this month</span>
        </div>
        <svg className="kpi-sparkline" width="80" height="44" viewBox="0 0 80 44" aria-hidden>
          <polyline
            points="0,34 13,36 26,28 39,30 52,22 65,18 80,14"
            fill="none"
            stroke="var(--red)"
            strokeWidth="2"
          />
        </svg>
      </div>
      <div className="kpi-card profit">
        <div className="kpi-label">Net Profit</div>
        <div className="kpi-value">{formatCurrency(netProfit)}</div>
        <div className="kpi-meta">
          <span className="kpi-delta flat">{marginPercent}%</span>
          <span>margin</span>
        </div>
        <svg className="kpi-sparkline" width="80" height="44" viewBox="0 0 80 44" aria-hidden>
          <polyline
            points="0,36 13,34 26,26 39,28 52,18 65,14 80,10"
            fill="none"
            stroke="var(--green)"
            strokeWidth="2"
          />
        </svg>
      </div>
      <div className="kpi-card jobs">
        <div className="kpi-label">Active Jobs</div>
        <div className="kpi-value">{activeJobsCount}</div>
        <div className="kpi-meta">
          <span className="kpi-delta flat">→</span>
          <span>with revenue</span>
        </div>
      </div>
    </div>
  )
}
