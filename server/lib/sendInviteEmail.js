const { Resend } = require('resend')

/**
 * Send employee invite email via Resend.
 * @param {{ to: string, inviteLink: string, employeeName?: string, appName?: string }} opts
 * @returns {{ sent: boolean, error?: unknown }}
 */
async function sendInviteEmail({ to, inviteLink, employeeName, appName }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { sent: false }
  }
  const from = process.env.INVITE_EMAIL_FROM || 'onboarding@resend.dev'
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
