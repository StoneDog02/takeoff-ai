const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { employee_id, job_id, active_only } = req.query
    const effectiveEmployeeId = req.employee ? req.employee.id : employee_id
    if (!effectiveEmployeeId && !job_id) return res.json([])
    let q = supabase.from('job_assignments').select('*').order('assigned_at', { ascending: false })
    if (effectiveEmployeeId) q = q.eq('employee_id', effectiveEmployeeId)
    if (job_id) q = q.eq('job_id', job_id)
    if (active_only === 'true') q = q.is('ended_at', null)
    const { data, error } = await q
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    if (req.employee) return res.status(403).json({ error: 'Employees cannot create job assignments' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { employee_id, job_id, role_on_job } = req.body || {}
    if (!employee_id || !job_id) return res.status(400).json({ error: 'employee_id and job_id required' })
    const { data, error } = await supabase
      .from('job_assignments')
      .insert({
        employee_id,
        job_id,
        role_on_job: role_on_job || '',
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
    if (req.employee) return res.status(403).json({ error: 'Employees cannot update job assignments' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { job_id, role_on_job, ended_at } = req.body || {}
    const updates = {}
    if (job_id !== undefined) updates.job_id = job_id
    if (role_on_job !== undefined) updates.role_on_job = role_on_job
    if (ended_at !== undefined) updates.ended_at = ended_at
    const { data, error } = await supabase
      .from('job_assignments')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Assignment not found' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.employee) return res.status(403).json({ error: 'Employees cannot delete job assignments' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { error } = await supabase.from('job_assignments').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

module.exports = router
