/** Matches server `isDailyLogFieldRole` — use for job `role_on_job` or roster `employees.role`. */
export function isDailyLogFieldRole(roleOnJob: string | undefined | null): boolean {
  if (!roleOnJob || typeof roleOnJob !== 'string') return false
  const s = roleOnJob.trim().toLowerCase()
  // Crew dropdown historically used "Superintendent" for the site lead; same access as Site Supervisor.
  return s === 'project manager' || s === 'site supervisor' || s === 'superintendent'
}

/** Roster-level: explicit GC flag or classic field-lead titles on the employee profile. */
export function rosterAllowsDailyLogAccess(
  rosterRole: string | undefined | null,
  dailyLogAccess: boolean | undefined | null
): boolean {
  return dailyLogAccess === true || isDailyLogFieldRole(rosterRole)
}

/** Per active assignment: GC flag, roster title, or role on that job. */
export function assignmentAllowsDailyLogAccess(
  rosterRole: string | undefined | null,
  roleOnJob: string | undefined | null,
  dailyLogAccess: boolean | undefined | null
): boolean {
  return dailyLogAccess === true || isDailyLogFieldRole(rosterRole) || isDailyLogFieldRole(roleOnJob)
}
