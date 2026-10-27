/**
 * Persist a contractor's Stripe Connect Express account on company_settings
 * without dropping their other invoice payment options.
 */
const { normalizeInvoicePaymentConfig } = require('./invoicePaymentConfig')

function appOrigin() {
  const raw = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '')
  if (!raw) return 'http://localhost:5173'
  return raw.startsWith('http') ? raw : `https://${raw}`
}

function configFromNormalized(prev, accountId, payoutsEnabled) {
  return {
    cash: prev.cash,
    check: prev.check,
    ach: prev.ach,
    card: prev.card,
    check_instructions: prev.check_instructions,
    ach_instructions: prev.ach_instructions,
    cash_note: prev.cash_note,
    stripe_connect_account_id: accountId,
    payouts_enabled: payoutsEnabled === true,
  }
}

async function readPaymentConfig(supabase, userId) {
  const { data, error } = await supabase
    .from('company_settings')
    .select('user_id, invoice_payment_config')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return {
    exists: Boolean(data),
    config: normalizeInvoicePaymentConfig(data?.invoice_payment_config),
  }
}

async function saveConnectPayoutState(supabase, userId, { accountId, payoutsEnabled }) {
  const current = await readPaymentConfig(supabase, userId)
  const next = configFromNormalized(current.config, accountId, payoutsEnabled)
  const patch = {
    invoice_payment_config: next,
    updated_at: new Date().toISOString(),
  }
  if (current.exists) {
    const { error } = await supabase.from('company_settings').update(patch).eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('company_settings').insert({
      user_id: userId,
      name: '',
      ...patch,
    })
    if (error) throw error
  }
  return next
}

async function findUserIdForConnectAccount(supabase, accountId) {
  if (!accountId || !String(accountId).startsWith('acct_')) return null
  const { data, error } = await supabase
    .from('company_settings')
    .select('user_id')
    .filter('invoice_payment_config->>stripe_connect_account_id', 'eq', accountId)
    .maybeSingle()
  if (error) throw error
  return data?.user_id || null
}

module.exports = {
  appOrigin,
  readPaymentConfig,
  saveConnectPayoutState,
  findUserIdForConnectAccount,
}
