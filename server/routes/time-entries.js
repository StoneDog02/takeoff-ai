const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

function computeHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null
  const a = new Date(clockIn).getTime()
  const b = new Date(clockOut).getTime()
  return Math.round(((b - a) / (1000 * 60 * 60)) * 100) / 100
}

router.get('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { employee_id, job_id, from, to } = req.query
    let q = supabase.from('time_entries').select('*').order('clock_in', { ascending: false })
    if (employee_id) q = q.eq('employee_id', employee_id)
    if (job_id) q = q.eq('job_id', job_id)
    if (from) q = q.gte('clock_in', from)
    if (to) q = q.lte('clock_in', to)
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
    const { employee_id, job_id, clock_in, clock_out, source } = req.body || {}
    if (!employee_id || !job_id) return res.status(400).json({ error: 'employee_id and job_id required' })
    const clockIn = clock_in || new Date().toISOString()
    const clockOut = clock_out || null
    const hours = clockOut ? computeHours(clockIn, clockOut) : null
    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        employee_id,
        job_id,
        clock_in: clockIn,
        clock_out: clockOut,
        hours,
        source: source || 'manual',
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json({ ...data, hours: data.hours ?? computeHours(data.clock_in, data.clock_out) })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/clock-out', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { clock_out, source, gps_clock_out_log_id } = req.body || {}
    const clockOut = clock_out || new Date().toISOString()
    const { data: entry, error: fetchErr } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (fetchErr || !entry) return res.status(404).json({ error: 'Time entry not found' })
    const hours = computeHours(entry.clock_in, clockOut)
    const updates = {
      clock_out: clockOut,
      hours,
      source: source || entry.source,
      ...(gps_clock_out_log_id != null && { gps_clock_out_log_id }),
    }
    const { data, error } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json({ ...data, hours: data.hours ?? computeHours(data.clock_in, data.clock_out) })
  } catch (err) {
    next(err)
  }
})

module.exports = router
