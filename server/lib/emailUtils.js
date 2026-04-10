const { Resend } = require('resend')

function escapeHtml(s) {
  if (s == null) return ''
  const str = String(s)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

/** From address for portal emails (estimate + bid). Falls back to invite from if set. */
function getPortalFrom() {
  return process.env.PORTAL_EMAIL_FROM || process.env.INVITE_EMAIL_FROM || 'onboarding@resend.dev'
}

/**
 * Send an email via Resend.
 * @param {{ from: string, to: string | string[], subject: string, html: string, text?: string, headers?: Record<string, string> }} opts
 * @returns {{ sent: boolean, error?: unknown }}
 */
async function sendEmail({ from, to, subject, html, text, headers }) {
  const resend = getResendClient()
  if (!resend) {
    console.warn('[sendEmail] RESEND_API_KEY is not set; skipping send')
    return { sent: false }
  }
  const toList = Array.isArray(to) ? to : [to]
  try {
    const payload = {
      from,
      to: toList,
      subject,
      html,
      text: text || stripHtml(html),
    }
    if (headers && typeof headers === 'object' && Object.keys(headers).length > 0) {
      payload.headers = headers
    }
    const { error } = await resend.emails.send(payload)
    if (error) {
      console.error('[sendEmail] Resend error:', error)
      return { sent: false, error }
    }
    return { sent: true }
  } catch (err) {
    console.error('[sendEmail] Error:', err)
    return { sent: false, error: err }
  }
}

function stripHtml(html) {
  if (typeof html !== 'string') return ''
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

module.exports = { escapeHtml, getResendClient, getPortalFrom, sendEmail }
