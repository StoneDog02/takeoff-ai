const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { data, error } = await supabase
      .from('contractors')
      .select('*')
      .eq('user_id', req.user?.id)
      .order('name')
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
    const { name, trade, email, phone } = req.body || {}
    const row = {
      user_id: req.user?.id,
      name: name ?? '',
      trade: trade ?? '',
      email: email ?? '',
      phone: phone ?? null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('contractors')
      .upsert(row, { onConflict: 'user_id,email', ignoreDuplicates: false })
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
    const { name, trade, email, phone } = req.body || {}
    const updates = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (trade !== undefined) updates.trade = trade
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    const { data, error } = await supabase
      .from('contractors')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user?.id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Contractor not found' })
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
      .from('contractors')
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
