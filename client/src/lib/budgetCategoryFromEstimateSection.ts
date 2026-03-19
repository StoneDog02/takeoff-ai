/**
 * Maps estimate line `section` to budget_line_items.category-style keys
 * (aligned with server / EstimateBuilderModal `inferBudgetCategoryKeyFromEstimateLine`).
 */
export function budgetCategoryKeyFromEstimateSection(section: string | null | undefined): string {
  const s = String(section || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .trim()
  if (!s) return 'other'
  if (s.includes('labor')) return 'labor'
  if (s.includes('material')) return 'materials'
  if (s.includes('subcontractor') || /^sub\s/.test(s) || s === 'subs') return 'subs'
  if (s.includes('equipment')) return 'equipment'
  if (s.includes('permit')) return 'permits'
  if (s.includes('overhead')) return 'overhead'
  return 'other'
}
