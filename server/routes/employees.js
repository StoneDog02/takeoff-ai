const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { status, job_id } = req.query
    let q = supabase
      .from('employees')
      .select('*')
      .eq('user_id', req.user?.id)
      .order('name')
    if (status) q = q.eq('status', status)
    const { data: employees, error } = await q
    if (error) throw error
    let list = employees || []
    if (job_id) {
      const { data: assignments } = await supabase
        .from('job_assignments')
        .select('employee_id')
        .eq('job_id', job_id)
        .is('ended_at', null)
      const ids = new Set((assignments || []).map((a) => a.employee_id))
      list = list.filter((e) => ids.has(e.id))
    }
    res.json(list)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { data: employee, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user?.id)
      .single()
    if (error || !employee) return res.status(404).json({ error: 'Employee not found' })
    res.json(employee)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { name, role, email, phone, status, current_compensation } = req.body || {}
    const { data, error } = await supabase
      .from('employees')
      .insert({
        user_id: req.user?.id,
        name: name || '',
        role: role || '',
        email: email || '',
        phone: phone || '',
        status: status || 'off',
        current_compensation: current_compensation ?? null,
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
    const { name, role, email, phone, status, current_compensation } = req.body || {}
    const updates = {}
    if (name !== undefined) updates.name = name
    if (role !== undefined) updates.role = role
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    if (status !== undefined) updates.status = status
    if (current_compensation !== undefined) updates.current_compensation = current_compensation
    updates.updated_at = new Date().toISOString()
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user?.id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Employee not found' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { error } = await supabase
      .from('employees')
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
