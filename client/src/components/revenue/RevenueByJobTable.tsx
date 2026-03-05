import type { RevenueSummary } from '@/types/revenue'

export interface JobTableRow {
  jobId: string
  jobName: string
  revenue: number
  profit: number
  status: 'active' | 'complete' | 'pending'
}

interface RevenueByJobTableProps {
  rows: JobTableRow[]
  summary: RevenueSummary
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatK(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : formatCurrency(n)
}

export function RevenueByJobTable({ rows, summary }: RevenueByJobTableProps) {
  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1)

  return (
    <div className="section-card">
      <div className="section-header">
        <div>
          <div className="section-title">Revenue by Job</div>
          <div className="section-sub">YTD performance across active projects</div>
        </div>
      </div>

      <div className="job-table">
        <div className="job-row header">
          <div className="job-col-hdr">Job</div>
          <div className="job-col-hdr r">Revenue</div>
          <div className="job-col-hdr r">Profit</div>
          <div className="job-col-hdr r">Status</div>
        </div>
        {rows.length === 0 ? (
          <div className="job-row">
            <div className="job-name" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
              No jobs with revenue in selected range
            </div>
          </div>
        ) : rows.map((row) => {
          const barPct = Math.round((row.revenue / maxRevenue) * 100)
          const marginPct =
            row.revenue > 0 ? Math.round((row.profit / row.revenue) * 100) : 0
          return (
            <div key={row.jobId} className="job-row">
              <div>
                <div className="job-name">{row.jobName}</div>
                <div className="job-bar-wrap">
                  <div
                    className="job-bar"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
              <div className="job-revenue">{formatK(row.revenue)}</div>
              <div className={`job-profit ${row.profit >= 0 ? 'pos' : 'neg'}`}>
                {row.profit >= 0 ? '+' : ''}{formatK(row.profit)}
                <br />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
                  {marginPct}% margin
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`job-status ${row.status}`}>
                  {row.status === 'active' ? 'Active' : row.status === 'complete' ? 'Complete' : 'Pending'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="profit-strip">
        <div className="profit-strip-item">
          <div className="profit-strip-label">Gross Revenue</div>
          <div className="profit-strip-val">{formatCurrency(summary.grossRevenue)}</div>
        </div>
        <div className="profit-strip-item">
          <div className="profit-strip-label">Total Expenses</div>
          <div className="profit-strip-val red">{formatCurrency(summary.totalExpenses)}</div>
        </div>
        <div className="profit-strip-item">
          <div className="profit-strip-label">Net Profit</div>
          <div className={`profit-strip-val ${summary.netProfit >= 0 ? 'green' : 'red'}`}>
            {formatCurrency(summary.netProfit)}
          </div>
        </div>
      </div>
    </div>
  )
}
