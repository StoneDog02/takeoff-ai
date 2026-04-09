const { escapeHtml } = require('./emailUtils')

/**
 * HTML for “welcome affiliate” transactional email (code, commission, setup + sign-in links).
 */
function buildAffiliateWelcomeEmailHtml({
  partnerName,
  productName,
  referralCode,
  commissionPercentLabel,
  referralSignUpUrl,
  portalSetupUrl,
  signInUrl,
}) {
  const name = escapeHtml(partnerName)
  const brand = escapeHtml(productName)
  const code = escapeHtml(referralCode)
  const pct = escapeHtml(commissionPercentLabel)

  const setupHref = portalSetupUrl ? escapeHtml(portalSetupUrl) : ''
  const signInHref = signInUrl ? escapeHtml(signInUrl) : ''
  const refHref = referralSignUpUrl ? escapeHtml(referralSignUpUrl) : ''

  const bgPage = '#ede9e3'
  const bgCard = '#ffffff'
  const textPrimary = '#1a1a24'
  const textMuted = '#64748b'
  const accent = '#c0392b'
  const headerDark = '#0b0e14'
  const border = '#e2e8f0'
  const font =
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

  const setupBlock = setupHref
    ? `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
    <tr>
      <td align="center">
        <a href="${setupHref}" style="display:inline-block;padding:14px 28px;background-color:${accent};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;line-height:1.2;">
          Create your partner password
        </a>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 20px;font-size:13px;line-height:1.55;color:${textMuted};text-align:center;">
    This link is unique to you and expires in 14 days. After you choose a password, sign in anytime with your email and password.
  </p>`
    : `<p style="margin:0 0 20px;font-size:14px;color:${textMuted};">Ask your admin for your partner portal setup link (PUBLIC_APP_URL must be set).</p>`

  const signInBlock = signInHref
    ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:${textPrimary};"><strong>Sign in later:</strong> <a href="${signInHref}" style="color:${accent};font-weight:600;">${signInHref}</a></p>`
    : ''

  const shareBlock = refHref
    ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:${textPrimary};"><strong>Share sign-up with your audience:</strong> <a href="${refHref}" style="color:${accent};word-break:break-all;">${escapeHtml(referralSignUpUrl)}</a></p>`
    : `<p style="margin:0 0 8px;font-size:14px;color:${textPrimary};"><strong>Your referral code:</strong> <span style="font-family:ui-monospace,Menlo,monospace;font-weight:700;">${code}</span> — add <code style="background:${bgPage};padding:2px 6px;border-radius:4px;">?ref=${code}</code> to your sign-up link when sharing.</p>`

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${bgPage};font-family:${font};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${bgPage};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:${bgCard};border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(11,14,20,0.08);border:1px solid ${border};">
          <tr>
            <td style="background-color:${headerDark};padding:22px 28px;border-bottom:3px solid ${accent};">
              <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#f5f3ef;">${brand}</p>
              <p style="margin:6px 0 0;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:rgba(245,243,239,0.55);">Partner / affiliate program</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 28px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${textPrimary};">
                Hi <strong>${name}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${textMuted};">
                You&apos;re set up as a partner. Here&apos;s what you need to know:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;background:${bgPage};border-radius:10px;border:1px solid ${border};">
                <tr>
                  <td style="padding:18px 22px;">
                    <p style="margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${textMuted};">Your referral code</p>
                    <p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:22px;font-weight:700;color:${textPrimary};letter-spacing:0.06em;">${code}</p>
                    <p style="margin:12px 0 0;font-size:13px;color:${textMuted};line-height:1.5;">Commission rate: <strong style="color:${textPrimary};">${pct}</strong> of subscription revenue from customers who subscribe after signing up with your code (paid per billing cycle).</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:${textPrimary};">Step 1 — Partner portal</p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:${textMuted};">
                Create a password for your partner dashboard. There you&apos;ll see everyone who signed up with your code and your accrued commissions.
              </p>
              ${setupBlock}
              ${signInBlock}
              <p style="margin:24px 0 12px;font-size:14px;font-weight:600;color:${textPrimary};">Step 2 — Share ${brand}</p>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:${textMuted};">
                Send people this link so your code is applied automatically when they create an account:
              </p>
              ${shareBlock}
              <p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:${textMuted};border-top:1px solid ${border};padding-top:20px;">
                Questions? Reply to this email or contact your ${brand} administrator.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;">Sent by ${brand}</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

module.exports = { buildAffiliateWelcomeEmailHtml }
