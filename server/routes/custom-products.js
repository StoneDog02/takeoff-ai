const express = require('express')
const multer = require('multer')
const router = express.Router()
const { supabase: defaultSupabase } = require('../db/supabase')
const { parseQuickBooksProductsExport, libraryKey } = require('../lib/parseQuickBooksProductsExport')

const FULL_ITEM_TYPES = ['service', 'product', 'labor', 'sub', 'material', 'equipment']

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname || ''
    const ok = /\.(xlsx|xls|csv)$/i.test(name)
    cb(null, ok)
  },
})

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

function parseTrades(raw) {
  if (raw == null) return undefined
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw)
      return Array.isArray(j) ? j.filter(Boolean) : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

function optionalNumber(val) {
  if (val === undefined || val === null || val === '') return undefined
  const n = Number(val)
  return Number.isFinite(n) ? n : undefined
}

function applyExtendedFields(target, body) {
  const { sub_cost, markup_pct, billed_price, trades, taxable } = body
  if (sub_cost !== undefined) {
    target.sub_cost = sub_cost === null || sub_cost === '' ? null : optionalNumber(sub_cost) ?? null
  }
  if (markup_pct !== undefined) {
    target.markup_pct = markup_pct === null || markup_pct === '' ? null : optionalNumber(markup_pct) ?? null
  }
  if (billed_price !== undefined) {
    target.billed_price = billed_price === null || billed_price === '' ? null : optionalNumber(billed_price) ?? null
  }
  if (trades !== undefined) {
    const tr = parseTrades(trades)
    if (tr !== undefined) target.trades = tr
  }
  if (taxable !== undefined) target.taxable = !!taxable
}

function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: 'Invalid or unsupported file. Use .xlsx, .xls, or .csv under 5 MB.' })
    }
    next()
  })
}

/** POST /api/custom-products/import/preview — parse file, no DB writes */
router.post('/import/preview', uploadSingle, async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'Missing file (use multipart field "file").' })
  }

  try {
    const { rows, warnings, parseErrors } = parseQuickBooksProductsExport(req.file.buffer, req.file.originalname)
    if (parseErrors?.length && rows.length === 0) {
      return res.status(400).json({ error: parseErrors[0].message, parseErrors, warnings })
    }

    const { data: existing, error: exErr } = await supabase
      .from('custom_products')
      .select('name, unit')
      .eq('user_id', req.user.id)
    if (exErr) throw exErr

    const existingKeys = new Set((existing || []).map((p) => libraryKey(p.name, p.unit || 'ea')))
    let wouldInsert = 0
    let skippedDuplicates = 0
    for (const r of rows) {
      const k = libraryKey(r.name, r.unit)
      if (existingKeys.has(k)) skippedDuplicates += 1
      else {
        wouldInsert += 1
        existingKeys.add(k)
      }
    }

    res.json({
      totalParsed: rows.length,
      wouldInsert,
      skippedDuplicates,
      previewRows: rows,
      warnings,
      parseErrors: parseErrors || [],
    })
  } catch (err) {
    console.error('Custom products import preview error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/custom-products/import — parse and insert */
router.post('/import', uploadSingle, async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'Missing file (use multipart field "file").' })
  }

  try {
    const { rows, warnings, parseErrors } = parseQuickBooksProductsExport(req.file.buffer, req.file.originalname)
    if (parseErrors?.length && rows.length === 0) {
      return res.status(400).json({ error: parseErrors[0].message, inserted: 0, skippedDuplicates: 0, warnings, parseErrors })
    }

    const { data: existing, error: exErr } = await supabase
      .from('custom_products')
      .select('name, unit')
      .eq('user_id', req.user.id)
    if (exErr) throw exErr

    const existingKeys = new Set((existing || []).map((p) => libraryKey(p.name, p.unit || 'ea')))
    const toInsert = []
    let skippedDuplicates = 0

    for (const r of rows) {
      const k = libraryKey(r.name, r.unit)
      if (existingKeys.has(k)) {
        skippedDuplicates += 1
        continue
      }
      existingKeys.add(k)
      const normalizedType = normalizeItemType(r.item_type)
      const row = {
        user_id: req.user.id,
        name: r.name,
        description: r.description,
        unit: r.unit || 'ea',
        default_unit_price: Number(r.default_unit_price) || 0,
        item_type: normalizedType,
        sub_cost: r.sub_cost != null ? Number(r.sub_cost) : null,
        markup_pct: null,
        billed_price: null,
        trades: [],
        taxable: !!r.taxable,
      }
      toInsert.push(row)
    }

    const CHUNK = 100
    let inserted = 0
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK)
      let { error } = await supabase.from('custom_products').insert(chunk)
      if (error?.code === '23514') {
        const legacyChunk = chunk.map((row) => ({
          ...row,
          item_type: toLegacyItemType(normalizeItemType(row.item_type)),
        }))
        ;({ error } = await supabase.from('custom_products').insert(legacyChunk))
      }
      if (error) throw error
      inserted += chunk.length
    }

    res.json({
      inserted,
      skippedDuplicates,
      totalParsed: rows.length,
      warnings,
      parseErrors: parseErrors || [],
    })
  } catch (err) {
    console.error('Custom products import error:', err)
    res.status(500).json({ error: err.message })
  }
})

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
    applyExtendedFields(baseRow, req.body)
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
    applyExtendedFields(updates, req.body)
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
