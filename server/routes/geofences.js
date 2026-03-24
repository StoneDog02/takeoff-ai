const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { job_id } = req.query
    if (req.actingAsEmployee && req.employee && job_id) {
      const { data: asg } = await defaultSupabase
        .from('job_assignments')
        .select('id')
        .eq('employee_id', req.employee.id)
        .eq('job_id', job_id)
        .is('ended_at', null)
        .maybeSingle()
      if (!asg) return res.json([])
      const { data, error } = await defaultSupabase.from('job_geofences').select('*').eq('job_id', job_id)
      if (error) throw error
      return res.json(data || [])
    }
    let q = supabase.from('job_geofences').select('*')
    if (!req.employee) q = q.eq('user_id', req.user?.id)
    if (job_id) q = q.eq('job_id', job_id)
    const { data, error } = await q
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.get('/job/:jobId', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const jobId = req.params.jobId
    if (req.actingAsEmployee && req.employee) {
      const { data: asg } = await defaultSupabase
        .from('job_assignments')
        .select('id')
        .eq('employee_id', req.employee.id)
        .eq('job_id', jobId)
        .is('ended_at', null)
        .maybeSingle()
      if (!asg) return res.json(null)
      const { data, error } = await defaultSupabase
        .from('job_geofences')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle()
      if (error) throw error
      return res.json(data || null)
    }
    let q = supabase.from('job_geofences').select('*').eq('job_id', jobId)
    if (!req.employee) q = q.eq('user_id', req.user?.id)
    const { data, error } = await q.maybeSingle()
    if (error) throw error
    res.json(data || null)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    if (req.employee) return res.status(403).json({ error: 'Employees cannot create geofences' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { job_id, center_lat, center_lng, radius_value, radius_unit } = req.body || {}
    if (!job_id || center_lat == null || center_lng == null || radius_value == null || !radius_unit)
      return res.status(400).json({ error: 'job_id, center_lat, center_lng, radius_value, radius_unit required' })
    const { data, error } = await supabase
      .from('job_geofences')
      .upsert(
        {
          job_id,
          user_id: req.user?.id,
          center_lat: Number(center_lat),
          center_lng: Number(center_lng),
          radius_value: Number(radius_value),
          radius_unit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'job_id' }
      )
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
    if (req.employee) return res.status(403).json({ error: 'Employees cannot update geofences' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { center_lat, center_lng, radius_value, radius_unit } = req.body || {}
    const updates = { updated_at: new Date().toISOString() }
    if (center_lat !== undefined) updates.center_lat = Number(center_lat)
    if (center_lng !== undefined) updates.center_lng = Number(center_lng)
    if (radius_value !== undefined) updates.radius_value = Number(radius_value)
    if (radius_unit !== undefined) updates.radius_unit = radius_unit
    const { data, error } = await supabase
      .from('job_geofences')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user?.id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Geofence not found' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.employee) return res.status(403).json({ error: 'Employees cannot delete geofences' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { error } = await supabase
      .from('job_geofences')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user?.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

module.exports = router
