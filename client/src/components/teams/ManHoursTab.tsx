import { useCallback, useEffect, useMemo, useState } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type { Employee, TimeEntry } from '@/types/global'
import { dayjs, formatDateTime } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'
import { EditTimeEntryModal } from '@/components/teams/EditTimeEntryModal'

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
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [addForEmployeeId, setAddForEmployeeId] = useState<string | null>(null)
  const [hoursRefreshKey, setHoursRefreshKey] = useState(0)
  /** 0 = current calendar week; each increment steps one week into the past. */
  const [weeksBack, setWeeksBack] = useState(0)

  const viewWeekStart = useMemo(() => dayjs().startOf('week').subtract(weeksBack, 'week'), [weeksBack])
  const viewWeekEnd = useMemo(() => viewWeekStart.endOf('week'), [viewWeekStart])
  const weekStartIso = viewWeekStart.toISOString()
  const weekEndIso = viewWeekEnd.toISOString()
  const weekRangeLabel = `${viewWeekStart.format('MMM D')}–${viewWeekEnd.format('MMM D, YYYY')}`
  const monthStart = dayjs().startOf('month').toISOString()
  const monthEnd = dayjs().endOf('month').toISOString()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      teamsApi.employees.list(),
      getProjectsList().then((p) => p.map((x) => ({ id: x.id, name: x.name }))),
      teamsApi.timeEntries.list({ from: weekStartIso, to: weekEndIso }),
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
  }, [hoursRefreshKey, weekStartIso, weekEndIso, monthStart, monthEnd])

  const selectedEmployee = selectedIndex !== null ? employees[selectedIndex] : null

  useEffect(() => {
    if (!selectedEmployee) {
      setDetailEntries([])
      return
    }
    setDetailLoading(true)
    teamsApi.timeEntries
      .list({ employee_id: selectedEmployee.id, from: weekStartIso, to: weekEndIso })
      .then((rows) =>
        setDetailEntries([...rows].sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()))
      )
      .catch(() => setDetailEntries([]))
      .finally(() => setDetailLoading(false))
  }, [selectedEmployee?.id, hoursRefreshKey, weekStartIso, weekEndIso])

  const closeTimeEntryModal = useCallback(() => {
    setEditEntry(null)
    setAddForEmployeeId(null)
  }, [])
  const onTimeEntrySaved = useCallback(() => setHoursRefreshKey((k) => k + 1), [])
  const openAddTimeEntry = useCallback(() => {
    if (!selectedEmployee) return
    setEditEntry(null)
    setAddForEmployeeId(selectedEmployee.id)
  }, [selectedEmployee])

  const totalWeek = Object.values(weekHoursByEmployee).reduce((s, h) => s + h, 0)
  const totalMonth = Object.values(monthHoursByEmployee).reduce((s, h) => s + h, 0)
  const avgWeek = employees.length ? totalWeek / employees.length : 0
  const jobMap = new Map(jobs.map((j) => [j.id, j.name]))

  return (
    <div className="teams-tab-body">
      <div className="teams-metrics-row">
        <div className="teams-metric-card">
          <div className="teams-metric-label">{weeksBack === 0 ? 'Total This Week' : 'Week total'}</div>
          <div className="teams-metric-value">{loading ? '…' : `${Math.round(totalWeek * 100) / 100} hrs`}</div>
          <div className="teams-metric-sub">{weeksBack === 0 ? 'All employees' : weekRangeLabel}</div>
        </div>
        <div className="teams-metric-card accent-blue">
          <div className="teams-metric-label">Total This Month</div>
          <div className="teams-metric-value">{loading ? '…' : `${Math.round(totalMonth * 100) / 100} hrs`}</div>
          <div className="teams-metric-sub">{dayjs().format('MMMM YYYY')}</div>
        </div>
        <div className="teams-metric-card accent-green">
          <div className="teams-metric-label">Avg Hours/Employee</div>
          <div className="teams-metric-value">{loading ? '…' : `${avgWeek.toFixed(1)} hrs`}</div>
          <div className="teams-metric-sub">{weeksBack === 0 ? 'This week' : weekRangeLabel}</div>
        </div>
      </div>

      <div
        className="teams-detail-header"
        style={{
          marginTop: 4,
          marginBottom: 8,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--bg-raised)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="teams-btn teams-btn-ghost"
            style={{ fontSize: 12, padding: '8px 12px' }}
            onClick={() => setWeeksBack((w) => w + 1)}
          >
            ← Previous week
          </button>
          <button
            type="button"
            className="teams-btn teams-btn-primary"
            style={{ fontSize: 12, padding: '8px 12px' }}
            disabled={weeksBack === 0}
            onClick={() => setWeeksBack(0)}
          >
            This week
          </button>
          <button
            type="button"
            className="teams-btn teams-btn-ghost"
            style={{ fontSize: 12, padding: '8px 12px' }}
            disabled={weeksBack === 0}
            onClick={() => setWeeksBack((w) => Math.max(0, w - 1))}
          >
            Next week →
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 160 }} />
        <div className="teams-cell-muted" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {weeksBack === 0 ? 'Viewing: This week' : `Viewing: ${weekRangeLabel}`}
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
                  <div className="teams-cell-muted" style={{ fontSize: 12 }}>
                    {weeksBack === 0 ? 'This week' : weekRangeLabel}
                  </div>
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
                    {(weekHoursByEmployee[selectedEmployee.id] ?? 0).toFixed(1)} hrs
                    {weeksBack === 0 ? ' this week' : ` · ${weekRangeLabel}`} · YTD —
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="teams-btn teams-btn-primary"
                    style={{ fontSize: 11, padding: '7px 14px' }}
                    onClick={openAddTimeEntry}
                  >
                    Add time entry
                  </button>
                  {onSelectEmployee && (
                    <button
                      type="button"
                      className="teams-btn teams-btn-ghost"
                      style={{ fontSize: 11, padding: '7px 14px' }}
                      onClick={() => onSelectEmployee(selectedEmployee)}
                    >
                      Full Profile →
                    </button>
                  )}
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Job</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Hours</th>
                    <th aria-label="Edit" />
                  </tr>
                </thead>
                <tbody>
                  {detailLoading ? (
                    <tr><td colSpan={6} className="teams-cell-muted" style={{ padding: 24 }}>Loading…</td></tr>
                  ) : detailEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="teams-cell-muted" style={{ padding: 24 }}>
                        <div style={{ marginBottom: 12 }}>
                          No time entries for {weeksBack === 0 ? 'this week' : `the week of ${weekRangeLabel}`}.
                        </div>
                        <button type="button" className="teams-btn teams-btn-primary" style={{ fontSize: 12 }} onClick={openAddTimeEntry}>
                          Add time entry
                        </button>
                      </td>
                    </tr>
                  ) : (
                    detailEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td><span className="teams-cell-name">{dayjs(entry.clock_in).format('MMM D')}</span></td>
                        <td><span className="teams-cell-muted">{jobMap.get(entry.job_id) ?? entry.job_id}</span></td>
                        <td><span className="teams-cell-muted">{formatDateTime(entry.clock_in)}</span></td>
                        <td><span className="teams-cell-muted">{entry.clock_out ? formatDateTime(entry.clock_out) : '—'}</span></td>
                        <td><span className="teams-cell-value">{entry.hours != null ? entry.hours : '—'}</span></td>
                        <td>
                          <button
                            type="button"
                            className="teams-btn teams-btn-ghost"
                            style={{ fontSize: 11, padding: '6px 10px' }}
                            onClick={() => {
                              setAddForEmployeeId(null)
                              setEditEntry(entry)
                            }}
                          >
                            Edit
                          </button>
                        </td>
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

      <EditTimeEntryModal
        entry={editEntry}
        addForEmployeeId={addForEmployeeId}
        addClockInDefaultIso={
          weeksBack > 0
            ? viewWeekStart.hour(8).minute(0).second(0).millisecond(0).toISOString()
            : null
        }
        employeeName={
          selectedEmployee?.name ??
          (editEntry ? (employees.find((e) => e.id === editEntry.employee_id)?.name ?? editEntry.employee_id) : '')
        }
        jobName={editEntry ? (jobMap.get(editEntry.job_id) ?? editEntry.job_id) : ''}
        jobs={jobs}
        onClose={closeTimeEntryModal}
        onSaved={onTimeEntrySaved}
      />
    </div>
  )
}
