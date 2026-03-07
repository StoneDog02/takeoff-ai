import { useEffect, useState } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type { Employee, TimeEntry } from '@/types/global'
import { dayjs, formatDateTime } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'

interface ManHoursTabProps {
  onSelectEmployee?: (emp: Employee) => void
}

export function ManHoursTab({ onSelectEmployee }: ManHoursTabProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [jobs, setJobs] = useState<{ id: string; name: string }[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekHoursByEmployee, setWeekHoursByEmployee] = useState<Record<string, number>>({})
  const [monthHoursByEmployee, setMonthHoursByEmployee] = useState<Record<string, number>>({})
  const [detailEntries, setDetailEntries] = useState<TimeEntry[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const weekStart = dayjs().startOf('week').toISOString()
  const weekEnd = dayjs().endOf('week').toISOString()
  const monthStart = dayjs().startOf('month').toISOString()
  const monthEnd = dayjs().endOf('month').toISOString()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      teamsApi.employees.list(),
      getProjectsList().then((p) => p.map((x) => ({ id: x.id, name: x.name }))),
      teamsApi.timeEntries.list({ from: weekStart, to: weekEnd }),
      teamsApi.timeEntries.list({ from: monthStart, to: monthEnd }),
    ])
      .then(([e, j, weekEntries, monthEntries]) => {
        setEmployees(e)
        setJobs(j)
        setWeekHoursByEmployee(
          weekEntries.reduce<Record<string, number>>((acc, entry) => {
            const id = entry.employee_id
            acc[id] = (acc[id] || 0) + (entry.hours ?? 0)
            return acc
          }, {})
        )
        setMonthHoursByEmployee(
          monthEntries.reduce<Record<string, number>>((acc, entry) => {
            const id = entry.employee_id
            acc[id] = (acc[id] || 0) + (entry.hours ?? 0)
            return acc
          }, {})
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectedEmployee = selectedIndex !== null ? employees[selectedIndex] : null

  useEffect(() => {
    if (!selectedEmployee) {
      setDetailEntries([])
      return
    }
    setDetailLoading(true)
    const start = dayjs().subtract(7, 'day').toISOString()
    const end = dayjs().add(1, 'day').toISOString()
    teamsApi.timeEntries
      .list({ employee_id: selectedEmployee.id, from: start, to: end })
      .then(setDetailEntries)
      .catch(() => setDetailEntries([]))
      .finally(() => setDetailLoading(false))
  }, [selectedEmployee?.id])

  const totalWeek = Object.values(weekHoursByEmployee).reduce((s, h) => s + h, 0)
  const totalMonth = Object.values(monthHoursByEmployee).reduce((s, h) => s + h, 0)
  const avgWeek = employees.length ? totalWeek / employees.length : 0
  const jobMap = new Map(jobs.map((j) => [j.id, j.name]))

  return (
    <div className="teams-tab-body">
      <div className="teams-metrics-row">
        <div className="teams-metric-card">
          <div className="teams-metric-label">Total This Week</div>
          <div className="teams-metric-value">{loading ? '…' : `${Math.round(totalWeek * 100) / 100} hrs`}</div>
          <div className="teams-metric-sub">All employees</div>
        </div>
        <div className="teams-metric-card accent-blue">
          <div className="teams-metric-label">Total This Month</div>
          <div className="teams-metric-value">{loading ? '…' : `${Math.round(totalMonth * 100) / 100} hrs`}</div>
          <div className="teams-metric-sub">{dayjs().format('MMMM YYYY')}</div>
        </div>
        <div className="teams-metric-card accent-green">
          <div className="teams-metric-label">Avg Hours/Employee</div>
          <div className="teams-metric-value">{loading ? '…' : `${avgWeek.toFixed(1)} hrs`}</div>
          <div className="teams-metric-sub">This week</div>
        </div>
      </div>

      <div className="teams-two-col">
        <div className="teams-sidebar-list" style={{ maxWidth: 340 }}>
          <div className="teams-sidebar-list-title">Employees</div>
          {employees.map((emp, i) => {
            const weekHrs = weekHoursByEmployee[emp.id] ?? 0
            return (
              <div
                key={emp.id}
                className={`teams-sidebar-item ${selectedIndex === i ? 'selected' : ''}`}
                onClick={() => setSelectedIndex(selectedIndex === i ? null : i)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedIndex(selectedIndex === i ? null : i)}
                role="button"
                tabIndex={0}
              >
                <TeamsAvatar initials={getInitials(emp.name)} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="teams-cell-name">{emp.name}</div>
                  <div className="teams-cell-muted" style={{ fontSize: 12 }}>This week</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="teams-metric-value" style={{ fontSize: 16 }}>{weekHrs.toFixed(1)}</div>
                  <div className="teams-cell-muted" style={{ fontSize: 11 }}>hrs</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="teams-detail-panel teams-table-wrap">
          {selectedEmployee ? (
            <>
              <div className="teams-detail-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                <TeamsAvatar initials={getInitials(selectedEmployee.name)} size="md" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="teams-roster-name">{selectedEmployee.name}</div>
                  <div className="teams-cell-muted">
                    {(weekHoursByEmployee[selectedEmployee.id] ?? 0).toFixed(1)} hrs this week · YTD —
                  </div>
                </div>
                {onSelectEmployee && (
                  <button
                    type="button"
                    className="teams-btn teams-btn-ghost"
                    style={{ marginLeft: 'auto', fontSize: 11, padding: '7px 14px' }}
                    onClick={() => onSelectEmployee(selectedEmployee)}
                  >
                    Full Profile →
                  </button>
                )}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Job</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLoading ? (
                    <tr><td colSpan={5} className="teams-cell-muted" style={{ padding: 24 }}>Loading…</td></tr>
                  ) : detailEntries.length === 0 ? (
                    <tr><td colSpan={5} className="teams-cell-muted" style={{ padding: 24 }}>No entries this period.</td></tr>
                  ) : (
                    detailEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td><span className="teams-cell-name">{dayjs(entry.clock_in).format('MMM D')}</span></td>
                        <td><span className="teams-cell-muted">{jobMap.get(entry.job_id) ?? entry.job_id}</span></td>
                        <td><span className="teams-cell-muted">{formatDateTime(entry.clock_in)}</span></td>
                        <td><span className="teams-cell-muted">{entry.clock_out ? formatDateTime(entry.clock_out) : '—'}</span></td>
                        <td><span className="teams-cell-value">{entry.hours != null ? entry.hours : '—'}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <div className="teams-placeholder">
              Select an employee to view time entries
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
