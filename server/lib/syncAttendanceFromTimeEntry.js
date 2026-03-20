/**
 * When a time entry is completed (has clock_out), mirror it into attendance_records
 * so Teams Attendance views stay in sync with clock in/out.
 */
async function syncAttendanceFromTimeEntry(supabase, entry) {
  if (!supabase || !entry?.clock_out || !entry?.clock_in || !entry?.employee_id) return
  const { data: existing } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('employee_id', entry.employee_id)
    .eq('clock_in', entry.clock_in)
    .maybeSingle()
  if (existing) return
  const workDate = entry.clock_in.slice(0, 10)
  const { error } = await supabase.from('attendance_records').insert({
    employee_id: entry.employee_id,
    date: workDate,
    clock_in: entry.clock_in,
    clock_out: entry.clock_out,
    late_arrival_minutes: null,
    early_departure_minutes: null,
    notes: null,
  })
  if (error) {
    console.warn('[syncAttendanceFromTimeEntry]', error.message)
  }
}

module.exports = { syncAttendanceFromTimeEntry }
