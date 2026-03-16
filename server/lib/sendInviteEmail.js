const { Resend } = require('resend')

/**
 * Send employee invite email via Resend.
 * @param {{ to: string, inviteLink: string, employeeName?: string, appName?: string }} opts
 * @returns {{ sent: boolean, error?: unknown }}
 */
async function sendInviteEmail({ to, inviteLink, employeeName, appName }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[sendInviteEmail] RESEND_API_KEY is not set; skipping send')
    return { sent: false }
  }
  // Resend only delivers to your own verified email when using onboarding@resend.dev.
  // To send to employees, verify a domain at resend.com/domains and set INVITE_EMAIL_FROM.
  const from = process.env.INVITE_EMAIL_FROM || 'onboarding@resend.dev'
  if (!process.env.INVITE_EMAIL_FROM) {
    console.warn('[sendInviteEmail] INVITE_EMAIL_FROM not set; using onboarding@resend.dev (Resend only delivers to your account email)')
  }
  const subject = process.env.INVITE_EMAIL_SUBJECT || "You're invited to the team"
  const name = employeeName || 'there'
  const app = appName || 'the team app'
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>You've been invited to join ${escapeHtml(app)}. Set your password to get started.</p>
    <p><a href="${escapeHtml(inviteLink)}">Accept invite and set password</a></p>
    <p>This link expires in 7 days. If you didn't expect this email, you can ignore it.</p>
  `.trim()
  const text = `Hi ${name},\n\nYou've been invited to join ${app}. Set your password to get started.\n\nOpen this link in your browser: ${inviteLink}\n\nThis link expires in 7 days. If you didn't expect this email, you can ignore it.`
  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
      text,
    })
    if (error) {
      console.error('[sendInviteEmail] Resend error:', error)
      return { sent: false, error }
    }
    console.log('[sendInviteEmail] Sent to', to, 'from', from)
    return { sent: true }
  } catch (err) {
    console.error('[sendInviteEmail] Error:', err)
    return { sent: false, error: err }
  }
}

function escapeHtml(s) {
  if (typeof s !== 'string') return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

module.exports = { sendInviteEmail }
