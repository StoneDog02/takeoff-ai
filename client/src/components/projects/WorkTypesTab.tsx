import { useState, useMemo, useEffect } from 'react'
import type { ProjectWorkType } from '@/types/global'
import { WorkTypeIcon } from '@/components/projects/WorkTypeIcon'
import { WorkTypeSelect } from '@/components/projects/WorkTypeSelect'
import { CustomWorkTypeColorPicker, getUsedWorkTypeColors, getWorkTypeStyle } from '@/components/projects/CustomWorkTypeColorPicker'
import { WORK_TYPE_KEYS, CUSTOM_WORK_TYPE_PALETTE } from '@/components/projects/NewProjectWizard/constants'
import { formatWorkTypePayRateDisplay, isGeneralLaborWorkTypeName } from '@/lib/workTypeDisplay'

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
  const [newCustomColor, setNewCustomColor] = useState<string>('#6366F1')

  const usedColorsForNew = useMemo(() => getUsedWorkTypeColors(workTypes), [workTypes])
  const availableColorsForNew = useMemo(
    () => CUSTOM_WORK_TYPE_PALETTE.filter((c) => !usedColorsForNew.has(c.toLowerCase())) as string[],
    [usedColorsForNew]
  )
  useEffect(() => {
    if (newTypeKey === 'custom' && availableColorsForNew.length > 0 && !availableColorsForNew.includes(newCustomColor)) {
      setNewCustomColor(availableColorsForNew[0]!)
    }
  }, [newTypeKey, availableColorsForNew, newCustomColor])

  const addWorkType = () => {
    const name = newName.trim()
    if (!name) return
    const rate = newRate.trim() === '' ? 0 : parseFloat(newRate)
    if (Number.isNaN(rate) || rate < 0) return
    if (rate === 0 && newTypeKey !== 'labor') return
    if (newTypeKey === 'custom' && !newCustomColor) return
    const wt: ProjectWorkType = {
      id: `wt-${Date.now()}`,
      project_id: projectId,
      name,
      description: newDesc.trim() || undefined,
      rate,
      unit: newUnit.trim() || 'hr',
      type_key: newTypeKey,
      ...(newTypeKey === 'custom' && newCustomColor ? { custom_color: newCustomColor } : {}),
    }
    onWorkTypesChange([...workTypes, wt])
    setNewName('')
    setNewDesc('')
    setNewRate('')
    setNewUnit('hr')
    setNewTypeKey('labor')
    setNewCustomColor('#6366F1')
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


  /** Work types sorted by category order (Labor, Demolition, Structure, Finish & Trades, Equipment, Custom). */
  const workTypesSorted = useMemo(() => {
    const order: string[] = [...WORK_TYPE_KEYS]
    return [...workTypes].sort((a, b) => {
      const ia = order.indexOf(a.type_key ?? '')
      const ib = order.indexOf(b.type_key ?? '')
      if (ia === -1 && ib === -1) return 0
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }, [workTypes])

  return (
    <section className="w-full min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(280px,360px)] gap-8 items-start">
        {/* Left column: work types list */}
        <div className="space-y-6 min-w-0">
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
                  <WorkTypeSelect
                    value={newTypeKey}
                    onChange={setNewTypeKey}
                    iconSize={18}
                    customColor={newTypeKey === 'custom' ? newCustomColor : undefined}
                  />
                </div>
              </div>
              {newTypeKey === 'custom' && (
                <CustomWorkTypeColorPicker
                  value={newCustomColor}
                  onChange={setNewCustomColor}
                  usedColors={usedColorsForNew}
                />
              )}
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
                <button
                  type="button"
                  onClick={addWorkType}
                  disabled={!newName.trim() || (newTypeKey !== 'labor' && !newRate.trim()) || (newTypeKey === 'custom' && !newCustomColor)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-50"
                >
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
              workTypesSorted.map((wt) => {
                const style = getWorkTypeStyle(wt.type_key, wt.custom_color)
                return (
                  <div
                    key={wt.id}
                    className="rounded-xl border border-border dark:border-border-dark overflow-hidden flex gap-4 p-4"
                    style={{ backgroundColor: style.bg }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/80 dark:bg-black/10 flex items-center justify-center shrink-0 text-gray-600 dark:text-white-dim" style={{ color: style.rate }}>
                      <WorkTypeIcon typeKey={wt.type_key} size={20} customColor={wt.custom_color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-landing-white">{wt.name}</div>
                      {wt.description && <div className="text-sm text-muted dark:text-white-dim mt-0.5">{wt.description}</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-bold" style={{ color: style.rate }}>{formatWorkTypePayRateDisplay(wt)}</span>
                      <div className="text-xs opacity-80" style={{ color: style.rate }}>{unitLabel(wt.unit)}</div>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeWorkType(wt.id)}
                        disabled={isGeneralLaborWorkTypeName(wt)}
                        className="shrink-0 text-sm disabled:opacity-40 disabled:cursor-not-allowed text-muted hover:text-red-600 dark:hover:text-red-400"
                        title={isGeneralLaborWorkTypeName(wt) ? 'General Labor is required on every job' : undefined}
                        aria-label="Remove"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right column: how employees see this */}
        <div className="lg:sticky lg:top-6 rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-5 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-landing-white mb-1 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted dark:text-white-dim"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
            How employees see this
          </h3>
          <p className="text-sm text-muted dark:text-white-dim mb-4">
            When a crew member clocks in on {projectName}, they see these work types and tap to select one before starting their timer.
          </p>
          <div className="rounded-xl border-2 border-gray-200 dark:border-dark-4 bg-gray-50 dark:bg-dark-4 p-4">
            <div className="space-y-2">
              {workTypes.length === 0 ? (
                <p className="text-sm text-muted dark:text-white-dim py-2">No work types — add some to the left.</p>
              ) : (
                workTypesSorted.map((wt) => {
                  const style = getWorkTypeStyle(wt.type_key, wt.custom_color)
                  return (
                    <div
                      key={wt.id}
                      className="flex items-center gap-3 rounded-lg p-3 border border-gray-200 dark:border-dark-3"
                      style={{ backgroundColor: style.bg }}
                    >
                      <div className="w-9 h-9 rounded-lg bg-white/80 flex items-center justify-center text-gray-600" style={{ color: style.rate }}>
                        <WorkTypeIcon typeKey={wt.type_key} size={18} customColor={wt.custom_color} />
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
      </div>
    </section>
  )
}
