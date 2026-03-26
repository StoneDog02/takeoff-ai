import { hardSubtotalExcludingPctLines, lineDollarAmount, type PctPricedLine } from '@/lib/estimatePctLine'

export type ClientFacingLineItem = {
  id: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  /** Budget-style category (Labor, Materials, …) for the Category column. */
  section?: string | null
  /**
   * When set, `section_notes` from the estimate are keyed by this (e.g. takeoff trade / bid scope name)
   * instead of `section`.
   */
  noteSectionKey?: string | null
}

const BUDGET_LABELS = new Set([
  'Labor',
  'Materials',
  'Subcontractors',
  'Equipment',
  'Permits & Fees',
  'Overhead',
  'Other',
])

function budgetCategoryFromMetaGroup(
  raw: unknown,
  source: string
): string {
  if (typeof raw === 'string' && BUDGET_LABELS.has(raw)) return raw
  if (source === 'takeoff') return 'Materials'
  if (source === 'bid') return 'Subcontractors'
  return 'Other'
}

/**
 * Older UI added each takeoff picker line as `source: 'custom'` with categoryName === long description.
 * Merge those into one takeoff group so the client sees a single scope row (not each material line).
 */
function preprocessMetaMergingLegacyTakeoffPickerCustom(meta: unknown[]): unknown[] {
  const legacy: Record<string, unknown>[] = []
  const rest: Record<string, unknown>[] = []
  for (const g of meta) {
    if (!g || typeof g !== 'object') continue
    const gr = g as Record<string, unknown>
    if (gr.source !== 'custom') {
      rest.push(gr)
      continue
    }
    const items = Array.isArray(gr.items) ? gr.items : []
    if (items.length !== 1 || !items[0] || typeof items[0] !== 'object') {
      rest.push(gr)
      continue
    }
    const it = items[0] as Record<string, unknown>
    const desc = String(it.description ?? '').trim()
    const cn = String(gr.categoryName ?? '').trim()
    const bc = budgetCategoryFromMetaGroup(gr.budgetCategory, 'custom')
    // Old "From takeoff" stored each line as custom with categoryName === full takeoff description.
    if (bc === 'Materials' && cn === desc && desc.length >= 80) {
      legacy.push(gr)
      continue
    }
    rest.push(gr)
  }
  if (legacy.length < 2) return meta

  const costSubtotal = Math.round(legacy.reduce((s, g) => s + (Number(g.costSubtotal) || 0), 0) * 100) / 100
  const synthetic: Record<string, unknown> = {
    id: 'legacy-takeoff-merge',
    categoryName: 'Takeoff materials',
    source: 'takeoff',
    items: legacy.flatMap((g) => (Array.isArray(g.items) ? g.items : [])),
    costSubtotal,
    markupPct: Number(legacy[0]?.markupPct) || 0,
    budgetCategory: 'Materials',
  }
  return [...rest, synthetic]
}

function pctLineFromItem(it: Record<string, unknown>): PctPricedLine {
  return {
    qty: Number(it.qty) || 0,
    unitPrice: Number(it.unitCost) || 0,
    unit: String(it.unit ?? 'ea'),
  }
}

/**
 * One row per logical group for customer-facing estimates:
 * - takeoff: single “scope” line (categoryName) + rolled-up total — no per-material takeoff lines
 * - bid: trade/scope + optional subcontractor name + awarded total
 * - custom: unchanged (one row per line)
 */
export function buildClientFacingLineItemsFromEstimateGroupsMeta(
  meta: unknown,
  fallbackLineItems: ClientFacingLineItem[]
): ClientFacingLineItem[] {
  if (!Array.isArray(meta) || meta.length === 0) return fallbackLineItems

  const metaCoalesced = preprocessMetaMergingLegacyTakeoffPickerCustom(meta)
  const groups = metaCoalesced.filter((g): g is Record<string, unknown> => g != null && typeof g === 'object')
  if (groups.length === 0) return fallbackLineItems

  const flatForHard: PctPricedLine[] = []
  for (const g of groups) {
    const items = Array.isArray(g.items) ? g.items : []
    for (const it of items) {
      if (!it || typeof it !== 'object') continue
      flatForHard.push(pctLineFromItem(it as Record<string, unknown>))
    }
  }
  const globalHard = hardSubtotalExcludingPctLines(flatForHard)

  const out: ClientFacingLineItem[] = []
  let n = 0

  for (const g of groups) {
    const source = g.source === 'bid' || g.source === 'takeoff' || g.source === 'custom' ? g.source : 'custom'
    const categoryName = String(g.categoryName ?? '').trim()
    const budgetCat = budgetCategoryFromMetaGroup(g.budgetCategory, source)
    const costSubtotal = Math.round((Number(g.costSubtotal) || 0) * 100) / 100

    if (source === 'takeoff') {
      const desc = categoryName || 'Scope of work'
      out.push({
        id: `meta-takeoff-${n++}`,
        description: desc,
        quantity: 1,
        unit: 'ls',
        unit_price: costSubtotal,
        total: costSubtotal,
        section: budgetCat,
        noteSectionKey: categoryName || null,
      })
      continue
    }

    if (source === 'bid') {
      const subs = Array.isArray(g.subNotes) ? g.subNotes : []
      const subName =
        subs[0] && typeof subs[0] === 'object' && subs[0] != null && 'subcontractor' in subs[0]
          ? String((subs[0] as { subcontractor?: string }).subcontractor ?? '').trim()
          : ''
      const primary = categoryName || 'Subcontractor work'
      const desc =
        subName && !primary.toLowerCase().includes(subName.toLowerCase())
          ? `${primary} — ${subName}`
          : primary
      out.push({
        id: `meta-bid-${n++}`,
        description: desc,
        quantity: 1,
        unit: 'job',
        unit_price: costSubtotal,
        total: costSubtotal,
        section: budgetCat,
        noteSectionKey: categoryName || null,
      })
      continue
    }

    const items = Array.isArray(g.items) ? g.items : []
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue
      const it = raw as Record<string, unknown>
      const line = pctLineFromItem(it)
      const total = Math.round(lineDollarAmount(line, globalHard) * 100) / 100
      out.push({
        id: `meta-custom-${n++}`,
        description: String(it.description ?? '') || '—',
        quantity: Number(it.qty) || 0,
        unit: String(it.unit ?? 'ea'),
        unit_price: Number(it.unitCost) || 0,
        total,
        section: budgetCat,
      })
    }
  }

  if (out.length === 0) return fallbackLineItems
  return out
}
