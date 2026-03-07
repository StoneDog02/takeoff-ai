import { useState, useEffect } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type {
  Employee,
  TimeEntry,
  AttendanceRecord,
  PayRaise,
  JobAssignment,
} from '@/types/global'
import { dayjs, formatDate, toISODate } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'
import { WeekBars } from './WeekBars'

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
}

export function EmployeePanel({ emp, onClose }: EmployeePanelProps) {
  const [panelTab, setPanelTab] = useState<PanelTab>('overview')
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [payRaises, setPayRaises] = useState<PayRaise[]>([])
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [jobNames, setJobNames] = useState<Record<string, string>>({})
  const [ytdEarnings, setYtdEarnings] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!emp) return
    setPanelTab('overview')
    setLoading(true)
    const year = dayjs().year()
    const fiveWeeksAgo = dayjs().subtract(5, 'week').startOf('week').format('YYYY-MM-DD')
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')
    const monthEnd = dayjs().endOf('month').format('YYYY-MM-DD')
    const weekStart = dayjs().startOf('week').format('YYYY-MM-DD')
    const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD')
    const thirtyDaysAgo = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
    const today = dayjs().format('YYYY-MM-DD')

    Promise.all([
      teamsApi.timeEntries.list({ employee_id: emp.id, from: fiveWeeksAgo, to: today }),
      teamsApi.attendance.list({ employee_id: emp.id, from: thirtyDaysAgo, to: today }),
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

  const onTimeCount = attendanceRecords.filter((r) => getAttendanceStatus(r) === 'on_time').length
  const lateCount = attendanceRecords.filter((r) => getAttendanceStatus(r) === 'late').length
  const earlyCount = attendanceRecords.filter((r) => getAttendanceStatus(r) === 'early_out').length
  const attRate =
    attendanceRecords.length > 0
      ? Math.round((onTimeCount / attendanceRecords.length) * 100)
      : 100

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
              { label: 'Attendance', val: `${attRate}%` },
            ].map((s, i) => (
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
            <p className="teams-muted" style={{ margin: 0 }}>Loading…</p>
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
                  <div className="teams-panel-actions">
                    {!emp.auth_user_id && (
                      <button type="button" className="teams-btn teams-btn-primary">
                        Invite to Portal
                      </button>
                    )}
                    <button type="button" className="teams-btn teams-btn-ghost">
                      Edit Employee
                    </button>
                  </div>
                </div>
              )}

              {panelTab === 'time' && (
                <div className="teams-panel-section">
                  <div className="teams-panel-section-title">Recent Time Entries</div>
                  {recentTimeEntries.length === 0 ? (
                    <div className="teams-panel-empty">No time entries yet</div>
                  ) : (
                    <div className="teams-panel-list">
                      {recentTimeEntries.map((e, i) => {
                        const jobName = jobNames[e.job_id] ?? e.job_id
                        const attRec = attendanceRecords.find(
                          (r) => r.date === e.clock_in.slice(0, 10)
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
                        <span className="teams-panel-rate-value">{attRate}%</span>
                      </div>
                      <div className="teams-panel-rate-bar">
                        <div
                          className="teams-panel-rate-bar-fill"
                          style={{ width: `${attRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="teams-panel-section">
                    <div className="teams-panel-section-title">History</div>
                    {attendanceRecords.length === 0 ? (
                      <div className="teams-panel-empty">No attendance records</div>
                    ) : (
                      <div className="teams-panel-list">
                        {[...attendanceRecords]
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
    </>
  )
}
