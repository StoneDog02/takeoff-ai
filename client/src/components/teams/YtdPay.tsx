import { useEffect, useState } from 'react'
import { teamsApi } from '@/api/teamsClient'
import type { Employee } from '@/types/global'
import { dayjs } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function YtdPay() {
  const [year, setYear] = useState(dayjs().year())
  const [data, setData] = useState<{
    year: number
    company_total: number
    by_employee: { employee_id: string; total_earnings: number; monthly_breakdown: { month: number; earnings: number }[] }[]
  } | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showMonthly, setShowMonthly] = useState(false)

  useEffect(() => {
    teamsApi.employees.list().then(setEmployees).catch(() => setEmployees([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    teamsApi.payroll
      .getYtd(year)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [year])

  const employeeMap = new Map(employees.map((e) => [e.id, e]))
  const total = data?.company_total ?? 0

  return (
    <div className="teams-tab-body">
      <div className="teams-toolbar-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="teams-metric-label" style={{ marginBottom: 0 }}>Year:</span>
          <select
            className="teams-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ maxWidth: 100 }}
          >
            {[year - 2, year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={`btn btn-ghost ${showMonthly ? 'active' : ''}`}
          onClick={() => setShowMonthly(!showMonthly)}
          style={{ border: '1px solid var(--border)' }}
        >
          {showMonthly ? 'Hide' : 'Show'} monthly breakdown
        </button>
      </div>

      <div className="teams-card teams-ytd-total" style={{ marginBottom: 16, padding: '20px 24px', borderTop: '3px solid var(--red)' }}>
        <div className="teams-metric-label">Company YTD Payroll</div>
        <div className="teams-metric-value" style={{ fontSize: 36 }}>
          {loading ? '…' : `$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
        </div>
        <div className="teams-metric-sub">Through {dayjs().format('MMMM YYYY')}</div>
      </div>

      <div className="teams-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Hours</th>
              <th>Rate</th>
              <th>YTD Earnings</th>
              {showMonthly && MONTHS.slice(0, dayjs().month() + 1).map((m) => <th key={m}>{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={showMonthly ? 15 : 4} className="teams-cell-muted" style={{ padding: 24 }}>Loading…</td></tr>
            ) : !data?.by_employee?.length ? (
              <tr>
                <td colSpan={showMonthly ? 15 : 4} className="teams-cell-muted" style={{ padding: 32, textAlign: 'center' }}>
                  No YTD data for {year}. Log time and set compensation to see earnings.
                </td>
              </tr>
            ) : (
              data.by_employee.map((row) => {
                const monthlyMap = new Map(row.monthly_breakdown?.map((x) => [x.month, x.earnings]) ?? [])
                const emp = employeeMap.get(row.employee_id)
                return (
                  <tr key={row.employee_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <TeamsAvatar initials={emp ? getInitials(emp.name) : '?'} size="sm" />
                        <span className="teams-cell-name">{emp?.name ?? row.employee_id}</span>
                      </div>
                    </td>
                    <td><span className="teams-cell-muted">— hrs</span></td>
                    <td><span className="teams-cell-muted">${emp?.current_compensation ?? '—'}/hr</span></td>
                    <td><span className="teams-cell-value">${row.total_earnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                    {showMonthly && MONTHS.slice(0, dayjs().month() + 1).map((_, i) => (
                      <td key={i}>
                        <span className="teams-cell-muted">
                          {monthlyMap.get(i + 1) != null ? `$${monthlyMap.get(i + 1)!.toLocaleString()}` : '—'}
                        </span>
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
            {data?.by_employee?.length ? (
              <tr style={{ background: 'var(--bg-raised)' }}>
                <td style={{ fontWeight: 700, padding: '14px 20px' }}>Total</td>
                <td style={{ padding: '14px 20px' }}>—</td>
                <td style={{ padding: '14px 20px' }}>—</td>
                <td style={{ padding: '14px 20px' }}>
                  <span className="teams-cell-value" style={{ color: 'var(--red)', fontWeight: 800 }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </td>
                {showMonthly && MONTHS.slice(0, dayjs().month() + 1).map((_, i) => (
                  <td key={i} style={{ padding: '14px 20px' }}>—</td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
