import type { PipelineItem, PipelineStage } from '@/types/global'
import type { JobExpense } from '@/types/global'
import { formatDate } from '@/lib/date'
import { StagePipeline } from './StagePipeline'
import { PIPELINE_STAGES, formatCurrency, pct } from '@/lib/pipeline'

const CAT_COLORS: Record<string, { color: string; bg: string }> = {
  materials: { color: 'var(--blue)', bg: 'var(--blue-glow)' },
  labor: { color: 'var(--est-amber)', bg: 'var(--est-amber-light)' },
  equipment: { color: 'var(--orange)', bg: 'rgba(199, 107, 26, 0.12)' },
  misc: { color: 'var(--text-muted)', bg: 'var(--bg-base)' },
}

const NEXT_ACTION: Record<PipelineStage, { label: string; next: PipelineStage } | null> = {
  draft: { label: 'Send to Client', next: 'sent' },
  sent: { label: 'Mark as Accepted', next: 'accepted' },
  accepted: { label: 'Create Invoice', next: 'invoiced' },
  invoiced: { label: 'Mark as Paid', next: 'paid' },
  paid: null,
}

interface PipelineDetailPanelProps {
  item: PipelineItem
  expenses: JobExpense[]
  onClose: () => void
  onAdvance: (id: string, next: PipelineStage) => void
}

export function PipelineDetailPanel({
  item,
  expenses,
  onClose,
  onAdvance,
}: PipelineDetailPanelProps) {
  const spend = expenses
    .filter((r) => r.job_id === item.job_id)
    .reduce((s, r) => s + Number(r.amount), 0)
  const margin = item.amount - spend
  const marginPct = pct(margin, item.amount)
  const action = NEXT_ACTION[item.stage]

  const marginColor =
    marginPct > 30 ? 'var(--green)' : marginPct > 10 ? 'var(--est-amber)' : 'var(--red)'

  return (
    <div
      className="estimates-detail-panel"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="estimates-detail-panel__inner"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="estimates-detail-panel__header">
          <div className="estimates-detail-panel__meta">
            <div>
              <div className="estimates-detail-panel__type-id">
                <span
                  className={`estimates-detail-panel__type-pill ${item.type}`}
                >
                  {item.type}
                </span>
                {item.id}
              </div>
              <h3 className="estimates-detail-panel__title">{item.jobName}</h3>
              <div className="estimates-detail-panel__sub">
                {item.client ?? 'No client email'} · {formatDate(item.date)}
              </div>
            </div>
            <button
              type="button"
              className="estimates-detail-panel__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="estimates-detail-panel__stage-wrap">
            <StagePipeline
              current={item.stage}
              onAdvance={(next) => onAdvance(item.id, next)}
            />
          </div>
        </div>

        <div className="estimates-detail-financials">
          <div className="estimates-detail-financials__grid">
            <div className="estimates-detail-financials__card">
              <div className="estimates-detail-financials__label">Estimate</div>
              <div className="estimates-detail-financials__val">{formatCurrency(item.amount)}</div>
              <div className="estimates-detail-financials__sub">Total value</div>
            </div>
            <div className="estimates-detail-financials__card">
              <div className="estimates-detail-financials__label">Invoiced</div>
              <div className="estimates-detail-financials__val">{formatCurrency(item.invoiced)}</div>
              <div className="estimates-detail-financials__sub">
                {pct(item.invoiced, item.amount)}% of est.
              </div>
            </div>
            <div className="estimates-detail-financials__card">
              <div className="estimates-detail-financials__label">Spent</div>
              <div className="estimates-detail-financials__val" style={{ color: marginColor }}>
                {formatCurrency(spend)}
              </div>
              <div className="estimates-detail-financials__sub" style={{ color: marginColor }}>
                {marginPct}% margin
              </div>
            </div>
          </div>
          <div className="estimates-detail-margin">
            <div className="estimates-detail-margin__label">
              <span>Job profitability</span>
              <span style={{ fontWeight: 600, color: marginColor }}>{marginPct}% margin</span>
            </div>
            <div className="estimates-detail-margin__bar">
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, pct(spend, item.amount))}%`,
                  background: marginColor,
                  borderRadius: 3,
                }}
              />
            </div>
            <div className="estimates-detail-margin__legend">
              <span>Spent {formatCurrency(spend)}</span>
              <span>Est. {formatCurrency(item.amount)}</span>
            </div>
          </div>
        </div>

        {item.milestones && item.milestones.length > 0 && (
          <div className="estimates-detail-section">
            <div className="estimates-detail-section-title">Progress Invoicing</div>
            {item.milestones.map((m, i) => {
              const stKey = m.status === 'invoiced' ? 'invoiced' : 'draft'
              PIPELINE_STAGES.find((s) => s.key === stKey)
              const dotColor =
                m.status === 'invoiced' ? 'var(--est-amber)' : 'var(--border-mid)'
              return (
                <div key={i} className="estimates-detail-milestone">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      className="estimates-detail-milestone-dot"
                      style={{ background: dotColor }}
                    />
                    <div>
                      <div className="estimates-detail-milestone-label">{m.label}</div>
                      <div className="estimates-detail-milestone-pct">{m.pct}% of total</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="estimates-detail-milestone-amount">
                      {formatCurrency(m.amount)}
                    </div>
                    <span
                      className="estimates-detail-milestone-badge"
                      style={{
                        background: m.status === 'invoiced' ? 'var(--est-amber-light)' : 'var(--bg-base)',
                        color: m.status === 'invoiced' ? 'var(--est-amber)' : 'var(--text-muted)',
                      }}
                    >
                      {m.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {expenses.filter((r) => r.job_id === item.job_id).length > 0 && (
          <div className="estimates-detail-section">
            <div className="estimates-detail-section-title">Job Expenses</div>
            {expenses
              .filter((r) => r.job_id === item.job_id)
              .map((r) => {
                const c = CAT_COLORS[r.category] ?? CAT_COLORS.misc
                return (
                  <div key={r.id} className="estimates-detail-expense">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="estimates-detail-expense-cat"
                        style={{ background: c.bg, color: c.color }}
                      >
                        {r.category}
                      </span>
                      <span className="estimates-detail-expense-desc">
                        {r.description ?? '—'}
                      </span>
                    </div>
                    <span className="estimates-detail-expense-amount">
                      {formatCurrency(Number(r.amount))}
                    </span>
                  </div>
                )
              })}
          </div>
        )}

        {action && (
          <div className="estimates-detail-action">
            <button
              type="button"
              onClick={() => {
                onAdvance(item.id, action.next)
                onClose()
              }}
            >
              {action.label} →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
