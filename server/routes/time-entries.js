const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')
const { syncAttendanceFromTimeEntry } = require('../lib/syncAttendanceFromTimeEntry')

/** Validate work type belongs to job (service client; avoids trusting client). */
async function assertWorkTypeForJob(supabase, jobId, projectWorkTypeId) {
  if (projectWorkTypeId == null || projectWorkTypeId === '') return null
  const { data: wt, error } = await supabase
    .from('project_work_types')
    .select('id, project_id')
    .eq('id', projectWorkTypeId)
    .maybeSingle()
  if (error) throw error
  if (!wt || wt.project_id !== jobId) {
    const err = new Error('Invalid work type for this job')
    err.statusCode = 400
    throw err
  }
  return wt.id
}

const router = express.Router()

/** Plain YYYY-MM-DD bounds are expanded so `to` is inclusive of that full calendar day in UTC (timestamptz compares). */
function normalizeClockInQueryBounds(from, to) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/
  let fromB = from
  let toB = to
  if (from && typeof from === 'string' && dateOnly.test(from.trim())) {
    fromB = `${from.trim()}T00:00:00.000Z`
  }
  if (to && typeof to === 'string' && dateOnly.test(to.trim())) {
    toB = `${to.trim()}T23:59:59.999Z`
  }
  return { from: fromB, to: toB }
}

function computeHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null
  const a = new Date(clockIn).getTime()
  const b = new Date(clockOut).getTime()
  return Math.round(((b - a) / (1000 * 60 * 60)) * 100) / 100
}

router.get('/', async (req, res, next) => {
  try {
    const supabase = req.actingAsEmployee ? (defaultSupabase || req.supabase) : (req.supabase || defaultSupabase)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { employee_id, job_id, from, to } = req.query
    const { from: fromBound, to: toBound } = normalizeClockInQueryBounds(from, to)
    const effectiveEmployeeId = req.employee ? req.employee.id : employee_id
    let q = supabase.from('time_entries').select('*').order('clock_in', { ascending: false })
    if (effectiveEmployeeId) q = q.eq('employee_id', effectiveEmployeeId)
    if (job_id) q = q.eq('job_id', job_id)
    if (fromBound) q = q.gte('clock_in', fromBound)
    if (toBound) q = q.lte('clock_in', toBound)
    const { data, error } = await q
    if (error) throw error
    const entries = (data || []).map((e) => ({
      ...e,
      hours: e.hours ?? computeHours(e.clock_in, e.clock_out),
    }))
    res.json(entries)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const rw = req.actingAsEmployee ? (defaultSupabase || supabase) : supabase
    const { employee_id, job_id, clock_in, clock_out, source, project_work_type_id } = req.body || {}
    const effectiveEmployeeId = req.employee ? req.employee.id : employee_id
    if (!effectiveEmployeeId || !job_id) return res.status(400).json({ error: 'employee_id and job_id required' })
    const db = defaultSupabase || supabase
    let resolvedWtId = null
    try {
      resolvedWtId = await assertWorkTypeForJob(db, job_id, project_work_type_id)
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ error: e.message })
      throw e
    }
    if (req.employee) {
      const { data: assignment, error: asgErr } = await rw
        .from('job_assignments')
        .select('id')
        .eq('employee_id', effectiveEmployeeId)
        .eq('job_id', job_id)
        .is('ended_at', null)
        .maybeSingle()
      if (asgErr) throw asgErr
      if (!assignment) {
        return res.status(403).json({ error: 'You are not assigned to this job.' })
      }
    }

    const clockIn = clock_in || new Date().toISOString()
    const clockOut = clock_out || null
    const hours = clockOut ? computeHours(clockIn, clockOut) : null
    const { data, error } = await rw
      .from('time_entries')
      .insert({
        employee_id: effectiveEmployeeId,
        job_id,
        clock_in: clockIn,
        clock_out: clockOut,
        hours,
        source: source || 'manual',
        ...(resolvedWtId != null && { project_work_type_id: resolvedWtId }),
      })
      .select()
      .single()
    if (error) throw error
    const row = { ...data, hours: data.hours ?? computeHours(data.clock_in, data.clock_out) }
    if (row.clock_out) {
      await syncAttendanceFromTimeEntry(rw, row)
    }
    res.status(201).json(row)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/clock-out', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const rw = req.actingAsEmployee ? (defaultSupabase || supabase) : supabase
    const { clock_out, source, gps_clock_out_log_id } = req.body || {}
    const clockOut = clock_out || new Date().toISOString()
    const { data: entry, error: fetchErr } = await rw
      .from('time_entries')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (fetchErr || !entry) return res.status(404).json({ error: 'Time entry not found' })
    if (req.employee && entry.employee_id !== req.employee.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const hours = computeHours(entry.clock_in, clockOut)
    const updates = {
      clock_out: clockOut,
      hours,
      source: source || entry.source,
      ...(gps_clock_out_log_id != null && { gps_clock_out_log_id }),
    }
    const { data, error } = await rw
      .from('time_entries')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    const row = { ...data, hours: data.hours ?? computeHours(data.clock_in, data.clock_out) }
    await syncAttendanceFromTimeEntry(rw, row)
    res.json(row)
  } catch (err) {
    next(err)
  }
})

module.exports = router
