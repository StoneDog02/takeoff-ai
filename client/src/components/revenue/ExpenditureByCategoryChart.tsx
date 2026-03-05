import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { ExpenditureByCategoryRow } from '@/types/revenue'

interface ExpenditureByCategoryChartProps {
  data: ExpenditureByCategoryRow[]
}

const CATEGORY_LABELS: Record<string, string> = {
  materials: 'Materials',
  labor: 'Labor',
  equipment: 'Equipment',
  misc: 'Misc',
}

const CHART_COLORS = ['#2B5BA8', '#1A7B7D', '#B86E1A', '#2D7D4F']

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

export function ExpenditureByCategoryChart({ data }: ExpenditureByCategoryChartProps) {
  const chartData = data.map((d, i) => ({
    ...d,
    name: CATEGORY_LABELS[d.category] ?? d.category,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))
  const total = chartData.reduce((s, d) => s + d.amount, 0)
  const maxAmount = Math.max(...chartData.map((d) => d.amount), 1)

  if (chartData.length === 0) {
    return (
      <div className="section-card">
        <div className="section-header">
          <div>
            <div className="section-title">Expenditure Breakdown</div>
            <div className="section-sub">Where the money&apos;s going</div>
          </div>
        </div>
        <div className="exp-body">
          <div className="exp-donut-row" style={{ minHeight: 200, alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No expense data in selected range</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="section-card">
      <div className="section-header">
        <div>
          <div className="section-title">Expenditure Breakdown</div>
          <div className="section-sub">Where the money&apos;s going</div>
        </div>
      </div>
      <div className="exp-body">
        <div className="exp-donut-row">
          <div style={{ width: 110, height: 110, flexShrink: 0, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={55}
                  paddingAngle={2}
                  stroke="none"
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                  }}
                  formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>
                {formatK(total)}
              </div>
              <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                TOTAL SPEND
              </div>
            </div>
          </div>
          <div className="exp-legend">
            {chartData.map((entry, i) => {
              const pct = total > 0 ? Math.round((entry.amount / total) * 100) : 0
              return (
                <div key={i} className="exp-leg-item">
                  <div className="exp-leg-dot" style={{ background: entry.color }} />
                  <span className="exp-leg-label">{entry.name}</span>
                  <span className="exp-leg-val">{formatK(entry.amount)}</span>
                  <span className="exp-leg-pct">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="exp-category-bars">
        {chartData.map((entry, i) => {
          const w = (entry.amount / maxAmount) * 100
          return (
            <div key={i} className="exp-bar-row">
              <div className="exp-bar-name">{entry.name}</div>
              <div className="exp-bar-track">
                <div
                  className="exp-bar-fill"
                  style={{ width: `${w}%`, background: entry.color }}
                />
              </div>
              <div className="exp-bar-val">{formatK(entry.amount)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
