import {
  BUDGET_CATEGORY_KEY_TO_UNITS_CATEGORY,
  CATEGORY_UNITS,
  DEFAULT_UNITS,
  type CategoryUnitsCategory,
} from '@/constants/units'

export { CATEGORY_UNITS, DEFAULT_UNITS } from '@/constants/units'

export function unitOptionsForCategory(category?: string | null) {
  if (!category) return DEFAULT_UNITS
  const cat = category as CategoryUnitsCategory
  return CATEGORY_UNITS[cat] ?? DEFAULT_UNITS
}

export function unitOptionsForBudgetCategoryKey(budgetKey?: string | null) {
  const label = budgetKey ? BUDGET_CATEGORY_KEY_TO_UNITS_CATEGORY[budgetKey] : null
  return unitOptionsForCategory(label ?? null)
}

/** When category changes: keep unit if valid for the new list, else first option (most common for that category). */
export function nextUnitForCategory(
  categoryLabel: string | null | undefined,
  currentUnit?: string | null
): string {
  const opts = unitOptionsForCategory(categoryLabel)
  const u = (currentUnit ?? '').trim()
  if (u && opts.some((o) => o.value === u)) return u
  return opts[0]?.value ?? 'ea'
}

export function nextUnitForBudgetCategoryKey(budgetKey: string, currentUnit?: string | null): string {
  const label = BUDGET_CATEGORY_KEY_TO_UNITS_CATEGORY[budgetKey] ?? 'Other'
  return nextUnitForCategory(label, currentUnit)
}

/** Line-item budget categories (same labels as estimate wizard / CATEGORY_UNITS). */
export const LINE_ITEM_BUDGET_CATEGORY_LABELS = [
  'Labor',
  'Materials',
  'Subcontractors',
  'Equipment',
  'Permits & Fees',
  'Overhead',
  'Other',
] as const

export type LineItemBudgetCategoryLabel = (typeof LINE_ITEM_BUDGET_CATEGORY_LABELS)[number]

/** Map Products & Services `item_type` to a budget category label for unit lists. */
export function estimateBudgetCategoryFromProductItemType(itemType?: string | null): LineItemBudgetCategoryLabel {
  const t = (itemType || '').toLowerCase()
  if (t === 'labor') return 'Labor'
  if (t === 'sub') return 'Subcontractors'
  if (t === 'equipment') return 'Equipment'
  if (t === 'product' || t === 'material') return 'Materials'
  return 'Other'
}
