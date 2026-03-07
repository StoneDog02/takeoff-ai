import { useEffect, useState } from 'react'
import { teamsApi } from '@/api/teamsClient'
import type { Employee, JobAssignment } from '@/types/global'
import { formatDate } from '@/lib/date'
import { TeamsAvatar, getInitials } from '@/components/teams/TeamsAvatar'

interface ProjectCrewTabProps {
  projectId: string
  projectName: string
  readOnly?: boolean
}

export function ProjectCrewTab({ projectId, projectName, readOnly = false }: ProjectCrewTabProps) {
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [roleOnJob, setRoleOnJob] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      teamsApi.jobAssignments.list({ job_id: projectId, active_only: true }),
      teamsApi.employees.list(),
    ])
      .then(([a, e]) => {
        setAssignments(a)
        setEmployees(e)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), [projectId])

  const assignedIds = new Set(assignments.filter((a) => !a.ended_at).map((a) => a.employee_id))
  const availableEmployees = employees.filter((e) => !assignedIds.has(e.id))

  const handleAssign = async () => {
    if (!selectedEmployeeId || readOnly) return
    setAdding(true)
    try {
      await teamsApi.jobAssignments.create({
        employee_id: selectedEmployeeId,
        job_id: projectId,
        role_on_job: roleOnJob.trim() || undefined,
      })
      load()
      setSelectedEmployeeId('')
      setRoleOnJob('')
    } finally {
      setAdding(false)
    }
  }

  const handleUnassign = async (assignmentId: string) => {
    if (readOnly) return
    try {
      await teamsApi.jobAssignments.delete(assignmentId)
      load()
    } catch {}
  }

  const employeeMap = new Map(employees.map((e) => [e.id, e]))

  if (loading) {
    return <p className="text-sm text-muted dark:text-white-dim">Loading crew…</p>
  }

  return (
    <section className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white">Crew for {projectName}</h2>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm min-w-[180px]"
            >
              <option value="">Add employee to crew…</option>
              {availableEmployees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} {e.role ? `(${e.role})` : ''}</option>
              ))}
            </select>
            {selectedEmployeeId && (
              <>
                <input
                  type="text"
                  value={roleOnJob}
                  onChange={(e) => setRoleOnJob(e.target.value)}
                  placeholder="Role (optional)"
                  className="rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm w-40"
                />
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={adding}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-50"
                >
                  {adding ? 'Adding…' : 'Add to crew'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {assignments.filter((a) => !a.ended_at).length === 0 ? (
        <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-8 text-center">
          <p className="text-muted dark:text-white-dim">No crew assigned to this project yet.</p>
          {!readOnly && <p className="text-sm text-muted dark:text-white-dim mt-1">Select an employee above to add them to the crew.</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 overflow-hidden">
          <ul className="divide-y divide-border dark:divide-border-dark">
            {assignments.filter((a) => !a.ended_at).map((a) => {
              const emp = employeeMap.get(a.employee_id)
              return (
                <li key={a.id} className="flex items-center gap-4 px-4 py-3">
                  <TeamsAvatar initials={emp ? getInitials(emp.name) : '?'} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-landing-white">{emp?.name ?? a.employee_id}</div>
                    <div className="text-sm text-muted dark:text-white-dim">
                      {a.role_on_job || emp?.role || '—'} · Assigned {a.assigned_at ? formatDate(a.assigned_at) : '—'}
                    </div>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleUnassign(a.id)}
                      className="text-sm text-muted hover:text-red-600 dark:hover:text-red-400 font-medium"
                    >
                      Remove from crew
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {availableEmployees.length === 0 && employees.length > 0 && !readOnly && (
        <p className="text-sm text-muted dark:text-white-dim">All employees are already on this crew. Add more people in Teams → Roster.</p>
      )}
    </section>
  )
}
