import { useState, useEffect, useMemo } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import { ConfirmDialog } from '@/components/settings/ConfirmDialog'
import type {
  Employee,
  TimeEntry,
  AttendanceRecord,
  PayRaise,
  JobAssignment,
} from '@/types/global'
import { dayjs, formatDate, toISODate } from '@/lib/date'
import { mergeAttendanceWithTimeEntries } from '@/lib/mergeAttendanceFromTimeEntries'
import { getInitials } from './TeamsAvatar'
import { WeekBars } from './WeekBars'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { EMPLOYEE_TRADE_ROLE_OPTIONS } from '@/components/teams/employeeTradeRoleOptions'

const PANEL_TABS = ['overview', 'time', 'attendance', 'pay'] as const
type PanelTab = (typeof PANEL_TABS)[number]

const ATT_CONFIG: Record<string, { label: string; class: string }> = {
  on_time: { label: 'On Time', class: 'ontime' },
  late: { label: 'Late', class: 'late' },
  early_out: { label: 'Early Out', class: 'early' },
}

function getAttendanceStatus(r: AttendanceRecord): keyof typeof ATT_CONFIG {
  if (r.late_arrival_minutes != null && r.late_arrival_minutes > 0) return 'late'
  if (r.early_departure_minutes != null && r.early_departure_minutes > 0) return 'early_out'
  return 'on_time'
}

function formatTime(iso: string): string {
  const d = dayjs(iso)
  return d.isValid() ? d.format('h:mm A') : '—'
}

const fmt = (n: number) => '$' + Number(n || 0).toLocaleString()
const fmtRate = (n: number) => `$${n}/hr`

const AVATAR_COLORS: string[] = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#6366F1']
function getAvatarColor(emp: Employee): string {
  const i = emp.name.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_COLORS[Math.abs(i) % AVATAR_COLORS.length]
}

interface EmployeePanelProps {
  emp: Employee | null
  onClose: () => void
  onEmployeeUpdated?: (updated: Employee) => void
  onEmployeeDeleted?: () => void
}

const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'on_site', label: 'On-site' },
  { value: 'off', label: 'Off' },
  { value: 'pto', label: 'PTO' },
] as const

export function EmployeePanel({ emp, onClose, onEmployeeUpdated, onEmployeeDeleted }: EmployeePanelProps) {
  const [panelTab, setPanelTab] = useState<PanelTab>('overview')
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [payRaises, setPayRaises] = useState<PayRaise[]>([])
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [jobNames, setJobNames] = useState<Record<string, string>>({})
  const [ytdEarnings, setYtdEarnings] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<{
    name: string
    role: string
    email: string
    phone: string
    status: 'on_site' | 'off' | 'pto'
    current_compensation: number | ''
    daily_log_access: boolean
  }>({
    name: '',
    role: '',
    email: '',
    phone: '',
    status: 'off',
    current_compensation: '',
    daily_log_access: false,
  })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmValue, setDeleteConfirmValue] = useState('')

  const roleSelectOptions = useMemo(() => {
    const r = editForm.role.trim()
    const base: string[] = [...EMPLOYEE_TRADE_ROLE_OPTIONS]
    if (r && !base.includes(r)) {
      return [r, ...base]
    }
    return base
  }, [editForm.role])

  useEffect(() => {
    if (!emp) return
    setPanelTab('overview')
    setEditing(false)
    setInviteLink(null)
    setInviteMessage(null)
    setEditForm({
      name: emp.name ?? '',
      role: emp.role ?? '',
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      status: (emp.status as 'off' | 'on_site' | 'pto') ?? 'off',
      current_compensation: emp.current_compensation ?? '',
      daily_log_access: emp.daily_log_access === true,
    })
    setLoading(true)
    const year = dayjs().year()
    // Use ISO instants — date-only `to` becomes midnight UTC on the server and excluded same-day shifts.
    const fiveWeeksStart = dayjs().subtract(5, 'week').startOf('week').toISOString()
    const nowIso = dayjs().toISOString()
    const attFrom = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
    const attTo = dayjs().format('YYYY-MM-DD')

    Promise.all([
      teamsApi.timeEntries.list({ employee_id: emp.id, from: fiveWeeksStart, to: nowIso }),
      teamsApi.attendance.list({ employee_id: emp.id, from: attFrom, to: attTo }),
      teamsApi.payRaises.list(emp.id),
      teamsApi.jobAssignments.list({ employee_id: emp.id, active_only: true }),
      getProjectsList().then((p) => {
        const map: Record<string, string> = {}
        p.forEach((x) => { map[x.id] = x.name })
        return map
      }),
      teamsApi.payroll.getYtd(year),
    ])
      .then(([entries, att, raises, assigns, names, ytd]) => {
        setTimeEntries(entries)
        setAttendanceRecords(att)
        setPayRaises(raises)
        setAssignments(assigns)
        setJobNames(names)
        const byEmp = ytd?.by_employee?.find((b) => b.employee_id === emp.id)
        setYtdEarnings(byEmp?.total_earnings ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [emp?.id])

  if (!emp) return null

  const color = getAvatarColor(emp)
  const rate = emp.current_compensation ?? 0

  // Hours this week / month from time entries
  const weekStart = dayjs().startOf('week')
  const weekEnd = dayjs().endOf('week')
  const monthStart = dayjs().startOf('month')
  const monthEnd = dayjs().endOf('month')
  const hoursThisWeek = timeEntries
    .filter((e) => {
      const t = dayjs(e.clock_in).valueOf()
      return t >= weekStart.valueOf() && t <= weekEnd.valueOf()
    })
    .reduce((s, e) => s + (e.hours ?? 0), 0)
  const hoursThisMonth = timeEntries
    .filter((e) => {
      const t = dayjs(e.clock_in).valueOf()
      return t >= monthStart.valueOf() && t <= monthEnd.valueOf()
    })
    .reduce((s, e) => s + (e.hours ?? 0), 0)
  const ytdHours = timeEntries
    .filter((e) => dayjs(e.clock_in).year() === dayjs().year())
    .reduce((s, e) => s + (e.hours ?? 0), 0)
  const ytdDisplay = ytdEarnings ?? rate * ytdHours

  // Last 5 weeks hours (W-4 … Now)
  const weeklyHours: number[] = []
  for (let i = 4; i >= 0; i--) {
    const start = dayjs().subtract(i, 'week').startOf('week')
    const end = dayjs().subtract(i, 'week').endOf('week')
    const h = timeEntries
      .filter((e) => {
        const t = dayjs(e.clock_in).valueOf()
        return t >= start.valueOf() && t <= end.valueOf()
      })
      .reduce((s, e) => s + (e.hours ?? 0), 0)
    weeklyHours.push(Math.round(h * 100) / 100)
  }

  const mergedAttendance = mergeAttendanceWithTimeEntries(attendanceRecords, timeEntries)
  const onTimeCount = mergedAttendance.filter((r) => getAttendanceStatus(r) === 'on_time').length
  const lateCount = mergedAttendance.filter((r) => getAttendanceStatus(r) === 'late').length
  const earlyCount = mergedAttendance.filter((r) => getAttendanceStatus(r) === 'early_out').length
  const attRate =
    mergedAttendance.length > 0
      ? Math.round((onTimeCount / mergedAttendance.length) * 100)
      : null

  const currentJobId = assignments.find((a) => !a.ended_at)?.job_id
  const currentJobName = currentJobId ? jobNames[currentJobId] : null
  const assignedAt = assignments.find((a) => a.job_id === currentJobId)?.assigned_at

  const recentTimeEntries = [...timeEntries]
    .sort((a, b) => dayjs(b.clock_in).valueOf() - dayjs(a.clock_in).valueOf())
    .slice(0, 10)

  return (
    <>
      <div
        className="teams-panel-backdrop"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close panel"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />
      <div className="teams-panel" role="dialog" aria-modal="true" aria-label="Employee profile">
        <div className="teams-panel-header">
          <div className="teams-panel-header-top">
            <div className="teams-panel-emp-info">
              <div
                className="teams-panel-avatar"
                style={{ background: color + '20', color }}
              >
                {getInitials(emp.name)}
              </div>
              <div>
                <div className="teams-panel-name">{emp.name}</div>
                <div className="teams-panel-meta">
                  {emp.role} · {rate ? fmtRate(rate) : '—'}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="teams-panel-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="teams-panel-stats">
            {[
              { label: 'This Week', val: `${Math.round(hoursThisWeek * 100) / 100}h` },
              { label: 'This Month', val: `${Math.round(hoursThisMonth * 100) / 100}h` },
              { label: 'YTD Earnings', val: fmt(ytdDisplay) },
              { label: 'Attendance', val: attRate != null ? `${attRate}%` : '—' },
            ].map((s) => (
              <div key={s.label} className="teams-panel-stat">
                <div className="teams-panel-stat-value">{s.val}</div>
                <div className="teams-panel-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="teams-panel-tabs">
            {PANEL_TABS.map((t) => (
              <button
                key={t}
                type="button"
                className={`teams-panel-tab ${panelTab === t ? 'active' : ''}`}
                onClick={() => setPanelTab(t)}
              >
                {t === 'pay' ? 'Pay & Raises' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="teams-panel-body">
          {loading ? (
            <div className="py-4"><LoadingSkeleton variant="inline" lines={4} /></div>
          ) : (
            <>
              {panelTab === 'overview' && (
                <div className="teams-panel-overview">
                  <div className="teams-panel-section">
                    <div className="teams-panel-section-title">Contact</div>
                    <div className="teams-panel-contact">
                      <span>✉</span> {emp.email}
                    </div>
                    {emp.phone && (
                      <div className="teams-panel-contact">
                        <span>📞</span> {emp.phone}
                      </div>
                    )}
                  </div>
                  <div className="teams-panel-section">
                    <div className="teams-panel-section-title">Current Assignment</div>
                    {currentJobName ? (
                      <div className="teams-panel-job-card">
                        <div className="teams-panel-job-dot" />
                        <div>
                          <div className="teams-panel-job-name">{currentJobName}</div>
                          {assignedAt && (
                            <div className="teams-muted">Since {formatDate(assignedAt)}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="teams-panel-job-card teams-panel-job-empty">
                        Not assigned to a job
                      </div>
                    )}
                  </div>
                  <div className="teams-panel-section">
                    <div className="teams-panel-section-title">Hours (last 5 weeks)</div>
                    <div className="teams-panel-week-bars-wrap">
                      <WeekBars data={weeklyHours} color={color} />
                      <div className="teams-panel-week-now">
                        <div className="teams-panel-week-now-value">{Math.round(hoursThisWeek * 100) / 100}h</div>
                        <div className="teams-muted">this week</div>
                      </div>
                    </div>
                  </div>
                  {editing ? (
                    <div className="teams-panel-section">
                      <div className="teams-panel-section-title">Edit Employee</div>
                      {editError && (
                        <div className="teams-muted" style={{ marginBottom: 8, color: 'var(--color-error, #b91c1c)' }}>{editError}</div>
                      )}
                      <div className="teams-panel-add-raise">
                        <div className="teams-form-row">
                          <label className="teams-label">Name</label>
                          <input
                            type="text"
                            className="teams-input"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          />
                        </div>
                        <div className="teams-form-row">
                          <label className="teams-label">Role</label>
                          <select
                            className="teams-input teams-select"
                            value={editForm.role}
                            onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                          >
                            <option value="">Select role…</option>
                            {roleSelectOptions.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="teams-form-row">
                          <label className="teams-label">Email</label>
                          <input
                            type="email"
                            className="teams-input"
                            value={editForm.email}
                            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                          />
                        </div>
                        <div className="teams-form-row">
                          <label className="teams-label">Phone</label>
                          <input
                            type="text"
                            className="teams-input"
                            value={editForm.phone}
                            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                          />
                        </div>
                        <div className="teams-form-row">
                          <label className="teams-label">Status</label>
                          <select
                            className="teams-input"
                            value={editForm.status}
                            onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as 'on_site' | 'off' | 'pto' }))}
                          >
                            {EMPLOYEE_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="teams-form-row">
                          <label className="teams-label">Current rate ($/hr)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="teams-input"
                            placeholder="0"
                            value={editForm.current_compensation === '' ? '' : editForm.current_compensation}
                            onChange={(e) => {
                              const v = e.target.value
                              setEditForm((f) => ({ ...f, current_compensation: v === '' ? '' : Number(v) }))
                            }}
                          />
                        </div>
                        <div className="teams-form-row teams-form-row--checkbox">
                          <label className="teams-label m-0">Daily log access</label>
                          <label className="flex cursor-pointer items-start gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={editForm.daily_log_access}
                              onChange={(e) => setEditForm((f) => ({ ...f, daily_log_access: e.target.checked }))}
                            />
                            <span className="teams-muted text-[12px] leading-snug">
                              Allow daily logs in the employee portal on assigned jobs. Use this for custom job titles or
                              any role that should not rely on the automatic Project Manager / Site Supervisor /
                              Superintendent rules.
                            </span>
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            type="button"
                            className="teams-btn teams-btn-primary"
                            disabled={saving || !editForm.name.trim()}
                            onClick={async () => {
                              setEditError(null)
                              setSaving(true)
                              try {
                                const payload = {
                                  name: editForm.name.trim(),
                                  role: editForm.role.trim(),
                                  email: editForm.email.trim(),
                                  phone: editForm.phone.trim() || undefined,
                                  status: editForm.status,
                                  current_compensation: editForm.current_compensation === '' ? undefined : Number(editForm.current_compensation),
                                  daily_log_access: editForm.daily_log_access,
                                }
                                const updated = await teamsApi.employees.update(emp.id, payload)
                                onEmployeeUpdated?.(updated)
                                setEditing(false)
                              } catch (err) {
                                setEditError(err instanceof Error ? err.message : 'Failed to save')
                              } finally {
                                setSaving(false)
                              }
                            }}
                          >
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="teams-btn teams-btn-ghost"
                            disabled={saving}
                            onClick={() => {
                              setEditing(false)
                              setEditError(null)
                              setEditForm({
                                name: emp.name ?? '',
                                role: emp.role ?? '',
                                email: emp.email ?? '',
                                phone: emp.phone ?? '',
                                status: (emp.status as 'on_site' | 'off' | 'pto') ?? 'off',
                                current_compensation: emp.current_compensation != null ? emp.current_compensation : '',
                                daily_log_access: emp.daily_log_access === true,
                              })
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {(inviteMessage || inviteLink) && (
                        <div className="teams-panel-section" style={{ marginBottom: 12 }}>
                          <div style={{ padding: 12, background: 'var(--color-surface)', borderRadius: 8, fontSize: 14 }}>
                            {inviteMessage && <div style={{ marginBottom: inviteLink ? 8 : 0 }}>{inviteMessage}</div>}
                            {inviteLink && (
                              <div>
                                <strong>Invite link:</strong>{' '}
                                {inviteLink.startsWith('http') ? (
                                  <a href={inviteLink} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{inviteLink}</a>
                                ) : (
                                  inviteLink
                                )}
                              </div>
                            )}
                            <button type="button" className="teams-btn teams-btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setInviteLink(null); setInviteMessage(null) }}>Dismiss</button>
                          </div>
                        </div>
                      )}
                      <div className="teams-panel-actions">
                        {!emp.auth_user_id && (
                          <button
                            type="button"
                            className="teams-btn teams-btn-primary"
                            disabled={inviting}
                            onClick={async () => {
                              setInviting(true)
                              setInviteLink(null)
                              setInviteMessage(null)
                              try {
                                const res = await teamsApi.employees.invite(emp.id)
                                if (res.invite_email_sent && emp.email) {
                                  setInviteMessage(`Invite email sent to ${emp.email}.`)
                                }
                                if (res.invite_link) setInviteLink(res.invite_link)
                                else if (!res.invite_email_sent) setInviteMessage('Invite created. Set APP_ORIGIN on the server to get a copyable link.')
                              } catch (err) {
                                setInviteMessage(err instanceof Error ? err.message : 'Failed to send invite.')
                              } finally {
                                setInviting(false)
                              }
                            }}
                          >
                            {inviting ? 'Sending…' : 'Invite to Portal'}
                          </button>
                        )}
                        <button
                        type="button"
                        className="teams-btn teams-btn-ghost"
                        onClick={() => setEditing(true)}
                      >
                        Edit Employee
                      </button>
                        <button
                          type="button"
                          className="teams-btn teams-btn-ghost"
                          onClick={() => setShowDeleteConfirm(true)}
                          style={{ color: 'var(--red)' }}
                        >
                          Delete profile
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {panelTab === 'time' && (
                <div className="teams-panel-section">
                  <div className="teams-panel-section-title">Recent Time Entries</div>
                  {recentTimeEntries.length === 0 ? (
                    <div className="teams-panel-empty">No time entries yet</div>
                  ) : (
                    <div className="teams-panel-list">
                      {recentTimeEntries.map((e) => {
                        const jobName = jobNames[e.job_id] ?? e.job_id
                        const attRec = mergedAttendance.find(
                          (r) => r.employee_id === e.employee_id && r.clock_in === e.clock_in
                        )
                        const status = attRec ? getAttendanceStatus(attRec) : 'on_time'
                        const att = ATT_CONFIG[status] ?? ATT_CONFIG.on_time
                        return (
                          <div key={e.id} className="teams-panel-time-row">
                            <div className="teams-panel-time-date">{formatDate(e.clock_in)}</div>
                            <div className="teams-panel-time-detail">
                              <div>{jobName}</div>
                              <div className="teams-muted">
                                {formatTime(e.clock_in)} → {e.clock_out ? formatTime(e.clock_out) : '—'}
                              </div>
                            </div>
                            <div className="teams-panel-time-right">
                              <div className="teams-panel-time-hours">{e.hours ?? 0}h</div>
                              <span className={`teams-status-pill ${att.class}`}>{att.label}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {panelTab === 'attendance' && (
                <div className="teams-panel-overview">
                  <div className="teams-panel-att-grid">
                    {[
                      { label: 'On Time', val: onTimeCount, class: 'ontime' },
                      { label: 'Early Out', val: earlyCount, class: 'early' },
                      { label: 'Late', val: lateCount, class: 'late' },
                    ].map((s) => (
                      <div key={s.label} className={`teams-panel-att-card ${s.class}`}>
                        <div className="teams-panel-att-value">{s.val}</div>
                        <div className="teams-panel-att-label">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="teams-panel-section">
                    <div className="teams-panel-section-title">Attendance Rate</div>
                    <div className="teams-panel-rate-bar-wrap">
                      <div className="teams-panel-rate-bar-labels">
                        <span className="teams-muted">On-time rate</span>
                        <span className="teams-panel-rate-value">{attRate != null ? `${attRate}%` : '—'}</span>
                      </div>
                      <div className="teams-panel-rate-bar">
                        <div
                          className="teams-panel-rate-bar-fill"
                          style={{ width: `${attRate ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="teams-panel-section">
                    <div className="teams-panel-section-title">History</div>
                    {mergedAttendance.length === 0 ? (
                      <div className="teams-panel-empty">No attendance records</div>
                    ) : (
                      <div className="teams-panel-list">
                        {[...mergedAttendance]
                          .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
                          .slice(0, 15)
                          .map((r) => {
                            const status = getAttendanceStatus(r)
                            const att = ATT_CONFIG[status] ?? ATT_CONFIG.on_time
                            return (
                              <div key={r.id} className="teams-panel-att-row">
                                <span className="teams-panel-att-row-date">{formatDate(r.date)}</span>
                                <span className="teams-muted">
                                  {formatTime(r.clock_in)} – {r.clock_out ? formatTime(r.clock_out) : '—'}
                                </span>
                                <span className={`teams-status-pill ${att.class}`}>{att.label}</span>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {panelTab === 'pay' && (
                <div className="teams-panel-overview">
                  <div className="teams-panel-pay-hero">
                    <div>
                      <div className="teams-panel-pay-hero-label">Current Rate</div>
                      <div className="teams-panel-pay-hero-value">{rate ? fmtRate(rate) : '—'}</div>
                    </div>
                    <div className="teams-panel-pay-hero-right">
                      <div className="teams-panel-pay-hero-label">YTD Earnings</div>
                      <div className="teams-panel-pay-hero-ytd">{fmt(ytdDisplay)}</div>
                      <div className="teams-muted">{ytdHours} hrs logged</div>
                    </div>
                  </div>
                  <div className="teams-panel-section">
                    <div className="teams-panel-section-title">Compensation History</div>
                    {payRaises.length === 0 ? (
                      <div className="teams-panel-empty">No raises recorded</div>
                    ) : (
                      <div className="teams-panel-list">
                        {payRaises
                          .sort((a, b) => dayjs(b.effective_date).valueOf() - dayjs(a.effective_date).valueOf())
                          .map((p) => (
                            <div key={p.id} className="teams-panel-pay-row">
                              <div className="teams-panel-pay-dot" />
                              <div className="teams-panel-pay-detail">
                                <div className="teams-panel-pay-reason">{p.notes || 'Raise'}</div>
                                <div className="teams-muted">{p.effective_date}</div>
                              </div>
                              {p.previous_rate != null && p.previous_rate > 0 && (
                                <span className="teams-muted">${p.previous_rate}/hr →</span>
                              )}
                              <span className="teams-panel-pay-rate">
                                ${p.new_rate ?? p.previous_rate ?? 0}/hr
                              </span>
                              {p.new_rate != null && p.previous_rate != null && (
                                <span className="teams-panel-pay-delta">
                                  +${p.new_rate - p.previous_rate}/hr
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="teams-panel-section">
                    <div className="teams-panel-section-title">Add Raise</div>
                    <div className="teams-panel-add-raise">
                      <div className="teams-form-row">
                        <label className="teams-label">Effective Date</label>
                        <input
                          type="date"
                          className="teams-input"
                          defaultValue={toISODate(dayjs())}
                        />
                      </div>
                      <div className="teams-form-row">
                        <label className="teams-label">Amount</label>
                        <input
                          type="text"
                          className="teams-input"
                          placeholder="2.50"
                        />
                      </div>
                      <div className="teams-form-row">
                        <input
                          type="text"
                          className="teams-input"
                          placeholder="Notes (optional)"
                        />
                      </div>
                      <button type="button" className="teams-btn teams-btn-primary" style={{ width: '100%' }}>
                        Add Raise
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Remove employee?"
        message={
          <>
            <strong>{emp?.name}</strong> will be removed from your roster. Time entries, attendance, and job assignments linked to this profile will remain for records, but the employee will no longer appear in your team list. This cannot be undone.
          </>
        }
        confirmLabel={deleting ? 'Removing…' : 'Remove employee'}
        cancelLabel="Cancel"
        variant="danger"
        value={deleteConfirmValue}
        onValueChange={setDeleteConfirmValue}
        onConfirm={async () => {
          if (!emp) return
          setDeleting(true)
          try {
            await teamsApi.employees.delete(emp.id)
            setShowDeleteConfirm(false)
            setDeleteConfirmValue('')
            onClose()
            onEmployeeDeleted?.()
          } catch (err) {
            console.error(err)
          } finally {
            setDeleting(false)
          }
        }}
        onCancel={() => {
          if (!deleting) {
            setShowDeleteConfirm(false)
            setDeleteConfirmValue('')
          }
        }}
      />
    </>
  )
}
