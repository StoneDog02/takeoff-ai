import { useEffect, useState } from 'react'
import { teamsApi } from '@/api/teams'
import { api } from '@/api/client'
import type { Employee, TimeEntry } from '@/types/global'
import { dayjs, formatDateTime } from '@/lib/date'
import { EditTimeEntryModal } from '@/components/teams/EditTimeEntryModal'

export function ManHoursLog() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [jobs, setJobs] = useState<{ id: string; name: string }[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    employee_id: '',
    job_id: '',
    clock_in: dayjs().format('YYYY-MM-DDTHH:mm'),
    clock_out: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      teamsApi.employees.list(),
      api.projects.list().then((p) => p.map((x) => ({ id: x.id, name: x.name }))),
      teamsApi.timeEntries.list(),
    ])
      .then(([e, j, t]) => {
        setEmployees(e)
        setJobs(j)
        setEntries(t.slice(0, 50))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), [])

  const employeeMap = new Map(employees.map((x) => [x.id, x]))
  const jobMap = new Map(jobs.map((x) => [x.id, x]))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.employee_id || !form.job_id) return
    setSubmitting(true)
    try {
      await teamsApi.timeEntries.create({
        employee_id: form.employee_id,
        job_id: form.job_id,
        clock_in: dayjs(form.clock_in).toISOString(),
        clock_out: form.clock_out ? dayjs(form.clock_out).toISOString() : undefined,
      })
      setForm({ ...form, clock_in: dayjs().format('YYYY-MM-DDTHH:mm'), clock_out: '' })
      load()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dashboard-app">
      <div className="projects-card" style={{ marginBottom: 24 }}>
        <div className="projects-top">
          <span className="page-title">Log hours</span>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Employee</label>
            <select
              required
              value={form.employee_id}
              onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
              className="dashboard-app .search-wrap"
              style={{ minWidth: 180 }}
            >
              <option value="">Select</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Job</label>
            <select
              required
              value={form.job_id}
              onChange={(e) => setForm((f) => ({ ...f, job_id: e.target.value }))}
              className="dashboard-app .search-wrap"
              style={{ minWidth: 180 }}
            >
              <option value="">Select</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Clock in</label>
            <input
              type="datetime-local"
              value={form.clock_in}
              onChange={(e) => setForm((f) => ({ ...f, clock_in: e.target.value }))}
              className="dashboard-app .search-wrap"
            />
          </div>
          <div>
            <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Clock out (optional)</label>
            <input
              type="datetime-local"
              value={form.clock_out}
              onChange={(e) => setForm((f) => ({ ...f, clock_out: e.target.value }))}
              className="dashboard-app .search-wrap"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Log entry'}
          </button>
        </form>
      </div>
      <div className="projects-card">
        <div className="projects-top">
          <span className="page-title">Recent time entries</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Job</th>
              <th>Clock in</th>
              <th>Clock out</th>
              <th>Hours</th>
              <th>Source</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="timeline-val">Loading…</td></tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="proj-name">{employeeMap.get(entry.employee_id)?.name ?? entry.employee_id}</td>
                  <td className="timeline-val">{jobMap.get(entry.job_id)?.name ?? entry.job_id}</td>
                  <td className="timeline-val">{formatDateTime(entry.clock_in)}</td>
                  <td className="timeline-val">{entry.clock_out ? formatDateTime(entry.clock_out) : '—'}</td>
                  <td className="budget-val">{entry.hours != null ? `${entry.hours} hrs` : '—'}</td>
                  <td className="timeline-val">{entry.source}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditEntry(entry)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && entries.length === 0 && (
          <p style={{ padding: 16, color: 'var(--text-muted)' }}>No time entries yet.</p>
        )}
      </div>

      <EditTimeEntryModal
        entry={editEntry}
        employeeName={editEntry ? (employeeMap.get(editEntry.employee_id)?.name ?? editEntry.employee_id) : ''}
        jobName={editEntry ? (jobMap.get(editEntry.job_id)?.name ?? editEntry.job_id) : ''}
        jobs={jobs}
        onClose={() => setEditEntry(null)}
        onSaved={load}
      />
    </div>
  )
}
