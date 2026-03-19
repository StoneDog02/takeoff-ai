/** `unit === 'pct'` means unitPrice/unitCost is a percentage (0–100) of the hard subtotal (all non-pct lines). */

export type PctPricedLine = {
  qty: number
  unitPrice: number
  unit: string
}

export function hardSubtotalExcludingPctLines(lines: ReadonlyArray<PctPricedLine>): number {
  return lines.reduce((sum, e) => {
    if (e.unit === 'pct') return sum
    return sum + (Number(e.qty) || 0) * (Number(e.unitPrice) || 0)
  }, 0)
}

export function cappedPctValue(raw: number): number {
  return Math.min(100, Math.max(0, Number(raw) || 0))
}

/** Dollar amount for one line (pct → % of hard base; else qty × unit price). */
export function lineDollarAmount(line: PctPricedLine, hardSubtotal: number): number {
  if (line.unit === 'pct') {
    const p = cappedPctValue(line.unitPrice)
    return Math.round((p / 100) * hardSubtotal * 100) / 100
  }
  return Math.round((Number(line.qty) || 0) * (Number(line.unitPrice) || 0) * 100) / 100
}
