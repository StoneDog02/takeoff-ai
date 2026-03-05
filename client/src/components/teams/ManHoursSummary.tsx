import { useEffect, useState } from 'react'
import { teamsApi } from '@/api/teams'
import type { Employee } from '@/types/global'
import { dayjs } from '@/lib/date'

export function ManHoursSummary() {
  const [employeeId, setEmployeeId] = useState<string>('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<{ clock_in: string; clock_out?: string; hours?: number }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    teamsApi.employees.list().then(setEmployees).catch(() => setEmployees([]))
  }, [])

  useEffect(() => {
    if (!employeeId) {
      setEntries([])
      return
    }
    setLoading(true)
    const start = dayjs().subtract(7, 'day').toISOString()
    const end = dayjs().add(1, 'day').toISOString()
    teamsApi.timeEntries
      .list({
        employee_id: employeeId,
        from: start,
        to: end,
      })
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [employeeId])

  const weekTotal = entries.reduce((s, e) => s + (e.hours ?? 0), 0)
  const weekRounded = Math.round(weekTotal * 100) / 100

  return (
    <div className="dashboard-app metrics" style={{ marginBottom: 24 }}>
      <div className="metric-card" style={{ animation: 'none' }}>
        <div className="metric-label">Weekly total (selected employee)</div>
        <div className="metric-value">{loading ? '…' : `${weekRounded} hrs`}</div>
        <div className="metric-footer">
          <select
            className="dashboard-app .search-wrap"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            <option value="">Select employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="metric-card" style={{ animation: 'none' }}>
        <div className="metric-label">Cumulative (this week)</div>
        <div className="metric-value">{loading ? '…' : `${weekRounded} hrs`}</div>
      </div>
    </div>
  )
}
