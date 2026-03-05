import type { BudgetSummary } from '@/types/global'

interface BudgetChartProps {
  summary: BudgetSummary
}

export function BudgetChart({ summary }: BudgetChartProps) {
  const { predicted_total, actual_total, profitability } = summary
  const max = Math.max(predicted_total, actual_total, 1)
  const predPct = (predicted_total / max) * 100
  const actualPct = (actual_total / max) * 100

  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-4 shadow-card">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-3">Budget vs actual</h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted dark:text-white-dim">Predicted</span>
            <span className="font-medium">${predicted_total.toLocaleString()}</span>
          </div>
          <div className="h-3 rounded-full bg-surface dark:bg-dark-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary dark:bg-primary/80"
              style={{ width: `${predPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted dark:text-white-dim">Actual</span>
            <span className="font-medium">${actual_total.toLocaleString()}</span>
          </div>
          <div className="h-3 rounded-full bg-surface dark:bg-dark-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent dark:bg-accent/80"
              style={{ width: `${actualPct}%` }}
            />
          </div>
        </div>
        <div className="pt-2 border-t border-border dark:border-border-dark">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted dark:text-white-dim">Profitability</span>
            <span
              className={`font-semibold ${
                profitability >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {profitability >= 0 ? '+' : ''}${profitability.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
