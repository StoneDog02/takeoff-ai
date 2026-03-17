/**
 * Public estimate portal API — token-gated, no auth.
 * GET /api/estimates/portal/:token — estimate with project info, line items, GC info, status. 404 if not found.
 * PATCH /api/estimates/portal/:token/viewed — set viewed_at, status = 'viewed' if currently sent. Idempotent.
 * POST /api/estimates/portal/:token/approve — status = accepted, actioned_at. Update project to awaiting_job_creation.
 * POST /api/estimates/portal/:token/request-changes — { message }, status = changes_requested, store message. Notify GC.
 * POST /api/estimates/portal/:token/decline — status = declined, actioned_at.
 * Rate limited. None require session auth.
 */
const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

// --- Rate limit: 10 requests per IP per hour (same as bid portal) ---
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 10
const rateMap = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [key, v] of rateMap.entries()) {
    if (v.resetAt < now) rateMap.delete(key)
  }
}, 60 * 1000)

function rateLimitPortal(req, res, next) {
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

router.use(rateLimitPortal)

/** GET /api/estimates/portal/:token — public. Returns estimate with project info, line items, GC info, status. 404 if not found. */
router.get('/:token', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })

    const { data: est, error: estErr } = await supabase
      .from('estimates')
      .select('id, job_id, user_id, title, status, total_amount, invoiced_amount, recipient_emails, sent_at, viewed_at, actioned_at, changes_requested_at, changes_requested_message')
      .eq('client_token', token)
      .maybeSingle()
    if (estErr) throw estErr
    if (!est) return res.status(404).json({ error: 'Invalid or expired link' })

    const projectId = est.job_id
    let project = null
    if (projectId) {
      const { data: proj } = await supabase
        .from('projects')
        .select('id, name, address_line_1, address_line_2, city, state, postal_code, assigned_to_name')
        .eq('id', projectId)
        .maybeSingle()
      project = proj
    }

    const { data: lineItems } = await supabase
      .from('estimate_line_items')
      .select('id, description, quantity, unit, unit_price, total, section')
      .eq('estimate_id', est.id)
      .order('id')

    const address = project
      ? [project.address_line_1, project.address_line_2, project.city, project.state, project.postal_code].filter(Boolean).join(', ')
      : ''
    const clientName = (project && project.assigned_to_name) ? String(project.assigned_to_name).trim() : null
    const gcName = 'Your contractor'
    const milestones = []
    if (Number(est.invoiced_amount) > 0) {
      milestones.push({ label: 'Invoiced to date', amount: Number(est.invoiced_amount) })
    }
    const estimateNumber = est.id ? `EST-${String(est.id).slice(-6).toUpperCase()}` : ''
    const totalAmount = Number(est.total_amount) || 0
    milestones.forEach((m) => {
      if (totalAmount > 0) {
        m.percentage = Math.round((Number(m.amount) / totalAmount) * 100)
      } else {
        m.percentage = 0
      }
    })

    return res.json({
      estimate_id: est.id,
      estimate_number: estimateNumber,
      date_issued: est.sent_at || null,
      expiry_date: null,
      projectName: (project && project.name) ? project.name : est.title || 'Estimate',
      address,
      clientName,
      clientAddress: address,
      gcName,
      company: null,
      line_items: lineItems || [],
      total: totalAmount,
      invoiced_amount: Number(est.invoiced_amount) || 0,
      milestones,
      notes: null,
      terms: null,
      status: (est.status || 'sent').toLowerCase(),
      sent_at: est.sent_at || null,
      viewed_at: est.viewed_at || null,
      actioned_at: est.actioned_at || null,
    })
  } catch (err) {
    next(err)
  }
})

/** PATCH /api/estimates/portal/:token/viewed — set viewed_at, status = 'viewed' if currently sent. Idempotent. */
router.patch('/:token/viewed', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })

    const { data: est, error: fetchErr } = await supabase
      .from('estimates')
      .select('id, status')
      .eq('client_token', token)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!est) return res.status(404).json({ error: 'Invalid or expired link' })

    const updates = { viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    const currentStatus = (est.status || '').toLowerCase()
    if (currentStatus === 'sent') updates.status = 'viewed'

    await supabase.from('estimates').update(updates).eq('id', est.id)
    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

/** POST /api/estimates/portal/:token/approve — set status = accepted, actioned_at. Update project to awaiting_job_creation. Returns confirmation. */
router.post('/:token/approve', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })

    const { data: est, error: fetchErr } = await supabase
      .from('estimates')
      .select('id, status, job_id')
      .eq('client_token', token)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!est) return res.status(404).json({ error: 'Invalid or expired link' })
    if ((est.status || '').toLowerCase() === 'accepted') {
      return res.json({ status: 'accepted', message: 'Already approved' })
    }
    if ((est.status || '').toLowerCase() === 'declined') {
      return res.status(400).json({ error: 'This estimate has been declined.' })
    }

    const now = new Date().toISOString()
    await supabase
      .from('estimates')
      .update({ status: 'accepted', actioned_at: now, updated_at: now })
      .eq('id', est.id)

    if (est.job_id) {
      await supabase
        .from('projects')
        .update({ status: 'awaiting_job_creation', updated_at: now })
        .eq('id', est.job_id)
    }

    return res.json({ status: 'accepted', message: 'Estimate approved.' })
  } catch (err) {
    next(err)
  }
})

/** POST /api/estimates/portal/:token/request-changes — accept { message }, set status = changes_requested, store message. Notify GC. Returns confirmation. */
router.post('/:token/request-changes', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })
    const message = (req.body && req.body.message) != null ? String(req.body.message).trim() : ''

    const { data: est, error: fetchErr } = await supabase
      .from('estimates')
      .select('id, status')
      .eq('client_token', token)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!est) return res.status(404).json({ error: 'Invalid or expired link' })
    if ((est.status || '').toLowerCase() === 'accepted') {
      return res.status(400).json({ error: 'This estimate has already been approved.' })
    }
    if ((est.status || '').toLowerCase() === 'declined') {
      return res.status(400).json({ error: 'This estimate has been declined.' })
    }

    const now = new Date().toISOString()
    await supabase
      .from('estimates')
      .update({
        status: 'changes_requested',
        changes_requested_at: now,
        changes_requested_message: message || null,
        updated_at: now,
      })
      .eq('id', est.id)

    // TODO: trigger notification to GC (e.g. email or in-app)
    console.log('[estimate-portal] Client requested changes for estimate', est.id, 'message:', message || '(none)')

    return res.json({ ok: true, message: 'Your feedback has been sent.' })
  } catch (err) {
    next(err)
  }
})

/** POST /api/estimates/portal/:token/decline — set status = declined, actioned_at. Returns confirmation. */
router.post('/:token/decline', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })

    const { data: est, error: fetchErr } = await supabase
      .from('estimates')
      .select('id, status')
      .eq('client_token', token)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!est) return res.status(404).json({ error: 'Invalid or expired link' })
    if ((est.status || '').toLowerCase() === 'declined') {
      return res.json({ status: 'declined', message: 'Already declined' })
    }
    if ((est.status || '').toLowerCase() === 'accepted') {
      return res.status(400).json({ error: 'This estimate has already been approved.' })
    }

    const now = new Date().toISOString()
    await supabase
      .from('estimates')
      .update({ status: 'declined', actioned_at: now, updated_at: now })
      .eq('id', est.id)
    return res.json({ status: 'declined', message: 'Estimate declined.' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
