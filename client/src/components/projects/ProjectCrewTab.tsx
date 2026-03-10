import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { teamsApi } from '@/api/teamsClient'
import type { Contractor, Employee, JobAssignment, Subcontractor } from '@/types/global'
import { formatDate } from '@/lib/date'
import { TeamsAvatar, getInitials } from '@/components/teams/TeamsAvatar'

interface ProjectCrewTabProps {
  projectId: string
  projectName: string
  readOnly?: boolean
  /** When provided, used for Roster section instead of loading (and avoids duplicate fetch). */
  jobAssignments?: JobAssignment[]
  rosterEmployees?: Employee[]
  /** Subcontractors for this project (from wizard / project API). Shown in second section. */
  subcontractors?: Subcontractor[]
  /** Called when user adds a subcontractor so parent can refresh the list. */
  onSubcontractorAdded?: () => void
  /** Called when crew changes (roster add/remove or subcontractor add) so parent can refetch project detail. */
  onCrewChange?: () => void
  /** Called when user wants to open Project Setup wizard (e.g. from empty state hint). */
  onOpenSetupWizard?: () => void
}

export function ProjectCrewTab({
  projectId,
  projectName: _projectName,
  readOnly = false,
  jobAssignments: jobAssignmentsProp,
  rosterEmployees: rosterEmployeesProp,
  subcontractors = [],
  onSubcontractorAdded,
  onCrewChange,
  onOpenSetupWizard: _onOpenSetupWizard,
}: ProjectCrewTabProps) {
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [roleOnJob, setRoleOnJob] = useState('')
  const [addSubcontractorOpen, setAddSubcontractorOpen] = useState(false)
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [contractorsLoading, setContractorsLoading] = useState(false)
  const [selectedContractorId, setSelectedContractorId] = useState('')
  const [addingSubcontractor, setAddingSubcontractor] = useState(false)

  const propsProvided = jobAssignmentsProp != null && rosterEmployeesProp != null
  const [useProps, setUseProps] = useState(true)
  useEffect(() => {
    if (propsProvided) setUseProps(true)
  }, [propsProvided, jobAssignmentsProp?.length, rosterEmployeesProp?.length])
  const assignmentsList = useProps && propsProvided ? jobAssignmentsProp! : assignments
  const employeesList = useProps && propsProvided ? rosterEmployeesProp! : employees

  const load = () => {
    if (useProps) return
    setLoading(true)
    Promise.all([
      teamsApi.jobAssignments.list({ job_id: projectId, active_only: true }),
      teamsApi.employees.list(),
    ])
      .then(([a, e]) => {
        setAssignments(a ?? [])
        setEmployees(e ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (propsProvided && useProps) {
      setLoading(false)
      return
    }
    if (!propsProvided) load()
  }, [projectId, propsProvided, useProps])

  const assignedIds = new Set(assignmentsList.filter((a) => !a.ended_at).map((a) => a.employee_id))
  const availableEmployees = employeesList.filter((e) => !assignedIds.has(e.id))

  const handleAssign = async () => {
    if (!selectedEmployeeId || readOnly) return
    setAdding(true)
    try {
      await teamsApi.jobAssignments.create({
        employee_id: selectedEmployeeId,
        job_id: projectId,
        role_on_job: roleOnJob.trim() || undefined,
      })
      const [a, e] = await Promise.all([
        teamsApi.jobAssignments.list({ job_id: projectId, active_only: true }),
        teamsApi.employees.list(),
      ])
      setAssignments(a ?? [])
      setEmployees(e ?? [])
      if (useProps) setUseProps(false)
      else load()
      setSelectedEmployeeId('')
      setRoleOnJob('')
      onCrewChange?.()
    } finally {
      setAdding(false)
    }
  }

  const handleUnassign = async (assignmentId: string) => {
    if (readOnly) return
    try {
      await teamsApi.jobAssignments.delete(assignmentId)
      const [a, e] = await Promise.all([
        teamsApi.jobAssignments.list({ job_id: projectId, active_only: true }),
        teamsApi.employees.list(),
      ])
      setAssignments(a ?? [])
      setEmployees(e ?? [])
      if (useProps) setUseProps(false)
      else load()
      onCrewChange?.()
    } catch {}
  }

  const employeeMap = new Map(employeesList.map((e) => [e.id, e]))
  const activeAssignments = assignmentsList.filter((a) => !a.ended_at)

  const totalMembers = activeAssignments.length + subcontractors.length
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false)

  useEffect(() => {
    if (!addSubcontractorOpen) return
    setContractorsLoading(true)
    api.contractors
      .list()
      .then((list) => setContractors(list))
      .catch(() => setContractors([]))
      .finally(() => setContractorsLoading(false))
  }, [addSubcontractorOpen])

  const subKey = (s: { name?: string; trade?: string; email?: string }) =>
    ((s.email || '').trim() || `${s.name || ''}|${s.trade || ''}`).toLowerCase()
  const existingSubKeys = new Set(subcontractors.map(subKey))
  const availableContractors = contractors.filter((c) => !existingSubKeys.has(subKey(c)))

  const handleAddSubcontractor = async () => {
    const c = contractors.find((x) => x.id === selectedContractorId)
    if (!c || readOnly) return
    setAddingSubcontractor(true)
    try {
      await api.projects.createSubcontractor(projectId, {
        name: c.name,
        trade: c.trade || 'Subcontractor',
        email: c.email || '',
        phone: c.phone || '',
      })
      onSubcontractorAdded?.()
      onCrewChange?.()
      setAddSubcontractorOpen(false)
      setSelectedContractorId('')
    } finally {
      setAddingSubcontractor(false)
    }
  }

  if (loading && !useProps) {
    return <p className="text-sm text-muted dark:text-white-dim">Loading crew…</p>
  }

  return (
    <section className="w-full min-w-0 space-y-6">
      {/* Page header: title, subtitle, Add Employee button with dropdown */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-landing-white">Crew</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {totalMembers} member{totalMembers !== 1 ? 's' : ''} assigned to this project
          </p>
        </div>
        {!readOnly && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddEmployeeOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 dark:bg-landing-white dark:text-gray-900 hover:opacity-90"
            >
              + Add Employee
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {addEmployeeOpen && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setAddEmployeeOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-3 shadow-lg">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-[var(--text-muted)]">Employee</label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm"
                    >
                      <option value="">Select employee…</option>
                      {availableEmployees.map((e) => (
                        <option key={e.id} value={e.id}>{e.name} {e.role ? `(${e.role})` : ''}</option>
                      ))}
                    </select>
                    <label className="block text-xs font-medium text-[var(--text-muted)]">Role (optional)</label>
                    <input
                      type="text"
                      value={roleOnJob}
                      onChange={(e) => setRoleOnJob(e.target.value)}
                      placeholder="e.g. Foreman"
                      className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => { handleAssign(); setAddEmployeeOpen(false) }}
                      disabled={adding || !selectedEmployeeId}
                      className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white bg-gray-900 dark:bg-landing-white dark:text-gray-900 hover:opacity-90 disabled:opacity-50"
                    >
                      {adding ? 'Adding…' : 'Add to crew'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Your Roster section */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-landing-white">Your Roster</h3>
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gray-900 dark:bg-landing-white text-xs font-semibold text-white dark:text-gray-900 px-2">
              {activeAssignments.length}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 overflow-hidden">
          {activeAssignments.length === 0 ? (
            <div className="border-2 border-dashed border-[var(--border)] dark:border-border-dark rounded-lg m-3 p-8 text-center">
              <div className="flex justify-center mb-3 text-[var(--text-muted)]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="font-semibold text-gray-900 dark:text-landing-white">No crew assigned yet</p>
              <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                Add employees from the dropdown above or via Project Setup → Team &amp; Crew.
              </p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setAddEmployeeOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-gray-900 dark:bg-landing-white dark:text-gray-900 hover:opacity-90"
                >
                  + Add Employee
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border dark:divide-border-dark">
              {activeAssignments.map((a) => {
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
          )}
        </div>
      </div>

      {/* Subcontractors section */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-landing-white">Subcontractors</h3>
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gray-900 dark:bg-landing-white text-xs font-semibold text-white dark:text-gray-900 px-2">
              {subcontractors.length}
            </span>
          </div>
          {!readOnly && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddSubcontractorOpen((o) => !o)}
                className="inline-flex items-center gap-2 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-base)]"
              >
                + Add Subcontractor
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {addSubcontractorOpen && (
                <>
                  <div className="fixed inset-0 z-10" aria-hidden onClick={() => setAddSubcontractorOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-3 shadow-lg">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-[var(--text-muted)]">From Directory</label>
                      <select
                        value={selectedContractorId}
                        onChange={(e) => setSelectedContractorId(e.target.value)}
                        className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm"
                      >
                        <option value="">
                          {contractorsLoading
                            ? 'Loading…'
                            : availableContractors.length === 0
                              ? 'None available (or all added)'
                              : 'Select subcontractor…'}
                        </option>
                        {availableContractors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.trade ? `(${c.trade})` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddSubcontractor}
                        disabled={addingSubcontractor || !selectedContractorId}
                        className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white bg-gray-900 dark:bg-landing-white dark:text-gray-900 hover:opacity-90 disabled:opacity-50"
                      >
                        {addingSubcontractor ? 'Adding…' : 'Add to project'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 overflow-hidden">
          {subcontractors.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-[var(--text-muted)]">No subcontractors on this project.</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {subcontractors.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 p-3"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 bg-amber-500/90 text-amber-950">
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-landing-white">{s.name}</div>
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                      {s.trade || 'Subcontractor'}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">Subcontractor</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          Manage subcontractors via Project Setup → Team &amp; Crew.
        </p>
      </div>

      {availableEmployees.length === 0 && employeesList.length > 0 && !readOnly && (
        <p className="text-sm text-muted dark:text-white-dim">All employees are already on this crew. Add more in Teams → Roster.</p>
      )}
    </section>
  )
}
