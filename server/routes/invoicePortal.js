/**
 * Public invoice portal API — token-gated, no auth.
 * GET /api/invoices/portal/:token — invoice + estimate summary + schedule rows for progress invoices.
 * PATCH /api/invoices/portal/:token/viewed — mark viewed (status viewed, viewed_at).
 */
const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')
const { fetchPublicCompanyProfile } = require('../lib/publicCompanyProfile')
const { fetchInvoiceBranding } = require('../lib/invoiceBranding')
const { parseManualInvoiceSnapshot, normalizeInvoiceScheduleSnapshot } = require('../lib/invoiceManualSnapshot')
const { notifyInvoiceStatusChange } = require('../lib/eventNotificationEmails')
const { getClientAttachmentsArray, resolveClientAttachmentUrl } = require('../lib/invoiceClientAttachments')
const { normalizeInvoicePaymentConfig, paymentOptionsForPortalResponse } = require('../lib/invoicePaymentConfig')

const router = express.Router()

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripeForInvoiceCheckout = null
if (stripeSecretKey) {
  try {
    stripeForInvoiceCheckout = require('stripe')(stripeSecretKey)
  } catch (e) {
    console.warn('[invoicePortal] Stripe init failed:', e.message)
  }
}

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

const CHECKOUT_WINDOW_MS = 60 * 60 * 1000
const CHECKOUT_MAX_PER_HOUR = 8
const checkoutRateMap = new Map()

function rateLimitCheckoutSession(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const key = `inv-co:${ip}`
  let r = checkoutRateMap.get(key)
  if (!r || now > r.resetAt) {
    checkoutRateMap.set(key, { count: 1, resetAt: now + CHECKOUT_WINDOW_MS })
    return next()
  }
  r.count += 1
  if (r.count > CHECKOUT_MAX_PER_HOUR) {
    return res.status(429).json({ error: 'Too many payment attempts. Try again later.' })
  }
  checkoutRateMap.set(key, r)
  next()
}

/**
 * POST /api/invoices/portal/:token/create-checkout-session
 * Stripe Checkout for client invoice card payment (optional Connect destination).
 */
router.post('/:token/create-checkout-session', rateLimitCheckoutSession, async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    if (!stripeForInvoiceCheckout) {
      return res.status(503).json({ error: 'Online card payment is not configured.' })
    }
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'Token required' })

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select(
        'id, user_id, estimate_id, job_id, status, total_amount, recipient_emails, schedule_snapshot, client_token'
      )
      .eq('client_token', token)
      .maybeSingle()
    if (invErr) throw invErr
    if (!inv) return res.status(404).json({ error: 'Invalid or expired link' })

    const st = String(inv.status || '').toLowerCase()
    if (st === 'paid') return res.status(400).json({ error: 'This invoice is already paid.' })

    const { data: csRow } = await supabase
      .from('company_settings')
      .select('invoice_payment_config')
      .eq('user_id', inv.user_id)
      .maybeSingle()
    const payCfg = normalizeInvoicePaymentConfig(csRow?.invoice_payment_config)
    if (!payCfg.card) {
      return res.status(400).json({ error: 'Card payment is not offered for this invoice.' })
    }

    const snap = normalizeInvoiceScheduleSnapshot(inv.schedule_snapshot)
    const rawRows = Array.isArray(snap.rows) ? snap.rows : []
    const meta =
      inv.estimate_id &&
      (await supabase
        .from('estimates')
        .select('estimate_groups_meta')
        .eq('id', inv.estimate_id)
        .maybeSingle()
        .then(({ data }) =>
          data?.estimate_groups_meta && typeof data.estimate_groups_meta === 'object' && !Array.isArray(data.estimate_groups_meta)
            ? data.estimate_groups_meta
            : {}
        )) ||
      {}

    const schedule_rows = rawRows.map((row) => {
      const due_display = formatDueDisplay(row)
      const rowStatus = computeRowStatus(row, inv.status, meta)
      return { amount: Number(row.amount) || 0, status: rowStatus }
    })
    const amount_due_now = schedule_rows.filter((r) => r.status === 'due_now').reduce((sum, r) => sum + r.amount, 0)

    let amountDollars = Number(inv.total_amount) || 0
    if (schedule_rows.length > 0 && amount_due_now > 0) {
      amountDollars = amount_due_now
    }
    const amountCents = Math.round(amountDollars * 100)
    if (amountCents < 50) {
      return res.status(400).json({ error: 'Amount is too small to pay online.' })
    }

    const emails = Array.isArray(inv.recipient_emails) ? inv.recipient_emails : []
    const clientEmail = emails[0] ? String(emails[0]).trim() : ''

    const baseUrlRaw = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '')
    const origin = baseUrlRaw
      ? baseUrlRaw.startsWith('http')
        ? baseUrlRaw
        : `https://${baseUrlRaw}`
      : 'http://localhost:5173'

    let projectLabel = 'Invoice'
    if (inv.job_id) {
      const { data: p } = await supabase.from('projects').select('name').eq('id', inv.job_id).maybeSingle()
      if (p?.name) projectLabel = String(p.name).trim().slice(0, 120)
    } else if (inv.estimate_id) {
      const { data: e } = await supabase.from('estimates').select('title').eq('id', inv.estimate_id).maybeSingle()
      if (e?.title) projectLabel = String(e.title).trim().slice(0, 120)
    }

    const sessionParams = {
      mode: 'payment',
      customer_email: clientEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `Invoice ${String(inv.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`,
              description: projectLabel || undefined,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/invoice/${encodeURIComponent(token)}?payment=success`,
      cancel_url: `${origin}/invoice/${encodeURIComponent(token)}?payment=cancelled`,
      metadata: {
        buildos_client_invoice: '1',
        invoice_id: inv.id,
        gc_user_id: inv.user_id || '',
      },
    }

    if (payCfg.stripe_connect_account_id) {
      sessionParams.payment_intent_data = {
        transfer_data: { destination: payCfg.stripe_connect_account_id },
      }
    }

    const session = await stripeForInvoiceCheckout.checkout.sessions.create(sessionParams)
    if (!session.url) return res.status(500).json({ error: 'Could not start checkout.' })
    return res.json({ url: session.url })
  } catch (err) {
    console.error('[invoicePortal] create-checkout-session:', err)
    next(err)
  }
})

/** GET /api/invoices/portal/:token/attachment/:attachmentId — redirect to time-limited file URL */
router.get('/:token/attachment/:attachmentId', async (req, res, next) => {
  try {
    const supabase = defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Service unavailable' })
    const { token, attachmentId } = req.params
    if (!token || !attachmentId) return res.status(400).json({ error: 'Invalid request' })
    const { data: inv, error } = await supabase
      .from('invoices')
      .select('id, job_id, user_id, schedule_snapshot, client_token')
      .eq('client_token', token)
      .maybeSingle()
    if (error) throw error
    if (!inv) return res.status(404).json({ error: 'Invalid or expired link' })
    const list = getClientAttachmentsArray(normalizeInvoiceScheduleSnapshot(inv.schedule_snapshot))
    const att = list.find((a) => String(a.id) === String(attachmentId))
    if (!att) return res.status(404).json({ error: 'Attachment not found' })
    const url = await resolveClientAttachmentUrl(supabase, inv, att)
    if (!url) return res.status(404).json({ error: 'File not available' })
    return res.redirect(302, url)
  } catch (err) {
    next(err)
  }
})

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
        'id, user_id, estimate_id, job_id, status, total_amount, recipient_emails, due_date, paid_at, sent_at, created_at, schedule_snapshot, client_token'
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

    const snap = normalizeInvoiceScheduleSnapshot(inv.schedule_snapshot)
    const manualSnap = parseManualInvoiceSnapshot(snap)

    const clientName = project?.assigned_to_name
      ? String(project.assigned_to_name).trim()
      : manualSnap?.client_name || null

    let gcName = 'Your contractor'
    let company = null
    if (inv.user_id) {
      company = await fetchPublicCompanyProfile(supabase, inv.user_id)
      if (company?.name) gcName = company.name
    }

    const meta = estimate?.estimate_groups_meta && typeof estimate.estimate_groups_meta === 'object' && !Array.isArray(estimate.estimate_groups_meta)
      ? estimate.estimate_groups_meta
      : {}

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
    if (manualSnap?.line_items?.length) {
      line_items = manualSnap.line_items
    } else if (inv.estimate_id) {
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
    if (
      line_items.length === 0 &&
      schedule_rows.length === 0 &&
      (Number(inv.total_amount) || 0) > 0
    ) {
      const t = Number(inv.total_amount) || 0
      line_items = [
        {
          id: 'invoice-total-summary',
          description: 'Invoice balance',
          quantity: 1,
          unit: 'ea',
          unit_price: t,
          total: t,
          section: null,
        },
      ]
    }

    const amount_due_now = schedule_rows
      .filter((r) => r.status === 'due_now')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

    const branding = await fetchInvoiceBranding(supabase, inv.user_id)

    const attachList = getClientAttachmentsArray(snap)
    const attachments = attachList.map((a) => ({
      id: String(a.id || ''),
      label: String(a.label || 'Attachment'),
    })).filter((a) => a.id)

    let payment_options = paymentOptionsForPortalResponse(null)
    if (inv.user_id) {
      const { data: csPay } = await supabase
        .from('company_settings')
        .select('invoice_payment_config')
        .eq('user_id', inv.user_id)
        .maybeSingle()
      payment_options = paymentOptionsForPortalResponse(csPay?.invoice_payment_config)
    }
    if (payment_options.card && !stripeForInvoiceCheckout) {
      payment_options = { ...payment_options, card: false }
    }

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
      gcName,
      company,
      invoice_kind: schedule_rows.length > 0 ? 'progress_series' : 'single',
      schedule_rows,
      line_items,
      notes:
        estimate?.client_notes != null && String(estimate.client_notes).trim()
          ? String(estimate.client_notes).trim()
          : manualSnap?.notes || null,
      terms:
        estimate?.client_terms != null && String(estimate.client_terms).trim()
          ? String(estimate.client_terms).trim()
          : manualSnap?.terms || null,
      branding,
      attachments,
      payment_options,
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
      .select('id, status, user_id, job_id')
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
      if (inv.user_id) {
        let projectName = null
        if (inv.job_id) {
          const { data: p } = await supabase.from('projects').select('name').eq('id', inv.job_id).maybeSingle()
          projectName = p?.name || null
        }
        void notifyInvoiceStatusChange(supabase, {
          userId: inv.user_id,
          projectName,
          oldStatus: 'sent',
          newStatus: 'viewed',
        })
      }
    }
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

module.exports = router
