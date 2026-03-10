import { useState, useMemo } from 'react'
import type { PipelineItem, PipelineStage } from '@/types/global'
import type { JobExpense } from '@/types/global'
import { PipelineDetailPanel } from './PipelineDetailPanel'
import { PIPELINE_STAGES, formatCurrency, pct } from '@/lib/pipeline'

const STAGE_COLORS: Record<PipelineStage, string> = {
  draft: 'var(--text-muted)',
  sent: 'var(--blue)',
  accepted: 'var(--est-amber)',
  invoiced: 'var(--est-amber)',
  paid: 'var(--green)',
}

interface PipelineTabProps {
  pipeline: PipelineItem[]
  setPipeline: (fn: (prev: PipelineItem[]) => PipelineItem[]) => void
  expenses: JobExpense[]
  jobFilterId: string
}

export function PipelineTab({ pipeline, setPipeline, expenses, jobFilterId }: PipelineTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filteredPipeline = useMemo(() => {
    if (!jobFilterId) return pipeline
    return pipeline.filter((i) => i.job_id === jobFilterId)
  }, [pipeline, jobFilterId])

  const filteredExpenses = useMemo(() => {
    if (!jobFilterId) return expenses
    return expenses.filter((r) => r.job_id === jobFilterId)
  }, [expenses, jobFilterId])

  const advanceStage = (id: string, next: PipelineStage) => {
    setPipeline((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              stage: next,
              invoiced:
                next === 'invoiced' || next === 'paid' ? item.amount : item.invoiced,
              paid: next === 'paid' ? item.amount : item.paid,
            }
          : item
      )
    )
  }

  const byStage = PIPELINE_STAGES.reduce(
    (acc, s) => {
      acc[s.key] = filteredPipeline.filter((i) => i.stage === s.key)
      return acc
    },
    {} as Record<PipelineStage, PipelineItem[]>
  )

  const totalPipeline = filteredPipeline.reduce((s, i) => s + i.amount, 0)
  const totalInvoiced = filteredPipeline
    .filter((i) => ['invoiced', 'paid'].includes(i.stage))
    .reduce((s, i) => s + i.amount, 0)
  const totalPaid = filteredPipeline.filter((i) => i.stage === 'paid').reduce((s, i) => s + i.amount, 0)
  const totalSpend = filteredExpenses.reduce((s, r) => s + Number(r.amount), 0)

  const selectedItem = selectedId ? pipeline.find((i) => i.id === selectedId) : null

  return (
    <div>
      {selectedItem && (
        <PipelineDetailPanel
          item={selectedItem}
          expenses={expenses}
          onClose={() => setSelectedId(null)}
          onAdvance={advanceStage}
        />
      )}

      <div className="estimates-pipeline-kpis">
        {[
          {
            label: 'Pipeline Value',
            val: formatCurrency(totalPipeline),
            sub: `${filteredPipeline.length} active document${filteredPipeline.length === 1 ? '' : 's'}`,
            bar: 'var(--purple)',
          },
          {
            label: 'Invoiced',
            val: formatCurrency(totalInvoiced),
            sub: 'Awaiting payment',
            bar: 'var(--est-amber)',
          },
          {
            label: 'Collected',
            val: formatCurrency(totalPaid),
            sub: 'Last 30 days',
            bar: 'var(--green)',
          },
          {
            label: 'Job Spend',
            val: formatCurrency(totalSpend),
            sub: 'Receipts logged',
            bar: 'var(--blue)',
          },
        ].map((k, i) => (
          <div
            key={i}
            className="estimates-pipeline-kpi"
            style={{ ['--kpi-bar' as string]: k.bar } as React.CSSProperties}
          >
            <div className="estimates-pipeline-kpi-label">{k.label}</div>
            <div className="estimates-pipeline-kpi-value">{k.val}</div>
            <div className="estimates-pipeline-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="estimates-pipeline-columns">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.key} className="estimates-pipeline-column">
            <div className="estimates-pipeline-column-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  className="estimates-pipeline-column-dot"
                  style={{ background: STAGE_COLORS[stage.key] }}
                />
                <span className="estimates-pipeline-column-title">{stage.label}</span>
              </div>
              <span className="estimates-pipeline-column-count">
                {byStage[stage.key].length}
              </span>
            </div>
            <div className="estimates-pipeline-column-cards">
              {byStage[stage.key].length === 0 && (
                <div className="estimates-pipeline-column-empty">
                  <span>Empty</span>
                </div>
              )}
              {byStage[stage.key].map((item) => {
                const spend = expenses
                  .filter((r) => r.job_id === item.job_id)
                  .reduce((s, r) => s + Number(r.amount), 0)
                const marginPct = pct(item.amount - spend, item.amount)
                const jobParts = item.jobName.split('–').map((s) => s.trim())
                const jobName = jobParts[0] ?? item.jobName
                const addr = jobParts[1]
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className="estimates-pipeline-card"
                    style={{ borderLeftColor: STAGE_COLORS[item.stage] }}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedId(item.id)
                      }
                    }}
                  >
                    <div className="estimates-pipeline-card-id">{item.id}</div>
                    <div className="estimates-pipeline-card-job">{jobName}</div>
                    {addr && <div className="estimates-pipeline-card-addr">{addr}</div>}
                    <div className="estimates-pipeline-card-amount">
                      {formatCurrency(item.amount)}
                    </div>
                    {spend > 0 && (
                      <>
                        <div className="estimates-pipeline-card-margin-bar">
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, pct(spend, item.amount))}%`,
                              background:
                                marginPct > 30
                                  ? 'var(--green)'
                                  : marginPct > 10
                                    ? 'var(--est-amber)'
                                    : 'var(--red)',
                              borderRadius: 2,
                            }}
                          />
                        </div>
                        <div className="estimates-pipeline-card-margin-pct">
                          {marginPct}% margin
                        </div>
                      </>
                    )}
                    {item.milestones && item.milestones.length > 0 && (
                      <div className="estimates-pipeline-card-milestones">
                        ⚡ {item.milestones.length} milestones
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
