/**
 * Public bid portal API — token-gated, no auth.
 * GET /api/bids/portal/:token — project info, trade, scope, status. 404 if not found, 410 if project cancelled.
 * PATCH /api/bids/portal/:token/viewed — viewed_at = now(), status = 'viewed' if pending. Idempotent.
 * POST /api/bids/portal/:token/respond — JSON { bid_amount, notes, attachment_url, availability }. Sets bid_received, responded_at. Returns updated record.
 * POST /api/bids/portal/:token/decline — status = declined, responded_at. Returns confirmation.
 * Rate limited: 10 requests per IP per hour.
 */
const express = require('express')
const multer = require('multer')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

// --- Rate limit: 10 requests per IP per hour ---
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 10
const rateMap = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [key, v] of rateMap.entries()) {
    if (v.resetAt < now) rateMap.delete(key)
  }
}, 60 * 1000)

function rateLimitBids(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const r = rateMap.get(ip)
  if (!r) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return next()
  }
  if (r.resetAt < now) {
    r.count = 1
    r.resetAt = now + RATE_WINDOW_MS
    return next()
  }
  r.count += 1
  if (r.count > RATE_MAX) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' })
  }
  next()
}

router.use(rateLimitBids)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = !file.mimetype || file.mimetype === 'application/pdf'
    cb(null, ok)
  },
})

const BID_QUOTES_PREFIX = 'bid-quotes'

function normStatus(s) {
  return (s || '').toLowerCase().trim()
}

function normTrade(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
}

/** Category name matches GC trade package tag (e.g. Framing vs "Rough Framing / Carpentry"). */
function categoryMatchesTrade(catName, tradeName) {
  const a = normTrade(catName)
  const b = normTrade(tradeName)
  if (!b) return false
  if (!a) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  const parts = a.split(/[/,&]+/).map((p) => p.trim()).filter(Boolean)
  for (const p of parts) {
    if (p === b || p.includes(b) || b.includes(p)) return true
  }
  return false
}

/**
 * Items from the takeoff category whose name matches the bid trade (GC internal cost_estimate stripped).
 */
function scopeItemsFromTakeoff(materialList, tradeName) {
  const cats = materialList?.categories
  if (!Array.isArray(cats) || !normTrade(tradeName)) return []

  let matchedCat = null
  for (const cat of cats) {
    if (categoryMatchesTrade(cat?.name, tradeName)) {
      matchedCat = cat
      break
    }
  }

  const rawItems = matchedCat && Array.isArray(matchedCat.items) ? matchedCat.items : []

  return rawItems.map((it) => ({
    description: it.description != null ? String(it.description) : '',
    quantity:
      typeof it.quantity === 'number' && !Number.isNaN(it.quantity)
        ? it.quantity
        : Number(it.quantity) || 0,
    unit: it.unit != null ? String(it.unit) : '',
  }))
}

/** GET /api/bids/portal/:token — public, token-gated. Returns project info, trade, scope, status. 404 if token not found, 410 if project cancelled. */
router.get('/portal/:token', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })

    const { data: bid, error: bidErr } = await supabase
      .from('sub_bids')
      .select(
        'id, trade_package_id, subcontractor_id, amount, notes, availability, quote_url, awarded, response_status, responded_at, dispatched_at, response_deadline'
      )
      .eq('portal_token', token)
      .maybeSingle()
    if (bidErr) throw bidErr
    if (!bid) return res.status(404).json({ error: 'Invalid or expired link' })

    const [{ data: pkg }, { data: sub }] = await Promise.all([
      supabase.from('trade_packages').select('id, project_id, trade_tag, line_items').eq('id', bid.trade_package_id).maybeSingle(),
      supabase.from('subcontractors').select('id, name').eq('id', bid.subcontractor_id).maybeSingle(),
    ])
    const projectId = pkg?.project_id
    const tradeName = pkg?.trade_tag || ''

    const { data: proj } = projectId
      ? await supabase
          .from('projects')
          .select('id, name, status, user_id, address_line_1, address_line_2, city, state, postal_code')
          .eq('id', projectId)
          .maybeSingle()
      : { data: null }

    if (proj && normStatus(proj.status) === 'cancelled') {
      return res.status(410).json({ error: 'This project has been cancelled.' })
    }

    const [takeoffRes, companyRes] = await Promise.all([
      projectId
        ? supabase
            .from('project_takeoffs')
            .select('material_list')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      proj?.user_id
        ? supabase.from('company_settings').select('name, email').eq('user_id', proj.user_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const materialList = takeoffRes?.data?.material_list
    const scope_items =
      materialList && typeof materialList === 'object'
        ? scopeItemsFromTakeoff(materialList, tradeName)
        : []

    const status = bid.awarded ? 'awarded' : (bid.response_status || 'pending')
    const project_address = proj
      ? [proj.address_line_1, proj.address_line_2, proj.city, proj.state, proj.postal_code].filter(Boolean).join(', ')
      : ''
    const scope = Array.isArray(pkg?.line_items) ? pkg.line_items : []
    const project_name = proj?.name || ''
    const gc_name = (companyRes?.data?.name && String(companyRes.data.name).trim()) || ''
    const gc_email_raw = companyRes?.data?.email != null ? String(companyRes.data.email).trim() : ''
    const gc_email =
      gc_email_raw && /^[^\s@]+@[^\s@]+\.[^\s@]+/.test(gc_email_raw) ? gc_email_raw : ''
    const sub_name = sub?.name || ''
    const dispatched_at = bid.dispatched_at || null
    const response_deadline = bid.response_deadline || null

    return res.json({
      project_name,
      project_address,
      gc_name: gc_name || null,
      gc_email: gc_email || null,
      trade_name: tradeName,
      sub_name,
      dispatched_at,
      response_deadline,
      scope_items,
      projectName: project_name,
      address: project_address,
      tradeName,
      scope,
      subName: sub_name,
      status,
      bid_amount: bid.amount != null ? Number(bid.amount) : null,
      notes: bid.notes || null,
      availability: bid.availability || null,
      attachment_url: bid.quote_url || null,
      responded_at: bid.responded_at || null,
    })
  } catch (err) {
    next(err)
  }
})

/** PATCH /api/bids/portal/:token/viewed — sets viewed_at = now(), status = 'viewed' if status was pending. Idempotent. */
router.patch('/portal/:token/viewed', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })

    const { data: bid, error: bidErr } = await supabase
      .from('sub_bids')
      .select('id, response_status')
      .eq('portal_token', token)
      .maybeSingle()
    if (bidErr) throw bidErr
    if (!bid) return res.status(404).json({ error: 'Invalid or expired link' })

    const current = (bid.response_status || 'pending').toLowerCase()
    const updates = { viewed_at: new Date().toISOString() }
    if (current === 'pending') updates.response_status = 'viewed'

    const { error: updateErr } = await supabase.from('sub_bids').update(updates).eq('id', bid.id)
    if (updateErr) throw updateErr
    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

/** Parse body: JSON or multipart depending on Content-Type. */
function parseRespondBody(req, res, next) {
  const ct = (req.headers['content-type'] || '').toLowerCase()
  if (ct.includes('multipart/form-data')) {
    return upload.single('quoteFile')(req, res, next)
  }
  return express.json()(req, res, next)
}

/** POST /api/bids/portal/:token/respond — JSON { bid_amount, notes, attachment_url, availability } or multipart (amount, notes, availability, quoteFile). Sets status = bid_received, responded_at. Returns updated record. */
async function handleRespond(req, res, next) {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })

    const body = req.body || {}
    const isJson = body.bid_amount !== undefined
    const bidAmount = isJson
      ? (body.bid_amount != null ? Number(body.bid_amount) : NaN)
      : (body.amount != null ? Number(body.amount) : NaN)
    if (Number.isNaN(bidAmount) || bidAmount < 0) return res.status(400).json({ error: 'Valid bid_amount is required' })
    const notes = (isJson ? body.notes : body.notes) != null ? String(isJson ? body.notes : body.notes).trim() || null : null
    const availability = (isJson ? body.availability : body.availability) != null ? String(isJson ? body.availability : body.availability).trim() || null : null

    const { data: bid, error: bidErr } = await supabase
      .from('sub_bids')
      .select('id, quote_url')
      .eq('portal_token', token)
      .maybeSingle()
    if (bidErr) throw bidErr
    if (!bid) return res.status(404).json({ error: 'Invalid or expired link' })

    let attachmentUrl = isJson && body.attachment_url != null ? String(body.attachment_url).trim() || null : null
    if (!isJson && req.file && req.file.buffer) {
      const bucket = 'job-walk-media'
      const safeName = (req.file.originalname || 'quote').replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${BID_QUOTES_PREFIX}/${bid.id}/${Date.now()}-${safeName}`
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, req.file.buffer, {
        contentType: req.file.mimetype || 'application/pdf',
        upsert: false,
      })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
        attachmentUrl = urlData?.publicUrl || path
      }
    }

    const respondedAt = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('sub_bids')
      .update({
        amount: bidAmount,
        notes,
        availability,
        quote_url: attachmentUrl || bid.quote_url,
        response_status: 'bid_received',
        responded_at: respondedAt,
      })
      .eq('id', bid.id)
    if (updateErr) throw updateErr
    const { data: updated } = await supabase.from('sub_bids').select('*').eq('id', bid.id).single()
    return res.status(200).json(updated)
  } catch (err) {
    next(err)
  }
}
router.post('/portal/:token/respond', parseRespondBody, handleRespond)
router.post('/portal/:token/submit', upload.single('quoteFile'), handleRespond)

/** POST /api/bids/portal/:token/decline — sets status = declined, responded_at. Returns confirmation. */
async function handleDecline(req, res, next) {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })
    const { data: bid, error: findErr } = await supabase
      .from('sub_bids')
      .select('id')
      .eq('portal_token', token)
      .maybeSingle()
    if (findErr || !bid) return res.status(404).json({ error: 'Invalid or expired link' })
    const respondedAt = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('sub_bids')
      .update({ response_status: 'declined', responded_at: respondedAt })
      .eq('id', bid.id)
    if (updateErr) throw updateErr
    return res.status(200).json({ ok: true, message: 'Bid request declined.' })
  } catch (err) {
    next(err)
  }
}
router.post('/portal/:token/decline', handleDecline)
router.patch('/portal/:token/decline', handleDecline)

module.exports = router
