const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { employee_id, from, to } = req.query
    let q = supabase.from('attendance_records').select('*').order('date', { ascending: false })
    if (employee_id) q = q.eq('employee_id', employee_id)
    if (from) q = q.gte('date', from)
    if (to) q = q.lte('date', to)
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
    const {
      employee_id,
      date,
      clock_in,
      clock_out,
      late_arrival_minutes,
      early_departure_minutes,
      notes,
    } = req.body || {}
    if (!employee_id || !date || !clock_in) return res.status(400).json({ error: 'employee_id, date, clock_in required' })
    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        employee_id,
        date,
        clock_in,
        clock_out: clock_out || null,
        late_arrival_minutes: late_arrival_minutes ?? null,
        early_departure_minutes: early_departure_minutes ?? null,
        notes: notes || null,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const {
      date,
      clock_in,
      clock_out,
      late_arrival_minutes,
      early_departure_minutes,
      notes,
    } = req.body || {}
    const updates = {}
    if (date !== undefined) updates.date = date
    if (clock_in !== undefined) updates.clock_in = clock_in
    if (clock_out !== undefined) updates.clock_out = clock_out
    if (late_arrival_minutes !== undefined) updates.late_arrival_minutes = late_arrival_minutes
    if (early_departure_minutes !== undefined) updates.early_departure_minutes = early_departure_minutes
    if (notes !== undefined) updates.notes = notes
    const { data, error } = await supabase
      .from('attendance_records')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Record not found' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { error } = await supabase.from('attendance_records').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

module.exports = router
