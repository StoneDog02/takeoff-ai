/**
 * Send portal emails via Resend using the email templates.
 * - Estimate portal: client email when GC sends estimate
 * - Bid portal: sub email when GC dispatches or resends bid link
 *
 * Env: RESEND_API_KEY (required to send). PORTAL_EMAIL_FROM (optional; defaults to INVITE_EMAIL_FROM).
 */
const { sendEmail, getPortalFrom } = require('./emailUtils')
const { renderEstimatePortalEmail } = require('../emails/estimatePortalEmail')
const { renderBidPortalEmail } = require('../emails/bidPortalEmail')

/**
 * Send "estimate ready for review" email to client.
 * @param {{ to: string, clientName?: string, gcName?: string, projectName?: string, portalUrl: string, documentKind?: 'estimate' | 'change_order' }} opts
 * @returns {{ sent: boolean, error?: unknown }}
 */
async function sendEstimatePortalEmail({ to, clientName, gcName, projectName, portalUrl, documentKind = 'estimate' }) {
  const from = getPortalFrom()
  const { subject, html, text } = renderEstimatePortalEmail({
    clientName: clientName || 'there',
    gcName: gcName || 'Your contractor',
    projectName: projectName || 'your project',
    portalUrl,
    documentKind,
  })
  const result = await sendEmail({ from, to, subject, html, text })
  if (result.sent) {
    console.log('[sendEstimatePortalEmail] Sent to', to, '→', portalUrl)
  }
  return result
}

/**
 * Send "submit your bid" email to subcontractor (dispatch or resend).
 * @param {{ to: string, projectName?: string, portalUrl: string, isResend?: boolean }} opts
 * @returns {{ sent: boolean, error?: unknown }}
 */
async function sendBidPortalEmail({ to, projectName, portalUrl, isResend }) {
  const from = getPortalFrom()
  const { subject, html, text } = renderBidPortalEmail({
    projectName: projectName || 'a project',
    portalUrl,
    isResend: !!isResend,
  })
  const result = await sendEmail({ from, to, subject, html, text })
  if (result.sent) {
    console.log('[sendBidPortalEmail] Sent to', to, isResend ? '(resend)' : '', '→', portalUrl)
  }
  return result
}

module.exports = { sendEstimatePortalEmail, sendBidPortalEmail }
