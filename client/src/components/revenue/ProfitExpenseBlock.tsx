import type { RevenueSummary } from '@/types/revenue'

interface ProfitExpenseBlockProps {
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

export function ProfitExpenseBlock({ summary }: ProfitExpenseBlockProps) {
  const { grossRevenue, totalExpenses, netProfit } = summary
  const max = Math.max(grossRevenue, totalExpenses, 1)
  const revenuePct = (grossRevenue / max) * 100
  const expensesPct = (totalExpenses / max) * 100

  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-4 shadow-card">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
        Net profit vs. expenses
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-xs font-medium text-muted dark:text-white-dim uppercase tracking-wide mb-1">
            Gross revenue
          </div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">
            {formatCurrency(grossRevenue)}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted dark:text-white-dim uppercase tracking-wide mb-1">
            Total expenses
          </div>
          <div className="text-lg font-semibold text-red-600 dark:text-red-400">
            {formatCurrency(totalExpenses)}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted dark:text-white-dim uppercase tracking-wide mb-1">
            Net profit
          </div>
          <div
            className={`text-lg font-semibold ${
              netProfit >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatCurrency(netProfit)}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted dark:text-white-dim">Revenue</span>
            <span className="font-medium">{formatCurrency(grossRevenue)}</span>
          </div>
          <div className="h-3 rounded-full bg-surface dark:bg-dark-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary dark:bg-primary/80"
              style={{ width: `${revenuePct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted dark:text-white-dim">Expenses</span>
            <span className="font-medium">{formatCurrency(totalExpenses)}</span>
          </div>
          <div className="h-3 rounded-full bg-surface dark:bg-dark-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent dark:bg-accent/80"
              style={{ width: `${expensesPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
