import { useEffect, useState } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type { Employee, GpsClockOutLog } from '@/types/global'
import { formatDateTime } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'

interface GpsClockOutLogListProps {
  onSelectEmployee?: (emp: Employee) => void
  /** When set, only show clock-outs for this job/project and hide the job filter. */
  fixedJobId?: string
}

export function GpsClockOutLogList({ onSelectEmployee, fixedJobId }: GpsClockOutLogListProps) {
  const [logs, setLogs] = useState<GpsClockOutLog[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [jobs, setJobs] = useState<{ id: string; name: string }[]>([])
  const [jobFilter, setJobFilter] = useState('')
  const [loading, setLoading] = useState(true)

  /** Project detail / single-job view: always filter API by this id — never load org-wide list. */
  const scopedJobId = fixedJobId?.trim() || undefined

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
    let cancelled = false
    const params =
      scopedJobId != null
        ? { job_id: scopedJobId }
        : jobFilter
          ? { job_id: jobFilter }
          : undefined
    teamsApi.gpsClockOut
      .list(params)
      .then((data) => {
        if (!cancelled) setLogs(data)
      })
      .catch(() => {
        if (!cancelled) setLogs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [scopedJobId, jobFilter])

  const employeeMap = new Map(employees.map((e) => [e.id, e]))
  const jobMap = new Map(jobs.map((j) => [j.id, j.name]))

  return (
    <>
      {!scopedJobId && (
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
      )}
      <div className="teams-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              {!scopedJobId && <th>Job</th>}
              <th>Exited At</th>
              <th>Location</th>
              <th>Trigger</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={scopedJobId ? 4 : 5} className="teams-cell-muted" style={{ padding: 24 }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={scopedJobId ? 4 : 5} className="teams-cell-muted" style={{ padding: 40, textAlign: 'center' }}>
                  {scopedJobId
                    ? 'No GPS-triggered clock-outs for this job yet. When a geofence is set and an employee leaves the boundary while clocked in here, it will appear in this list.'
                    : "No GPS-triggered clock-outs. When a geofence is set and an employee leaves the boundary while clocked in, it'll appear here."}
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const emp = employeeMap.get(log.employee_id)
                return (
                  <tr
                    key={log.id}
                    role={onSelectEmployee && emp ? 'button' : undefined}
                    tabIndex={onSelectEmployee && emp ? 0 : undefined}
                    onClick={() => emp && onSelectEmployee?.(emp)}
                    onKeyDown={(e) => emp && onSelectEmployee && e.key === 'Enter' && onSelectEmployee(emp)}
                    style={{ cursor: onSelectEmployee && emp ? 'pointer' : undefined }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <TeamsAvatar initials={getInitials(emp?.name ?? '?')} size="sm" />
                        <span className="teams-cell-name">{emp?.name ?? log.employee_id}</span>
                      </div>
                    </td>
                    {!scopedJobId && (
                      <td><span className="teams-cell-muted">{jobMap.get(log.job_id) ?? log.job_id}</span></td>
                    )}
                    <td><span className="teams-cell-value" style={{ fontWeight: 500 }}>{formatDateTime(log.exited_at)}</span></td>
                    <td><span className="teams-cell-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.lat != null && log.lng != null ? `${log.lat.toFixed(5)}, ${log.lng.toFixed(5)}` : '—'}</span></td>
                    <td><span className="teams-status-pill late">Left boundary</span></td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
