import { useEffect, useState } from 'react'
import { teamsApi } from '@/api/teamsClient'
import type { DayScheduleSegment, JobAssignment, JobWeeklySchedule, WeekdayScheduleKey } from '@/types/global'

const TIMEZONES_US = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
] as const

const DISPLAY_DAYS: { key: WeekdayScheduleKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const ALL_KEYS: WeekdayScheduleKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function emptyDay(): DayScheduleSegment {
  return { enabled: false, start: '07:00', end: '15:30' }
}

function normalizeLoaded(ws: JobWeeklySchedule | undefined): Record<WeekdayScheduleKey, DayScheduleSegment> {
  const out = {} as Record<WeekdayScheduleKey, DayScheduleSegment>
  for (const k of ALL_KEYS) {
    const d = ws?.[k]
    if (d && typeof d === 'object') {
      out[k] = {
        enabled: !!d.enabled,
        start: typeof d.start === 'string' && d.start ? d.start : '07:00',
        end: typeof d.end === 'string' && d.end ? d.end : '15:30',
      }
    } else {
      out[k] = emptyDay()
    }
  }
  return out
}

export interface JobAssignmentScheduleModalProps {
  assignment: JobAssignment
  employeeName: string
  projectName: string
  onClose: () => void
  onSaved?: () => void
}

export function JobAssignmentScheduleModal({
  assignment,
  employeeName,
  projectName,
  onClose,
  onSaved,
}: JobAssignmentScheduleModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timezone, setTimezone] = useState('America/Denver')
  const [days, setDays] = useState<Record<WeekdayScheduleKey, DayScheduleSegment>>(() => {
    const o = {} as Record<WeekdayScheduleKey, DayScheduleSegment>
    for (const k of ALL_KEYS) o[k] = emptyDay()
    return o
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    teamsApi.jobAssignments
      .getSchedule(assignment.id)
      .then((res) => {
        if (cancelled) return
        setTimezone(res.timezone || 'America/Denver')
        setDays(normalizeLoaded(res.weekly_schedule))
      })
      .catch(() => {
        if (!cancelled) setError('Could not load schedule.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [assignment.id])

  const updateDay = (key: WeekdayScheduleKey, patch: Partial<DayScheduleSegment>) => {
    setDays((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const weekly_schedule: JobWeeklySchedule = {}
    for (const k of ALL_KEYS) {
      const d = days[k]
      if (!d) continue
      if (d.enabled) {
        weekly_schedule[k] = {
          enabled: true,
          start: d.start || '07:00',
          end: d.end || '15:30',
        }
      }
    }
    try {
      await teamsApi.jobAssignments.saveSchedule(assignment.id, { weekly_schedule, timezone })
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose} role="dialog" aria-modal>
      <div
        className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border dark:border-border-dark">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-landing-white">Work schedule</h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {employeeName} · {projectName}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
            Set expected days and hours for this job. When they clock in and out, we compare to this schedule for late arrival and
            early departure on the Attendance view (uses the job timezone below).
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Job timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm text-gray-900 dark:text-landing-white"
            >
              {TIMEZONES_US.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-muted py-6 text-center">Loading schedule…</p>
          ) : (
            <div className="space-y-3">
              {DISPLAY_DAYS.map(({ key, label }) => {
                const d = days[key] ?? emptyDay()
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border dark:border-border-dark bg-gray-50/80 dark:bg-dark-4/50 px-3 py-2.5"
                  >
                    <label className="flex items-center gap-2 min-w-[120px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                        className="rounded border-border"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-landing-white">{label}</span>
                    </label>
                    {d.enabled && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted">Start</span>
                        <input
                          type="time"
                          value={d.start}
                          onChange={(e) => updateDay(key, { start: e.target.value })}
                          className="rounded border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-2 py-1 text-gray-900 dark:text-landing-white"
                        />
                        <span className="text-muted">End</span>
                        <input
                          type="time"
                          value={d.end}
                          onChange={(e) => updateDay(key, { end: e.target.value })}
                          className="rounded border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-2 py-1 text-gray-900 dark:text-landing-white"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="p-5 border-t border-border dark:border-border-dark flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-dark-4"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-gray-900 dark:bg-landing-white dark:text-gray-900 hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
