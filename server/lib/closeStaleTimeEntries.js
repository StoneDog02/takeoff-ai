/**
 * Close time entries that are still open after maxHours since clock_in.
 * Uses service-role Supabase (bypasses RLS). Intended for scheduled HTTP cron.
 */
const { syncAttendanceFromTimeEntry } = require('./syncAttendanceFromTimeEntry')

function computeHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null
  const a = new Date(clockIn).getTime()
  const b = new Date(clockOut).getTime()
  return Math.round(((b - a) / (1000 * 60 * 60)) * 100) / 100
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ maxHours?: number }} [options]
 * @returns {Promise<{ closed: number, ids: string[] }>}
 */
async function closeStaleTimeEntries(supabase, options = {}) {
  if (!supabase) throw new Error('Supabase client required')

  const maxHoursRaw = options.maxHours ?? Number(process.env.STALE_TIME_ENTRY_MAX_HOURS)
  const maxHours = Number.isFinite(maxHoursRaw) && maxHoursRaw > 0 ? maxHoursRaw : 16

  const cutoffMs = Date.now() - maxHours * 60 * 60 * 1000
  const cutoffIso = new Date(cutoffMs).toISOString()

  const { data: stale, error: listErr } = await supabase
    .from('time_entries')
    .select('id, employee_id, job_id, clock_in, clock_out, project_work_type_id')
    .is('clock_out', null)
    .lt('clock_in', cutoffIso)

  if (listErr) throw listErr

  const rows = stale || []
  const closedIds = []
  const nowIso = new Date().toISOString()

  for (const row of rows) {
    const hours = computeHours(row.clock_in, nowIso)
    const { data: updated, error: updErr } = await supabase
      .from('time_entries')
      .update({
        clock_out: nowIso,
        hours,
        source: 'server_auto',
        gps_clock_out_log_id: null,
      })
      .eq('id', row.id)
      .is('clock_out', null)
      .select()
      .maybeSingle()

    if (updErr) {
      console.warn('[closeStaleTimeEntries] update failed', row.id, updErr.message)
      continue
    }
    if (!updated) continue

    closedIds.push(row.id)
    try {
      await syncAttendanceFromTimeEntry(supabase, {
        ...updated,
        hours: updated.hours ?? hours,
      })
    } catch (e) {
      console.warn('[closeStaleTimeEntries] syncAttendance', row.id, e?.message)
    }
  }

  return { closed: closedIds.length, ids: closedIds }
}

module.exports = { closeStaleTimeEntries, computeHours }
