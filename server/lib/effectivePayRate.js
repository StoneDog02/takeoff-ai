/**
 * Gross pay rate for a clocked time entry.
 * - General labor (project work type with type_key "labor"): employee's base hourly rate.
 * - Other hourly work types (GC-set rates, e.g. equipment $200/hr): project_work_types.rate.
 * - Legacy entries (no work type): employee base rate.
 * - Non-hourly work types (sf, ea, etc.): employee base for now (quantity-based pay not on the clock entry).
 *
 * @param {object} entry - time_entries row (expects job_id, project_work_type_id)
 * @param {number} employeeBaseRate - employees.current_compensation ($/hr)
 * @param {object | null | undefined} workType - project_work_types row or null
 * @param {string} jobId - must match entry.job_id; work type must belong to this job
 * @returns {number}
 */
function resolveEffectiveHourlyPayRate(entry, employeeBaseRate, workType, jobId) {
  const base = Number(employeeBaseRate) || 0
  if (!entry?.project_work_type_id || !workType) return base
  if (workType.project_id !== jobId || entry.job_id !== jobId) return base
  const typeKey = workType.type_key || ''
  if (typeKey === 'labor') return base
  const unit = String(workType.unit || 'hr').toLowerCase()
  if (unit === 'hr') return Number(workType.rate) || base
  return base
}

module.exports = { resolveEffectiveHourlyPayRate }
