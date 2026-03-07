import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminStats, getAdminUsers, type AdminUser } from '@/api/admin'
import { teamsApi } from '@/api/teamsClient'
import { Card, CardHeader, CardBody } from '@/components/settings/SettingsPrimitives'
import { usePreview } from '@/contexts/PreviewContext'
import type { Employee } from '@/types/global'

export function AdminPage() {
  const navigate = useNavigate()
  const { setPreviewAsPm, setPreviewAsEmployee } = usePreview()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [previewEmployeeId, setPreviewEmployeeId] = useState('')
  const [stats, setStats] = useState<{
    totalUsers: number
    newUsersLast7Days: number
    newUsersLast30Days: number
  } | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersPage, setUsersPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getAdminStats()
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stats')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
  }, [])

  useEffect(() => {
    setEmployeesLoading(true)
    teamsApi.employees.list().then(setEmployees).catch(() => setEmployees([])).finally(() => setEmployeesLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    getAdminUsers(usersPage, 20)
      .then((data) => {
        if (!cancelled) setUsers(data.users)
      })
      .catch(() => {
        if (!cancelled) setUsers([])
      })
  }, [usersPage])

  function formatDate(iso: string | null): string {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return '—'
    }
  }

  return (
    <div className="admin-page min-h-full">
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-sub">Analytics and data for project owners</p>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--red-light, #fef2f2)', borderRadius: 8, color: 'var(--red, #b91c1c)' }}>
          {error}
        </div>
      )}

      <div className="kpi-row">
        <div className="kpi-card users">
          <div className="kpi-label">Total users</div>
          <div className="kpi-value">{loading ? '…' : (stats?.totalUsers ?? 0)}</div>
          <div className="kpi-meta">
            <span className="kpi-delta flat">All time</span>
          </div>
        </div>
        <div className="kpi-card new7">
          <div className="kpi-label">New users (7d)</div>
          <div className="kpi-value">{loading ? '…' : (stats?.newUsersLast7Days ?? 0)}</div>
          <div className="kpi-meta">
            <span className="kpi-delta flat">Last week</span>
          </div>
        </div>
        <div className="kpi-card new30">
          <div className="kpi-label">New users (30d)</div>
          <div className="kpi-value">{loading ? '…' : (stats?.newUsersLast30Days ?? 0)}</div>
          <div className="kpi-meta">
            <span className="kpi-delta flat">Last 30 days</span>
          </div>
        </div>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <CardHeader
          title="Test portals"
          desc="Try the project manager and employee experiences without another login."
        />
        <CardBody>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setPreviewAsPm()
                  navigate('/dashboard')
                }}
              >
                Open project manager view
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {employeesLoading ? (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading employees…</span>
              ) : employees.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Add employees in Teams to preview as a specific employee.
                </span>
              ) : null}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const emp = employees.find((e) => e.id === previewEmployeeId)
                    setPreviewAsEmployee(emp ? emp.id : '', emp ? emp.name : '')
                    navigate('/employee/clock')
                  }}
                >
                  {employees.length > 0 ? 'Open employee portal' : 'Open employee portal (no employee)'}
                </button>
                {employees.length > 0 && (
                  <select
                    value={previewEmployeeId}
                    onChange={(e) => setPreviewEmployeeId(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    <option value="">Select employee to preview as</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="admin-page bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card>
          <CardHeader title="Subscription overview" desc="Billing and plan metrics" />
          <CardBody>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
              Connect Stripe to see subscription analytics. Paid plans, trials, and churn will appear here once billing is integrated.
            </p>
            <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              0 paid · 0 trials
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Revenue" desc="MRR and revenue from subscriptions" />
          <CardBody>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
              Revenue will appear here once billing is connected.
            </p>
            <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              $0 MRR
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Users" desc="Recent sign-ups and last sign-in" />
        <CardBody style={{ padding: 0 }}>
          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Signed up</th>
                  <th>Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && !loading && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      No users yet
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email || '(no email)'}</td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>{formatDate(u.last_sign_in_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderTop: '1px solid var(--border, #e5e7eb)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {usersPage}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={usersPage <= 1}
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                className="btn btn-sm"
                style={{ opacity: usersPage <= 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={users.length < 20}
                onClick={() => setUsersPage((p) => p + 1)}
                className="btn btn-sm"
                style={{ opacity: users.length < 20 ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        </CardBody>
      </Card>
      </div>
    </div>
  )
}
