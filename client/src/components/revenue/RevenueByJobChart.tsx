import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { RevenueByJobRow } from '@/types/revenue'

interface RevenueByJobChartProps {
  data: RevenueByJobRow[]
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function RevenueByJobChart({ data }: RevenueByJobChartProps) {
  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-4 shadow-card">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
        Revenue by job
      </h2>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              className="opacity-60"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
              stroke="var(--border)"
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <YAxis
              type="category"
              dataKey="jobName"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              stroke="var(--border)"
              width={75}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
              formatter={(value: number | undefined) => [
                formatCurrency(value ?? 0),
                'Revenue',
              ]}
              labelFormatter={(label) => String(label)}
            />
            <Bar
              dataKey="revenue"
              fill="var(--color-primary)"
              radius={[0, 4, 4, 0]}
              name="Revenue"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
