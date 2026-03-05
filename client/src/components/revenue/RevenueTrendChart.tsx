import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { RevenueTrendPoint } from '@/types/revenue'

/** Period totals from the same source as KPIs (Gross Revenue, Total Expenses, Net Profit). Use for legend so chart matches KPIs. */
export interface PeriodTotals {
  revenue: number
  expenses: number
  profit: number
}

interface RevenueTrendChartProps {
  data: RevenueTrendPoint[]
  chartSubtitle: string
  /** When provided, legend shows these values so the chart matches KPI/summary numbers. */
  periodTotals?: PeriodTotals
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

const TOOLTIP_ORDER: { dataKey: string; label: string; color: string }[] = [
  { dataKey: 'revenue', label: 'Revenue', color: '#3b82f6' },
  { dataKey: 'expenses', label: 'Expenses', color: '#dc2626' },
  { dataKey: 'profit', label: 'Net Profit', color: '#16a34a' },
]

function TrendTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; dataKey: string }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  const payloadMap = Object.fromEntries(payload.map((p) => [p.dataKey, p.value]))
  return (
    <div
      style={{
        background: '#1a1a1a',
        border: 'none',
        borderRadius: 10,
        padding: '12px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        minWidth: 160,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.9)',
          marginBottom: 10,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      {TOOLTIP_ORDER.map(({ dataKey, label: rowLabel, color }) => {
        const raw = payloadMap[dataKey]
        if (raw == null) return null
        const value = typeof raw === 'number' ? raw : Number(raw)
        return (
          <div
            key={dataKey}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                {rowLabel}
              </span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function formatK(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : formatCurrency(n)
}

export function RevenueTrendChart({ data, chartSubtitle, periodTotals }: RevenueTrendChartProps) {
  const legendRevenue = periodTotals?.revenue ?? data.reduce((s, d) => s + d.revenue, 0)
  const legendExpenses = periodTotals?.expenses ?? data.reduce((s, d) => s + (d.expenses ?? 0), 0)
  const legendProfit = periodTotals?.profit ?? data.reduce((s, d) => s + (d.profit ?? 0), 0)

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-header-left">
          <div className="chart-title">Revenue &amp; Profit Trend</div>
          <div className="chart-sub">{chartSubtitle}</div>
        </div>
        <div className="chart-header-right">
          <div className="chart-legend" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ width: 20, height: 2, borderRadius: 1, background: 'var(--blue)' }} />
              <span>Revenue</span>
              <span style={{ fontWeight: 600, marginLeft: 2 }}>
                {formatK(legendRevenue)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div
                style={{
                  width: 20,
                  height: 2,
                  borderRadius: 1,
                  background: 'repeating-linear-gradient(90deg, var(--red) 0, var(--red) 4px, transparent 4px, transparent 8px)',
                }}
              />
              <span>Expenses</span>
              <span style={{ fontWeight: 600, marginLeft: 2 }}>
                {formatK(legendExpenses)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ width: 20, height: 2, borderRadius: 1, background: 'var(--green)' }} />
              <span>Net Profit</span>
              <span style={{ fontWeight: 600, marginLeft: 2 }}>
                {formatK(legendProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="chart-area" style={{ padding: '10px 24px 20px' }}>
        <div style={{ height: 260, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                style={{ opacity: 0.6 }}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                stroke="var(--border)"
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                stroke="var(--border)"
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip
                content={<TrendTooltipContent />}
                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="var(--blue)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#fff', stroke: 'var(--blue)', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="var(--red)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 5, fill: '#fff', stroke: 'var(--red)', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                name="Net Profit"
                stroke="var(--green)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#fff', stroke: 'var(--green)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
