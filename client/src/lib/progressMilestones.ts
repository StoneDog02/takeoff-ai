/**
 * Progress invoicing milestones (phase-linked) — shared by NewInvoiceModal and phase payment prompt.
 */
import type { Estimate, Phase } from '@/types/global'

export type ProgressMilestone = {
  id: string
  label: string
  pct: number
  amount: number
  invoiced: boolean
}

/**
 * Only read explicit progress milestone arrays from estimate meta.
 * Do not treat top-level `estimate_groups_meta` arrays (line-item groups) as milestones.
 */
export function extractProgressMilestonesOnly(meta: unknown): ProgressMilestone[] {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return []
  const root = meta as Record<string, unknown>
  const candidates = [root.progress_milestones, root.milestones, root.progressInvoicingMilestones]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue
    const parsed = candidate
      .map((m, i) => {
        const rec = m && typeof m === 'object' ? (m as Record<string, unknown>) : null
        if (!rec) return null
        const pct = Number(rec.pct ?? rec.percentage ?? 0)
        const amount = Number(rec.amount ?? 0)
        return {
          id: String(rec.id ?? `ms-${i}`),
          label: String(rec.label ?? rec.name ?? `Milestone ${i + 1}`),
          pct: Number.isFinite(pct) ? pct : 0,
          amount: Number.isFinite(amount) ? amount : 0,
          invoiced: !!(rec.invoiced ?? (rec.status === 'invoiced')),
        } as ProgressMilestone
      })
      .filter((m): m is ProgressMilestone => !!m)
    if (parsed.length > 0) return parsed
  }
  return []
}

function sortPhases(phases: Phase[]): Phase[] {
  return [...phases].sort((a, b) => {
    const oa = a.order ?? 0
    const ob = b.order ?? 0
    if (oa !== ob) return oa - ob
    return String(a.start_date || '').localeCompare(String(b.start_date || ''))
  })
}

/** Split `total` dollars across `parts` buckets with no penny loss. */
export function splitMoneyEqually(total: number, parts: number): number[] {
  if (parts <= 0) return []
  const cents = Math.round(Math.max(0, total) * 100)
  const base = Math.floor(cents / parts)
  const remainder = cents - base * parts
  const out: number[] = []
  for (let i = 0; i < parts; i++) {
    const c = base + (i < remainder ? 1 : 0)
    out.push(c / 100)
  }
  return out
}

/**
 * Progress rows = project phases (Phase builder). Amounts for open phases = equal share of
 * remaining estimate balance (total − invoiced_amount). Invoiced flags merge from saved meta by phase id.
 */
export function buildMilestonesFromProjectPhases(
  phases: Phase[],
  estimate: Estimate,
  metaRows: ProgressMilestone[]
): ProgressMilestone[] {
  const sorted = sortPhases(phases)
  const metaById = new Map(metaRows.map((m) => [m.id, m]))
  const total = Number(estimate.total_amount || 0)
  const invoicedFromApi = Number(estimate.invoiced_amount || 0)
  const remaining = Math.max(0, total - invoicedFromApi)

  const pendingPhases = sorted.filter((ph) => !metaById.get(ph.id)?.invoiced)
  const pendingAmounts = splitMoneyEqually(remaining, pendingPhases.length)
  const amountByPhaseId = new Map<string, number>()
  pendingPhases.forEach((ph, i) => {
    amountByPhaseId.set(ph.id, pendingAmounts[i] ?? 0)
  })

  return sorted.map((ph) => {
    const meta = metaById.get(ph.id)
    const invoiced = !!(meta?.invoiced)
    const amount = invoiced
      ? Math.round(Number(meta?.amount || 0) * 100) / 100
      : Math.round((amountByPhaseId.get(ph.id) ?? 0) * 100) / 100
    const pct = total > 0 ? Math.round((amount / total) * 1000) / 10 : 0
    return {
      id: ph.id,
      label: ph.name || 'Phase',
      pct,
      amount,
      invoiced,
    }
  })
}

export function applyMilestonesToEstimateMeta(meta: unknown, milestones: ProgressMilestone[]): unknown {
  const normalized = milestones.map((m) => ({
    id: m.id,
    label: m.label,
    pct: m.pct,
    amount: m.amount,
    invoiced: m.invoiced,
    status: m.invoiced ? 'invoiced' : 'pending',
  }))
  if (Array.isArray(meta)) {
    return { estimate_groups: meta, progress_milestones: normalized }
  }
  if (meta && typeof meta === 'object') {
    return { ...(meta as Record<string, unknown>), progress_milestones: normalized }
  }
  return { progress_milestones: normalized }
}
