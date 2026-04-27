/**
 * Send portal emails via Resend using the email templates.
 * - Estimate portal: client email when GC sends estimate / change order
 * - Invoice portal: client email when GC sends invoice (POST /api/invoices/:id/send)
 * - Bid portal: sub email when GC dispatches or resends bid link
 *
 * Env: RESEND_API_KEY (required to send). PORTAL_EMAIL_FROM (optional; defaults to INVITE_EMAIL_FROM).
 */
const { sendEmail, getPortalFrom } = require('./emailUtils')
const { renderEstimatePortalEmail, renderEstimateReminderEmail } = require('../emails/estimatePortalEmail')
const { renderBidPortalEmail } = require('../emails/bidPortalEmail')
const { renderInvoicePortalEmail } = require('../emails/invoicePortalEmail')

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
 * Send follow-up / reminder for an already-sent estimate (same portal URL; does not rotate token).
 * @param {{ to: string, clientName?: string, gcName?: string, projectName?: string, portalUrl: string, documentKind?: 'estimate' | 'change_order' }} opts
 * @returns {{ sent: boolean, error?: unknown }}
 */
async function sendEstimateReminderEmail({ to, clientName, gcName, projectName, portalUrl, documentKind = 'estimate' }) {
  const from = getPortalFrom()
  const { subject, html, text } = renderEstimateReminderEmail({
    clientName: clientName || 'there',
    gcName: gcName || 'Your contractor',
    projectName: projectName || 'your project',
    portalUrl,
    documentKind,
  })
  const result = await sendEmail({ from, to, subject, html, text })
  if (result.sent) {
    console.log('[sendEstimateReminderEmail] Sent to', to, '→', portalUrl)
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

/**
 * Send invoice portal link to client.
 * @param {{ to: string, clientName?: string, projectName?: string, portalUrl: string, isResend?: boolean }} opts
 */
async function sendInvoicePortalEmail({ to, clientName, projectName, portalUrl, isResend }) {
  const from = getPortalFrom()
  const { subject, html, text } = renderInvoicePortalEmail({
    clientName: clientName || 'there',
    projectName: projectName || 'your project',
    portalUrl,
    isResend: !!isResend,
  })
  const result = await sendEmail({ from, to, subject, html, text })
  if (result.sent) {
    console.log('[sendInvoicePortalEmail] Sent to', to, isResend ? '(resend)' : '', '→', portalUrl)
  }
  return result
}

module.exports = { sendEstimatePortalEmail, sendEstimateReminderEmail, sendBidPortalEmail, sendInvoicePortalEmail }
