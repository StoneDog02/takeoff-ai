/**
 * When a time entry is completed (has clock_out), mirror it into attendance_records
 * so Teams Attendance views stay in sync with clock in/out.
 */
const { computeAttendanceVariance } = require('./jobAssignmentSchedule')

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

  let late_arrival_minutes = null
  let early_departure_minutes = null
  if (entry.job_id) {
    const { data: ja } = await supabase
      .from('job_assignments')
      .select('id')
      .eq('employee_id', entry.employee_id)
      .eq('job_id', entry.job_id)
      .is('ended_at', null)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (ja?.id) {
      const { data: sch } = await supabase
        .from('job_assignment_schedules')
        .select('weekly_schedule, timezone')
        .eq('job_assignment_id', ja.id)
        .maybeSingle()
      if (sch?.weekly_schedule) {
        const tz = sch.timezone || 'America/Denver'
        const v = computeAttendanceVariance(entry.clock_in, entry.clock_out, sch.weekly_schedule, workDate, tz)
        late_arrival_minutes = v.late_arrival_minutes
        early_departure_minutes = v.early_departure_minutes
      }
    }
  }

  const { error } = await supabase.from('attendance_records').insert({
    employee_id: entry.employee_id,
    date: workDate,
    clock_in: entry.clock_in,
    clock_out: entry.clock_out,
    late_arrival_minutes,
    early_departure_minutes,
    notes: null,
  })
  if (error) {
    console.warn('[syncAttendanceFromTimeEntry]', error.message)
  }
}

module.exports = { syncAttendanceFromTimeEntry }
