import type { ProjectWorkType } from '@/types/global'

/** Seeded / canonical “General Labor” row (matches server seed). */
export function isGeneralLaborWorkTypeName(w: { name?: string; type_key?: string }): boolean {
  return (w.type_key || '') === 'labor' && (w.name || '').trim().toLowerCase() === 'general labor'
}

/** Hourly `labor` types are paid from each employee’s profile — not the $ amount on the row. */
export function isLaborHourlyEmployeeRate(w: { type_key?: string; unit?: string }): boolean {
  return (w.type_key || '') === 'labor' && (w.unit || 'hr') === 'hr'
}

export function formatWorkTypePayRateDisplay(w: Pick<ProjectWorkType, 'rate' | 'unit' | 'type_key'>): string {
  if (isLaborHourlyEmployeeRate(w)) return 'Employee rate'
  const rate = Number(w.rate) || 0
  const unit = w.unit || 'hr'
  if (unit === 'hr') return `$${rate}/hr`
  if (unit === 'sf') return `$${rate}/sf`
  if (unit === 'ea') return `$${rate}/ea`
  if (unit === 'lf') return `$${rate}/lf`
  return `$${rate}/${unit}`
}
