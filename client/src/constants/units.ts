/**
 * Canonical unit options per budget / line-item category (same lists as estimate builder).
 * Import from here for the raw map; use `@/lib/categoryUnits` for next-unit coercion helpers.
 */
export type CategoryUnitsCategory =
  | 'Labor'
  | 'Materials'
  | 'Subcontractors'
  | 'Equipment'
  | 'Permits & Fees'
  | 'Overhead'
  | 'Other'

export const CATEGORY_UNITS: Record<CategoryUnitsCategory, { value: string; label: string }[]> = {
  Labor: [
    { value: 'hr', label: 'per hr' },
    { value: 'day', label: 'per day' },
    { value: 'week', label: 'per week' },
    { value: 'person', label: 'per person' },
    { value: 'ls', label: 'lump sum' },
  ],
  Materials: [
    { value: 'sf', label: 'per sf' },
    { value: 'lf', label: 'per lf' },
    { value: 'ea', label: 'per ea' },
    { value: 'cy', label: 'per CY' },
    { value: 'ton', label: 'per ton' },
    { value: 'lb', label: 'per lb' },
    { value: 'gal', label: 'per gal' },
    { value: 'box', label: 'per box' },
    { value: 'sheet', label: 'per sheet' },
    { value: 'ls', label: 'lump sum' },
  ],
  Subcontractors: [
    { value: 'ls', label: 'lump sum' },
    { value: 'sf', label: 'per sf' },
    { value: 'unit', label: 'per unit' },
    { value: 'day', label: 'per day' },
  ],
  Equipment: [
    { value: 'day', label: 'per day' },
    { value: 'week', label: 'per week' },
    { value: 'month', label: 'per month' },
    { value: 'hr', label: 'per hr' },
    { value: 'ls', label: 'lump sum' },
  ],
  'Permits & Fees': [
    { value: 'ls', label: 'lump sum' },
    { value: 'ea', label: 'per ea' },
    { value: 'unit', label: 'per unit' },
  ],
  Overhead: [
    { value: 'ls', label: 'lump sum' },
    { value: 'hr', label: 'per hr' },
    { value: 'day', label: 'per day' },
    { value: 'pct', label: '% of total' },
  ],
  Other: [
    { value: 'hr', label: 'per hr' },
    { value: 'sf', label: 'per sf' },
    { value: 'lf', label: 'per lf' },
    { value: 'ea', label: 'per ea' },
    { value: 'ls', label: 'lump sum' },
  ],
}

export const DEFAULT_UNITS: { value: string; label: string }[] = [
  { value: 'hr', label: 'per hr' },
  { value: 'sf', label: 'per sf' },
  { value: 'lf', label: 'per lf' },
  { value: 'ea', label: 'per ea' },
  { value: 'cy', label: 'per CY' },
  { value: 'ls', label: 'lump sum' },
]

/** Budget tab `category` keys → `CATEGORY_UNITS` keys. */
export const BUDGET_CATEGORY_KEY_TO_UNITS_CATEGORY: Record<string, CategoryUnitsCategory> = {
  labor: 'Labor',
  materials: 'Materials',
  subs: 'Subcontractors',
  equipment: 'Equipment',
  permits: 'Permits & Fees',
  overhead: 'Overhead',
  other: 'Other',
}
