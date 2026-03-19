/**
 * Email template: estimate ready for review (client portal link).
 * Renders HTML and plain text for Resend.
 */
const { escapeHtml } = require('../lib/emailUtils')

/**
 * @param {{ clientName: string, gcName: string, projectName: string, portalUrl: string, documentKind?: 'estimate' | 'change_order' }} opts
 * @returns {{ subject: string, html: string, text: string }}
 */
function renderEstimatePortalEmail({ clientName, gcName, projectName, portalUrl, documentKind = 'estimate' }) {
  const name = clientName || 'there'
  const gc = gcName || 'Your contractor'
  const project = projectName || 'your project'
  const isCo = documentKind === 'change_order'
  const subject = isCo ? `Change order for ${project}` : `Estimate ready for ${project}`
  const docWord = isCo ? 'change order' : 'estimate'
  const ctaLabel = isCo ? 'Review change order' : 'Review estimate'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#f7f6f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.5;color:#1c1a18;">
  <div class="wrapper" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div class="card" style="background:#ffffff;border-radius:14px;border:1px solid rgba(0,0,0,0.07);padding:32px 28px;">
      <h1 class="heading" style="font-size:22px;font-weight:600;color:#1c1a18;margin:0 0 16px;">Hi ${escapeHtml(name)},</h1>
      <p class="body-text" style="font-size:15px;color:#6b6764;margin:0 0 24px;line-height:1.55;">${escapeHtml(gc)} has sent you a ${docWord} for <strong>${escapeHtml(project)}</strong>. Review the details and approve, request changes, or decline from the link below.</p>
      <div class="cta-wrap" style="margin:28px 0 0;">
        <a href="${escapeHtml(portalUrl)}" class="cta" style="display:inline-block;padding:14px 28px;background:#c0392b;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">${escapeHtml(ctaLabel)}</a>
      </div>
      <p class="muted" style="font-size:13px;color:#b0ada9;margin:24px 0 0;">If the button doesn’t work, copy and paste this link into your browser:<br/><a href="${escapeHtml(portalUrl)}" style="color:#2d6fa8;word-break:break-all;">${escapeHtml(portalUrl)}</a></p>
    </div>
    <p class="footer" style="text-align:center;font-size:12px;color:#b0ada9;padding:32px 24px 0;margin:0;">Powered by BuildOS</p>
  </div>
</body>
</html>`

  const text = `Hi ${name},

${gc} has sent you a ${docWord} for ${project}. Review the details and approve, request changes, or decline.

Open this link in your browser: ${portalUrl}

Powered by BuildOS`

  return { subject, html, text }
}

module.exports = { renderEstimatePortalEmail }
