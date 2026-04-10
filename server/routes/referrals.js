/**
 * Referral invites: record pending referral + send Resend email with sign-up link (?ref=).
 */
const express = require('express')
const crypto = require('crypto')
const { supabase } = require('../db/supabase')
const { sendEmail, escapeHtml } = require('../lib/emailUtils')

const router = express.Router()

function isUuid(s) {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
  )
}

function buildReferralCode(email) {
  const prefixRaw = (email || '').split('@')[0] || ''
  const alnum = prefixRaw.replace(/[^a-z0-9]/gi, '')
  let base = (alnum.length > 0 ? alnum : 'USER').slice(0, 6).toUpperCase()
  if (base.length === 0) base = 'USER'
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.randomBytes(4)
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += alphabet[bytes[i] % alphabet.length]
  return base + suffix
}

async function getOrCreateReferralCode(userId, email) {
  if (!supabase) throw new Error('Database not configured')
  const { data: existing, error: selErr } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('user_id', userId)
    .maybeSingle()
  if (selErr) throw selErr
  if (existing?.code) return existing.code

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = buildReferralCode(email)
    const { error: insErr } = await supabase.from('referral_codes').insert({ user_id: userId, code })
    if (!insErr) return code
    if (insErr.code !== '23505') throw insErr
  }
  throw new Error('Could not create referral code')
}

async function applyReferralViaEdgeFunction(code, refereeEmail) {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anon || !serviceKey) {
    throw new Error('Supabase URL/keys not configured on server')
  }
  const res = await fetch(`${supabaseUrl}/functions/v1/apply-referral`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ code, referee_email: refereeEmail }),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { ok: res.ok, status: res.status, json }
}

function publicAppOrigin() {
  const raw = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '')
  if (!raw) return ''
  return raw.startsWith('http') ? raw : `https://${raw}`
}

/** Base URL of this API (reachable from email clients). Set PUBLIC_API_URL for open tracking. */
function trackingPublicBaseUrl() {
  const raw = (process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '')
  if (!raw) return ''
  return raw.startsWith('http') ? raw : `https://${raw}`
}

/** 1×1 transparent GIF for email open pixel */
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

/**
 * GET /api/referrals/track-email-open?t=<invite_token>
 * Public (no auth). Sets invite_email_opened_at once. Always returns a 1×1 GIF.
 */
async function trackReferralEmailOpen(req, res) {
  const raw = typeof req.query.t === 'string' ? req.query.t.trim() : ''
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.type('image/gif')

  if (!isUuid(raw) || !supabase) {
    res.send(TRANSPARENT_GIF)
    return
  }

  try {
    await supabase
      .from('referrals')
      .update({ invite_email_opened_at: new Date().toISOString() })
      .eq('invite_token', raw)
      .is('invite_email_opened_at', null)
  } catch (e) {
    console.warn('[referrals/track-email-open]', e?.message || e)
  }
  res.send(TRANSPARENT_GIF)
}

/**
 * Plain-text body for referral invites (helps inbox placement vs HTML-only “newsletter” signals).
 */
function buildReferralInviteEmailText({ inviterLabel, productName, signUpUrl, code }) {
  const inviter = inviterLabel || 'Someone'
  const brand = productName || 'the app'
  const lines = [
    `Hi,`,
    ``,
    `${inviter} invited you to join ${brand}.`,
    ``,
  ]
  if (signUpUrl) {
    lines.push(`Use this link to create your account (your referral is already included):`)
    lines.push(signUpUrl)
    lines.push(``)
  }
  lines.push(`Referral code: ${code}`)
  if (!signUpUrl) {
    lines.push(``)
    lines.push(`Enter that code during sign-up for ${brand}.`)
  }
  lines.push(``, `If you didn’t expect this message, you can ignore it.`)
  return lines.join('\n')
}

/**
 * Minimal HTML for referral invites — avoids heavy “marketing” layout (big buttons, banners, promos)
 * that often land referral mail in Gmail’s Promotions tab. No guarantee of Primary; improves odds.
 */
function buildReferralInviteEmailHtml({ inviterLabel, productName, signUpUrl, code, trackingPixelUrl }) {
  const inviter = escapeHtml(inviterLabel)
  const brand = escapeHtml(productName)
  const safeCode = escapeHtml(code)
  const href = signUpUrl ? escapeHtml(signUpUrl) : ''

  const linkBlock = signUpUrl
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1a1a24;">Use this link to create your account (your referral is already included):<br /><a href="${href}" style="color:#1d4ed8;word-break:break-all;">${href}</a></p>`
    : `<p style="margin:0 0 8px;font-size:16px;line-height:1.55;color:#1a1a24;">Sign up for ${brand} and enter your referral code when asked.</p><p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#475569;">Ask your administrator if you need a direct sign-up link.</p>`

  const pixel =
    trackingPixelUrl
      ? `<img src="${escapeHtml(trackingPixelUrl)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;overflow:hidden;margin:0;padding:0;" />`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.5;color:#1a1a24;background:#fafafa;">
<p style="margin:0 0 12px;">Hi,</p>
<p style="margin:0 0 16px;"><strong>${inviter}</strong> invited you to join <strong>${brand}</strong>.</p>
${linkBlock}
<p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#475569;">Referral code: <strong style="font-family:ui-monospace,Menlo,monospace;">${safeCode}</strong></p>
<p style="margin:20px 0 0;font-size:14px;line-height:1.5;color:#64748b;">If you didn’t expect this email, you can ignore it.</p>
${pixel}
</body>
</html>`
}

/**
 * POST /api/referrals/send-invite
 * Body: { email }
 * Auth: Bearer (referrer). Records pending referral, emails invitee with sign-up link including ?ref=.
 */
router.post('/send-invite', async (req, res) => {
  try {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return res.status(400).json({ error: 'Valid email is required' })
    }

    const userId = req.user?.id
    const userEmail = req.user?.email || ''
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    if (emailRaw === (userEmail || '').toLowerCase()) {
      return res.status(400).json({ error: 'You cannot invite your own email address.' })
    }

    const code = await getOrCreateReferralCode(userId, userEmail)

    const { ok, status, json } = await applyReferralViaEdgeFunction(code, emailRaw)
    if (!ok) {
      const msg = json?.error || json?.message || 'Could not record referral'
      if (status === 409) return res.status(409).json({ error: msg })
      return res.status(status >= 400 ? status : 500).json({ error: msg })
    }

    let trackingPixelUrl = ''
    const apiBase = trackingPublicBaseUrl()
    if (apiBase) {
      const { data: refRow } = await supabase
        .from('referrals')
        .select('invite_token')
        .eq('referrer_id', userId)
        .eq('referee_email', emailRaw)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (refRow?.invite_token) {
        trackingPixelUrl = `${apiBase}/api/referrals/track-email-open?t=${encodeURIComponent(refRow.invite_token)}`
      }
    }

    const base = publicAppOrigin()
    const signUpUrl = base ? `${base}/sign-up?ref=${encodeURIComponent(code)}` : ''

    const inviterLabel =
      (req.user?.user_metadata?.full_name && String(req.user.user_metadata.full_name).trim()) ||
      userEmail ||
      'Someone'

    const from = process.env.INVITE_EMAIL_FROM || 'onboarding@resend.dev'
    const productName = process.env.APP_NAME || 'Proj-X'

    const html = buildReferralInviteEmailHtml({
      inviterLabel,
      productName,
      signUpUrl,
      code,
      trackingPixelUrl,
    })
    const text = buildReferralInviteEmailText({
      inviterLabel,
      productName,
      signUpUrl,
      code,
    })

    const { sent, error: sendErr } = await sendEmail({
      from,
      to: emailRaw,
      subject: `${inviterLabel} invited you to ${productName}`,
      html,
      text,
    })

    if (!sent) {
      console.error('[referrals/send-invite] Resend failed:', sendErr)
      return res.status(503).json({
        error:
          'Referral was saved, but the email could not be sent. Set RESEND_API_KEY and a verified INVITE_EMAIL_FROM domain in Resend.',
        code: 'email_failed',
        success: false,
      })
    }

    return res.json({
      success: true,
      message: 'We sent an email with a sign-up link that includes your referral.',
    })
  } catch (err) {
    console.error('[referrals/send-invite]', err)
    return res.status(500).json({ error: err.message || 'Failed to send invite' })
  }
})

/**
 * DELETE /api/referrals/:id
 * Auth: Bearer. Removes a referral row you created (referrer_id = you). Does not revoke credits already issued.
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid referral id' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })

    const { data, error } = await supabase
      .from('referrals')
      .delete()
      .eq('id', id)
      .eq('referrer_id', userId)
      .select('id')

    if (error) {
      console.error('[referrals/delete]', error)
      return res.status(500).json({ error: 'Could not delete referral' })
    }
    if (!data?.length) {
      return res.status(404).json({ error: 'Referral not found' })
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('[referrals/delete]', err)
    return res.status(500).json({ error: err.message || 'Failed to delete referral' })
  }
})

module.exports = {
  router,
  trackReferralEmailOpen,
  buildReferralCode,
  applyReferralViaEdgeFunction,
  buildReferralInviteEmailHtml,
  buildReferralInviteEmailText,
}
