import { useEffect, useState } from 'react'
import { X, Clock, Briefcase } from 'lucide-react'
import { teamsApi } from '@/api/teams'
import type { TimeEntry } from '@/types/global'
import { dayjs } from '@/lib/date'

function toDatetimeLocal(iso: string) {
  return dayjs(iso).format('YYYY-MM-DDTHH:mm')
}

export interface EditTimeEntryModalProps {
  /** Row to edit; omit when adding (use addForEmployeeId). */
  entry: TimeEntry | null
  /** With entry=null, opens add form for this employee (e.g. forgot to clock in). */
  addForEmployeeId?: string | null
  /** When adding, pre-fill clock-in from this ISO time. Omit or null to default to now. */
  addClockInDefaultIso?: string | null
  employeeName: string
  /** Edit mode: job label in subtitle */
  jobName?: string
  jobs: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}

export function EditTimeEntryModal({
  entry,
  addForEmployeeId = null,
  addClockInDefaultIso = null,
  employeeName,
  jobName = '',
  jobs,
  onClose,
  onSaved,
}: EditTimeEntryModalProps) {
  const isAdd = !entry && !!addForEmployeeId
  const isOpen = !!entry || isAdd

  const [addJobId, setAddJobId] = useState('')
  const [editClockIn, setEditClockIn] = useState('')
  const [editClockOut, setEditClockOut] = useState('')
  const [editStillIn, setEditStillIn] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const clockInId = 'time-entry-clock-in'
  const clockOutId = 'time-entry-clock-out'
  const jobSelectId = 'time-entry-job'

  useEffect(() => {
    if (!entry) return
    setEditClockIn(toDatetimeLocal(entry.clock_in))
    setEditClockOut(entry.clock_out ? toDatetimeLocal(entry.clock_out) : '')
    setEditStillIn(!entry.clock_out)
    setAddJobId('')
    setEditError(null)
  }, [entry?.id, entry?.clock_in, entry?.clock_out])

  useEffect(() => {
    if (!addForEmployeeId || entry) return
    setEditClockIn(
      addClockInDefaultIso
        ? toDatetimeLocal(addClockInDefaultIso)
        : dayjs().format('YYYY-MM-DDTHH:mm')
    )
    setEditClockOut('')
    setEditStillIn(false)
    setAddJobId(jobs[0]?.id ?? '')
    setEditError(null)
  }, [addForEmployeeId, entry, jobs, addClockInDefaultIso])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editSaving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, editSaving, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editStillIn && !editClockOut.trim()) {
      setEditError('Set a clock-out time, or mark the employee as still on the job.')
      return
    }
    if (isAdd && !addJobId) {
      setEditError('Select a job.')
      return
    }
    setEditSaving(true)
    setEditError(null)
    try {
      if (entry) {
        const clockInIso = dayjs(editClockIn).toISOString()
        const clockOutIso = editStillIn ? null : dayjs(editClockOut).toISOString()
        const clockInUnchanged = dayjs(editClockIn).isSame(dayjs(entry.clock_in), 'minute')
        const closingOpenShift =
          !editStillIn && Boolean(editClockOut.trim()) && (entry.clock_out == null || entry.clock_out === '')

        // Prefer legacy clock-out route when only finishing an open shift (no clock-in edit).
        // Many servers had PATCH /:id/clock-out before PUT/PATCH /:id existed — avoids 404.
        if (closingOpenShift && clockInUnchanged && clockOutIso) {
          await teamsApi.timeEntries.clockOut(entry.id, {
            clock_out: clockOutIso,
            source: 'manual',
          })
        } else {
          await teamsApi.timeEntries.update(entry.id, {
            clock_in: clockInIso,
            clock_out: clockOutIso,
            source: 'manual',
          })
        }
      } else if (addForEmployeeId) {
        await teamsApi.timeEntries.create({
          employee_id: addForEmployeeId,
          job_id: addJobId,
          clock_in: dayjs(editClockIn).toISOString(),
          clock_out: editStillIn ? undefined : dayjs(editClockOut).toISOString(),
          source: 'manual',
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  const titleId = isAdd ? 'add-time-entry-title' : 'edit-time-entry-title'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={() => !editSaving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* dashboard-app: theme tokens + .teams-* inputs; time-entry-modal-panel overrides min-height:100vh */}
      <div
        className="dashboard-app time-entry-modal-panel w-full max-w-[480px] shrink-0 overflow-hidden rounded-xl border shadow-2xl"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--bg-surface)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-3"
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-raised)',
          }}
        >
          <div className="min-w-0 pr-2">
            <h2
              id={titleId}
              className="m-0 text-[17px] font-bold leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {isAdd ? 'Add time entry' : 'Edit time entry'}
            </h2>
            <p className="teams-muted m-0 mt-1 text-[13px] leading-snug">
              {isAdd
                ? 'Record a shift when someone forgot to clock in, or fix times below.'
                : 'Update clock in/out for this shift.'}
            </p>
          </div>
          <button
            type="button"
            className="teams-btn teams-btn-ghost shrink-0"
            style={{ padding: '8px 10px', minWidth: 'auto', lineHeight: 1 }}
            aria-label="Close"
            onClick={onClose}
            disabled={editSaving}
          >
            <X size={18} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="teams-form" style={{ padding: '20px 22px 22px' }}>
          <div
            className="rounded-lg border"
            style={{
              padding: '14px 16px',
              borderColor: 'var(--border)',
              background: 'var(--bg-page)',
            }}
          >
            <div className="teams-label" style={{ marginBottom: 6 }}>
              {isAdd ? 'Employee' : 'Shift'}
            </div>
            <div className="text-[15px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {employeeName || '—'}
            </div>
            {!isAdd && jobName ? (
              <div className="teams-muted mt-1 flex items-center gap-1.5 text-[12px]">
                <Briefcase size={12} className="shrink-0 opacity-70" aria-hidden />
                {jobName}
              </div>
            ) : null}
          </div>

          {isAdd ? (
            <div className="teams-form-row">
              <label className="teams-label flex items-center gap-1.5" htmlFor={jobSelectId}>
                <Briefcase size={12} className="opacity-70" aria-hidden />
                Job
              </label>
              <select
                id={jobSelectId}
                required
                value={addJobId}
                onChange={(ev) => setAddJobId(ev.target.value)}
                className="teams-select"
              >
                <option value="">Select a job…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
              <span className="teams-muted text-[12px]">Which site or project this time applies to.</span>
            </div>
          ) : null}

          <div className="teams-form-row">
            <label className="teams-label flex items-center gap-1.5" htmlFor={clockInId}>
              <Clock size={12} className="opacity-70" aria-hidden />
              Clock in
            </label>
            <input
              id={clockInId}
              type="datetime-local"
              required
              value={editClockIn}
              onChange={(ev) => setEditClockIn(ev.target.value)}
              className="teams-input"
            />
            <span className="teams-muted text-[12px]">You can backdate if they forgot to clock in.</span>
          </div>

          <div
            className="rounded-lg border"
            style={{
              padding: '14px 16px',
              borderColor: 'var(--red-border)',
              background: 'var(--red-glow-soft)',
            }}
          >
            <label className="teams-checkbox-label m-0" style={{ color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={editStillIn}
                onChange={(ev) => setEditStillIn(ev.target.checked)}
              />
              <span className="text-[13px] font-medium">Still on the job (no clock out yet)</span>
            </label>
            <p className="teams-muted m-0 mt-2 text-[12px] leading-relaxed">
              Check this if they are currently working. Uncheck to enter an end time.
            </p>
          </div>

          {!editStillIn ? (
            <div className="teams-form-row">
              <label className="teams-label flex items-center gap-1.5" htmlFor={clockOutId}>
                <Clock size={12} className="opacity-70" aria-hidden />
                Clock out
              </label>
              <input
                id={clockOutId}
                type="datetime-local"
                value={editClockOut}
                onChange={(ev) => setEditClockOut(ev.target.value)}
                className="teams-input"
              />
            </div>
          ) : null}

          {editError ? (
            <p
              className="m-0 rounded-md px-3 py-2 text-[13px] leading-snug"
              style={{
                background: 'var(--red-glow-soft)',
                color: 'var(--red-light)',
                border: '1px solid var(--red-border)',
              }}
              role="alert"
            >
              {editError}
            </p>
          ) : null}

          <div
            className="teams-form-actions"
            style={{
              marginTop: 8,
              paddingTop: 18,
              borderTop: '1px solid var(--border)',
              justifyContent: 'flex-end',
            }}
          >
            <button type="button" className="teams-btn teams-btn-ghost" onClick={onClose} disabled={editSaving}>
              Cancel
            </button>
            <button type="submit" className="teams-btn teams-btn-primary" disabled={editSaving}>
              {editSaving ? 'Saving…' : isAdd ? 'Add time entry' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
