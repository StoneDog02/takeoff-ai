/**
 * Billing summary for Settings / Stripe: subscription row, Stripe plan details, usage counts, portal URL.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} userId
 */
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe = null
if (stripeSecretKey) {
  stripe = require('stripe')(stripeSecretKey)
}

function formatPrice(amountCents, currency = 'usd', interval) {
  const amount = (amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)
  const symbol = currency === 'usd' ? '$' : `${currency.toUpperCase()} `
  const period = interval === 'year' ? '/yr' : '/mo'
  return symbol + amount + period
}

function parseProductLimit(metadata, key) {
  if (!metadata || typeof metadata !== 'object') return null
  const v = metadata[key]
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

async function buildBillingSummary(userId, db) {
  if (!userId || !db) {
    const err = new Error('Unauthorized')
    err.statusCode = 401
    throw err
  }

  const { data: subRows, error: subErr } = await db
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (subErr) throw subErr
  const rows = subRows || []
  const priority = ['active', 'trialing', 'past_due', 'paused', 'unpaid', 'incomplete']
  const sub =
    rows.find((r) => priority.includes(r.status)) ||
    rows.find((r) => r.status !== 'canceled') ||
    rows[0] ||
    null

  const [{ count: projectCount }, { count: employeeCount }] = await Promise.all([
    db.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('employees').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  let limits = { max_projects: null, max_team_members: null }
  let plan = null
  let trialEnd = null
  let manageBillingUrl = null
  let liveStatus = sub?.status || null
  let cancelAtPeriodEnd = sub?.cancel_at_period_end ?? false
  let stripePriceId = sub?.stripe_price_id ?? null

  if (stripe && sub?.stripe_subscription_id) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {
        expand: ['items.data.price.product'],
      })
      liveStatus = stripeSub.status || liveStatus
      cancelAtPeriodEnd = !!stripeSub.cancel_at_period_end
      trialEnd =
        stripeSub.trial_end != null ? new Date(stripeSub.trial_end * 1000).toISOString() : null
      const item = stripeSub.items?.data?.[0]
      const price = item?.price
      const product = price?.product
      const productObj = typeof product === 'object' && product ? product : null
      if (price && productObj) {
        if (price.id) stripePriceId = price.id
        const interval = price.recurring?.interval === 'year' ? 'year' : 'month'
        plan = {
          name: productObj.name || 'Subscription',
          description: (productObj.description && String(productObj.description).trim()) || null,
          amount_cents: price.unit_amount ?? 0,
          currency: (price.currency || 'usd').toLowerCase(),
          interval,
          formatted: formatPrice(price.unit_amount ?? 0, price.currency, price.recurring?.interval),
        }
        limits = {
          max_projects: parseProductLimit(productObj.metadata, 'max_projects'),
          max_team_members:
            parseProductLimit(productObj.metadata, 'max_team_members') ??
            parseProductLimit(productObj.metadata, 'max_seats'),
        }
      }
    } catch (e) {
      console.warn('[billingSummary] subscription retrieve:', e.message)
    }
  }

  const baseUrl = (
    process.env.STRIPE_BILLING_PORTAL_RETURN_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ''
  )
    .toString()
    .trim()
    .replace(/\/$/, '')
  if (stripe && sub?.stripe_customer_id && baseUrl) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${baseUrl}/settings?section=billing`,
      })
      manageBillingUrl = session.url
    } catch (e) {
      console.warn('[billingSummary] billing portal session:', e.message)
    }
  }

  return {
    subscription: sub
      ? {
          id: sub.id,
          status: liveStatus,
          cancel_at_period_end: cancelAtPeriodEnd,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          trial_end: trialEnd,
          stripe_price_id: stripePriceId,
          plan,
        }
      : null,
    usage: {
      project_count: projectCount ?? 0,
      team_member_count: employeeCount ?? 0,
    },
    limits,
    manage_billing_url: manageBillingUrl,
  }
}

module.exports = { buildBillingSummary }
