const express = require('express')
const router = express.Router()
const { supabase: supabaseAdmin } = require('../db/supabase')
const { buildReferralCode } = require('./referrals')
const { sendEmail } = require('../lib/emailUtils')
const { buildAffiliateWelcomeEmailHtml } = require('../lib/affiliateWelcomeEmail')
const { generateSetupToken, setupExpiresAtIso, publicAppOrigin } = require('../lib/affiliatePortalTokens')

const PER_PAGE = 50

function isUuid(s) {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
  )
}

/** GET /api/admin/stats - Aggregates for admin dashboard (user counts) */
router.get('/stats', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let totalUsers = 0
    let newUsersLast7Days = 0
    let newUsersLast30Days = 0
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      })
      if (error) {
        return res.status(500).json({ error: error.message })
      }
      const users = data?.users ?? []
      totalUsers += users.length
      for (const u of users) {
        const createdAt = u.created_at ? new Date(u.created_at) : null
        if (createdAt && createdAt >= thirtyDaysAgo) newUsersLast30Days++
        if (createdAt && createdAt >= sevenDaysAgo) newUsersLast7Days++
      }
      hasMore = users.length === PER_PAGE
      page++
    }

    res.json({
      totalUsers,
      newUsersLast7Days,
      newUsersLast30Days,
    })
  } catch (err) {
    next(err)
  }
})

/** GET /api/admin/users - Paginated list of users (id, email, created_at, last_sign_in_at) */
router.get('/users', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page, 10) || 20))

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    })
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    const users = (data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }))
    res.json({ users, page, perPage })
  } catch (err) {
    next(err)
  }
})

function normalizeCommissionRate(raw) {
  if (raw === undefined || raw === null) return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/%/g, '').trim())
  if (!Number.isFinite(n) || n < 0) return null
  if (n > 1) return Math.min(1, n / 100)
  return n
}

async function insertUniqueAffiliateReferralCode(affiliateId, emailForPrefix) {
  if (!supabaseAdmin) throw new Error('Database not configured')
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = buildReferralCode(emailForPrefix)
    const { error: insErr } = await supabaseAdmin
      .from('referral_codes')
      .insert({ affiliate_id: affiliateId, code })
    if (!insErr) return code
    if (insErr.code !== '23505') throw insErr
  }
  throw new Error('Could not create unique referral code')
}

async function buildAffiliateAdminPayload(affiliateRow, referralCode) {
  const id = affiliateRow.id
  const { data: refRows } = await supabaseAdmin
    .from('referrals')
    .select('signed_up_at, status')
    .eq('affiliate_id', id)
  let signupCount = 0
  let completedCount = 0
  for (const r of refRows || []) {
    if (r.signed_up_at) signupCount++
    if (r.status === 'completed') completedCount++
  }
  const { data: commRows } = await supabaseAdmin
    .from('affiliate_commission_events')
    .select('amount_cents')
    .eq('affiliate_id', id)
  let commissionCentsTotal = 0
  for (const c of commRows || []) {
    commissionCentsTotal += typeof c.amount_cents === 'number' ? c.amount_cents : Number(c.amount_cents) || 0
  }
  return {
    ...affiliateRow,
    referral_code: referralCode ?? null,
    signup_count: signupCount,
    completed_referrals: completedCount,
    commission_cents_total: commissionCentsTotal,
  }
}

/** GET /api/admin/affiliates */
router.get('/affiliates', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const { data: affiliates, error: affErr } = await supabaseAdmin
      .from('affiliates')
      .select('*')
      .order('created_at', { ascending: false })
    if (affErr) throw affErr

    const { data: codes, error: codeErr } = await supabaseAdmin
      .from('referral_codes')
      .select('affiliate_id, code')
      .not('affiliate_id', 'is', null)
    if (codeErr) throw codeErr

    const codeByAffiliate = new Map()
    for (const row of codes || []) {
      if (row.affiliate_id && row.code) codeByAffiliate.set(row.affiliate_id, row.code)
    }

    const { data: refRows, error: refErr } = await supabaseAdmin
      .from('referrals')
      .select('affiliate_id, signed_up_at, status')
      .not('affiliate_id', 'is', null)
    if (refErr) throw refErr

    const { data: commRows, error: commErr } = await supabaseAdmin
      .from('affiliate_commission_events')
      .select('affiliate_id, amount_cents')
    if (commErr) throw commErr

    const signupCount = new Map()
    const completedCount = new Map()
    for (const r of refRows || []) {
      const aid = r.affiliate_id
      if (!aid) continue
      if (r.signed_up_at) signupCount.set(aid, (signupCount.get(aid) || 0) + 1)
      if (r.status === 'completed') completedCount.set(aid, (completedCount.get(aid) || 0) + 1)
    }

    const commissionSumCents = new Map()
    for (const c of commRows || []) {
      const aid = c.affiliate_id
      if (!aid) continue
      const add = typeof c.amount_cents === 'number' ? c.amount_cents : Number(c.amount_cents) || 0
      commissionSumCents.set(aid, (commissionSumCents.get(aid) || 0) + add)
    }

    const list = (affiliates || []).map((a) => ({
      ...a,
      referral_code: codeByAffiliate.get(a.id) ?? null,
      signup_count: signupCount.get(a.id) || 0,
      completed_referrals: completedCount.get(a.id) || 0,
      commission_cents_total: commissionSumCents.get(a.id) || 0,
    }))

    res.json({ affiliates: list })
  } catch (err) {
    next(err)
  }
})

/** POST /api/admin/affiliates */
router.post('/affiliates', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const body = req.body || {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const rate = normalizeCommissionRate(body.commission_rate)
    if (!name) return res.status(400).json({ error: 'name is required' })
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' })
    }
    if (rate === null || rate > 1) {
      return res.status(400).json({ error: 'commission_rate must be between 0 and 1 (e.g. 0.2 for 20%)' })
    }

    const nowIso = new Date().toISOString()
    const { data: created, error: insErr } = await supabaseAdmin
      .from('affiliates')
      .insert({
        name,
        email,
        phone: phone || null,
        commission_rate: rate,
        updated_at: nowIso,
      })
      .select()
      .single()

    if (insErr) throw insErr

    let code
    try {
      code = await insertUniqueAffiliateReferralCode(created.id, email)
    } catch (codeErr) {
      await supabaseAdmin.from('affiliates').delete().eq('id', created.id)
      throw codeErr
    }

    const portalToken = generateSetupToken()
    const tokenExpires = setupExpiresAtIso()
    const { error: tokErr } = await supabaseAdmin
      .from('affiliates')
      .update({
        portal_setup_token: portalToken,
        portal_setup_token_expires_at: tokenExpires,
        updated_at: nowIso,
      })
      .eq('id', created.id)
    if (tokErr) {
      await supabaseAdmin.from('referral_codes').delete().eq('affiliate_id', created.id)
      await supabaseAdmin.from('affiliates').delete().eq('id', created.id)
      throw tokErr
    }

    const base = publicAppOrigin()
    const setupUrl = base ? `${base}/affiliate/setup?token=${encodeURIComponent(portalToken)}` : ''
    const signInUrl = base ? `${base}/sign-in` : ''
    const referralSignUpUrl = base ? `${base}/sign-up?ref=${encodeURIComponent(code)}` : ''
    const pctLabel = `${Math.round(rate * 10000) / 100}%`
    const productName = process.env.APP_NAME || 'Proj-X'
    const from = process.env.INVITE_EMAIL_FROM || 'onboarding@resend.dev'
    const html = buildAffiliateWelcomeEmailHtml({
      partnerName: name,
      productName,
      referralCode: code,
      commissionPercentLabel: pctLabel,
      referralSignUpUrl,
      portalSetupUrl: setupUrl,
      signInUrl,
    })
    const { sent, error: sendErr } = await sendEmail({
      from,
      to: email,
      subject: `You're invited — ${productName} partner program`,
      html,
    })
    if (!sent) {
      console.error('[admin/affiliates] welcome email failed:', sendErr?.message || sendErr)
    }

    const { data: refreshed } = await supabaseAdmin.from('affiliates').select('*').eq('id', created.id).single()
    const row = refreshed || created
    const payload = await buildAffiliateAdminPayload(row, code)
    res.status(201).json({ affiliate: payload, welcome_email_sent: Boolean(sent) })
  } catch (err) {
    next(err)
  }
})

/** PATCH /api/admin/affiliates/:id */
router.patch('/affiliates/:id', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) return res.status(400).json({ error: 'Invalid id' })

    const { data: existing, error: loadErr } = await supabaseAdmin
      .from('affiliates')
      .select('id, auth_user_id')
      .eq('id', id)
      .maybeSingle()
    if (loadErr) throw loadErr
    if (!existing) return res.status(404).json({ error: 'Not found' })

    const body = req.body || {}
    const patch = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) return res.status(400).json({ error: 'name cannot be empty' })
      patch.name = name
    }
    if (body.email !== undefined) {
      if (existing.auth_user_id) {
        return res.status(400).json({ error: 'Cannot change email after the partner has activated their account' })
      }
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Valid email is required' })
      }
      patch.email = email
    }
    if (body.phone !== undefined) {
      patch.phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
    }
    if (body.commission_rate !== undefined) {
      const rate = normalizeCommissionRate(body.commission_rate)
      if (rate === null || rate > 1) {
        return res.status(400).json({ error: 'commission_rate must be between 0 and 1' })
      }
      patch.commission_rate = rate
    }
    if (body.active !== undefined) {
      patch.active = Boolean(body.active)
    }

    const patchFields = Object.keys(patch).filter((k) => k !== 'updated_at')
    if (patchFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error } = await supabaseAdmin
      .from('affiliates')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found' })

    const { data: codeRow } = await supabaseAdmin
      .from('referral_codes')
      .select('code')
      .eq('affiliate_id', id)
      .maybeSingle()

    const payload = await buildAffiliateAdminPayload(data, codeRow?.code ?? null)
    res.json({ affiliate: payload })
  } catch (err) {
    next(err)
  }
})

/** DELETE /api/admin/affiliates/:id — removes partner row, referral code, affiliate referrals (and related commission rows), and portal auth user if any. */
router.delete('/affiliates/:id', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id || !isUuid(id)) {
      return res.status(400).json({ error: 'Invalid id' })
    }

    const { data: row, error: getErr } = await supabaseAdmin
      .from('affiliates')
      .select('id, auth_user_id')
      .eq('id', id)
      .maybeSingle()
    if (getErr) throw getErr
    if (!row) return res.status(404).json({ error: 'Not found' })

    const { error: refDelErr } = await supabaseAdmin.from('referrals').delete().eq('affiliate_id', id)
    if (refDelErr) throw refDelErr

    if (row.auth_user_id) {
      const { error: delUserErr } = await supabaseAdmin.auth.admin.deleteUser(row.auth_user_id)
      if (delUserErr) {
        const msg = delUserErr.message || ''
        if (!msg.toLowerCase().includes('not found') && !msg.toLowerCase().includes('user not found')) {
          throw delUserErr
        }
      }
    }

    const { error: delAffErr } = await supabaseAdmin.from('affiliates').delete().eq('id', id)
    if (delAffErr) throw delAffErr

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

const SUPPORT_STATUSES = new Set(['new', 'seen', 'in_progress', 'resolved'])
const SUPPORT_PRIORITIES = new Set(['low', 'normal', 'high', 'critical'])
const SUPPORT_TYPES = new Set(['bug', 'feature', 'question', 'other'])

/** GET /api/admin/support/new-count — messages with status new */
router.get('/support/new-count', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const { count, error } = await supabaseAdmin
      .from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new')
    if (error) throw error
    res.json({ count: count ?? 0 })
  } catch (err) {
    next(err)
  }
})

/** GET /api/admin/support — list with optional filters, newest first */
router.get('/support', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const status = typeof req.query.status === 'string' ? req.query.status : ''
    const type = typeof req.query.type === 'string' ? req.query.type : ''
    const q = typeof req.query.q === 'string' ? req.query.trim() : ''

    let query = supabaseAdmin.from('support_messages').select('*').order('created_at', { ascending: false })

    if (status && status !== 'all' && SUPPORT_STATUSES.has(status)) {
      query = query.eq('status', status)
    }
    if (type && type !== 'all' && SUPPORT_TYPES.has(type)) {
      query = query.eq('type', type)
    }
    if (q) {
      const esc = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
      const pattern = `%${esc}%`
      query = query.or(
        `message.ilike.${pattern},user_email.ilike.${pattern},user_name.ilike.${pattern}`
      )
    }

    const { data, error } = await query
    if (error) throw error
    res.json({ messages: data ?? [] })
  } catch (err) {
    next(err)
  }
})

/** PATCH /api/admin/support/:id — admin update */
router.patch('/support/:id', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const id = req.params.id
    const body = req.body || {}
    const patch = {}

    if (body.status !== undefined) {
      if (!SUPPORT_STATUSES.has(body.status)) {
        return res.status(400).json({ error: 'Invalid status' })
      }
      patch.status = body.status
      if (body.status === 'resolved') {
        patch.resolved_at = new Date().toISOString()
      } else {
        patch.resolved_at = null
      }
    }
    if (body.priority !== undefined) {
      if (!SUPPORT_PRIORITIES.has(body.priority)) {
        return res.status(400).json({ error: 'Invalid priority' })
      }
      patch.priority = body.priority
    }
    if (body.admin_notes !== undefined) {
      patch.admin_notes = typeof body.admin_notes === 'string' ? body.admin_notes : null
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error } = await supabaseAdmin
      .from('support_messages')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

module.exports = router
