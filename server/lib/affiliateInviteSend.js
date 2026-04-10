/**
 * Shared: record affiliate email referral + send invite (partner portal + admin "my invite").
 */
const { buildReferralInviteEmailHtml, buildReferralInviteEmailText } = require('../routes/referrals')
const { sendEmail } = require('./emailUtils')
const { publicAppOrigin } = require('./affiliatePortalTokens')

function trackingPublicBaseUrl() {
  const raw = (process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '')
  if (!raw) return ''
  return raw.startsWith('http') ? raw : `https://${raw}`
}

/** Record pending referral + send invite email for an affiliates row. */
async function sendAffiliateReferralInviteEmail(supabaseAdmin, aff, emailRaw) {
  if (!aff?.active) {
    return { ok: false, status: 403, error: 'Your partner account is inactive.' }
  }

  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return { ok: false, status: 400, error: 'Valid email is required' }
  }
  if (emailRaw === (aff.email || '').toLowerCase()) {
    return { ok: false, status: 400, error: 'You cannot invite your own email address.' }
  }

  const { data: codeRow, error: codeErr } = await supabaseAdmin
    .from('referral_codes')
    .select('code')
    .eq('affiliate_id', aff.id)
    .maybeSingle()
  if (codeErr) throw codeErr
  if (!codeRow?.code) {
    return { ok: false, status: 404, error: 'No referral code found for your account' }
  }
  const code = String(codeRow.code).trim()

  const tracksCommission = aff.tracks_commission !== false
  const commissionRate =
    tracksCommission && aff.commission_rate != null ? Number(aff.commission_rate) : null

  const { data: dupRow } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('affiliate_id', aff.id)
    .eq('referee_email', emailRaw)
    .maybeSingle()
  if (dupRow?.id) {
    return { ok: false, status: 409, error: 'A referral for this email already exists' }
  }

  const { error: insErr } = await supabaseAdmin.from('referrals').insert({
    referrer_id: null,
    affiliate_id: aff.id,
    affiliate_commission_rate: Number.isFinite(commissionRate) ? commissionRate : null,
    referee_id: null,
    referee_email: emailRaw,
    code,
    status: 'pending',
    completed_at: null,
  })
  if (insErr) {
    if (insErr.code === '23505') {
      return { ok: false, status: 409, error: 'A referral for this email already exists' }
    }
    console.error('[affiliateInviteSend] insert referral:', insErr)
    return { ok: false, status: 500, error: insErr.message || 'Could not record referral' }
  }

  let trackingPixelUrl = ''
  const apiBase = trackingPublicBaseUrl()
  if (apiBase) {
    const { data: refRow } = await supabaseAdmin
      .from('referrals')
      .select('invite_token')
      .eq('affiliate_id', aff.id)
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

  const inviterLabel = (aff.name && String(aff.name).trim()) || aff.email || 'Someone'
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
    console.error('[affiliateInviteSend] Resend failed:', sendErr)
    return {
      ok: false,
      status: 503,
      error:
        'Referral was saved, but the email could not be sent. Ask your administrator to set RESEND_API_KEY and INVITE_EMAIL_FROM.',
      code: 'email_failed',
    }
  }

  return {
    ok: true,
    message: 'We sent an email with a sign-up link that includes your referral.',
  }
}

module.exports = { sendAffiliateReferralInviteEmail }
