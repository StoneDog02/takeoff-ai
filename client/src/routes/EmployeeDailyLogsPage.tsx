import { useEffect, useMemo, useState } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import { DailyLogTab } from '@/components/projects/DailyLogTab'
import { useEffectiveEmployee } from '@/hooks/useEffectiveEmployee'
import { useAuth } from '@/contexts/AuthContext'
import { isDailyLogFieldRole } from '@/lib/dailyLogFieldRoles'
import type { JobAssignment, Project } from '@/types/global'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

type EligibleJob = { project: Project; assignment: JobAssignment }

export function EmployeeDailyLogsPage() {
  const { employeeId } = useEffectiveEmployee()
  const { employee: authEmployee } = useAuth()
  const rosterFieldLead = isDailyLogFieldRole(authEmployee?.role)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<EligibleJob[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!employeeId) {
      setLoading(false)
      setJobs([])
      return
    }
    let cancelled = false
    setLoadError(null)
    setLoading(true)
    Promise.all([
      teamsApi.jobAssignments.list({ employee_id: employeeId, active_only: true }),
      getProjectsList(),
    ])
      .then(([assignments, projects]) => {
        if (cancelled) return
        const eligible = rosterFieldLead
          ? assignments
          : assignments.filter((a) => isDailyLogFieldRole(a.role_on_job))
        const byProjectId = new Map(projects.map((p) => [p.id, p]))
        const list: EligibleJob[] = []
        for (const a of eligible) {
          const p = byProjectId.get(a.job_id)
          if (p) list.push({ project: p, assignment: a })
        }
        setJobs(list)
        setProjectId((prev) => {
          if (list.length === 0) return null
          if (prev && list.some((j) => j.project.id === prev)) return prev
          return list[0]!.project.id
        })
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load your jobs.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [employeeId, rosterFieldLead])

  const selected = useMemo(
    () => jobs.find((j) => j.project.id === projectId),
    [jobs, projectId]
  )

  if (!employeeId) {
    return (
      <div className="dashboard-app employee-daily-logs-page flex min-h-[40vh] w-full min-w-0 items-center justify-center p-4 md:p-6">
        <p className="text-sm text-[var(--text-muted)]">Sign in as an employee to use daily logs.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="dashboard-app employee-daily-logs-page w-full min-w-0 p-4 md:p-6">
        <LoadingSkeleton variant="inline" lines={4} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="dashboard-app employee-daily-logs-page w-full min-w-0 p-4 md:p-6">
        <p className="text-sm text-red-600" role="alert">
          {loadError}
        </p>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="dashboard-app employee-daily-logs-page w-full min-w-0 p-4 md:p-6">
        <h1 className="text-lg font-semibold text-[var(--text-primary)] m-0">Daily logs</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
          Daily logs appear when you have an active job assignment and your contractor marks you as a field lead
          either on your <strong>roster profile</strong> (e.g. Site Supervisor) or as your <strong>role on that
          job</strong> under the project&apos;s <strong>Crew</strong> tab. If you should have access, ask them to
          confirm you&apos;re on the crew for that job.
        </p>
      </div>
    )
  }

  return (
    <div className="dashboard-app employee-daily-logs-page w-full min-w-0 p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)] m-0">Daily logs</h1>
          <p className="text-sm text-[var(--text-muted)] m-0 mt-1">
            Entries sync to your contractor&apos;s project — the office sees the same logs.
          </p>
        </div>
        {jobs.length > 1 ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-muted)]">
            Job
            <select
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] min-w-[200px]"
              value={projectId ?? ''}
              onChange={(e) => setProjectId(e.target.value || null)}
            >
              {jobs.map((j) => (
                <option key={j.project.id} value={j.project.id}>
                  {j.project.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {projectId && selected ? (
        <DailyLogTab
          employeePortal
          projectId={projectId}
          projectName={selected.project.name}
          phases={[]}
        />
      ) : null}
    </div>
  )
}
