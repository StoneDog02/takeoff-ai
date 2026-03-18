const express = require('express')
const router = express.Router()
const { supabase: defaultSupabase } = require('../db/supabase')

function getSupabase(req) {
  return req.supabase || defaultSupabase
}

/** GET /api/custom-products */
router.get('/', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { data, error } = await supabase
      .from('custom_products')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Custom products list error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/custom-products */
router.post('/', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { name, description, unit, default_unit_price, item_type, sub_cost, markup_pct, billed_price, trades, taxable } = req.body
    const { data, error } = await supabase
      .from('custom_products')
      .insert({
        user_id: req.user.id,
        name: name || 'Product',
        description: description || null,
        unit: unit || 'ea',
        default_unit_price: Number(default_unit_price) || 0,
        item_type: ['service', 'product', 'labor', 'sub', 'material', 'equipment'].includes(item_type) ? item_type : null,
        sub_cost: sub_cost != null ? Number(sub_cost) : null,
        markup_pct: markup_pct != null ? Number(markup_pct) : null,
        billed_price: billed_price != null ? Number(billed_price) : null,
        trades: Array.isArray(trades) ? trades : [],
        taxable: !!taxable,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    console.error('Custom product create error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** PATCH /api/custom-products/:id */
router.patch('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { name, description, unit, default_unit_price, item_type, sub_cost, markup_pct, billed_price, trades, taxable } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (unit !== undefined) updates.unit = unit
    if (default_unit_price !== undefined) updates.default_unit_price = Number(default_unit_price)
    if (item_type !== undefined) updates.item_type = ['service', 'product', 'labor', 'sub', 'material', 'equipment'].includes(item_type) ? item_type : null
    if (sub_cost !== undefined) updates.sub_cost = sub_cost != null ? Number(sub_cost) : null
    if (markup_pct !== undefined) updates.markup_pct = markup_pct != null ? Number(markup_pct) : null
    if (billed_price !== undefined) updates.billed_price = billed_price != null ? Number(billed_price) : null
    if (trades !== undefined) updates.trades = Array.isArray(trades) ? trades : []
    if (taxable !== undefined) updates.taxable = !!taxable
    const { data, error } = await supabase
      .from('custom_products')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  } catch (err) {
    console.error('Custom product update error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** DELETE /api/custom-products/:id */
router.delete('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { error } = await supabase.from('custom_products').delete().eq('id', id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    console.error('Custom product delete error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
