import { useMemo, useState } from 'react'
import type { Invoice, Job } from '@/types/global'
import { DocumentDetailModal } from './DocumentDetailModal'
import { formatCurrency } from '@/lib/pipeline'

interface PipelineTabProps {
  invoices: Invoice[]
  jobFilterId: string
  jobs: Job[]
  onPipelineRefresh?: () => void | Promise<void>
}

type InvoiceColumnKey = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue'

type InvoiceWithOptionalPaid = Invoice & {
  paid_amount?: number | null
  amount_paid?: number | null
  viewed_at?: string | null
}

const COLUMN_CONFIG: { key: InvoiceColumnKey; label: string; color: string }[] = [
  { key: 'draft', label: 'Draft', color: 'var(--text-muted)' },
  { key: 'sent', label: 'Sent', color: 'var(--blue)' },
  { key: 'viewed', label: 'Viewed', color: 'var(--blue)' },
  { key: 'partial', label: 'Partial', color: 'var(--est-amber)' },
  { key: 'paid', label: 'Paid', color: 'var(--green)' },
  { key: 'overdue', label: 'Overdue', color: 'var(--red)' },
]

function formatInvoiceNumber(id: string): string {
  const digits = (id.match(/\d+/g) || []).join('')
  if (!digits) return `INV-${id.slice(-4).toUpperCase()}`
  return `INV-${digits.slice(-4).padStart(3, '0')}`
}

function formatClientName(invoice: Invoice): string {
  const raw = invoice.recipient_emails?.[0]
  if (!raw) return 'No client'
  const local = raw.split('@')[0] || raw
  return local
    .split(/[._-]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

function formatDueDate(due?: string): string {
  if (!due) return 'No due date'
  const dt = new Date(due)
  if (Number.isNaN(dt.getTime())) return 'No due date'
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function hoursAgo(date: string): number {
  const dt = new Date(date)
  if (Number.isNaN(dt.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60)))
}

function daysOverdue(due?: string): number {
  if (!due) return 0
  const dt = new Date(due)
  if (Number.isNaN(dt.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24)))
}

function getPaidAmount(inv: InvoiceWithOptionalPaid): number {
  const paid = Number(inv.paid_amount ?? inv.amount_paid ?? 0)
  if (Number.isNaN(paid)) return 0
  return Math.max(0, paid)
}

export function PipelineTab({ invoices, jobFilterId, jobs, onPipelineRefresh }: PipelineTabProps) {
  /** When set, show full document modal (estimate/invoice) with API-backed actions */
  const [documentModal, setDocumentModal] = useState<{ id: string; type: 'estimate' | 'invoice' } | null>(null)
  const [showPaid, setShowPaid] = useState(false)
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j.name])), [jobs])

  const filteredInvoices = useMemo(() => {
    return jobFilterId ? invoices.filter((inv) => inv.job_id === jobFilterId) : invoices
  }, [invoices, jobFilterId])

  const grouped = useMemo(() => {
    const init: Record<InvoiceColumnKey, InvoiceWithOptionalPaid[]> = {
      draft: [],
      sent: [],
      viewed: [],
      partial: [],
      paid: [],
      overdue: [],
    }

    filteredInvoices.forEach((inv) => {
      const invoice = inv as InvoiceWithOptionalPaid
      const total = Number(invoice.total_amount || 0)
      const paidAmount = getPaidAmount(invoice)
      const hasPartialPayment = paidAmount > 0 && paidAmount < total && invoice.status !== 'paid'
      const isOverdueByDate = invoice.status !== 'paid' && !!invoice.due_date && daysOverdue(invoice.due_date) > 0

      if (hasPartialPayment) {
        init.partial.push(invoice)
        return
      }

      if (invoice.status === 'draft') init.draft.push(invoice)
      else if (invoice.status === 'sent') init.sent.push(invoice)
      else if (invoice.status === 'viewed') init.viewed.push(invoice)
      else if (invoice.status === 'paid') init.paid.push(invoice)
      else if (invoice.status === 'overdue' || isOverdueByDate) init.overdue.push(invoice)
      else init.sent.push(invoice)
    })

    return init
  }, [filteredInvoices])

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

      <div className="estimates-pipeline-columns">
        {COLUMN_CONFIG.filter((c) => c.key !== 'paid' || showPaid).map((column) => {
          const items = grouped[column.key]
          const total = items.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)
          return (
            <div key={column.key} className="estimates-pipeline-column">
              <div className="estimates-pipeline-column-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    className="estimates-pipeline-column-dot"
                    style={{ background: column.color }}
                  />
                  <span className="estimates-pipeline-column-title">{column.label}</span>
                </div>
                <span className="estimates-pipeline-column-count">
                  {items.length} - {formatCurrency(total)}
                </span>
              </div>
              <div className="estimates-pipeline-column-cards">
                {items.length === 0 && (
                  <div className="estimates-pipeline-column-empty">
                    <span>Empty</span>
                  </div>
                )}
                {items.map((inv) => {
                  const projectName = jobMap.get(inv.job_id) || inv.job_id
                  const clientName = formatClientName(inv)
                  const overdueDays = daysOverdue(inv.due_date)
                  const isOverdue = inv.status === 'overdue' || overdueDays > 0
                  const paidAmount = getPaidAmount(inv)
                  const totalAmount = Number(inv.total_amount || 0)
                  const showPartialProgress = column.key === 'partial' && paidAmount > 0 && totalAmount > 0
                  const viewedAt = inv.viewed_at || (inv.status === 'viewed' ? inv.updated_at : null)
                  const openedText = viewedAt ? `Opened ${hoursAgo(viewedAt)} hours ago` : 'Not opened'
                  return (
                    <div
                      key={inv.id}
                      role="button"
                      tabIndex={0}
                      className="estimates-pipeline-card"
                      style={{ borderLeftColor: column.key === 'overdue' ? 'var(--red)' : column.color }}
                      onClick={() => setDocumentModal({ id: inv.id, type: 'invoice' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setDocumentModal({ id: inv.id, type: 'invoice' })
                        }
                      }}
                    >
                      <div className="estimates-pipeline-card-job">{projectName} - {clientName}</div>
                      <div className="estimates-pipeline-card-id">{formatInvoiceNumber(inv.id)}</div>
                      <div className="estimates-pipeline-card-amount">{formatCurrency(totalAmount)}</div>
                      <div className={`estimates-pipeline-card-addr ${isOverdue ? 'estimates-pipeline-card-addr--overdue' : ''}`}>
                        Due {formatDueDate(inv.due_date)}
                      </div>

                      {(column.key === 'sent' || column.key === 'viewed') && (
                        <div className="estimates-pipeline-card-opened">
                          <span className="estimates-pipeline-card-opened-text">{openedText}</span>
                        </div>
                      )}

                      {showPartialProgress && (
                        <>
                          <div className="estimates-pipeline-card-margin-bar">
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(100, Math.round((paidAmount / totalAmount) * 100))}%`,
                                background: 'var(--est-amber)',
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <div className="estimates-pipeline-card-margin-pct">
                            {formatCurrency(paidAmount)} of {formatCurrency(totalAmount)}
                          </div>
                          <div className="estimates-pipeline-card-milestones">Partially paid</div>
                        </>
                      )}

                      {column.key === 'overdue' && isOverdue && (
                        <div className="estimates-pipeline-card-milestones" style={{ color: 'var(--red)' }}>
                          {overdueDays} day{overdueDays === 1 ? '' : 's'} overdue
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="estimates-pipeline-show-declined">
        <label className="estimates-pipeline-show-declined-label">
          <input
            type="checkbox"
            checked={showPaid}
            onChange={(e) => setShowPaid(e.target.checked)}
          />
          <span>Show paid</span>
        </label>
      </div>
    </div>
  )
}
