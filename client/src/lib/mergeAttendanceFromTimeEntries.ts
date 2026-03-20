import type { AttendanceRecord, TimeEntry } from '@/types/global'

/**
 * Attendance rows from clock in/out may only exist in `time_entries`. Merge completed
 * shifts into a unified list for display (deduped by employee + clock_in).
 */
export function mergeAttendanceWithTimeEntries(
  records: AttendanceRecord[],
  entries: TimeEntry[]
): AttendanceRecord[] {
  const keys = new Set(records.map((r) => `${r.employee_id}|${r.clock_in}`))
  const synthetic: AttendanceRecord[] = []
  for (const e of entries) {
    if (!e.clock_out) continue
    const key = `${e.employee_id}|${e.clock_in}`
    if (keys.has(key)) continue
    keys.add(key)
    synthetic.push({
      id: `time-entry:${e.id}`,
      employee_id: e.employee_id,
      date: e.clock_in.slice(0, 10),
      clock_in: e.clock_in,
      clock_out: e.clock_out,
      created_at: e.created_at,
    })
  }
  return [...records, ...synthetic].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}
