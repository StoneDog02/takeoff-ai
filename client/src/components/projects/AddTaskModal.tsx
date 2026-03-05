import { useState } from 'react'
import type { Phase } from '@/types/global'
import { api } from '@/api/client'
import { toISODate } from '@/lib/date'

interface AddTaskModalProps {
  projectId: string
  phases: Phase[]
  onClose: () => void
  onSaved: () => void
}

export function AddTaskModal({ projectId, phases, onClose, onSaved }: AddTaskModalProps) {
  const [phaseId, setPhaseId] = useState(phases[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(toISODate(new Date()) ?? '')
  const [endDate, setEndDate] = useState(toISODate(new Date(Date.now() + 7 * 86400000)) ?? '')
  const [responsible, setResponsible] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.projects.createTask(projectId, {
        phase_id: phaseId || undefined,
        title: title || 'Task',
        start_date: startDate,
        end_date: endDate,
        responsible: responsible || undefined,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-6 shadow-lg max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-4">Add task</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {phases.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">Phase</label>
              <select
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value)}
                className="w-full rounded-md px-3 py-2 border border-border dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white"
              >
                <option value="">— None —</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md px-3 py-2 border border-border dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white"
              placeholder="Task name"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md px-3 py-2 border border-border dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md px-3 py-2 border border-border dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">Responsible</label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="w-full rounded-md px-3 py-2 border border-border dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white"
              placeholder="e.g. GC, Subcontractor"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border dark:border-border-dark text-muted dark:text-white-dim hover:bg-gray-100 dark:hover:bg-dark-4">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
