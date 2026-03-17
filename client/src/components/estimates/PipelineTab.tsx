import { useState, useMemo } from 'react'
import type { PipelineItem, PipelineStage } from '@/types/global'
import type { JobExpense } from '@/types/global'
import type { Job } from '@/types/global'
import { DocumentDetailModal } from './DocumentDetailModal'
import { PIPELINE_STAGES, formatCurrency, pct } from '@/lib/pipeline'
import { formatRelative } from '@/lib/date'

const STAGE_COLORS: Record<PipelineStage, string> = {
  draft: 'var(--text-muted)',
  sent: 'var(--blue)',
  accepted: 'var(--est-amber)',
  invoiced: 'var(--est-amber)',
  paid: 'var(--green)',
  declined: 'var(--text-muted)',
}

interface PipelineTabProps {
  pipeline: PipelineItem[]
  setPipeline: (fn: (prev: PipelineItem[]) => PipelineItem[]) => void
  expenses: JobExpense[]
  jobFilterId: string
  jobs: Job[]
  onPipelineRefresh?: () => void | Promise<void>
}

export function PipelineTab({ pipeline, expenses, jobFilterId, jobs, onPipelineRefresh }: PipelineTabProps) {
  /** When set, show full document modal (estimate/invoice) with API-backed actions */
  const [documentModal, setDocumentModal] = useState<{ id: string; type: 'estimate' | 'invoice' } | null>(null)
  const [showDeclined, setShowDeclined] = useState(false)

  const filteredPipeline = useMemo(() => {
    let list = jobFilterId ? pipeline.filter((i) => i.job_id === jobFilterId) : pipeline
    if (!showDeclined) list = list.filter((i) => i.stage !== 'declined')
    return list
  }, [pipeline, jobFilterId, showDeclined])

  const filteredExpenses = useMemo(() => {
    if (!jobFilterId) return expenses
    return expenses.filter((r) => r.job_id === jobFilterId)
  }, [expenses, jobFilterId])

  const byStage = PIPELINE_STAGES.reduce(
    (acc, s) => {
      acc[s.key] = filteredPipeline.filter((i) => i.stage === s.key)
      return acc
    },
    {} as Record<PipelineStage, PipelineItem[]>
  )

  const totalPipeline = filteredPipeline.reduce((s, i) => s + i.amount, 0)
  const sentItems = filteredPipeline.filter((i) => i.stage === 'sent')
  const sentEstimateOpened = sentItems.filter((i) => i.type === 'estimate' && i.viewed_at).length
  const sentEstimateUnopened = sentItems.filter((i) => i.type === 'estimate' && !i.viewed_at).length
  const totalInvoiced = filteredPipeline
    .filter((i) => ['invoiced', 'paid'].includes(i.stage))
    .reduce((s, i) => s + i.amount, 0)
  const totalPaid = filteredPipeline.filter((i) => i.stage === 'paid').reduce((s, i) => s + i.amount, 0)
  const totalSpend = filteredExpenses.reduce((s, r) => s + Number(r.amount), 0)

  const showDocumentModal = documentModal != null

  return (
    <div>
      {showDocumentModal && documentModal && (
        <DocumentDetailModal
          type={documentModal.type}
          id={documentModal.id}
          jobs={jobs}
          onClose={() => setDocumentModal(null)}
          onConvertToInvoice={() => {
            onPipelineRefresh?.()
            setDocumentModal(null)
          }}
          onSent={() => {
            onPipelineRefresh?.()
          }}
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
            label: 'Sent',
            val: formatCurrency(sentItems.reduce((s, i) => s + i.amount, 0)),
            sub: sentItems.filter((i) => i.type === 'estimate').length
              ? `${sentEstimateOpened} opened, ${sentEstimateUnopened} unopened`
              : 'Awaiting client',
            bar: 'var(--blue)',
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

      <div className="estimates-pipeline-show-declined">
        <label className="estimates-pipeline-show-declined-label">
          <input
            type="checkbox"
            checked={showDeclined}
            onChange={(e) => setShowDeclined(e.target.checked)}
          />
          <span>Show declined</span>
        </label>
      </div>

      <div className="estimates-pipeline-columns">
        {PIPELINE_STAGES.filter((s) => s.key !== 'declined' || showDeclined).map((stage) => (
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
                const isViewed = item.type === 'estimate' && item.viewed_at
                const isChangesRequested = item.type === 'estimate' && item.estimateStatus === 'changes_requested'
                const isAccepted = item.type === 'estimate' && item.stage === 'accepted'
                const changesPreview = item.changes_requested_message
                  ? (item.changes_requested_message.slice(0, 80) + (item.changes_requested_message.length > 80 ? '…' : ''))
                  : ''
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className={`estimates-pipeline-card ${isChangesRequested ? 'estimates-pipeline-card--changes-requested' : ''}`}
                    style={{ borderLeftColor: STAGE_COLORS[item.stage] }}
                    onClick={() => setDocumentModal({ id: item.id, type: item.type })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDocumentModal({ id: item.id, type: item.type })
                      }
                    }}
                  >
                    {isChangesRequested && (
                      <div className="estimates-pipeline-card-banner estimates-pipeline-card-banner--amber">
                        <span className="estimates-pipeline-card-banner-title">Client requested changes</span>
                        {changesPreview && (
                          <p className="estimates-pipeline-card-banner-preview">{changesPreview}</p>
                        )}
                        <button
                          type="button"
                          className="estimates-pipeline-card-banner-action"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDocumentModal({ id: item.id, type: item.type })
                          }}
                        >
                          Revise &amp; Resend →
                        </button>
                      </div>
                    )}
                    <div className="estimates-pipeline-card-job">{jobName}</div>
                    {addr && <div className="estimates-pipeline-card-addr">{addr}</div>}
                    {isViewed && (
                      <div className="estimates-pipeline-card-opened">
                        <span className="estimates-pipeline-card-opened-icon" aria-hidden>👁</span>
                        <span className="estimates-pipeline-card-opened-text">
                          Opened {formatRelative(item.viewed_at)}
                        </span>
                      </div>
                    )}
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
                    {isAccepted && (
                      <button
                        type="button"
                        className="estimates-pipeline-card-convert"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDocumentModal({ id: item.id, type: item.type })
                        }}
                      >
                        Convert to Job →
                      </button>
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
