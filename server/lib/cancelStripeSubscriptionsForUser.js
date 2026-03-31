/**
 * Cancel Stripe subscriptions for a user before account deletion.
 * Prefers listing by Stripe customer (covers all subs on the customer); falls back to DB subscription IDs.
 * Best-effort: logs and continues on Stripe errors.
 * @param {string} userId
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 */
async function cancelStripeSubscriptionsForUser(userId, db) {
  if (!userId || !db) return
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) return

  const stripe = require('stripe')(stripeSecretKey)

  const { data: fc } = await db
    .from('user_financial_connections')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  const { data: subCustomerRows } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .not('stripe_customer_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)

  const customerId =
    fc?.stripe_customer_id ||
    (Array.isArray(subCustomerRows) && subCustomerRows[0]?.stripe_customer_id) ||
    null

  /** @type {string[]} */
  let subscriptionIds = []

  if (customerId) {
    try {
      const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
      subscriptionIds = (list.data || [])
        .filter((s) => s.status && !['canceled', 'incomplete_expired'].includes(s.status))
        .map((s) => s.id)
    } catch (e) {
      console.warn('[cancelStripeSubscriptionsForUser] list by customer:', e?.message || e)
    }
  }

  if (subscriptionIds.length === 0) {
    const { data: rows, error } = await db
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
    if (error) {
      console.warn('[cancelStripeSubscriptionsForUser] db:', error.message)
      return
    }
    subscriptionIds = [...new Set((rows || []).map((r) => r.stripe_subscription_id).filter(Boolean))]
  } else {
    const { data: rows } = await db.from('subscriptions').select('stripe_subscription_id').eq('user_id', userId)
    const fromDb = (rows || []).map((r) => r.stripe_subscription_id).filter(Boolean)
    subscriptionIds = [...new Set([...subscriptionIds, ...fromDb])]
  }

  for (const subId of subscriptionIds) {
    try {
      await stripe.subscriptions.cancel(subId)
    } catch (e) {
      const msg = e?.message || String(e)
      const code = e?.code
      if (code === 'resource_missing' || /No such subscription/i.test(msg)) continue
      if (/canceled subscription/i.test(msg) || /already been canceled/i.test(msg)) continue
      console.warn(`[cancelStripeSubscriptionsForUser] ${subId}:`, msg)
    }
  }
}

module.exports = { cancelStripeSubscriptionsForUser }
