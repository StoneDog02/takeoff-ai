import { useEffect, useState } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type { Employee, JobAssignment } from '@/types/global'
import { dayjs } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'
import { AddEmployeeWizardModal } from './AddEmployeeWizardModal'

type ViewMode = 'cards' | 'table'

const STATUS_PILL: Record<string, { class: string; label: string }> = {
  on_site: { class: 'active', label: 'Active' },
  off: { class: 'inactive', label: 'Inactive' },
  pto: { class: 'inactive', label: 'PTO' },
}

/** Attendance flag for card display (from most recent record) */
const ATTENDANCE_DISPLAY: Record<string, { class: string; label: string }> = {
  on_time: { class: 'ontime', label: 'On time' },
  late: { class: 'late', label: 'Late' },
  early_out: { class: 'early', label: 'Early out' },
}

interface EmployeeRosterProps {
  onSelectEmployee?: (emp: Employee) => void
}

type AttendanceFlag = 'on_time' | 'late' | 'early_out'

export function EmployeeRoster({ onSelectEmployee }: EmployeeRosterProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [jobNames, setJobNames] = useState<Record<string, string>>({})
  const [weekHoursByEmployee, setWeekHoursByEmployee] = useState<Record<string, number>>({})
  const [attendanceByEmployee, setAttendanceByEmployee] = useState<Record<string, AttendanceFlag | null>>({})
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showAddWizard, setShowAddWizard] = useState(false)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [addSuccessMessage, setAddSuccessMessage] = useState<string | null>(null)

  const handleInviteToPortal = async (emp: Employee) => {
    if (emp.auth_user_id) return
    setInvitingId(emp.id)
    setInviteLink(null)
    setAddSuccessMessage(null)
    try {
      const res = await teamsApi.employees.invite(emp.id)
      if (res.invite_email_sent && emp.email) {
        setAddSuccessMessage(`Invite email sent to ${emp.email}.`)
      }
      if (res.invite_link) setInviteLink(res.invite_link)
      else if (!res.invite_email_sent) setInviteLink('Invite created. Set APP_ORIGIN on the server to get a copyable link.')
      load()
    } catch (err) {
      console.error(err)
      setInviteLink('Failed to send invite.')
    } finally {
      setInvitingId(null)
    }
  }

  const load = () => {
    setLoading(true)
    const weekStart = dayjs().startOf('week').toISOString()
    const weekEnd = dayjs().endOf('week').toISOString()
    const fromAtt = dayjs().subtract(14, 'day').format('YYYY-MM-DD')
    const toAtt = dayjs().format('YYYY-MM-DD')
    Promise.all([
      teamsApi.employees.list(statusFilter ? { status: statusFilter } : undefined),
      teamsApi.jobAssignments.list({ active_only: true }),
      getProjectsList().then((projects) => {
        const map: Record<string, string> = {}
        projects.forEach((p) => { map[p.id] = p.name })
        return map
      }),
      teamsApi.timeEntries.list({ from: weekStart, to: weekEnd }),
      teamsApi.attendance.list({ from: fromAtt, to: toAtt }),
    ])
      .then(([emps, assigns, names, weekEntries, attRecords]) => {
        setEmployees(emps)
        setAssignments(assigns)
        setJobNames(names)
        setWeekHoursByEmployee(
          weekEntries.reduce<Record<string, number>>((acc, e) => {
            acc[e.employee_id] = (acc[e.employee_id] || 0) + (e.hours ?? 0)
            return acc
          }, {})
        )
        const latestByEmp: Record<string, AttendanceFlag | null> = {}
        attRecords
          .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
          .forEach((r) => {
            if (latestByEmp[r.employee_id] != null) return
            if (r.late_arrival_minutes != null && r.late_arrival_minutes > 0) latestByEmp[r.employee_id] = 'late'
            else if (r.early_departure_minutes != null && r.early_departure_minutes > 0) latestByEmp[r.employee_id] = 'early_out'
            else latestByEmp[r.employee_id] = 'on_time'
          })
        setAttendanceByEmployee(latestByEmp)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  const assignmentsByEmployee = new Map<string, string[]>()
  assignments.forEach((a) => {
    const names = assignmentsByEmployee.get(a.employee_id) || []
    if (jobNames[a.job_id]) names.push(jobNames[a.job_id])
    assignmentsByEmployee.set(a.employee_id, names)
  })

  const filtered = employees

  const handleWizardSuccess = (employee: Employee, inviteSent: boolean) => {
    setShowAddWizard(false)
    load()
    if (inviteSent && employee.email) {
      setAddSuccessMessage(`Invite email sent to ${employee.email}.`)
    }
    onSelectEmployee?.(employee)
  }

  return (
    <div className="teams-tab-body">
      {showAddWizard && (
        <AddEmployeeWizardModal
          onClose={() => setShowAddWizard(false)}
          onSuccess={handleWizardSuccess}
        />
      )}
      {addSuccessMessage && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-surface)', borderRadius: 8, fontSize: 14 }}>
          {addSuccessMessage}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setAddSuccessMessage(null)}>Dismiss</button>
        </div>
      )}
      {inviteLink && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-surface)', borderRadius: 8, fontSize: 14 }}>
          <strong>Invite link:</strong>{' '}
          {inviteLink.startsWith('http') ? (
            <a href={inviteLink} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{inviteLink}</a>
          ) : (
            inviteLink
          )}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setInviteLink(null)}>Dismiss</button>
        </div>
      )}
      <div className="teams-toolbar-row">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="teams-select"
          style={{ maxWidth: 180 }}
        >
          <option value="">All statuses</option>
          <option value="on_site">On-site</option>
          <option value="off">Off</option>
          <option value="pto">PTO</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => setShowAddWizard(true)}>
            Add employee
          </button>
          <div className="teams-pill-toggle">
            <button
              type="button"
              className={viewMode === 'cards' ? 'active' : ''}
              onClick={() => setViewMode('cards')}
            >
              Cards
            </button>
            <button
              type="button"
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading roster…</p>
      ) : filtered.length === 0 ? (
        <div className="teams-empty-state">
          <p>No employees yet. Add your first employee to build your roster and assign them to jobs.</p>
          <button type="button" className="btn btn-primary" onClick={() => setShowAddWizard(true)}>
            Add employee
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="teams-cards-grid">
          {filtered.map((emp) => {
            const jobLabel = (assignmentsByEmployee.get(emp.id) || []).join(', ') || null
            const pill = STATUS_PILL[emp.status] || STATUS_PILL.off
            const hoursThisWeek = weekHoursByEmployee[emp.id] ?? 0
            const attFlag = attendanceByEmployee[emp.id]
            const attDisplay = attFlag ? ATTENDANCE_DISPLAY[attFlag] : null
            const rateStr = emp.current_compensation != null ? `$${emp.current_compensation}/hr` : '—'
            return (
              <div
                key={emp.id}
                className="teams-card teams-roster-card"
                role="button"
                tabIndex={0}
                onClick={() => onSelectEmployee?.(emp)}
                onKeyDown={(e) => e.key === 'Enter' && onSelectEmployee?.(emp)}
                style={{ cursor: onSelectEmployee ? 'pointer' : undefined }}
              >
                <div className="teams-roster-card-top">
                  <TeamsAvatar initials={getInitials(emp.name)} size="lg" />
                  <div className="teams-roster-card-heading">
                    <div className="teams-roster-name">{emp.name}</div>
                    <div className="teams-roster-role">{emp.role}</div>
                  </div>
                  <span className={`teams-status-pill ${pill.class}`}>{pill.label}</span>
                </div>
                {jobLabel && (
                  <div className="teams-roster-card-job">
                    <span className="teams-roster-card-job-icon" aria-hidden>📍</span>
                    <span className="teams-roster-card-job-text">{jobLabel}</span>
                  </div>
                )}
                <div className="teams-roster-card-stats">
                  <div className="teams-roster-card-stat">
                    <div className="teams-roster-card-stat-value">{Math.round(hoursThisWeek * 10) / 10}h</div>
                    <div className="teams-roster-card-stat-label">THIS WEEK</div>
                  </div>
                  <div className="teams-roster-card-stat">
                    <div className="teams-roster-card-stat-value">{rateStr}</div>
                    <div className="teams-roster-card-stat-label">RATE</div>
                  </div>
                  <div className="teams-roster-card-stat">
                    {attDisplay ? (
                      <>
                        <div className="teams-roster-card-stat-value teams-roster-card-att">
                          <span className={`teams-roster-card-att-dot ${attDisplay.class}`} />
                          {attDisplay.label}
                        </div>
                        <div className="teams-roster-card-stat-label">ATTEND.</div>
                      </>
                    ) : (
                      <>
                        <div className="teams-roster-card-stat-value teams-roster-card-att">—</div>
                        <div className="teams-roster-card-stat-label">ATTEND.</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="teams-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Status</th>
                <th>Rate</th>
                <th>Current Job</th>
                <th>Contact</th>
                <th>Portal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => {
                const pill = STATUS_PILL[emp.status] || STATUS_PILL.off
                return (
                  <tr
                    key={emp.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectEmployee?.(emp)}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectEmployee?.(emp)}
                    style={{ cursor: onSelectEmployee ? 'pointer' : undefined }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <TeamsAvatar initials={getInitials(emp.name)} size="sm" />
                        <span className="teams-cell-name">{emp.name}</span>
                      </div>
                    </td>
                    <td><span className="teams-cell-muted">{emp.role}</span></td>
                    <td><span className={`teams-status-pill ${pill.class}`}>{pill.label}</span></td>
                    <td><span className="teams-cell-value">{emp.current_compensation != null ? `$${emp.current_compensation}/hr` : '—'}</span></td>
                    <td><span className="teams-cell-muted">{(assignmentsByEmployee.get(emp.id) || []).join(', ') || '—'}</span></td>
                    <td><span className="teams-cell-muted">{emp.email}</span></td>
                    <td>
                      {emp.auth_user_id ? (
                        <span className="teams-cell-muted" style={{ fontSize: 12 }}>Has access</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={invitingId === emp.id}
                          onClick={() => handleInviteToPortal(emp)}
                        >
                          {invitingId === emp.id ? '…' : 'Invite'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
