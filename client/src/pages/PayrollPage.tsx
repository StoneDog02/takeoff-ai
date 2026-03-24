import { useEffect, useState, useMemo, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Download, Send, FileText, Search, ChevronDown, ChevronUp, Calendar, AlertTriangle, UserCircle, ExternalLink } from 'lucide-react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import { api } from '@/api/client'
import { quickbooksApi } from '@/api/quickbooks'
import type { Employee, ProjectWorkType, TimeEntry } from '@/types/global'
import { payrollLineWorkTypeLabel, resolveEffectiveHourlyPayRate } from '@/lib/effectivePayRate'
import { dayjs } from '@/lib/date'
import { TeamsAvatar, getInitials } from '@/components/teams/TeamsAvatar'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

interface PayrollContact {
  name: string
  email: string
  phone?: string
}

type DateRangeKey = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom'
type ViewMode = 'summary' | 'detailed'

interface DateRange {
  from: string
  to: string
  label: string
}

function getRange(key: DateRangeKey, customFrom?: string, customTo?: string): DateRange {
  const now = dayjs()
  switch (key) {
    case 'this-week':
      return {
        from: now.startOf('week').toISOString(),
        to: now.endOf('week').toISOString(),
        label: `This week (${now.startOf('week').format('MMM D')}–${now.endOf('week').format('MMM D, YYYY')})`,
      }
    case 'last-week':
      return {
        from: now.subtract(1, 'week').startOf('week').toISOString(),
        to: now.subtract(1, 'week').endOf('week').toISOString(),
        label: `Last week`,
      }
    case 'this-month':
      return {
        from: now.startOf('month').toISOString(),
        to: now.endOf('month').toISOString(),
        label: `This month`,
      }
    case 'last-month':
      return {
        from: now.subtract(1, 'month').startOf('month').toISOString(),
        to: now.subtract(1, 'month').endOf('month').toISOString(),
        label: `Last month`,
      }
    case 'custom':
      const from = customFrom ? dayjs(customFrom).startOf('day').toISOString() : now.startOf('week').toISOString()
      const to = customTo ? dayjs(customTo).endOf('day').toISOString() : now.endOf('week').toISOString()
      return {
        from,
        to,
        label: `${dayjs(from).format('MMM D')}–${dayjs(to).format('MMM D, YYYY')}`,
      }
    default:
      return getRange('this-week')
  }
}

interface EmployeePayrollRow {
  employee: Employee
  totalHours: number
  grossPay: number
  entries: TimeEntry[]
}

function buildPayrollData(
  employees: Employee[],
  entries: TimeEntry[],
  workTypeById: Map<string, ProjectWorkType>
): EmployeePayrollRow[] {
  const empMap = new Map(employees.map((e) => [e.id, e]))
  const byEmployee = new Map<string, { entries: TimeEntry[]; hours: number; pay: number }>()

  for (const entry of entries) {
    const emp = empMap.get(entry.employee_id)
    if (!emp) continue
    const hours = entry.hours ?? 0
    const wt = entry.project_work_type_id ? workTypeById.get(entry.project_work_type_id) : undefined
    const rate = resolveEffectiveHourlyPayRate(entry, emp.current_compensation ?? 0, wt, entry.job_id)
    const pay = hours * rate
    let rec = byEmployee.get(entry.employee_id)
    if (!rec) {
      rec = { entries: [], hours: 0, pay: 0 }
      byEmployee.set(entry.employee_id, rec)
    }
    rec.entries.push(entry)
    rec.hours += hours
    rec.pay += pay
  }

  return Array.from(byEmployee.entries())
    .map(([employeeId, { entries: e, hours, pay }]) => ({
      employee: empMap.get(employeeId)!,
      totalHours: Math.round(hours * 100) / 100,
      grossPay: Math.round(pay * 100) / 100,
      entries: e.sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()),
    }))
    .filter((r) => r.employee)
}

function buildCSV(rows: EmployeePayrollRow[], range: DateRange): string {
  const headers = ['Employee', 'Role', 'Base Rate ($/hr)', 'Total Hours', 'Gross Pay']
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(
      [
        `"${row.employee.name}"`,
        `"${row.employee.role}"`,
        row.employee.current_compensation ?? '',
        row.totalHours,
        row.grossPay.toFixed(2),
      ].join(',')
    )
  }
  lines.push('')
  lines.push(`Period,${range.label}`)
  lines.push(`Total Employees,${rows.length}`)
  lines.push(
    `Total Hours,${rows.reduce((s, r) => s + r.totalHours, 0).toFixed(2)}`
  )
  lines.push(
    `Gross Payroll,$${rows.reduce((s, r) => s + r.grossPay, 0).toFixed(2)}`
  )
  return lines.join('\n')
}

export function PayrollPage() {
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>('this-week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('summary')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [workTypeById, setWorkTypeById] = useState<Map<string, ProjectWorkType>>(() => new Map())
  const [jobs, setJobs] = useState<{ id: string; name: string; address?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [payrollContact, setPayrollContactState] = useState<PayrollContact | null>(null)
  const [contactForm, setContactForm] = useState<PayrollContact>({ name: '', email: '', phone: '' })
  const [contactLoading, setContactLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [expandedSummaryIds, setExpandedSummaryIds] = useState<Set<string>>(new Set())
  const [quickbooksConnected, setQuickbooksConnected] = useState<boolean | null>(null)

  const toggleSummaryExpand = (employeeId: string) => {
    setExpandedSummaryIds((prev) => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  const range = useMemo(
    () => getRange(dateRangeKey, customFrom || undefined, customTo || undefined),
    [dateRangeKey, customFrom, customTo]
  )

  useEffect(() => {
    setLoading(true)
    Promise.all([
      teamsApi.employees.list(),
      getProjectsList().then((p) => p.map((x) => ({ id: x.id, name: x.name, address: x.address_line_1 }))),
      teamsApi.timeEntries.list({ from: range.from, to: range.to }),
    ])
      .then(async ([e, j, ent]) => {
        setEmployees(e)
        setJobs(j)
        setEntries(ent)
        const jobIds = [...new Set(ent.map((x) => x.job_id))]
        const merged = new Map<string, ProjectWorkType>()
        await Promise.all(
          jobIds.map((jid) =>
            api.projects.getWorkTypes(jid).then((list) => {
              for (const w of list) merged.set(w.id, w)
            })
          )
        ).catch(() => {})
        setWorkTypeById(merged)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [range.from, range.to])

  useEffect(() => {
    setContactLoading(true)
    teamsApi.payroll
      .getContact()
      .then((c) => {
        setPayrollContactState(c)
        if (c) setContactForm({ name: c.name, email: c.email, phone: c.phone ?? '' })
      })
      .catch(() => {})
      .finally(() => setContactLoading(false))
  }, [])

  useEffect(() => {
    quickbooksApi
      .getPayrollStatus()
      .then(() => setQuickbooksConnected(true))
      .catch(() => setQuickbooksConnected(false))
  }, [])

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j.name])), [jobs])
  const jobAddressMap = useMemo(() => new Map(jobs.map((j) => [j.id, j.address ?? j.name])), [jobs])
  const payrollRows = useMemo(
    () => buildPayrollData(employees, entries, workTypeById),
    [employees, entries, workTypeById]
  )

  const totalHours = payrollRows.reduce((s, r) => s + r.totalHours, 0)
  const totalGross = payrollRows.reduce((s, r) => s + r.grossPay, 0)
  const avgRate = totalHours > 0 ? totalGross / totalHours : 0

  const handleExportCSV = () => {
    const csv = buildCSV(payrollRows, range)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-${dayjs(range.from).format('YYYY-MM-DD')}-to-${dayjs(range.to).format('YYYY-MM-DD')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleApproveAndRun = () => {
    if (!payrollContact?.email) {
      setContactModalOpen(true)
      return
    }
    setApproveModalOpen(true)
  }

  const confirmSend = async () => {
    if (!payrollContact?.email) return
    setSending(true)
    try {
      await teamsApi.payroll.recordRun({
        period_from: range.from,
        period_to: range.to,
        recipient_email: payrollContact.email,
        recipient_name: payrollContact.name || undefined,
        employee_count: payrollRows.length,
        total_hours: totalHours,
        gross_pay: totalGross,
      })
    } catch {
      // still open mailto if record fails
    }
    const subject = encodeURIComponent(`Payroll report ${dayjs(range.from).format('MMM D')}–${dayjs(range.to).format('MMM D, YYYY')}`)
    const body = encodeURIComponent(
      `Please find the attached payroll summary for ${range.label}.\n\n` +
        `Employees: ${payrollRows.length}\nTotal Hours: ${totalHours.toFixed(2)}\nGross Payroll: $${totalGross.toFixed(2)}\n\n` +
        `(Export the CSV from the app and attach to this email, or use the numbers above.)`
    )
    window.open(`mailto:${payrollContact.email}?subject=${subject}&body=${body}`, '_blank')
    setSending(false)
    setSent(true)
    setTimeout(() => {
      setApproveModalOpen(false)
      setSent(false)
    }, 1500)
  }

  const saveContact = async () => {
    const email = contactForm.email.trim()
    if (!email) return
    const payload: PayrollContact = {
      name: contactForm.name.trim(),
      email,
      phone: contactForm.phone?.trim() || undefined,
    }
    try {
      await teamsApi.payroll.setContact(payload)
      setPayrollContactState(payload)
      setContactModalOpen(false)
    } catch {
      // leave modal open on error
    }
  }

  const periodLabel = `${dayjs(range.from).format('MMM D')}-${dayjs(range.to).format('D, YYYY')}`

  return (
    <div className="dashboard-app teams-page payroll-page">
      <div className="teams-page-inner">
        <div className="payroll-page-header">
          <div>
            <h1 className="dashboard-title">Payroll</h1>
            <p className="teams-tab-header-desc">
              Gross pay uses each employee’s base rate for general labor work types, and the job’s rate for other hourly work types (for example equipment). Review hours and line-item rates before you run payroll.
            </p>
          </div>
          <div className="payroll-header-actions">
            <button type="button" className="payroll-btn secondary" onClick={handleExportCSV} disabled={loading}>
              <Download size={16} />
              Export CSV
            </button>
            <button type="button" className="payroll-btn primary" onClick={handleApproveAndRun} disabled={loading}>
              Approve & Run
              <Send size={14} />
            </button>
          </div>
        </div>

        <div className="payroll-filters-row">
          <div className="payroll-date-tabs">
            {(['this-week', 'last-week', 'this-month', 'last-month', 'custom'] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`payroll-date-tab ${dateRangeKey === key ? 'active' : ''}`}
                onClick={() => setDateRangeKey(key)}
              >
                {key === 'this-week' && 'This week'}
                {key === 'last-week' && 'Last week'}
                {key === 'this-month' && 'This month'}
                {key === 'last-month' && 'Last month'}
                {key === 'custom' && 'Custom range'}
              </button>
            ))}
          </div>
          {dateRangeKey === 'custom' && (
            <div className="payroll-custom-dates">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="payroll-date-input"
              />
              <span className="payroll-date-sep">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="payroll-date-input"
              />
            </div>
          )}
          <div className="payroll-view-toggle">
            <button
              type="button"
              className={`payroll-view-btn ${viewMode === 'summary' ? 'active' : ''}`}
              onClick={() => setViewMode('summary')}
            >
              <FileText size={14} />
              Summary
            </button>
            <button
              type="button"
              className={`payroll-view-btn ${viewMode === 'detailed' ? 'active' : ''}`}
              onClick={() => setViewMode('detailed')}
            >
              <Search size={14} />
              Detailed
            </button>
          </div>
        </div>

        <div className="payroll-cards-row">
          <div className="payroll-summary-card accent-blue">
            <div className="payroll-summary-label">EMPLOYEES</div>
            <div className="payroll-summary-value">{loading ? '…' : payrollRows.length}</div>
            <div className="payroll-summary-sub">with hours this period</div>
          </div>
          <div className="payroll-summary-card accent-orange">
            <div className="payroll-summary-label">TOTAL HOURS</div>
            <div className="payroll-summary-value">{loading ? '…' : `${totalHours.toFixed(1)} hrs`}</div>
            <div className="payroll-summary-sub">across all jobs</div>
          </div>
          <div className="payroll-summary-card accent-green">
            <div className="payroll-summary-label">GROSS PAY</div>
            <div className="payroll-summary-value payroll-value-green">{loading ? '…' : `$${totalGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</div>
            <div className="payroll-summary-sub">before taxes & deductions</div>
          </div>
          <div className="payroll-summary-card accent-red">
            <div className="payroll-summary-label">AVG RATE</div>
            <div className="payroll-summary-value">{loading ? '…' : `$${avgRate.toFixed(2)}/hr`}</div>
            <div className="payroll-summary-sub">blended this period</div>
          </div>
        </div>

        {quickbooksConnected !== null && (
          <div className="payroll-qb-corrections" style={{ marginTop: 24, marginBottom: 24 }}>
            <div className="payroll-summary-card" style={{ maxWidth: '100%', padding: '20px 24px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>QuickBooks payroll corrections</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #6b7280)', lineHeight: 1.4 }}>
                    {quickbooksConnected
                      ? 'Need to fix a paycheck or submit a payroll amendment? Open QuickBooks to correct payroll. In-app correction submission will be available after Intuit enables the Payroll API for this app.'
                      : 'Connect QuickBooks in Settings to open payroll corrections from here.'}
                  </p>
                </div>
                {quickbooksConnected ? (
                  <a
                    href="https://qbo.intuit.com/app/homepage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="payroll-btn primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <ExternalLink size={16} />
                    Open QuickBooks to correct payroll
                  </a>
                ) : (
                  <Link to="/settings" className="payroll-btn secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <ExternalLink size={16} />
                    Connect QuickBooks
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'detailed' && (
          <div className="payroll-period-bar">
            <Calendar size={14} />
            <span>{periodLabel.toUpperCase()} · ALL SHIFTS</span>
          </div>
        )}

        <div className="payroll-content">
          {loading ? (
            <div className="payroll-content py-8">
              <LoadingSkeleton variant="inline" lines={6} className="max-w-md" />
            </div>
          ) : viewMode === 'summary' ? (
            <div className="payroll-summary-list">
              {payrollRows.length === 0 ? (
                <div className="payroll-empty">No hours logged for this period.</div>
              ) : (
                payrollRows.map((row) => {
                  const isExpanded = expandedSummaryIds.has(row.employee.id)
                  const baseRate = row.employee.current_compensation ?? 0
                  return (
                    <div key={row.employee.id} className="payroll-employee-card summary">
                      <TeamsAvatar initials={getInitials(row.employee.name)} size="lg" />
                      <div className="payroll-employee-info">
                        <div className="payroll-employee-top">
                          <div className="payroll-employee-name-role">
                            <button
                              type="button"
                              className="payroll-employee-name-btn"
                              onClick={() => toggleSummaryExpand(row.employee.id)}
                            >
                              <span className="payroll-employee-name">{row.employee.name}</span>
                              {isExpanded ? <ChevronUp size={18} className="payroll-chevron" /> : <ChevronDown size={18} className="payroll-chevron" />}
                            </button>
                            <div className="payroll-employee-role">{row.employee.role}</div>
                          </div>
                          <div className="payroll-employee-metrics">
                            <span><span className="payroll-metric-label">BASE RATE:</span> <span className="payroll-metric-value">${baseRate}/hr</span></span>
                            <span><span className="payroll-metric-label">TOTAL HOURS:</span> <span className="payroll-metric-value">{row.totalHours} hrs</span></span>
                            <span><span className="payroll-metric-label">GROSS PAY:</span> <span className="payroll-metric-value">${row.grossPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                          </div>
                        </div>
                      </div>
                      <div className="payroll-employee-meta">
                        <span className="payroll-status-pill active">Active</span>
                        <button
                          type="button"
                          className="payroll-expand-btn"
                          onClick={() => toggleSummaryExpand(row.employee.id)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                          {isExpanded ? <ChevronUp size={18} className="payroll-chevron" /> : <ChevronDown size={18} className="payroll-chevron" />}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="payroll-summary-detail">
                          <table className="payroll-summary-detail-table">
                            <thead>
                              <tr>
                                <th>WORK TYPE & JOB</th>
                                <th>DATE(S)</th>
                                <th>HRS</th>
                                <th>RATE</th>
                                <th>SUBTOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.entries.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="payroll-summary-detail-empty">No entries this period.</td>
                                </tr>
                              ) : (
                                row.entries.map((entry) => {
                                  const h = entry.hours ?? 0
                                  const wt = entry.project_work_type_id ? workTypeById.get(entry.project_work_type_id) : undefined
                                  const lineRate = resolveEffectiveHourlyPayRate(
                                    entry,
                                    row.employee.current_compensation ?? 0,
                                    wt,
                                    entry.job_id
                                  )
                                  const sub = h * lineRate
                                  const jobLabel = jobAddressMap.get(entry.job_id) ?? jobMap.get(entry.job_id) ?? entry.job_id
                                  const typeLabel = payrollLineWorkTypeLabel(entry, wt)
                                  return (
                                    <tr key={entry.id}>
                                      <td>
                                        <div className="payroll-summary-detail-work">
                                          <span className="payroll-summary-detail-type">{typeLabel}</span>
                                          <span className="payroll-summary-detail-job">{jobLabel}</span>
                                        </div>
                                      </td>
                                      <td>{dayjs(entry.clock_in).format('MMM D, YYYY')}</td>
                                      <td className="payroll-summary-detail-num">{h.toFixed(2)}</td>
                                      <td className="payroll-summary-detail-rate">${lineRate.toFixed(2)}/hr</td>
                                      <td className="payroll-summary-detail-num">${sub.toFixed(2)}</td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                          </table>
                          <div className="payroll-summary-subtotal-row">
                            <span className="payroll-summary-subtotal-label">Subtotal — {row.employee.name}</span>
                            <span className="payroll-summary-subtotal-hrs">{row.totalHours.toFixed(2)}</span>
                            <span className="payroll-summary-subtotal-rate">blended</span>
                            <span className="payroll-summary-subtotal-gross payroll-value-green">${row.grossPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <div className="payroll-detailed-list">
              {payrollRows.length === 0 ? (
                <div className="payroll-empty">No hours logged for this period.</div>
              ) : (
                payrollRows.map((row) => {
                  const baseRate = row.employee.current_compensation ?? 0
                  const byDay = new Map<string, TimeEntry[]>()
                  for (const e of row.entries) {
                    const day = dayjs(e.clock_in).format('YYYY-MM-DD')
                    if (!byDay.has(day)) byDay.set(day, [])
                    byDay.get(day)!.push(e)
                  }
                  const days = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]))
                  return (
                    <div key={row.employee.id} className="payroll-detailed-employee">
                      <div className="payroll-detailed-header">
                        <TeamsAvatar initials={getInitials(row.employee.name)} size="lg" />
                        <div className="payroll-detailed-header-info">
                          <div className="payroll-employee-name">{row.employee.name}</div>
                          <div className="payroll-employee-role">{row.employee.role} · Base ${baseRate}/hr</div>
                        </div>
                        <div className="payroll-detailed-header-stats">
                          <span>
                            <span className="payroll-header-stat-label">SHIFTS</span>
                            <span className="payroll-header-stat-value">{row.entries.length}</span>
                          </span>
                          <span>
                            <span className="payroll-header-stat-label">HOURS</span>
                            <span className="payroll-header-stat-value">{row.totalHours}</span>
                          </span>
                          <span>
                            <span className="payroll-header-stat-label">GROSS PAY</span>
                            <span className="payroll-header-stat-value payroll-header-gross">${row.grossPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </span>
                        </div>
                      </div>
                      <div className="payroll-detailed-table-wrap">
                        <table className="payroll-detail-table">
                          <thead>
                            <tr>
                              <th>DATE</th>
                              <th>WORK TYPE</th>
                              <th>JOB SITE</th>
                              <th>HRS</th>
                              <th>RATE</th>
                              <th>SUBTOTAL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {days.map(([day, dayEntries]) => (
                              <Fragment key={day}>
                                {dayEntries.map((entry, i) => {
                                  const h = entry.hours ?? 0
                                  const wt = entry.project_work_type_id ? workTypeById.get(entry.project_work_type_id) : undefined
                                  const lineRate = resolveEffectiveHourlyPayRate(
                                    entry,
                                    row.employee.current_compensation ?? 0,
                                    wt,
                                    entry.job_id
                                  )
                                  const sub = h * lineRate
                                  const typeLabel = payrollLineWorkTypeLabel(entry, wt)
                                  return (
                                    <tr key={entry.id}>
                                      {i === 0 ? (
                                        <td rowSpan={dayEntries.length} className="payroll-date-cell">
                                          <div className="payroll-date-line">
                                            <span className="payroll-date-text">
                                              <span className="payroll-day-dot" />
                                              {dayjs(day).format('ddd MMM D')}
                                            </span>
                                            <span className="payroll-date-hrs">
                                              {dayEntries.reduce((s, e) => s + (e.hours ?? 0), 0).toFixed(2)} hrs
                                            </span>
                                          </div>
                                        </td>
                                      ) : null}
                                      <td>
                                        <div className="payroll-work-type">
                                          <span>{typeLabel}</span>
                                          <span className="payroll-billed-pill">paid @ ${lineRate.toFixed(2)}/hr</span>
                                        </div>
                                      </td>
                                      <td>{jobAddressMap.get(entry.job_id) ?? jobMap.get(entry.job_id) ?? entry.job_id}</td>
                                      <td>{h.toFixed(2)}</td>
                                      <td>${lineRate.toFixed(2)}/hr</td>
                                      <td>${sub.toFixed(2)}</td>
                                    </tr>
                                  )
                                })}
                              </Fragment>
                            ))}
                            <tr className="payroll-week-total-row">
                              <td colSpan={3} className="payroll-week-total-label">
                                Week total — {row.employee.name}
                              </td>
                              <td className="payroll-week-total-hrs">{row.totalHours.toFixed(2)}</td>
                              <td className="payroll-week-total-rate">
                                <span className="payroll-week-total-rate-muted">blended</span> ${(row.totalHours > 0 ? row.grossPay / row.totalHours : baseRate).toFixed(2)}/hr
                              </td>
                              <td className="payroll-week-total-gross payroll-value-green">${row.grossPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {!loading && payrollRows.length > 0 && (
          <div className="payroll-footer-bar">
            <div className="payroll-footer-left">
              Grand Total — {payrollRows.length} employees · {periodLabel}
            </div>
            <div className="payroll-footer-stats">
              <span>TOTAL HOURS</span>
              <span className="payroll-footer-value">{totalHours.toFixed(1)} hrs</span>
            </div>
            <div className="payroll-footer-stats">
              <span>GROSS PAYROLL</span>
              <span className="payroll-footer-value green">${totalGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <button type="button" className="payroll-btn primary" onClick={handleApproveAndRun}>
              Approve & Run
              <Send size={14} />
            </button>
          </div>
        )}

        <div className="payroll-disclaimer">
          <AlertTriangle size={18} />
          <span>
            Gross pay only. Taxes, benefits, and deductions are not calculated here. Connect a payroll processor (Gusto, ADP, etc.) to handle net pay and tax filings.
          </span>
        </div>

        <div className="payroll-contact-link-wrap">
          <button
            type="button"
            className="payroll-contact-link"
            onClick={() => {
              setContactForm(
                payrollContact
                  ? { name: payrollContact.name, email: payrollContact.email, phone: payrollContact.phone ?? '' }
                  : { name: '', email: '', phone: '' }
              )
              setContactModalOpen(true)
            }}
          >
            <UserCircle size={16} />
            {contactLoading ? 'Loading…' : payrollContact?.email ? `Payroll contact: ${payrollContact.name || payrollContact.email}` : 'Set payroll contact'}
          </button>
        </div>
      </div>

      {contactModalOpen && (
        <div className="payroll-modal-overlay" onClick={() => setContactModalOpen(false)}>
          <div className="payroll-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="payroll-modal-title">Payroll contact</h3>
            <p className="payroll-modal-desc">Reports will be sent to this person when you click Approve & Run.</p>
            <div className="payroll-modal-form">
              <label>Name</label>
              <input
                type="text"
                value={contactForm.name}
                onChange={(e) => setContactForm((c) => ({ ...c, name: e.target.value }))}
                placeholder="e.g. Jane Smith"
              />
              <label>Email</label>
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((c) => ({ ...c, email: e.target.value }))}
                placeholder="payroll@company.com"
              />
              <label>Phone (optional)</label>
              <input
                type="tel"
                value={contactForm.phone ?? ''}
                onChange={(e) => setContactForm((c) => ({ ...c, phone: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="payroll-modal-actions">
              <button type="button" className="payroll-btn secondary" onClick={() => setContactModalOpen(false)}>Cancel</button>
              <button type="button" className="payroll-btn primary" onClick={saveContact}>Save</button>
            </div>
          </div>
        </div>
      )}

      {approveModalOpen && (
        <div className="payroll-modal-overlay" onClick={() => !sending && setApproveModalOpen(false)}>
          <div className="payroll-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="payroll-modal-title">{sent ? 'Report sent' : 'Send payroll report?'}</h3>
            <p className="payroll-modal-desc">
              {sent
                ? `An email has been opened to send the report to ${payrollContact?.email}. Attach the CSV if needed.`
                : `This will open your email to send the payroll report to ${payrollContact?.name || payrollContact?.email}. You can attach the exported CSV.`}
            </p>
            {!sent && (
              <div className="payroll-modal-actions">
                <button type="button" className="payroll-btn secondary" onClick={() => setApproveModalOpen(false)} disabled={sending}>Cancel</button>
                <button type="button" className="payroll-btn primary" onClick={confirmSend} disabled={sending}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
