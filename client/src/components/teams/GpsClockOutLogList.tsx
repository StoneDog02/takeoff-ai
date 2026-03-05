import { useEffect, useState } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type { Employee, GpsClockOutLog } from '@/types/global'
import { formatDateTime } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'

export function GpsClockOutLogList() {
  const [logs, setLogs] = useState<GpsClockOutLog[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [jobs, setJobs] = useState<{ id: string; name: string }[]>([])
  const [jobFilter, setJobFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      teamsApi.employees.list(),
      getProjectsList().then((p) => p.map((x) => ({ id: x.id, name: x.name }))),
    ]).then(([e, j]) => {
      setEmployees(e)
      setJobs(j)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    teamsApi.gpsClockOut
      .list(jobFilter ? { job_id: jobFilter } : undefined)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [jobFilter])

  const employeeMap = new Map(employees.map((e) => [e.id, e]))
  const jobMap = new Map(jobs.map((j) => [j.id, j.name]))

  return (
    <>
      <div className="teams-toolbar-row" style={{ padding: '0 24px 12px' }}>
        <span className="teams-metric-label" style={{ marginBottom: 0, marginRight: 4 }}>Job:</span>
        <select
          className="teams-select"
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">All jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.name}</option>
          ))}
        </select>
      </div>
      <div className="teams-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Job</th>
              <th>Exited At</th>
              <th>Location</th>
              <th>Trigger</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="teams-cell-muted" style={{ padding: 24 }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="teams-cell-muted" style={{ padding: 40, textAlign: 'center' }}>
                  No GPS-triggered clock-outs. When a geofence is set and an employee leaves the boundary while clocked in, it'll appear here.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <TeamsAvatar initials={getInitials(employeeMap.get(log.employee_id)?.name ?? '?')} size="sm" />
                      <span className="teams-cell-name">{employeeMap.get(log.employee_id)?.name ?? log.employee_id}</span>
                    </div>
                  </td>
                  <td><span className="teams-cell-muted">{jobMap.get(log.job_id) ?? log.job_id}</span></td>
                  <td><span className="teams-cell-value" style={{ fontWeight: 500 }}>{formatDateTime(log.exited_at)}</span></td>
                  <td><span className="teams-cell-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.lat != null && log.lng != null ? `${log.lat.toFixed(5)}, ${log.lng.toFixed(5)}` : '—'}</span></td>
                  <td><span className="teams-status-pill late">Left boundary</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
