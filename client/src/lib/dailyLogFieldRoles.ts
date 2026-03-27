/** Matches server `isDailyLogFieldRole` — use for job `role_on_job` or roster `employees.role`. */
export function isDailyLogFieldRole(roleOnJob: string | undefined | null): boolean {
  if (!roleOnJob || typeof roleOnJob !== 'string') return false
  const s = roleOnJob.trim().toLowerCase()
  // Crew dropdown historically used "Superintendent" for the site lead; same access as Site Supervisor.
  return s === 'project manager' || s === 'site supervisor' || s === 'superintendent'
}
