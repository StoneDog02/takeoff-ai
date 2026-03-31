/**
 * Stripe routes for signup/payment and webhooks.
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (for webhook). Optional: STRIPE_SIGNUP_PRODUCT_ID.
 * Referral discount on recurring invoices: STRIPE_REFERRAL_COUPON_ID (used by invoice.created handler).
 */
const express = require('express')
const router = express.Router()
const { requireAuth, getSupabaseForRequest } = require('../middleware/auth')
const { supabase } = require('../db/supabase')

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const signupProductId = process.env.STRIPE_SIGNUP_PRODUCT_ID
let stripe = null
if (stripeSecretKey) {
  stripe = require('stripe')(stripeSecretKey)
}

function createRateLimiter({ name, windowMs, max, keyFn }) {
  const buckets = new Map()
  function cleanup(now) {
    // Light cleanup; keep memory bounded
    if (buckets.size < 5000) return
    for (const [k, v] of buckets.entries()) {
      if (now - v.resetAt > windowMs * 2) buckets.delete(k)
    }
  }
  return (req, res, next) => {
    const now = Date.now()
    cleanup(now)
    const key = `${name}:${keyFn(req)}`
    const cur = buckets.get(key)
    if (!cur || now > cur.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      res.set('X-RateLimit-Limit', String(max))
      res.set('X-RateLimit-Remaining', String(max - 1))
      res.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)))
      return next()
    }
    if (cur.count >= max) {
      res.set('Retry-After', String(Math.ceil((cur.resetAt - now) / 1000)))
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' })
    }
    cur.count += 1
    buckets.set(key, cur)
    res.set('X-RateLimit-Limit', String(max))
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - cur.count)))
    res.set('X-RateLimit-Reset', String(Math.ceil(cur.resetAt / 1000)))
    next()
  }
}

function ipKey(req) {
  const ip = (req.ip || '').toString()
  return ip || 'unknown'
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
const setupIntentLimiter = createRateLimiter({
  name: 'stripe_setup_intent',
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyFn: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    return `${ipKey(req)}:${email || '-'}`
  },
})

router.post('/setup-intent', setupIntentLimiter, async (req, res) => {
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

async function getOrCreateStripeCustomerByEmail(email) {
  const trimmed = typeof email === 'string' ? email.trim() : ''
  if (!trimmed || !stripe) return null
  const existing = await stripe.customers.list({ email: trimmed, limit: 1 })
  if (existing.data?.length) return existing.data[0]
  return stripe.customers.create({ email: trimmed })
}

async function getStripeCustomerIdForUser(req) {
  const userId = req.user?.id
  if (!userId) return null
  // Prefer DB mapping when present (prevents any email-based ambiguity)
  if (supabase) {
    const { data } = await supabase
      .from('user_financial_connections')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (data?.stripe_customer_id) return data.stripe_customer_id
  }
  return null
}

/**
 * POST /api/stripe/financial-connections-session
 * Starts Financial Connections for the Stripe Customer tied to the user's email.
 * Auth: optional Bearer (preferred in app); otherwise body { email } for signup before account exists.
 * Returns { client_secret } for stripe.collectFinancialConnectionsAccounts on the client.
 */
const fcSessionLimiter = createRateLimiter({
  name: 'stripe_fc_session',
  windowMs: 10 * 60 * 1000,
  max: 12,
  keyFn: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    return `${ipKey(req)}:${email || '-'}`
  },
})

router.post('/financial-connections-session', fcSessionLimiter, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  // If authenticated, prefer the user_id→customer_id mapping (or fall back to user email)
  let stripeCustomerId = null
  let email
  const sb = getSupabaseForRequest(req)
  if (sb) {
    try {
      const {
        data: { user },
      } = await sb.auth.getUser()
      if (user?.id) req.user = user
      if (user?.email) email = user.email
    } catch {
      // fall through
    }
  }
  if (req.user?.id) {
    try {
      stripeCustomerId = await getStripeCustomerIdForUser(req)
    } catch {
      stripeCustomerId = null
    }
  }
  if (!stripeCustomerId && !email) {
    const raw = req.body?.email
    if (typeof raw === 'string' && raw.includes('@')) email = raw.trim()
  }
  if (!stripeCustomerId && !email) return res.status(400).json({ error: 'email is required' })
  try {
    const customer =
      stripeCustomerId
        ? await stripe.customers.retrieve(stripeCustomerId)
        : await getOrCreateStripeCustomerByEmail(email)
    if (!customer || typeof customer !== 'object' || !customer.id) return res.status(500).json({ error: 'Could not resolve Stripe customer' })
    const session = await stripe.financialConnections.sessions.create({
      account_holder: {
        type: 'customer',
        customer: customer.id,
      },
      permissions: ['transactions'],
      filters: { countries: ['US'] },
    })
    return res.json({
      client_secret: session.client_secret,
      stripe_customer_id: customer.id,
    })
  } catch (err) {
    console.error('[stripe] financial-connections-session error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to start bank linking',
    })
  }
})

function mapFcAccount(a) {
  return {
    id: a.id,
    display_name: a.display_name || null,
    institution_name: a.institution_name || null,
    last4: a.last4 || null,
    status: a.status || null,
    category: a.category || null,
  }
}

/**
 * POST /api/stripe/financial-connections-sync
 * Lists Financial Connections accounts on the user's Stripe customer and saves IDs to Supabase.
 */
router.post('/financial-connections-sync', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  const userId = req.user?.id
  const email = req.user?.email
  if (!userId || !email) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const mappedCustomerId = await getStripeCustomerIdForUser(req)
    const customer =
      mappedCustomerId
        ? await stripe.customers.retrieve(mappedCustomerId)
        : await getOrCreateStripeCustomerByEmail(email)
    if (!customer || typeof customer !== 'object' || !customer.id) return res.status(500).json({ error: 'Could not resolve Stripe customer' })
    const list = await stripe.financialConnections.accounts.list({
      account_holder: { customer: customer.id },
      limit: 100,
    })
    const ids = list.data.map((a) => a.id)
    if (supabase) {
      const { error: upErr } = await supabase.from('user_financial_connections').upsert(
        {
          user_id: userId,
          stripe_customer_id: customer.id,
          account_ids: ids,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (upErr) console.error('[stripe] financial-connections-sync upsert:', upErr.message)
    } else {
      // If the server isn't configured with a service role key, we can still return the Stripe list
      // but we can't persist it to the database.
    }
    return res.json({ accounts: list.data.map(mapFcAccount) })
  } catch (err) {
    console.error('[stripe] financial-connections-sync error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to sync bank links',
    })
  }
})

/**
 * GET /api/stripe/financial-connections-status
 * Read-only: linked accounts from Stripe for the signed-in user's customer (no DB write).
 */
router.get('/financial-connections-status', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  const email = req.user?.email
  if (!email) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const mappedCustomerId = await getStripeCustomerIdForUser(req)
    const customer =
      mappedCustomerId
        ? await stripe.customers.retrieve(mappedCustomerId)
        : (await stripe.customers.list({ email: email.trim(), limit: 1 })).data?.[0]
    if (!customer || typeof customer !== 'object' || !customer.id) return res.json({ stripe_customer_id: null, accounts: [] })
    const list = await stripe.financialConnections.accounts.list({
      account_holder: { customer: customer.id },
      limit: 100,
    })
    return res.json({
      stripe_customer_id: customer.id,
      accounts: list.data.map(mapFcAccount),
    })
  } catch (err) {
    console.error('[stripe] financial-connections-status error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to load bank links',
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
 * invoice.created — apply referral discount when the user has a stored credit.
 * Skips subscription_create (first invoice, including trial start) so no discount is applied before real billing.
 * Resolves the app user via public.subscriptions.stripe_customer_id (set at checkout / subscription webhooks).
 */
async function handleInvoiceCreatedReferral(event) {
  if (!supabase || !stripe) return
  const invoice = event.data?.object
  if (!invoice || typeof invoice.id !== 'string') return

  const reason = invoice.billing_reason
  if (reason === 'subscription_create') return
  if (reason !== 'subscription_cycle' && reason !== 'subscription_update') return

  const rawCustomer = invoice.customer
  const customerId = typeof rawCustomer === 'string' ? rawCustomer : rawCustomer?.id
  if (!customerId) return

  const { data: subRow, error: subErr } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .limit(1)
    .maybeSingle()

  if (subErr) {
    console.error('[stripe] invoice.created referral: subscriptions lookup failed:', subErr.message)
    return
  }
  const userId = subRow?.user_id
  if (!userId) return

  const { data: balanceRaw, error: consumeErr } = await supabase.rpc('consume_referral_credit', {
    p_user_id: userId,
  })
  if (consumeErr) {
    console.error('[stripe] invoice.created referral: consume_referral_credit failed:', consumeErr.message)
    return
  }
  if (balanceRaw === null || balanceRaw === undefined) return
  const balance = typeof balanceRaw === 'number' ? balanceRaw : Number(balanceRaw)
  if (Number.isNaN(balance) || balance === -1) return

  const couponId = (process.env.STRIPE_REFERRAL_COUPON_ID || '').trim()
  if (!couponId) {
    console.error('[stripe] invoice.created referral: STRIPE_REFERRAL_COUPON_ID missing; refunding credit')
    await supabase.rpc('increment_referral_credits', { p_user_id: userId })
    return
  }

  try {
    await stripe.invoices.update(invoice.id, {
      discounts: [{ coupon: couponId }],
    })
  } catch (err) {
    console.error('[stripe] invoice.created referral: invoices.update failed:', err.message)
    await supabase.rpc('increment_referral_credits', { p_user_id: userId })
  }
}

/**
 * Award referral credits only after Stripe confirms a real subscription payment (renewal cycle).
 * Requires billing_reason === subscription_cycle; looks up user via public.subscriptions.stripe_customer_id.
 */
async function handleInvoicePaymentSucceededReferralCredits(event) {
  if (!supabase) return
  const invoice = event.data?.object
  if (!invoice || invoice.billing_reason !== 'subscription_cycle') return

  const rawCustomer = invoice.customer
  const customerId = typeof rawCustomer === 'string' ? rawCustomer : rawCustomer?.id
  if (!customerId) return

  const { data: subRow, error: subErr } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .limit(1)
    .maybeSingle()

  if (subErr) {
    console.error('[stripe] invoice.payment_succeeded referral: subscriptions lookup failed:', subErr.message)
    return
  }
  const refereeUserId = subRow?.user_id
  if (!refereeUserId) return

  const { data: pendingRows, error: qErr } = await supabase
    .from('referrals')
    .select('id, referrer_id')
    .eq('referee_id', refereeUserId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)

  if (qErr) {
    console.error('[stripe] invoice.payment_succeeded referral: referrals query failed:', qErr.message)
    return
  }
  const pendingRow = pendingRows?.[0]
  if (!pendingRow?.id || !pendingRow.referrer_id) return

  const { error: updErr } = await supabase
    .from('referrals')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', pendingRow.id)

  if (updErr) {
    console.error('[stripe] invoice.payment_succeeded referral: update failed:', updErr.message)
    return
  }

  const { error: refErr } = await supabase.rpc('increment_referral_credits', {
    p_user_id: pendingRow.referrer_id,
  })
  if (refErr) {
    console.error('[stripe] invoice.payment_succeeded referral: increment referrer failed:', refErr.message)
    return
  }
  const { error: refeErr } = await supabase.rpc('increment_referral_credits', {
    p_user_id: refereeUserId,
  })
  if (refeErr) {
    console.error('[stripe] invoice.payment_succeeded referral: increment referee failed:', refeErr.message)
  }
}

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
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        const subIdFromInvoice = invoice.subscription
        if (supabase && subIdFromInvoice) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subIdFromInvoice)
        }
        // Referral credits: idempotent if both events fire; gated inside by billing_reason === subscription_cycle
        await handleInvoicePaymentSucceededReferralCredits(event)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subIdFromInvoice = invoice.subscription
        if (supabase && subIdFromInvoice) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subIdFromInvoice)
        }
        break
      }
      case 'invoice.created': {
        await handleInvoiceCreatedReferral(event)
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
