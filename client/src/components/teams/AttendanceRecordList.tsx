import { useEffect, useState } from 'react'
import { teamsApi } from '@/api/teamsClient'
import type { AttendanceRecord, Employee } from '@/types/global'
import { dayjs, formatDate, formatDateTime } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'

type AttFilter = 'all' | 'on-time' | 'early-out' | 'late'

interface AttendanceRecordListProps {
  onSelectEmployee?: (emp: Employee) => void
}

export function AttendanceRecordList({ onSelectEmployee }: AttendanceRecordListProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeFilter, setEmployeeFilter] = useState<string>('')
  const [attFilter, setAttFilter] = useState<AttFilter>('all')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    const from = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
    const to = dayjs().format('YYYY-MM-DD')
    Promise.all([
      teamsApi.attendance.list(
        employeeFilter ? { employee_id: employeeFilter, from, to } : { from, to }
      ),
      teamsApi.employees.list(),
    ])
      .then(([r, e]) => {
        setRecords(r)
        setEmployees(e)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), [employeeFilter])

  const employeeMap = new Map(employees.map((x) => [x.id, x]))
  const lateCount = records.filter((r) => r.late_arrival_minutes != null && r.late_arrival_minutes > 0).length
  const earlyCount = records.filter((r) => r.early_departure_minutes != null && r.early_departure_minutes > 0).length
  const onTimeCount = records.length - lateCount - earlyCount

  const getRecordStatus = (r: AttendanceRecord): AttFilter => {
    if (r.late_arrival_minutes != null && r.late_arrival_minutes > 0) return 'late'
    if (r.early_departure_minutes != null && r.early_departure_minutes > 0) return 'early-out'
    return 'on-time'
  }
  const filteredRecords =
    attFilter === 'all'
      ? records
      : records.filter((r) => getRecordStatus(r) === attFilter)

  return (
    <div className="teams-tab-body">
      <div className="teams-metrics-row">
        <div className="teams-metric-card accent-green">
          <div className="teams-metric-label">On Time</div>
          <div className="teams-metric-value">{loading ? '…' : onTimeCount}</div>
          <div className="teams-metric-sub">Last 30 days</div>
        </div>
        <div className="teams-metric-card">
          <div className="teams-metric-label">Late Arrivals</div>
          <div className="teams-metric-value">{loading ? '…' : lateCount}</div>
          <div className="teams-metric-sub">Last 30 days</div>
        </div>
        <div className="teams-metric-card accent-blue">
          <div className="teams-metric-label">Early Departures</div>
          <div className="teams-metric-value">{loading ? '…' : earlyCount}</div>
          <div className="teams-metric-sub">Last 30 days</div>
        </div>
      </div>

      <div className="teams-toolbar-row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <select
          className="teams-select"
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', background: 'var(--bg-raised)', borderRadius: 7, padding: 3, gap: 2, border: '1px solid var(--border)' }}>
          {(['all', 'on-time', 'early-out', 'late'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAttFilter(v)}
              style={{
                padding: '4px 10px',
                border: 'none',
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                background: attFilter === v ? 'var(--color-surface-elevated)' : 'transparent',
                color: attFilter === v ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: attFilter === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {v === 'all' ? 'All' : v === 'on-time' ? 'On Time' : v === 'early-out' ? 'Early Out' : 'Late'}
            </button>
          ))}
        </div>
      </div>

      <div className="teams-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="teams-cell-muted" style={{ padding: 24 }}>Loading…</td></tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="teams-cell-muted" style={{ padding: 32, textAlign: 'center' }}>
                  No attendance records in the last 30 days.
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => {
                const status = r.late_arrival_minutes != null && r.late_arrival_minutes > 0
                  ? 'late'
                  : r.early_departure_minutes != null && r.early_departure_minutes > 0
                    ? 'early'
                    : 'ontime'
                const statusLabel = status === 'late' ? 'Late' : status === 'early' ? 'Early out' : 'On time'
                const emp = employeeMap.get(r.employee_id)
                return (
                  <tr
                    key={r.id}
                    role={onSelectEmployee && emp ? 'button' : undefined}
                    tabIndex={onSelectEmployee && emp ? 0 : undefined}
                    onClick={() => emp && onSelectEmployee?.(emp)}
                    onKeyDown={(e) => emp && onSelectEmployee && e.key === 'Enter' && onSelectEmployee(emp)}
                    style={{ cursor: onSelectEmployee && emp ? 'pointer' : undefined }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <TeamsAvatar initials={getInitials(emp?.name ?? '?')} size="sm" />
                        <span className="teams-cell-name">{emp?.name ?? r.employee_id}</span>
                      </div>
                    </td>
                    <td><span className="teams-cell-muted">{formatDate(r.date)}</span></td>
                    <td><span className="teams-cell-value" style={{ fontWeight: 500 }}>{formatDateTime(r.clock_in)}</span></td>
                    <td><span className="teams-cell-value" style={{ fontWeight: 500 }}>{r.clock_out ? formatDateTime(r.clock_out) : '—'}</span></td>
                    <td><span className={`teams-status-pill ${status}`}>{statusLabel}</span></td>
                    <td><span className="teams-cell-muted">{r.notes || '—'}</span></td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
