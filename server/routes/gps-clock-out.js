const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { job_id, employee_id } = req.query
    let q = supabase.from('gps_clock_out_log').select('*').order('exited_at', { ascending: false })
    if (job_id) q = q.eq('job_id', job_id)
    if (employee_id) q = q.eq('employee_id', employee_id)
    const { data, error } = await q
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { employee_id, time_entry_id, job_id, exited_at, lat, lng, geofence_id } = req.body || {}
    if (!employee_id || !time_entry_id || !job_id)
      return res.status(400).json({ error: 'employee_id, time_entry_id, job_id required' })
    const exitedAt = exited_at || new Date().toISOString()
    const { data: log, error: insertErr } = await supabase
      .from('gps_clock_out_log')
      .insert({
        employee_id,
        time_entry_id,
        job_id,
        exited_at: exitedAt,
        lat: lat ?? null,
        lng: lng ?? null,
        geofence_id: geofence_id || null,
      })
      .select()
      .single()
    if (insertErr) throw insertErr
    const clockOut = exitedAt
    const { data: entry } = await supabase.from('time_entries').select('clock_in').eq('id', time_entry_id).single()
    const hours = entry
      ? Math.round(((new Date(clockOut) - new Date(entry.clock_in)) / (1000 * 60 * 60)) * 100) / 100
      : null
    await supabase
      .from('time_entries')
      .update({
        clock_out: clockOut,
        hours,
        source: 'gps_auto',
        gps_clock_out_log_id: log.id,
      })
      .eq('id', time_entry_id)
    res.status(201).json(log)
  } catch (err) {
    next(err)
  }
})

module.exports = router
