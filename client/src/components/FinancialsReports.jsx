import { useCallback, useMemo } from 'react'
import { formatCurrency } from '@/lib/pipeline'

/** Mock only — replace with Supabase-backed aggregates later */
const MOCK_JOB_PNL = [
  {
    id: 'job-mock-1',
    name: 'Riverside Custom Home',
    totalInvoiced: 448_200,
    totalSpent: 318_400,
  },
  {
    id: 'job-mock-2',
    name: 'Park Ave Remodel',
    totalInvoiced: 186_500,
    totalSpent: 142_100,
  },
  {
    id: 'job-mock-3',
    name: 'Savannah Nguyen Kitchen',
    totalInvoiced: 92_400,
    totalSpent: 61_250,
  },
  {
    id: 'job-mock-4',
    name: 'Lakefront Addition',
    totalInvoiced: 274_000,
    totalSpent: 198_750,
  },
  {
    id: 'job-mock-5',
    name: 'Downtown Loft',
    totalInvoiced: 128_900,
    totalSpent: 104_200,
  },
]

const MOCK_CATEGORY_SPEND = [
  { expense_type: 'Materials', amount: 186_420 },
  { expense_type: 'Labor', amount: 124_800 },
  { expense_type: 'Subcontractor', amount: 98_350 },
  { expense_type: 'Equipment', amount: 42_180 },
  { expense_type: 'Overhead', amount: 28_940 },
  { expense_type: 'Payroll', amount: 156_200 },
]

function marginDollars(row) {
  return row.totalInvoiced - row.totalSpent
}

function marginPct(row) {
  if (row.totalInvoiced <= 0) return 0
  return (marginDollars(row) / row.totalInvoiced) * 100
}

function marginColor(p) {
  if (p >= 25) return '#10B981'
  if (p >= 15) return '#F59E0B'
  return '#EF4444'
}

function escapeCsvCell(s) {
  const t = String(s ?? '')
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

export function FinancialsReports() {
  const categoryMax = useMemo(
    () => Math.max(...MOCK_CATEGORY_SPEND.map((c) => c.amount), 1),
    [],
  )

  const downloadCsv = useCallback(() => {
    const lines = []
    lines.push('Proj-X Financials Report (mock data)')
    lines.push(`Generated,${new Date().toISOString()}`)
    lines.push('')
    lines.push('Per-Job P&L Summary')
    lines.push(['Job', 'Total Invoiced', 'Total Spent (tagged tx)', 'Margin $', 'Margin %'].map(escapeCsvCell).join(','))
    for (const row of MOCK_JOB_PNL) {
      const m = marginDollars(row)
      const p = marginPct(row).toFixed(1)
      lines.push(
        [row.name, row.totalInvoiced, row.totalSpent, m, `${p}%`].map(escapeCsvCell).join(','),
      )
    }
    lines.push('')
    lines.push('Spend by Category (expense_type)')
    lines.push(['Category', 'Amount'].map(escapeCsvCell).join(','))
    for (const c of MOCK_CATEGORY_SPEND) {
      lines.push([c.expense_type, c.amount].map(escapeCsvCell).join(','))
    }
    const csv = lines.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financials-report-mock-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div className="financials-reports w-full pb-10 space-y-10">
      {/* 1. Per-Job P&L */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">Per-job P&amp;L summary</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Mock data — invoiced vs. spend from tagged bank transactions (placeholder).
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="revenue-overhaul-jobs-thead grid grid-cols-[1fr_minmax(100px,120px)_minmax(100px,120px)_minmax(88px,100px)_minmax(72px,88px)] gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
            <div>Job</div>
            <div className="text-right">Invoiced</div>
            <div className="text-right">Spent</div>
            <div className="text-right">Margin</div>
            <div className="text-right">%</div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {MOCK_JOB_PNL.map((row) => {
              const m = marginDollars(row)
              const p = marginPct(row)
              const color = marginColor(p)
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_minmax(100px,120px)_minmax(100px,120px)_minmax(88px,100px)_minmax(72px,88px)] gap-2 px-4 py-3 items-center text-sm"
                >
                  <div className="font-medium text-[var(--text-primary)] min-w-0 truncate" title={row.name}>
                    {row.name}
                  </div>
                  <div className="text-right tabular-nums text-[var(--text-secondary)]">{formatCurrency(row.totalInvoiced)}</div>
                  <div className="text-right tabular-nums text-[var(--text-secondary)]">{formatCurrency(row.totalSpent)}</div>
                  <div className="text-right tabular-nums font-medium" style={{ color }}>
                    {formatCurrency(m)}
                  </div>
                  <div className="text-right tabular-nums font-semibold" style={{ color }}>
                    {p.toFixed(1)}%
                  </div>
                </div>
              )
            })}
          </div>
          </div>
        </div>
      </section>

      {/* 2. Spend by category */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">Spend by category</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Mock totals by expense type (Materials, Subcontractor, Equipment, etc.).
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-4">
          {MOCK_CATEGORY_SPEND.map((c) => {
            const pct = Math.round((c.amount / categoryMax) * 100)
            return (
              <div key={c.expense_type}>
                <div className="flex justify-between items-baseline gap-3 mb-1.5">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{c.expense_type}</span>
                  <span className="text-sm tabular-nums font-semibold text-[var(--text-secondary)]">
                    {formatCurrency(c.amount)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg-raised)] overflow-hidden border border-[var(--border)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, var(--red) 0%, #c0392b 100%)',
                      minWidth: pct > 0 ? '4px' : '0',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 3. Export */}
      <section>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-sm">
          <div className="revenue-overhaul-card-head mb-5">
            <div className="revenue-overhaul-card-title">Export</div>
            <div className="revenue-overhaul-card-sub">Download mock report data for testing workflows</div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] cursor-not-allowed opacity-70"
            >
              <span className="mr-2 opacity-80" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M7 9h4M7 13h10" strokeLinecap="round" />
                </svg>
              </span>
              Export to QuickBooks
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--red)] hover:opacity-95 text-white text-sm font-medium px-4 py-2.5"
            >
              <span className="mr-2" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v12M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 19h14" strokeLinecap="round" />
                </svg>
              </span>
              Export CSV
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
