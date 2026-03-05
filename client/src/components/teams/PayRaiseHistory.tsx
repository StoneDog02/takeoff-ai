import { useEffect, useState } from 'react'
import { teamsApi } from '@/api/teamsClient'
import type { Employee, PayRaise } from '@/types/global'
import { dayjs, toISODate } from '@/lib/date'
import { TeamsAvatar, getInitials } from './TeamsAvatar'

export function PayRaiseHistory() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [raises, setRaises] = useState<PayRaise[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    effective_date: toISODate(dayjs()),
    amount_type: 'dollar' as 'percent' | 'dollar',
    amount: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    teamsApi.employees.list().then(setEmployees).catch(() => setEmployees([]))
  }, [])

  useEffect(() => {
    if (!selectedEmployee) {
      setRaises([])
      setLoading(false)
      return
    }
    setLoading(true)
    teamsApi.payRaises
      .list(selectedEmployee)
      .then(setRaises)
      .catch(() => setRaises([]))
      .finally(() => setLoading(false))
  }, [selectedEmployee])

  const emp = employees.find((e) => e.id === selectedEmployee)
  const currentRate = emp?.current_compensation

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee || !form.amount) return
    setSubmitting(true)
    try {
      const amount = Number(form.amount)
      const newRate = form.amount_type === 'dollar' ? amount : emp?.current_compensation != null
        ? Math.round(emp.current_compensation * (1 + amount / 100) * 100) / 100
        : undefined
      await teamsApi.payRaises.create({
        employee_id: selectedEmployee,
        effective_date: form.effective_date,
        amount_type: form.amount_type,
        amount,
        previous_rate: emp?.current_compensation,
        new_rate: newRate,
        notes: form.notes || undefined,
      })
      setForm((f) => ({ ...f, amount: '', notes: '' }))
      teamsApi.payRaises.list(selectedEmployee).then(setRaises)
      if (emp && newRate != null) {
        await teamsApi.employees.update(selectedEmployee, { current_compensation: newRate })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="teams-tab-body">
      <div className="teams-two-col">
        <div className="teams-sidebar-list" style={{ maxWidth: 300 }}>
          <div className="teams-sidebar-list-title">Employees</div>
          {employees.map((e) => (
            <div
              key={e.id}
              className={`teams-sidebar-item ${selectedEmployee === e.id ? 'selected' : ''}`}
              onClick={() => setSelectedEmployee(selectedEmployee === e.id ? '' : e.id)}
              onKeyDown={(ev) => ev.key === 'Enter' && setSelectedEmployee(selectedEmployee === e.id ? '' : e.id)}
              role="button"
              tabIndex={0}
            >
              <TeamsAvatar initials={getInitials(e.name)} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="teams-cell-name">{e.name}</div>
                <div className="teams-cell-muted" style={{ fontSize: 12 }}>{e.role}</div>
              </div>
              <div className="teams-cell-value" style={{ fontSize: 14 }}>${e.current_compensation ?? '—'}/hr</div>
            </div>
          ))}
        </div>

        <div className="teams-card teams-detail-panel">
          {emp && (
            <>
              <div className="teams-detail-header" style={{ padding: '20px 24px' }}>
                <TeamsAvatar initials={getInitials(emp.name)} size="lg" />
                <div>
                  <div className="teams-roster-name" style={{ fontSize: 18 }}>{emp.name}</div>
                  <div className="teams-cell-muted">{emp.role} · Started —</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div className="teams-metric-label" style={{ marginBottom: 4 }}>Current rate</div>
                  <div className="teams-metric-value" style={{ fontSize: 28 }}>
                    ${currentRate ?? '—'}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>/hr</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 24px' }}>
                <div className="teams-metric-label" style={{ marginBottom: 16 }}>Compensation history</div>
                {loading ? (
                  <p className="teams-cell-muted">Loading…</p>
                ) : raises.length === 0 ? (
                  <p className="teams-cell-muted">No raise history recorded.</p>
                ) : (
                  <div className="teams-raise-list">
                    {raises.map((r) => (
                      <div key={r.id} className="teams-raise-item">
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <span className="teams-cell-name">{r.effective_date}</span>
                          <span className="teams-cell-muted" style={{ marginLeft: 8 }}>{r.notes || ''}</span>
                        </div>
                        <div className="teams-cell-muted">${r.previous_rate ?? '—'}/hr</div>
                        <div className="teams-cell-muted">→</div>
                        <div className="teams-cell-value" style={{ color: 'var(--green)' }}>${r.new_rate ?? '—'}/hr</div>
                        <span className="teams-status-pill ontime">+${(r.new_rate ?? 0) - (r.previous_rate ?? 0)}/hr</span>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAdd} style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                  <div>
                    <label className="teams-metric-label" style={{ display: 'block', marginBottom: 4 }}>Effective date</label>
                    <input type="date" value={form.effective_date} onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))} className="teams-select" />
                  </div>
                  <div>
                    <label className="teams-metric-label" style={{ display: 'block', marginBottom: 4 }}>Type</label>
                    <select value={form.amount_type} onChange={(e) => setForm((f) => ({ ...f, amount_type: e.target.value as 'percent' | 'dollar' }))} className="teams-select">
                      <option value="percent">Percent</option>
                      <option value="dollar">Dollar</option>
                    </select>
                  </div>
                  <div>
                    <label className="teams-metric-label" style={{ display: 'block', marginBottom: 4 }}>Amount</label>
                    <input type="number" step={form.amount_type === 'percent' ? 0.5 : 0.01} required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="teams-select" placeholder={form.amount_type === 'percent' ? '5' : '2.50'} />
                  </div>
                  <div>
                    <label className="teams-metric-label" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
                    <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="teams-select" placeholder="Optional" />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Add raise'}</button>
                </form>
              </div>
            </>
          )}
          {!emp && (
            <div className="teams-placeholder">
              Select an employee to view their compensation history
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
