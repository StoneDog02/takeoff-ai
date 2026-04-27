import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Phase } from '@/types/global'
import type { DashboardProject } from '@/api/client'
import { api } from '@/api/client'

type DashboardCreateTaskModalProps = {
  open: boolean
  onClose: () => void
  /** Calendar-selected day (YYYY-MM-DD); task defaults to this span. */
  scheduleDate: string
  projects: DashboardProject[]
  onCreated: () => void
}

export function DashboardCreateTaskModal({
  open,
  onClose,
  scheduleDate,
  projects,
  onCreated,
}: DashboardCreateTaskModalProps) {
  const navigate = useNavigate()
  const [projectId, setProjectId] = useState('')
  const [phaseId, setPhaseId] = useState('')
  const [phases, setPhases] = useState<Phase[]>([])
  const [phasesLoading, setPhasesLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(scheduleDate)
  const [endDate, setEndDate] = useState(scheduleDate)
  const [responsible, setResponsible] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setPhaseId('')
    setResponsible('')
    setError(null)
    setStartDate(scheduleDate)
    setEndDate(scheduleDate)
    setProjectId((prev) => {
      const stillValid = projects.some((p) => p.id === prev)
      if (stillValid) return prev
      return projects[0]?.id ?? ''
    })
  }, [open, scheduleDate, projects])

  useEffect(() => {
    if (!open || !projectId) {
      setPhases([])
      return
    }
    let cancelled = false
    setPhasesLoading(true)
    api.projects
      .getPhases(projectId)
      .then((p) => {
        if (!cancelled) setPhases(p)
      })
      .catch(() => {
        if (!cancelled) setPhases([])
      })
      .finally(() => {
        if (!cancelled) setPhasesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  useEffect(() => {
    setPhaseId('')
  }, [projectId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) return
    setError(null)
    if (endDate < startDate) {
      setError('End date cannot be before start date.')
      return
    }
    setSaving(true)
    try {
      await api.projects.createTask(projectId, {
        phase_id: phaseId || undefined,
        title: title.trim() || 'Task',
        start_date: startDate,
        end_date: endDate,
        responsible: responsible.trim() || undefined,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose} role="presentation">
      <div
        className="rounded-xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 p-6 shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-create-task-title"
      >
        <h2 id="dashboard-create-task-title" className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-1">
          Create task
        </h2>
        <p className="text-sm text-gray-500 dark:text-white-dim mb-4">
          Add a one-off schedule item. Choose a job; optionally link it to a phase or leave phase blank for a job-level task.
        </p>

        {projects.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-white-dim">You need at least one project to add a task.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-gray-200 dark:border-border-dark text-muted dark:text-white-dim hover:bg-gray-100 dark:hover:bg-dark-4 text-sm font-medium">
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate('/projects?new=1')
                }}
                className="px-4 py-2 rounded-md bg-accent text-white text-sm font-semibold hover:opacity-90"
              >
                New project
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="dash-task-job" className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">
                Job
              </label>
              <select
                id="dash-task-job"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-md px-3 py-2 border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white text-sm"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="dash-task-phase" className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">
                Phase <span className="font-normal text-gray-400 dark:text-white-faint">(optional)</span>
              </label>
              <select
                id="dash-task-phase"
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value)}
                disabled={phasesLoading || phases.length === 0}
                className="w-full rounded-md px-3 py-2 border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white text-sm disabled:opacity-60"
              >
                <option value="">— None (job-level task) —</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {!phasesLoading && phases.length === 0 && projectId ? (
                <p className="text-xs text-gray-500 dark:text-white-dim mt-1">No phases on this job yet.</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="dash-task-title" className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">
                Title
              </label>
              <input
                id="dash-task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md px-3 py-2 border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white text-sm"
                placeholder="What needs to happen?"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dash-task-start" className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">
                  Start date
                </label>
                <input
                  id="dash-task-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md px-3 py-2 border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white text-sm"
                />
              </div>
              <div>
                <label htmlFor="dash-task-end" className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">
                  End date
                </label>
                <input
                  id="dash-task-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md px-3 py-2 border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="dash-task-responsible" className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">
                Responsible <span className="font-normal text-gray-400 dark:text-white-faint">(optional)</span>
              </label>
              <input
                id="dash-task-responsible"
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="w-full rounded-md px-3 py-2 border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white text-sm"
                placeholder="e.g. GC, crew lead"
              />
            </div>

            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-gray-200 dark:border-border-dark text-muted dark:text-white-dim hover:bg-gray-100 dark:hover:bg-dark-4 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !projectId}
                className="px-4 py-2 rounded-md bg-accent text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Create task'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
