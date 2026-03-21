/**
 * Stripe routes for signup/payment and webhooks.
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (for webhook). Optional: STRIPE_SIGNUP_PRODUCT_ID.
 */
const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { supabase } = require('../db/supabase')

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const signupProductId = process.env.STRIPE_SIGNUP_PRODUCT_ID
let stripe = null
if (stripeSecretKey) {
  stripe = require('stripe')(stripeSecretKey)
}

/** Format amount in cents to display string (e.g. $49.00/mo) */
function formatPrice(amountCents, currency = 'usd', interval) {
  const amount = (amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)
  const symbol = currency === 'usd' ? '$' : currency.toUpperCase() + ' '
  const period = interval === 'year' ? '/yr' : '/mo'
  return symbol + amount + period
}

/**
 * GET /api/stripe/plans
 * Returns active recurring plans for signup and product-level data for landing page.
 * - plans: If STRIPE_SIGNUP_PRODUCT_ID is set, only that product's prices; else all. Used by signup flow.
 * - products: Always all active products (for landing pricing cards).
 * Response:
 *   plans: [{ id, name, amount, currency, interval, formatted }]
 *   products: [{ productId, name, description, metadata, prices: [...] }]
 */
router.get('/plans', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  try {
    // For signup: optionally restrict to one product
    let signupProducts = []
    if (signupProductId) {
      const product = await stripe.products.retrieve(signupProductId)
      if (product && product.active) signupProducts = [product]
    } else {
      const productsRes = await stripe.products.list({ active: true })
      signupProducts = productsRes.data || []
    }

    // For landing: always all active products
    const productsRes = await stripe.products.list({ active: true })
    const allProducts = productsRes.data || []

    const plans = []
    const productList = []
    for (const product of allProducts) {
      const pricesRes = await stripe.prices.list({
        product: product.id,
        active: true,
        type: 'recurring',
      })
      const priceList = (pricesRes.data || []).map((p) => ({
        id: p.id,
        amount: p.unit_amount ?? 0,
        currency: (p.currency || 'usd').toLowerCase(),
        interval: p.recurring?.interval === 'year' ? 'year' : 'month',
        formatted: formatPrice(p.unit_amount ?? 0, p.currency, p.recurring?.interval),
      }))
      const sortedPrices = priceList.sort((a, b) => (a.interval === 'month' ? 0 : 1) - (b.interval === 'month' ? 0 : 1))
      // Only add to flat plans list if this product is in signup set
      const includeInPlans = signupProducts.some((p) => p.id === product.id)
      if (includeInPlans) {
        const productPlans = priceList.map((p) => ({
          id: p.id,
          name: product.name,
          amount: p.amount,
          currency: p.currency,
          interval: p.interval,
          formatted: p.formatted,
        }))
        plans.push(...productPlans)
      }
      // Always add to product list for landing page
      productList.push({
        productId: product.id,
        name: product.name,
        description: product.description || '',
        metadata: product.metadata || {},
        prices: sortedPrices,
      })
    }
    return res.json({ plans, products: productList })
  } catch (err) {
    if (err.code === 'resource_missing') {
      return res.json({ plans: [], products: [] })
    }
    console.error('[stripe] plans error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to load plans',
    })
  }
})

/**
 * POST /api/stripe/setup-intent
 * Create a SetupIntent so the client can collect a payment method and save it
 * for later (e.g. charge after trial). Returns { client_secret }.
 * Body (optional): { email } to create/link a Stripe Customer.
 */
router.post('/setup-intent', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  try {
    const { email } = req.body || {}
    let customerId
    if (email && typeof email === 'string' && email.trim()) {
      const customers = await stripe.customers.list({ email: email.trim(), limit: 1 })
      if (customers.data.length > 0) {
        customerId = customers.data[0].id
      } else {
        const customer = await stripe.customers.create({ email: email.trim() })
        customerId = customer.id
      }
    }
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      ...(customerId ? { customer: customerId } : {}),
    })
    return res.json({ client_secret: setupIntent.client_secret })
  } catch (err) {
    console.error('[stripe] setup-intent error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to create setup intent',
    })
  }
})

/**
 * POST /api/stripe/create-subscription
 * Creates a Stripe subscription. Standard plan gets 14-day trial; other plans charge immediately.
 * Requires auth (call after signUp with session).
 * Body: { email, price_id }. user_id from token.
 */
router.post('/create-subscription', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const { email, price_id } = req.body || {}
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'email is required' })
  }
  if (!price_id || typeof price_id !== 'string') {
    return res.status(400).json({ error: 'price_id is required' })
  }
  try {
    const customers = await stripe.customers.list({ email: email.trim(), limit: 1 })
    const customer = customers.data?.[0]
    if (!customer) {
      return res.status(400).json({ error: 'No payment method on file. Complete the payment step first.' })
    }
    const pms = await stripe.paymentMethods.list({ customer: customer.id, type: 'card' })
    const pm = pms.data?.[0]
    if (pm) {
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: pm.id },
      })
    }
    // 14-day trial only for Standard plan; other plans charge immediately
    let trialDays
    try {
      const price = await stripe.prices.retrieve(price_id, { expand: ['product'] })
      const product = price.product
      const productName = typeof product === 'object' && product?.name ? product.name : ''
      if (productName.toLowerCase() === 'standard') trialDays = 14
    } catch {
      // If we can't resolve the product, skip trial
    }
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price_id }],
      ...(trialDays ? { trial_period_days: trialDays } : {}),
      metadata: { user_id: userId },
    })
    const sub = subscription
    const status = sub.status === 'trialing' ? 'trialing' : sub.status
    if (supabase) {
      await supabase.from('subscriptions').upsert(
        {
          user_id: userId,
          stripe_customer_id: customer.id,
          stripe_subscription_id: sub.id,
          stripe_price_id: price_id,
          status,
          current_period_start: sub.current_period_start
            ? new Date(sub.current_period_start * 1000).toISOString()
            : null,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_subscription_id' }
      )
    }
    return res.json({ subscription_id: sub.id })
  } catch (err) {
    console.error('[stripe] create-subscription error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to create subscription',
    })
  }
})

/**
 * Webhook handler. Must be mounted with express.raw({ type: 'application/json' }) so body is raw.
 * Keeps public.subscriptions in sync with Stripe.
 */
async function handleWebhook(req, res) {
  if (!stripe || !webhookSecret) {
    return res.status(503).send('Webhook not configured')
  }
  const sig = req.headers['stripe-signature']
  if (!sig) return res.status(400).send('Missing Stripe-Signature')
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe] webhook signature verification failed:', err.message)
    return res.status(400).send('Invalid signature')
  }

  const subId = event.data?.object?.id
  const customerId = event.data?.object?.customer

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object
        if (!supabase) break
        const userId = sub.metadata?.user_id || null
        const row = {
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          stripe_price_id: sub.items?.data?.[0]?.price?.id || null,
          status: sub.status === 'trialing' ? 'trialing' : sub.status,
          current_period_start: sub.current_period_start
            ? new Date(sub.current_period_start * 1000).toISOString()
            : null,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }
        if (userId) row.user_id = userId
        await supabase.from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' })
        break
      }
      case 'customer.subscription.deleted': {
        if (supabase && subId) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subId)
        }
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subIdFromInvoice = invoice.subscription
        if (supabase && subIdFromInvoice) {
          const status = event.type === 'invoice.payment_failed' ? 'past_due' : 'active'
          await supabase
            .from('subscriptions')
            .update({
              status,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subIdFromInvoice)
        }
        break
      }
      default:
        // ignore other events
        break
    }
  } catch (err) {
    console.error('[stripe] webhook handler error:', err)
    return res.status(500).send('Webhook handler failed')
  }
  res.sendStatus(200)
}

router.handleWebhook = handleWebhook
module.exports = router
