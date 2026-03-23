const express = require('express')
const router = express.Router()
const { supabase: defaultSupabase } = require('../db/supabase')

const FULL_ITEM_TYPES = ['service', 'product', 'labor', 'sub', 'material', 'equipment']

function getSupabase(req) {
  return req.supabase || defaultSupabase
}

/** Trim + lowercase; default service. */
function normalizeItemType(raw) {
  if (typeof raw !== 'string') return 'service'
  const t = raw.trim().toLowerCase()
  return FULL_ITEM_TYPES.includes(t) ? t : 'service'
}

/**
 * Older DBs only allow service | product | labor. Map extended types so inserts still succeed
 * until migrations are applied (material→product, sub→labor, equipment→service).
 */
function toLegacyItemType(t) {
  const map = {
    service: 'service',
    product: 'product',
    labor: 'labor',
    material: 'product',
    sub: 'labor',
    equipment: 'service',
  }
  return map[t] || 'service'
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
    const { name, description, unit, default_unit_price, item_type } = req.body
    const normalizedType = normalizeItemType(item_type)
    const baseRow = {
      user_id: req.user.id,
      name: name || 'Product',
      description: description || null,
      unit: unit || 'ea',
      default_unit_price: Number(default_unit_price) || 0,
      item_type: normalizedType,
    }
    let { data, error } = await supabase.from('custom_products').insert(baseRow).select().single()
    if (error?.code === '23514' && normalizedType !== toLegacyItemType(normalizedType)) {
      const retryRow = { ...baseRow, item_type: toLegacyItemType(normalizedType) }
      ;({ data, error } = await supabase.from('custom_products').insert(retryRow).select().single())
    }
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
    const { name, description, unit, default_unit_price, item_type } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (unit !== undefined) updates.unit = unit
    if (default_unit_price !== undefined) updates.default_unit_price = Number(default_unit_price)
    if (item_type !== undefined) {
      const normalizedType = normalizeItemType(item_type)
      updates.item_type = normalizedType
    }
    let { data, error } = await supabase
      .from('custom_products')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error?.code === '23514' && updates.item_type !== undefined) {
      const t = updates.item_type
      const legacy = toLegacyItemType(t)
      if (legacy !== t) {
        ;({ data, error } = await supabase
          .from('custom_products')
          .update({ ...updates, item_type: legacy })
          .eq('id', id)
          .select()
          .single())
      }
    }
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
