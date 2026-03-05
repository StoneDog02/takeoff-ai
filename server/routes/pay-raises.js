const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { employee_id } = req.query
    let q = supabase.from('pay_raises').select('*').order('effective_date', { ascending: false })
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
    const { employee_id, effective_date, amount_type, amount, previous_rate, new_rate, notes } = req.body || {}
    if (!employee_id || !effective_date || !amount_type || amount == null)
      return res.status(400).json({ error: 'employee_id, effective_date, amount_type, amount required' })
    const { data, error } = await supabase
      .from('pay_raises')
      .insert({
        employee_id,
        effective_date,
        amount_type,
        amount: Number(amount),
        previous_rate: previous_rate ?? null,
        new_rate: new_rate ?? null,
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
    const { effective_date, amount_type, amount, previous_rate, new_rate, notes } = req.body || {}
    const updates = {}
    if (effective_date !== undefined) updates.effective_date = effective_date
    if (amount_type !== undefined) updates.amount_type = amount_type
    if (amount !== undefined) updates.amount = Number(amount)
    if (previous_rate !== undefined) updates.previous_rate = previous_rate
    if (new_rate !== undefined) updates.new_rate = new_rate
    if (notes !== undefined) updates.notes = notes
    const { data, error } = await supabase
      .from('pay_raises')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Pay raise not found' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { error } = await supabase.from('pay_raises').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

module.exports = router
