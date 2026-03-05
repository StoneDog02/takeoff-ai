import { useEffect, useState } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type { Employee, JobAssignment } from '@/types/global'
import { formatDate } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'

type ViewMode = 'by_employee' | 'by_job'

export function JobAssignments() {
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [jobs, setJobs] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('by_employee')

  const load = () => {
    setLoading(true)
    Promise.all([
      teamsApi.jobAssignments.list({ active_only: true }),
      teamsApi.employees.list(),
      getProjectsList().then((p) => p.map((x) => ({ id: x.id, name: x.name }))),
    ])
      .then(([a, e, j]) => {
        setAssignments(a)
        setEmployees(e)
        setJobs(j)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), [])

  const employeeMap = new Map(employees.map((e) => [e.id, e]))
  const jobMap = new Map(jobs.map((j) => [j.id, j.name]))

  const byEmployee = assignments.filter((a) => !a.ended_at)
  const byJob = new Map<string, JobAssignment[]>()
  byEmployee.forEach((a) => {
    const list = byJob.get(a.job_id) || []
    list.push(a)
    byJob.set(a.job_id, list)
  })

  return (
    <div className="teams-tab-body">
      <div className="teams-toolbar-row">
        <div className="teams-pill-toggle">
          <button
            type="button"
            className={view === 'by_employee' ? 'active' : ''}
            onClick={() => setView('by_employee')}
          >
            By employee
          </button>
          <button
            type="button"
            className={view === 'by_job' ? 'active' : ''}
            onClick={() => setView('by_job')}
          >
            By job
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
      ) : byEmployee.length === 0 ? (
        <div className="teams-empty-state">
          <p>No active assignments yet. Add employees in the Roster tab, then assign them to jobs.</p>
        </div>
      ) : view === 'by_employee' ? (
        <div className="teams-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Assigned Job</th>
                <th>Since</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {byEmployee.map((a) => {
                const emp = employeeMap.get(a.employee_id)
                const jobName = jobMap.get(a.job_id) ?? a.job_id
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <TeamsAvatar initials={emp ? getInitials(emp.name) : '?'} size="sm" />
                        <span className="teams-cell-name">{emp?.name ?? a.employee_id}</span>
                      </div>
                    </td>
                    <td><span className="teams-cell-muted">{emp?.role ?? '—'}</span></td>
                    <td><span className="teams-cell-muted">{jobName}</span></td>
                    <td><span className="teams-cell-muted">{a.assigned_at ? formatDate(a.assigned_at) : '—'}</span></td>
                    <td><span className="teams-status-pill active">Active</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="teams-by-job-list">
          {Array.from(byJob.entries()).map(([jobId, workers]) => {
            const jobName = jobMap.get(jobId) ?? jobId
            const activeCount = workers.filter((w) => !w.ended_at).length
            return (
              <div key={jobId} className="teams-card">
                <div className="teams-by-job-card-header">
                  <span className="teams-roster-name">{jobName}</span>
                  <span className="teams-cell-muted" style={{ fontSize: 12 }}>{activeCount} active</span>
                </div>
                <div className="teams-by-job-card-workers">
                  {workers.map((w) => {
                    const emp = employeeMap.get(w.employee_id)
                    return (
                      <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <TeamsAvatar initials={emp ? getInitials(emp.name) : '?'} size="sm" />
                        <div>
                          <div className="teams-cell-name" style={{ fontSize: 13 }}>{emp?.name ?? w.employee_id}</div>
                          <div className="teams-cell-muted" style={{ fontSize: 12 }}>{emp?.role ?? '—'}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
