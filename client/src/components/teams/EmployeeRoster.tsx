import { useEffect, useState } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type { Employee, JobAssignment } from '@/types/global'
import { TeamsAvatar, getInitials } from './TeamsAvatar'

type ViewMode = 'cards' | 'table'

const STATUS_PILL: Record<string, { class: string; label: string }> = {
  on_site: { class: 'active', label: 'Active' },
  off: { class: 'inactive', label: 'Inactive' },
  pto: { class: 'inactive', label: 'PTO' },
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="teams-info-row">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  )
}

export function EmployeeRoster() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [jobNames, setJobNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', role: '', email: '', phone: '', status: 'off' as const })
  const [saving, setSaving] = useState(false)

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.name || !addForm.email) return
    setSaving(true)
    try {
      await teamsApi.employees.create(addForm)
      setShowAdd(false)
      setAddForm({ name: '', role: '', email: '', phone: '', status: 'off' })
      load()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const load = () => {
    setLoading(true)
    Promise.all([
      teamsApi.employees.list(statusFilter ? { status: statusFilter } : undefined),
      teamsApi.jobAssignments.list({ active_only: true }),
      getProjectsList().then((projects) => {
        const map: Record<string, string> = {}
        projects.forEach((p) => { map[p.id] = p.name })
        return map
      }),
    ])
      .then(([emps, assigns, names]) => {
        setEmployees(emps)
        setAssignments(assigns)
        setJobNames(names)
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

  return (
    <div className="teams-tab-body">
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
        {showAdd && (
          <form
            onSubmit={handleAddEmployee}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
          >
            <input
              placeholder="Name"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              className="search-wrap"
              required
            />
            <input
              placeholder="Role"
              value={addForm.role}
              onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
              className="search-wrap"
            />
            <input
              type="email"
              placeholder="Email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              className="search-wrap"
              required
            />
            <input
              placeholder="Phone"
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
              className="search-wrap"
            />
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </form>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
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
          <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
            Add employee
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="teams-cards-grid">
          {filtered.map((emp) => {
            const jobLabel = (assignmentsByEmployee.get(emp.id) || []).join(', ') || '—'
            const pill = STATUS_PILL[emp.status] || STATUS_PILL.off
            return (
              <div key={emp.id} className="teams-card teams-roster-card">
                <div className="teams-roster-card-top">
                  <TeamsAvatar initials={getInitials(emp.name)} size="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="teams-roster-name">{emp.name}</div>
                    <div className="teams-roster-role">{emp.role}</div>
                    <span className={`teams-status-pill ${pill.class}`}>{pill.label}</span>
                  </div>
                </div>
                <div className="teams-roster-card-info">
                  <InfoRow label="Rate" value={emp.current_compensation != null ? `$${emp.current_compensation}/hr` : '—'} />
                  <InfoRow label="Job" value={jobLabel} />
                  <InfoRow label="Since" value="—" />
                  <InfoRow label="Contact" value={emp.email} />
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => {
                const pill = STATUS_PILL[emp.status] || STATUS_PILL.off
                return (
                  <tr key={emp.id}>
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
