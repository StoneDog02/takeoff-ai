import type { TimeEntry, ProjectWorkType } from '@/types/global'

/**
 * Gross pay rate for a clocked time entry (see server/lib/effectivePayRate.js).
 * General labor (`type_key === 'labor'`) uses the employee base rate; other hourly types use the GC rate on the work type.
 */
export function resolveEffectiveHourlyPayRate(
  entry: TimeEntry,
  employeeBaseRate: number,
  workType: ProjectWorkType | undefined,
  jobId: string
): number {
  const base = Number(employeeBaseRate) || 0
  if (!entry.project_work_type_id || !workType) return base
  if (workType.project_id !== jobId || entry.job_id !== jobId) return base
  const typeKey = workType.type_key || ''
  if (typeKey === 'labor') return base
  const unit = String(workType.unit || 'hr').toLowerCase()
  if (unit === 'hr') return Number(workType.rate) || base
  return base
}

export function payrollLineWorkTypeLabel(entry: TimeEntry, workType: ProjectWorkType | undefined): string {
  if (!entry.project_work_type_id || !workType) return 'General labor'
  return workType.name || 'Work type'
}
