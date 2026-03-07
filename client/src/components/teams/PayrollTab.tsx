import { useEffect, useState } from 'react'
import { teamsApi } from '@/api/teamsClient'
import type { Employee, PayRaise } from '@/types/global'
import { dayjs, toISODate } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'

interface PayrollTabProps {
  onSelectEmployee?: (emp: Employee) => void
}

const fmt = (n: number) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })
const fmtRate = (n: number) => `$${n}/hr`

export function PayrollTab({ onSelectEmployee }: PayrollTabProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [raises, setRaises] = useState<PayRaise[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [ytdData, setYtdData] = useState<{
    year: number
    company_total: number
    by_employee: { employee_id: string; total_earnings: number; monthly_breakdown?: { month: number; earnings: number }[] }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [raisesLoading, setRaisesLoading] = useState(false)
  const [form, setForm] = useState({
    effective_date: toISODate(dayjs()),
    amount_type: 'dollar' as 'percent' | 'dollar',
    amount: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const year = dayjs().year()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      teamsApi.employees.list(),
      teamsApi.payroll.getYtd(year),
    ])
      .then(([e, ytd]) => {
        setEmployees(e)
        setYtdData(ytd ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year])

  useEffect(() => {
    if (!selectedId) {
      setRaises([])
      setRaisesLoading(false)
      return
    }
    setRaisesLoading(true)
    teamsApi.payRaises
      .list(selectedId)
      .then(setRaises)
      .catch(() => setRaises([]))
      .finally(() => setRaisesLoading(false))
  }, [selectedId])

  const emp = employees.find((e) => e.id === selectedId)
  const currentRate = emp?.current_compensation
  const ytdTotal = ytdData?.company_total ?? 0
  const ytdByEmp = ytdData?.by_employee?.find((b) => b.employee_id === selectedId)
  const ytdEarnings = ytdByEmp?.total_earnings ?? 0
  const activeCount = employees.filter((e) => e.status === 'on_site').length
  const avgRate = activeCount > 0
    ? Math.round(
        employees.filter((e) => e.status === 'on_site').reduce((s, e) => s + (e.current_compensation ?? 0), 0) / activeCount
      )
    : 0
  const totalHours = ytdData?.by_employee?.reduce((s, b) => s + (b.total_earnings ?? 0) / (emp?.current_compensation || 1), 0) ?? 0

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !form.amount) return
    setSubmitting(true)
    try {
      const amount = Number(form.amount)
      const newRate = form.amount_type === 'dollar' ? amount : emp?.current_compensation != null
        ? Math.round(emp.current_compensation * (1 + amount / 100) * 100) / 100
        : undefined
      await teamsApi.payRaises.create({
        employee_id: selectedId,
        effective_date: form.effective_date,
        amount_type: form.amount_type,
        amount,
        previous_rate: emp?.current_compensation,
        new_rate: newRate,
        notes: form.notes || undefined,
      })
      setForm((f) => ({ ...f, amount: '', notes: '' }))
      teamsApi.payRaises.list(selectedId).then(setRaises)
      if (emp && newRate != null) {
        await teamsApi.employees.update(selectedId, { current_compensation: newRate })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="teams-tab-body">
      {/* YTD hero */}
      <div className="teams-payroll-hero">
        <div>
          <div className="teams-payroll-hero-label">Company YTD Payroll</div>
          <div className="teams-payroll-hero-value">
            {loading ? '…' : fmt(ytdTotal)}
          </div>
          <div className="teams-payroll-hero-sub">Through {dayjs().format('MMMM YYYY')}</div>
        </div>
        <div className="teams-payroll-hero-stats">
          <div className="teams-payroll-hero-stat">
            <div className="teams-payroll-hero-stat-value">{avgRate ? `$${avgRate}/hr` : '—'}</div>
            <div className="teams-payroll-hero-stat-label">Avg Rate</div>
          </div>
          <div className="teams-payroll-hero-stat">
            <div className="teams-payroll-hero-stat-value">{Math.round(totalHours)}</div>
            <div className="teams-payroll-hero-stat-label">Total Hours</div>
          </div>
        </div>
      </div>

      <div className="teams-two-col" style={{ gridTemplateColumns: '240px 1fr' }}>
        <div className="teams-sidebar-list">
          <div className="teams-sidebar-list-title">Employees</div>
          {employees.map((e) => (
            <div
              key={e.id}
              className={`teams-sidebar-item ${selectedId === e.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(selectedId === e.id ? '' : e.id)}
              onKeyDown={(ev) => ev.key === 'Enter' && setSelectedId(selectedId === e.id ? '' : e.id)}
              role="button"
              tabIndex={0}
            >
              <TeamsAvatar initials={getInitials(e.name)} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="teams-cell-name">{e.name}</div>
                <div className="teams-cell-muted" style={{ fontSize: 12 }}>{e.role}</div>
              </div>
              <div className="teams-cell-value" style={{ fontSize: 12 }}>
                {e.current_compensation != null ? fmtRate(e.current_compensation) : '—'}
              </div>
            </div>
          ))}
        </div>

        {emp ? (
          <div className="teams-card teams-detail-panel">
            <div className="teams-detail-header" style={{ padding: '18px 24px', flexWrap: 'wrap', gap: 12 }}>
              <TeamsAvatar initials={getInitials(emp.name)} size="lg" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="teams-roster-name" style={{ fontSize: 15 }}>{emp.name}</div>
                <div className="teams-cell-muted">{emp.role}</div>
              </div>
              {onSelectEmployee && (
                <button
                  type="button"
                  className="teams-btn teams-btn-ghost"
                  style={{ fontSize: 11, padding: '7px 14px' }}
                  onClick={() => onSelectEmployee(emp)}
                >
                  Full Profile →
                </button>
              )}
              <div style={{ textAlign: 'right', width: '100%' }}>
                <div className="teams-metric-label" style={{ marginBottom: 3 }}>Current Rate</div>
                <div className="teams-metric-value" style={{ fontSize: 22 }}>
                  {currentRate != null ? fmtRate(currentRate) : '—'}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border)' }}>
              {[
                { label: 'YTD Earnings', val: fmt(ytdEarnings), color: 'var(--green)' },
                { label: 'YTD Hours', val: '—', color: 'var(--blue)' },
                { label: 'Avg/Week', val: '—', color: 'var(--text-muted)' },
              ].map((s) => (
                <div key={s.label} style={{ padding: '16px 20px', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                  <div className="teams-metric-value" style={{ fontSize: 20, color: s.color, marginBottom: 3 }}>{s.val}</div>
                  <div className="teams-metric-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '18px 24px' }}>
              <div className="teams-metric-label" style={{ marginBottom: 14 }}>Compensation History</div>
              {raisesLoading ? (
                <p className="teams-cell-muted">Loading…</p>
              ) : raises.length === 0 ? (
                <p className="teams-cell-muted">No raise history recorded.</p>
              ) : (
                <div className="teams-raise-list">
                  {raises
                    .sort((a, b) => dayjs(b.effective_date).valueOf() - dayjs(a.effective_date).valueOf())
                    .map((r) => (
                      <div key={r.id} className="teams-raise-item">
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <span className="teams-cell-name">{r.notes || r.effective_date}</span>
                          <span className="teams-cell-muted" style={{ marginLeft: 8 }}>{r.effective_date}</span>
                        </div>
                        {r.previous_rate != null && r.previous_rate > 0 && (
                          <span className="teams-cell-muted">${r.previous_rate}/hr →</span>
                        )}
                        <span className="teams-cell-value">${r.new_rate ?? '—'}/hr</span>
                        {r.new_rate != null && r.previous_rate != null && (
                          <span className="teams-status-pill ontime">+${r.new_rate - r.previous_rate}/hr</span>
                        )}
                      </div>
                    ))}
                </div>
              )}

              <form onSubmit={handleAdd} style={{ marginTop: 20 }}>
                <div className="teams-metric-label" style={{ marginBottom: 12 }}>Add Raise</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="teams-form-row">
                    <label className="teams-label">Effective Date</label>
                    <input
                      type="date"
                      value={form.effective_date}
                      onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))}
                      className="teams-input"
                    />
                  </div>
                  <div className="teams-form-row">
                    <label className="teams-label">Type</label>
                    <select
                      value={form.amount_type}
                      onChange={(e) => setForm((f) => ({ ...f, amount_type: e.target.value as 'percent' | 'dollar' }))}
                      className="teams-select"
                    >
                      <option value="percent">Percent</option>
                      <option value="dollar">Dollar</option>
                    </select>
                  </div>
                  <div className="teams-form-row">
                    <label className="teams-label">Amount</label>
                    <input
                      type="number"
                      step={form.amount_type === 'percent' ? 0.5 : 0.01}
                      required
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      className="teams-input"
                      placeholder={form.amount_type === 'percent' ? '5' : '2.50'}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="teams-input"
                    placeholder="Notes (optional)"
                    style={{ flex: 1, minWidth: 120 }}
                  />
                  <button type="submit" className="teams-btn teams-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Add Raise'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="teams-placeholder">
            Select an employee to view compensation and add raises
          </div>
        )}
      </div>
    </div>
  )
}
