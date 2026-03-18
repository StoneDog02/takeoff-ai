import type { BidSheet, MaterialList, TradePackage } from '@/types/global'

export type GcEstimateLine = {
  description: string
  quantity: number
  unit: string
  unit_price: number
}

function selfPerformLinesValid(pkg: TradePackage): boolean {
  if (!pkg.gc_self_perform || !Array.isArray(pkg.gc_estimate_lines) || pkg.gc_estimate_lines.length === 0) {
    return false
  }
  return pkg.gc_estimate_lines.some((l) => {
    const q = Number(l.quantity) || 0
    const p = Number(l.unit_price) || 0
    return q * p > 0 || p > 0
  })
}

/** Every takeoff / bid-sheet trade scope is either awarded to a sub or marked GC self-perform with priced lines. */
export function allTradesReadyForEstimate(
  bidSheet: BidSheet | null | undefined,
  takeoffs: { material_list?: MaterialList }[]
): boolean {
  const cats = takeoffs[0]?.material_list?.categories ?? []
  const tagsFromTakeoff = cats.map((c) => c.name)
  const tagsFromPkgs = (bidSheet?.trade_packages ?? []).map((p) => p.trade_tag)
  const allTags = [...new Set([...tagsFromTakeoff, ...tagsFromPkgs])]
  if (allTags.length === 0) return false

  const pkgByTag = new Map<string, TradePackage>()
  for (const p of bidSheet?.trade_packages ?? []) {
    if (!pkgByTag.has(p.trade_tag)) pkgByTag.set(p.trade_tag, p)
  }
  const awardedTags = new Set<string>()
  for (const b of bidSheet?.sub_bids ?? []) {
    if (!b.awarded || !bidSheet?.trade_packages) continue
    const pkg = bidSheet.trade_packages.find((p) => p.id === b.trade_package_id)
    if (pkg) awardedTags.add(pkg.trade_tag)
  }

  for (const tag of allTags) {
    if (awardedTags.has(tag)) continue
    const pkg = pkgByTag.get(tag)
    if (pkg && selfPerformLinesValid(pkg)) continue
    return false
  }
  return true
}
