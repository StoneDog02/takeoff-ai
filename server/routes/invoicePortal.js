/**
 * Public invoice portal API — token-gated, no auth.
 * GET /api/invoices/portal/:token — invoice + estimate summary + schedule rows for progress invoices.
 * PATCH /api/invoices/portal/:token/viewed — mark viewed (status viewed, viewed_at).
 */
const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

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

const COMPLETION_LABELS = {
  on_phase_completion: 'Due when phase completes',
  net_15: '15 days after completion',
  net_30: '30 days after completion',
  net_45: '45 days after completion',
  net_60: '60 days after completion',
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatDueDisplay(row) {
  if (row.mode === 'specific_date' && row.specificDate) {
    const d = String(row.specificDate).slice(0, 10)
    return `Due ${d}`
  }
  const key = row.completionTerms || row.completion_terms
  return COMPLETION_LABELS[key] || 'On completion'
}

/**
 * @param {object} row
 * @param {string} invoiceStatus
 * @param {{ milestone_ready_for_payment?: string[] }} meta
 */
function computeRowStatus(row, invoiceStatus, meta) {
  const st = String(invoiceStatus || '').toLowerCase()
  if (st === 'paid') return 'paid'

  const readyIds = Array.isArray(meta?.milestone_ready_for_payment)
    ? meta.milestone_ready_for_payment.map(String)
    : []
  const mid = String(row.milestone_id || '')
  const ready = readyIds.includes(mid)

  if (row.mode === 'specific_date' && row.specificDate) {
    const due = String(row.specificDate).slice(0, 10)
    if (todayIsoDate() >= due) return 'due_now'
    return 'upcoming'
  }
  if (row.mode === 'on_completion') {
    const ct = row.completionTerms || row.completion_terms
    if (ct === 'on_phase_completion' && ready) return 'due_now'
    if (typeof ct === 'string' && ct.startsWith('net_') && ready) return 'due_now'
    return 'upcoming'
  }
  return 'upcoming'
}

/** GET /api/invoices/portal/:token */
router.get('/:token', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select(
        'id, estimate_id, job_id, status, total_amount, recipient_emails, due_date, paid_at, sent_at, created_at, schedule_snapshot, client_token'
      )
      .eq('client_token', token)
      .maybeSingle()
    if (invErr) throw invErr
    if (!inv) return res.status(404).json({ error: 'Invalid or expired link' })

    let estimate = null
    if (inv.estimate_id) {
      const { data: est } = await supabase
        .from('estimates')
        .select('id, client_notes, client_terms, estimate_groups_meta, title')
        .eq('id', inv.estimate_id)
        .maybeSingle()
      estimate = est
    }

    let project = null
    if (inv.job_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('id, name, address_line_1, address_line_2, city, state, postal_code, assigned_to_name')
        .eq('id', inv.job_id)
        .maybeSingle()
      project = proj
    }

    const address = project
      ? [project.address_line_1, project.address_line_2, project.city, project.state, project.postal_code].filter(Boolean).join(', ')
      : ''
    const clientName = project?.assigned_to_name ? String(project.assigned_to_name).trim() : null

    const meta = estimate?.estimate_groups_meta && typeof estimate.estimate_groups_meta === 'object' && !Array.isArray(estimate.estimate_groups_meta)
      ? estimate.estimate_groups_meta
      : {}

    const snap = inv.schedule_snapshot && typeof inv.schedule_snapshot === 'object' ? inv.schedule_snapshot : {}
    const rawRows = Array.isArray(snap.rows) ? snap.rows : []

    const schedule_rows = rawRows.map((row) => {
      const due_display = formatDueDisplay(row)
      const status = computeRowStatus(row, inv.status, meta)
      return {
        milestone_id: String(row.milestone_id || ''),
        label: String(row.label || 'Milestone'),
        amount: Number(row.amount) || 0,
        mode: row.mode === 'on_completion' ? 'on_completion' : 'specific_date',
        specific_date: row.specificDate || row.specific_date || null,
        completion_terms: row.completionTerms || row.completion_terms || null,
        due_display,
        status,
      }
    })

    let line_items = []
    if (schedule_rows.length === 0 && inv.estimate_id) {
      const { data: items } = await supabase
        .from('estimate_line_items')
        .select('id, description, quantity, unit, unit_price, total, section')
        .eq('estimate_id', inv.estimate_id)
        .order('id')
      line_items = (items || []).map((li) => ({
        id: li.id,
        description: li.description,
        quantity: Number(li.quantity) || 0,
        unit: li.unit || 'ea',
        unit_price: Number(li.unit_price) || 0,
        total: Number(li.total) || 0,
        section: li.section,
      }))
    }

    const amount_due_now = schedule_rows
      .filter((r) => r.status === 'due_now')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

    return res.json({
      invoice_id: inv.id,
      estimate_id: inv.estimate_id,
      job_id: inv.job_id,
      status: (inv.status || 'draft').toLowerCase(),
      total_amount: Number(inv.total_amount) || 0,
      amount_due_now,
      due_date: inv.due_date || null,
      paid_at: inv.paid_at || null,
      sent_at: inv.sent_at || null,
      projectName: project?.name || estimate?.title || 'Invoice',
      address,
      clientName,
      gcName: 'Your contractor',
      company: null,
      invoice_kind: schedule_rows.length > 0 ? 'progress_series' : 'single',
      schedule_rows,
      line_items,
      notes: estimate?.client_notes != null && String(estimate.client_notes).trim() ? String(estimate.client_notes).trim() : null,
      terms: estimate?.client_terms != null && String(estimate.client_terms).trim() ? String(estimate.client_terms).trim() : null,
    })
  } catch (err) {
    next(err)
  }
})

/** PATCH /api/invoices/portal/:token/viewed */
router.patch('/:token/viewed', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const token = req.params.token
    const { data: inv, error } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('client_token', token)
      .maybeSingle()
    if (error) throw error
    if (!inv) return res.status(404).json({ error: 'Invalid or expired link' })
    const st = String(inv.status || '').toLowerCase()
    if (st === 'sent') {
      const now = new Date().toISOString()
      await supabase
        .from('invoices')
        .update({ status: 'viewed', viewed_at: now, updated_at: now })
        .eq('id', inv.id)
    }
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

module.exports = router
