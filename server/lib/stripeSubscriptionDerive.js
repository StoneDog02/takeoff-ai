/**
 * Map Stripe subscription line items to app tier / addons / employees using the same price IDs
 * as the signup wizard (STRIPE_PRICE_* or VITE_STRIPE_PRICE_* on the server).
 */

function priceEnv(suffix) {
  const a = process.env[`STRIPE_PRICE_${suffix}`]
  const b = process.env[`VITE_STRIPE_PRICE_${suffix}`]
  return String(a || b || '').trim()
}

function loadPriceIdMap() {
  return {
    core: priceEnv('CORE'),
    plus: priceEnv('PLUS'),
    pro: priceEnv('PRO'),
    estimating: priceEnv('ESTIMATING'),
    portals: priceEnv('PORTALS'),
    aiTakeoff: priceEnv('AI_TAKEOFF'),
    financials: priceEnv('FINANCIALS'),
    fieldPayrollBase: priceEnv('FIELD_PAYROLL_BASE'),
    fieldPayrollPerEmp: priceEnv('FIELD_PAYROLL_PER_EMP'),
    docs: priceEnv('DOCS'),
    directory: priceEnv('DIRECTORY'),
  }
}

/**
 * @param {import('stripe').Stripe.Subscription} sub
 * @returns {{
 *   tier: 'core'|'plus'|'pro'|null,
 *   addons: string[],
 *   employees: number,
 *   primaryTierPriceId: string|null
 * }}
 */
function deriveSubscriptionPricingFromStripeSubscription(sub) {
  const m = loadPriceIdMap()
  const items = sub.items?.data || []
  /** @type {Map<string, number>} */
  const qtyByPrice = new Map()
  /** @type {Set<string>} */
  const priceIds = new Set()

  for (const item of items) {
    const priceObj = item.price
    const pid = typeof priceObj === 'string' ? priceObj : priceObj?.id
    if (!pid) continue
    const q = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
    priceIds.add(pid)
    qtyByPrice.set(pid, (qtyByPrice.get(pid) || 0) + q)
  }

  let tier = null
  let primaryTierPriceId = null
  if (m.pro && priceIds.has(m.pro)) {
    tier = 'pro'
    primaryTierPriceId = m.pro
  } else if (m.plus && priceIds.has(m.plus)) {
    tier = 'plus'
    primaryTierPriceId = m.plus
  } else if (m.core && priceIds.has(m.core)) {
    tier = 'core'
    primaryTierPriceId = m.core
  }

  const addons = []
  if (m.estimating && priceIds.has(m.estimating)) addons.push('estimating')
  if (m.portals && priceIds.has(m.portals)) addons.push('portals')
  if (m.aiTakeoff && priceIds.has(m.aiTakeoff)) addons.push('ai-takeoff')
  if (m.financials && priceIds.has(m.financials)) addons.push('financial')
  if (
    (m.fieldPayrollBase && priceIds.has(m.fieldPayrollBase)) ||
    (m.fieldPayrollPerEmp && priceIds.has(m.fieldPayrollPerEmp))
  ) {
    addons.push('field-ops')
  }
  if (m.docs && priceIds.has(m.docs)) addons.push('vault')
  if (m.directory && priceIds.has(m.directory)) addons.push('directory')

  const hasFieldPayroll =
    (m.fieldPayrollBase && priceIds.has(m.fieldPayrollBase)) ||
    (m.fieldPayrollPerEmp && priceIds.has(m.fieldPayrollPerEmp))

  /** null = do not overwrite DB (no Field Payroll lines on this subscription). */
  let employees = null
  if (hasFieldPayroll) {
    const over = m.fieldPayrollPerEmp && priceIds.has(m.fieldPayrollPerEmp)
      ? qtyByPrice.get(m.fieldPayrollPerEmp) || 0
      : 0
    employees = 5 + over
  }

  return { tier, addons, employees, primaryTierPriceId }
}

/**
 * @param {string|undefined} stripeStatus
 * @returns {string}
 */
function mapStripeSubscriptionStatus(stripeStatus) {
  const allowed = new Set([
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
  ])
  if (stripeStatus && allowed.has(stripeStatus)) return stripeStatus
  return stripeStatus || 'incomplete'
}

module.exports = {
  deriveSubscriptionPricingFromStripeSubscription,
  mapStripeSubscriptionStatus,
  loadPriceIdMap,
}
