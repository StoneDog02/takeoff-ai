/**
 * Build unified pipeline (estimate + invoice) items for the Pipeline tab.
 * Maps our estimate/invoice statuses to pipeline stages: draft → sent → accepted → invoiced → paid.
 */
import type { Estimate, Invoice, Job, PipelineItem, PipelineStage } from '@/types/global'

function estimateStatusToStage(status: Estimate['status']): PipelineStage {
  switch (status) {
    case 'draft': return 'draft'
    case 'sent':
    case 'viewed':
    case 'changes_requested':
      return 'sent'
    case 'accepted': return 'accepted'
    case 'declined': return 'declined'
    default: return 'draft'
  }
}

function invoiceStatusToStage(status: Invoice['status']): PipelineStage {
  switch (status) {
    case 'paid': return 'paid'
    case 'draft':
    case 'sent':
    case 'viewed':
    case 'overdue':
      return 'invoiced'
    default: return 'invoiced'
  }
}

/** Build milestones for an estimate from invoiced_amount (optional; for mock we can pass explicit milestones). */
export function buildMilestonesFromInvoiced(
  totalAmount: number,
  invoicedAmount: number,
  labels: string[] = ['Deposit (30%)', 'Rough-in (40%)', 'Completion (30%)'],
  pcts: number[] = [30, 40, 30]
): PipelineItem['milestones'] {
  const milestones: PipelineItem['milestones'] = []
  let remaining = invoicedAmount
  for (let i = 0; i < labels.length && i < pcts.length; i++) {
    const pct = pcts[i]
    const amount = Math.round((totalAmount * pct) / 100)
    const status = remaining >= amount ? 'invoiced' : 'pending'
    if (remaining >= amount) remaining -= amount
    else remaining = 0
    milestones.push({ label: labels[i], pct, amount, status })
  }
  return milestones
}

export function buildPipelineItems(
  estimates: Estimate[],
  invoices: Invoice[],
  jobs: Job[],
  /** Optional: map estimate id -> milestones for progress invoicing (e.g. from mock). */
  estimateMilestones?: Record<string, PipelineItem['milestones']>
): PipelineItem[] {
  const jobMap = new Map(jobs.map((j) => [j.id, j.name]))
  const items: PipelineItem[] = []

  const estimateIdsWithInvoices = new Set(
    invoices.map((i) => i.estimate_id).filter(Boolean) as string[]
  )

  estimates.forEach((e) => {
    if (estimateIdsWithInvoices.has(e.id)) return
    const stage = estimateStatusToStage(e.status)
    const jobName = jobMap.get(e.job_id) ?? e.job_id
    const client = e.recipient_emails?.[0] ?? null
    const invoiced = Number(e.invoiced_amount ?? 0)
    const milestones = estimateMilestones?.[e.id] ?? buildMilestonesFromInvoiced(
      Number(e.total_amount),
      invoiced
    )
    items.push({
      id: e.id,
      type: 'estimate',
      job_id: e.job_id,
      jobName,
      client,
      date: e.created_at,
      amount: Number(e.total_amount),
      stage,
      invoiced,
      paid: 0,
      milestones,
      estimateStatus: e.status,
      viewed_at: e.viewed_at ?? null,
      changes_requested_message: e.changes_requested_message ?? null,
    })
  })

  invoices.forEach((i) => {
    const stage = invoiceStatusToStage(i.status)
    const jobName = jobMap.get(i.job_id) ?? i.job_id
    const client = i.recipient_emails?.[0] ?? null
    const paid = i.status === 'paid' ? Number(i.total_amount) : 0
    items.push({
      id: i.id,
      type: 'invoice',
      job_id: i.job_id,
      jobName,
      client,
      date: i.created_at,
      amount: Number(i.total_amount),
      stage,
      invoiced: Number(i.total_amount),
      paid,
      milestones: [],
      estimate_id: i.estimate_id,
    })
  })

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function formatCurrency(n: number): string {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0
}

export const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'paid', label: 'Paid' },
  { key: 'declined', label: 'Declined' },
]
