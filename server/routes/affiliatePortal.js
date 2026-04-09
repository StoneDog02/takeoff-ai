/**
 * Public affiliate portal setup + authenticated affiliate dashboard data.
 */
const express = require('express')
const { supabase: supabaseAdmin } = require('../db/supabase')
const { requireAuth } = require('../middleware/auth')
const { publicAppOrigin } = require('../lib/affiliatePortalTokens')

const router = express.Router()

async function requireAffiliate(req, res, next) {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database not configured' })
    if (req.profile?.role !== 'affiliate') {
      return res.status(403).json({ error: 'Affiliate access only' })
    }
    const { data: aff, error } = await supabaseAdmin
      .from('affiliates')
      .select('*')
      .eq('auth_user_id', req.user.id)
      .maybeSingle()
    if (error) throw error
    if (!aff) return res.status(403).json({ error: 'No affiliate account linked' })
    req.affiliate = aff
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/affiliates/portal/setup?token=
 * Public: validate one-time token before password form.
 */
router.get('/setup', async (req, res, next) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database not configured' })
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''
    if (!token || token.length < 16) {
      return res.status(400).json({ valid: false, error: 'Invalid token' })
    }
    const { data: row, error } = await supabaseAdmin
      .from('affiliates')
      .select('id, name, email, commission_rate, auth_user_id, portal_setup_token_expires_at')
      .eq('portal_setup_token', token)
      .maybeSingle()
    if (error) throw error
    if (!row || row.auth_user_id) {
      return res.json({ valid: false, error: 'Invalid or already used link' })
    }
    const exp = row.portal_setup_token_expires_at ? new Date(row.portal_setup_token_expires_at) : null
    if (exp && exp < new Date()) {
      return res.json({ valid: false, error: 'This setup link has expired. Ask an admin to resend your invite.' })
    }
    const pct = row.commission_rate != null ? Math.round(Number(row.commission_rate) * 10000) / 100 : 0
    res.json({
      valid: true,
      name: row.name,
      email: row.email,
      commission_percent: pct,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/affiliates/portal/setup
 * Body: { token, password }
 * Public: create auth user, set profile role affiliate, link affiliates.auth_user_id, clear token.
 */
router.post('/setup', async (req, res, next) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database not configured' })
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (!token || token.length < 16) {
      return res.status(400).json({ error: 'Invalid token' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const { data: aff, error: affErr } = await supabaseAdmin
      .from('affiliates')
      .select('id, name, email, auth_user_id, portal_setup_token_expires_at')
      .eq('portal_setup_token', token)
      .maybeSingle()
    if (affErr) throw affErr
    if (!aff) {
      return res.status(400).json({ error: 'Invalid or already used link' })
    }
    if (aff.auth_user_id) {
      return res.status(409).json({ error: 'Account already activated. Sign in with your email and password.' })
    }
    const exp = aff.portal_setup_token_expires_at ? new Date(aff.portal_setup_token_expires_at) : null
    if (exp && exp < new Date()) {
      return res.status(400).json({ error: 'This setup link has expired' })
    }

    const email = (aff.email || '').toLowerCase().trim()
    if (!email) {
      return res.status(400).json({ error: 'Affiliate record has no email' })
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: aff.name || undefined },
    })
    if (createErr) {
      const msg = createErr.message || ''
      if (msg.includes('already been registered') || msg.toLowerCase().includes('already exists')) {
        return res.status(409).json({
          error:
            'An account already exists for this email. Use Sign in instead, or ask an admin to link your partner account.',
        })
      }
      throw createErr
    }
    const userId = created.user.id

    const nowIso = new Date().toISOString()
    const { data: profUpdated, error: profErr } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'affiliate', updated_at: nowIso })
      .eq('id', userId)
      .select('id')
    if (profErr) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      } catch (e) {
        console.warn('[affiliatePortal/setup] rollback deleteUser failed:', e?.message)
      }
      throw profErr
    }
    if (!profUpdated?.length) {
      const { error: insProfErr } = await supabaseAdmin.from('profiles').insert({
        id: userId,
        role: 'affiliate',
        updated_at: nowIso,
      })
      if (insProfErr) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId)
        } catch (e) {
          console.warn('[affiliatePortal/setup] rollback deleteUser failed:', e?.message)
        }
        throw insProfErr
      }
    }

    const { error: linkErr } = await supabaseAdmin
      .from('affiliates')
      .update({
        auth_user_id: userId,
        portal_setup_token: null,
        portal_setup_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', aff.id)
      .is('auth_user_id', null)

    if (linkErr) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      } catch (e) {
        console.warn('[affiliatePortal/setup] rollback deleteUser failed:', e?.message)
      }
      throw linkErr
    }

    res.json({ success: true, message: 'Account ready. You can sign in now.' })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/affiliates/portal/summary
 * Auth affiliate: code + aggregates + referral rows (safe fields).
 */
router.get('/summary', requireAuth, requireAffiliate, async (req, res, next) => {
  try {
    const aff = req.affiliate
    const { data: codeRow } = await supabaseAdmin
      .from('referral_codes')
      .select('code')
      .eq('affiliate_id', aff.id)
      .maybeSingle()

    const { data: refRows, error: refErr } = await supabaseAdmin
      .from('referrals')
      .select('id, referee_email, signed_up_at, status, completed_at, created_at')
      .eq('affiliate_id', aff.id)
      .order('created_at', { ascending: false })
    if (refErr) throw refErr

    const { data: commRows, error: commErr } = await supabaseAdmin
      .from('affiliate_commission_events')
      .select('amount_cents')
      .eq('affiliate_id', aff.id)
    if (commErr) throw commErr

    let commissionCentsTotal = 0
    for (const c of commRows || []) {
      commissionCentsTotal += typeof c.amount_cents === 'number' ? c.amount_cents : Number(c.amount_cents) || 0
    }

    const referrals = (refRows || []).map((r) => ({
      id: r.id,
      referee_email: r.referee_email || null,
      signed_up_at: r.signed_up_at,
      status: r.status,
      completed_at: r.completed_at,
      created_at: r.created_at,
    }))

    const pct = aff.commission_rate != null ? Math.round(Number(aff.commission_rate) * 10000) / 100 : 0
    const base = publicAppOrigin()
    const referralShareUrl = base && codeRow?.code ? `${base}/sign-up?ref=${encodeURIComponent(codeRow.code)}` : null

    res.json({
      affiliate: {
        id: aff.id,
        name: aff.name,
        email: aff.email,
        commission_percent: pct,
        active: aff.active,
      },
      referral_code: codeRow?.code ?? null,
      referral_share_url: referralShareUrl,
      signup_count: referrals.filter((x) => x.signed_up_at).length,
      completed_referrals: referrals.filter((x) => x.status === 'completed').length,
      commission_cents_total: commissionCentsTotal,
      referrals,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = { router }
