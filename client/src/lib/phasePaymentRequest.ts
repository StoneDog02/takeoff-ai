/**
 * Send a progress invoice + payment request when a project phase is marked complete.
 */
import { estimatesApi, type EstimateWithLines } from '@/api/estimates'
import type { Estimate, Phase } from '@/types/global'
import {
  extractProgressMilestonesOnly,
  buildMilestonesFromProjectPhases,
  applyMilestonesToEstimateMeta,
} from '@/lib/progressMilestones'

export function formatPhasePaymentUsd(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount)
}

/**
 * Whether this phase has an uninvoiced progress milestone (same logic as progress invoicing).
 */
export function getUninvoicedPaymentForPhase(
  phases: Phase[],
  phaseId: string,
  estimate: Estimate,
  estimateDetail: EstimateWithLines | null
): { amount: number; label: string } | null {
  if (!estimateDetail) return null
  const meta = estimateDetail.estimate_groups_meta
  const fromMeta = extractProgressMilestonesOnly(meta)
  const built = buildMilestonesFromProjectPhases(phases, estimate, fromMeta)
  const row = built.find((m) => m.id === phaseId)
  if (!row || row.invoiced || row.amount <= 0) return null
  return { amount: row.amount, label: row.label }
}

const DISMISS_PREFIX = 'takeoff_phase_pay_dismiss_'

export function dismissPhasePaymentPrompt(projectId: string, phaseId: string): void {
  try {
    localStorage.setItem(`${DISMISS_PREFIX}${projectId}_${phaseId}`, '1')
  } catch {
    /* ignore */
  }
}

export function isPhasePaymentPromptDismissed(projectId: string, phaseId: string): boolean {
  try {
    return localStorage.getItem(`${DISMISS_PREFIX}${projectId}_${phaseId}`) === '1'
  } catch {
    return false
  }
}

/**
 * Create invoice for this phase amount, mark milestone ready + invoiced in estimate meta, send to client.
 */
export async function sendProgressPaymentForPhase(args: {
  phases: Phase[]
  estimateId: string
  phaseId: string
  phaseName: string
  clientEmail: string
}): Promise<void> {
  const detail = await estimatesApi.getEstimate(args.estimateId)
  const meta = detail.estimate_groups_meta
  const base: Record<string, unknown> =
    meta && typeof meta === 'object' && !Array.isArray(meta) ? { ...(meta as Record<string, unknown>) } : {}

  const ready: string[] = Array.isArray(base.milestone_ready_for_payment)
    ? base.milestone_ready_for_payment.map(String)
    : []
  if (!ready.includes(String(args.phaseId))) ready.push(String(args.phaseId))
  base.milestone_ready_for_payment = ready

  const fromMeta = extractProgressMilestonesOnly(base)
  const built = buildMilestonesFromProjectPhases(args.phases, detail, fromMeta)
  const row = built.find((m) => m.id === args.phaseId)
  if (!row || row.invoiced) {
    throw new Error('This phase is already invoiced or has no billable milestone.')
  }
  const amount = row.amount
  if (amount <= 0) {
    throw new Error('Nothing to invoice for this phase.')
  }

  const label = args.phaseName?.trim() || row.label

  const result = await estimatesApi.convertToInvoice(args.estimateId, {
    amount,
    schedule_snapshot: {
      rows: [
        {
          milestone_id: args.phaseId,
          label,
          amount,
          mode: 'on_completion',
          completionTerms: 'on_phase_completion',
        },
      ],
    },
  })

  const updatedMilestones = built.map((m) =>
    m.id === args.phaseId ? { ...m, invoiced: true, amount: m.amount, pct: m.pct } : m
  )
  const nextMeta = applyMilestonesToEstimateMeta(base, updatedMilestones)

  await estimatesApi.updateEstimate(args.estimateId, {
    estimate_groups_meta: nextMeta,
  })

  const email = args.clientEmail.trim()
  await estimatesApi.updateInvoice(result.invoice.id, {
    recipient_emails: [email],
  })
  await estimatesApi.sendInvoice(result.invoice.id, [email])
}
