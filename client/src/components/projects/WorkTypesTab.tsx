import { useState } from 'react'
import type { ProjectWorkType } from '@/types/global'

const WORK_TYPE_COLORS: Record<string, { bg: string; rate: string }> = {
  labor: { bg: '#EFF6FF', rate: '#2563EB' },
  tile: { bg: '#F0FDF4', rate: '#16A34A' },
  plumbing: { bg: '#FFF7ED', rate: '#EA580C' },
  demolition: { bg: '#FDF2F8', rate: '#DB2777' },
  framing: { bg: '#F0FDF4', rate: '#15803d' },
  concrete: { bg: '#EFF6FF', rate: '#2563EB' },
  cabinets: { bg: '#F5F3FF', rate: '#7C3AED' },
  countertop: { bg: '#FEFCE8', rate: '#CA8A04' },
  default: { bg: '#F1F5F9', rate: '#475569' },
}

const WORK_TYPE_ICONS: Record<string, string> = {
  labor: 'wrench',
  tile: 'grid',
  plumbing: 'droplet',
  demolition: 'zap',
  framing: 'layout',
  concrete: 'box',
  cabinets: 'package',
  countertop: 'square',
  default: 'briefcase',
}

function getWorkTypeStyle(typeKey?: string) {
  const key = (typeKey && WORK_TYPE_COLORS[typeKey]) ? typeKey : 'default'
  return WORK_TYPE_COLORS[key] ?? WORK_TYPE_COLORS.default
}

interface WorkTypesTabProps {
  projectId: string
  projectName: string
  workTypes: ProjectWorkType[]
  onWorkTypesChange: (list: ProjectWorkType[]) => void
  readOnly?: boolean
}

export function WorkTypesTab({
  projectId,
  projectName,
  workTypes,
  onWorkTypesChange,
  readOnly = false,
}: WorkTypesTabProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newRate, setNewRate] = useState('')
  const [newUnit, setNewUnit] = useState('hr')
  const [newTypeKey, setNewTypeKey] = useState('labor')

  const addWorkType = () => {
    const name = newName.trim()
    const rate = parseFloat(newRate)
    if (!name || Number.isNaN(rate) || rate < 0) return
    const wt: ProjectWorkType = {
      id: `wt-${Date.now()}`,
      project_id: projectId,
      name,
      description: newDesc.trim() || undefined,
      rate,
      unit: newUnit.trim() || 'hr',
      type_key: newTypeKey,
    }
    onWorkTypesChange([...workTypes, wt])
    setNewName('')
    setNewDesc('')
    setNewRate('')
    setNewUnit('hr')
    setNewTypeKey('labor')
    setAddOpen(false)
  }

  const removeWorkType = (id: string) => {
    onWorkTypesChange(workTypes.filter((w) => w.id !== id))
  }

  const unitLabel = (unit: string) => {
    if (unit === 'hr') return 'per hr'
    if (unit === 'sf') return 'per sf'
    if (unit === 'ea') return 'per ea'
    if (unit === 'lf') return 'per lf'
    return `per ${unit}`
  }

  const formatRate = (rate: number, unit: string) => {
    if (unit === 'hr') return `$${rate}/hr`
    if (unit === 'sf') return `$${rate}/sf`
    if (unit === 'ea') return `$${rate}/ea`
    if (unit === 'lf') return `$${rate}/lf`
    return `$${rate}/${unit}`
  }

  return (
    <section className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white">Work types for {projectName}</h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover dark:bg-red-mid"
          >
            <span>+ Add work type</span>
          </button>
        )}
      </div>

      {addOpen && (
        <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-5 space-y-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-landing-white">New work type</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted dark:text-white-dim mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. General Labor"
                className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted dark:text-white-dim mb-1">Type (for color)</label>
              <select
                value={newTypeKey}
                onChange={(e) => setNewTypeKey(e.target.value)}
                className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm"
              >
                {Object.keys(WORK_TYPE_COLORS).filter((k) => k !== 'default').map((k) => (
                  <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted dark:text-white-dim mb-1">Description (optional)</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Employees clock in under this work type on the job site."
              className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-muted dark:text-white-dim mb-1">Rate ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="85"
                className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-muted dark:text-white-dim mb-1">Unit</label>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm"
              >
                <option value="hr">per hr</option>
                <option value="sf">per sf</option>
                <option value="ea">per ea</option>
                <option value="lf">per lf</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addWorkType} disabled={!newName.trim() || !newRate} className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-50">
              Add work type
            </button>
            <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium border border-border dark:border-border-dark text-gray-700 dark:text-landing-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {workTypes.length === 0 ? (
          <p className="text-sm text-muted dark:text-white-dim py-4">No work types yet. Add one so crew can clock in under a rate for this job.</p>
        ) : (
          workTypes.map((wt) => {
            const style = getWorkTypeStyle(wt.type_key)
            return (
              <div
                key={wt.id}
                className="rounded-xl border border-border dark:border-border-dark overflow-hidden flex gap-4 p-4"
                style={{ backgroundColor: style.bg }}
              >
                <div className="w-10 h-10 rounded-lg bg-white/80 dark:bg-black/10 flex items-center justify-center shrink-0 text-gray-600 dark:text-white-dim">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-landing-white">{wt.name}</div>
                  {wt.description && <div className="text-sm text-muted dark:text-white-dim mt-0.5">{wt.description}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-bold" style={{ color: style.rate }}>{formatRate(wt.rate, wt.unit)}</span>
                  <div className="text-xs opacity-80" style={{ color: style.rate }}>{unitLabel(wt.unit)}</div>
                </div>
                {!readOnly && (
                  <button type="button" onClick={() => removeWorkType(wt.id)} className="shrink-0 text-muted hover:text-red-600 dark:hover:text-red-400 text-sm" aria-label="Remove">Remove</button>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="pt-6 border-t border-border dark:border-border-dark">
        <h3 className="font-semibold text-gray-900 dark:text-landing-white mb-1 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted dark:text-white-dim"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
          How employees see this
        </h3>
        <p className="text-sm text-muted dark:text-white-dim mb-4">
          When a crew member clocks in on {projectName}, they see these work types and tap to select one before starting their timer.
        </p>
        <div className="rounded-xl border-2 border-gray-200 dark:border-dark-4 bg-gray-50 dark:bg-dark-4 p-4 max-w-sm">
          <div className="space-y-2">
            {workTypes.length === 0 ? (
              <p className="text-sm text-muted dark:text-white-dim py-2">No work types — add some above.</p>
            ) : (
              workTypes.map((wt) => {
                const style = getWorkTypeStyle(wt.type_key)
                return (
                  <div
                    key={wt.id}
                    className="flex items-center gap-3 rounded-lg p-3 border border-gray-200 dark:border-dark-3"
                    style={{ backgroundColor: style.bg }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/80 flex items-center justify-center text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-landing-white text-sm">{wt.name}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
