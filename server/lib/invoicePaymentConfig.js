/**
 * Normalize company_settings.invoice_payment_config for internal use and public invoice portal.
 */

function normalizeInvoicePaymentConfig(raw) {
  const base = {
    cash: true,
    check: true,
    ach: true,
    card: false,
    check_instructions: '',
    ach_instructions: '',
    cash_note: '',
    stripe_connect_account_id: null,
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const o = raw
  return {
    cash: o.cash !== false,
    check: o.check !== false,
    ach: o.ach !== false,
    card: o.card === true,
    check_instructions: typeof o.check_instructions === 'string' ? o.check_instructions : '',
    ach_instructions: typeof o.ach_instructions === 'string' ? o.ach_instructions : '',
    cash_note: typeof o.cash_note === 'string' ? o.cash_note : '',
    stripe_connect_account_id:
      o.stripe_connect_account_id != null && String(o.stripe_connect_account_id).trim().startsWith('acct_')
        ? String(o.stripe_connect_account_id).trim()
        : null,
  }
}

/** Safe subset for GET invoice portal (no secrets beyond wire instructions you chose to show). */
function paymentOptionsForPortalResponse(config) {
  const c = normalizeInvoicePaymentConfig(config)
  const out = {
    cash: c.cash,
    check: c.check,
    ach: c.ach,
    card: c.card,
    check_instructions: c.check_instructions.trim() || null,
    ach_instructions: c.ach_instructions.trim() || null,
    cash_note: c.cash_note.trim() || null,
  }
  const anyMethod = out.cash || out.check || out.ach || out.card
  const anyText = !!(out.check_instructions || out.ach_instructions || out.cash_note)
  if (!anyMethod && !anyText) {
    return {
      cash: true,
      check: true,
      ach: true,
      card: false,
      check_instructions: null,
      ach_instructions: null,
      cash_note: null,
    }
  }
  return out
}

/** Settings API (camelCase) */
function companySettingsInvoicePaymentFromRow(rowConfig) {
  const c = normalizeInvoicePaymentConfig(rowConfig)
  return {
    cash: c.cash,
    check: c.check,
    ach: c.ach,
    card: c.card,
    checkInstructions: c.check_instructions,
    achInstructions: c.ach_instructions,
    cashNote: c.cash_note,
    stripeConnectAccountId: c.stripe_connect_account_id,
  }
}

function companySettingsInvoicePaymentToRow(apiShape) {
  if (!apiShape || typeof apiShape !== 'object') return {}
  return {
    cash: apiShape.cash !== false,
    check: apiShape.check !== false,
    ach: apiShape.ach !== false,
    card: apiShape.card === true,
    check_instructions: typeof apiShape.checkInstructions === 'string' ? apiShape.checkInstructions : '',
    ach_instructions: typeof apiShape.achInstructions === 'string' ? apiShape.achInstructions : '',
    cash_note: typeof apiShape.cashNote === 'string' ? apiShape.cashNote : '',
    stripe_connect_account_id:
      apiShape.stripeConnectAccountId != null &&
      String(apiShape.stripeConnectAccountId).trim().startsWith('acct_')
        ? String(apiShape.stripeConnectAccountId).trim()
        : null,
  }
}

module.exports = {
  normalizeInvoicePaymentConfig,
  paymentOptionsForPortalResponse,
  companySettingsInvoicePaymentFromRow,
  companySettingsInvoicePaymentToRow,
}
