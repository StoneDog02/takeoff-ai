/**
 * Stripe routes for signup/payment and webhooks.
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (for webhook). Optional: STRIPE_SIGNUP_PRODUCT_ID.
 * Referral discount on recurring invoices: STRIPE_REFERRAL_COUPON_ID (used by invoice.created handler).
 */
const express = require('express')
const router = express.Router()
const { requireAuth, getSupabaseForRequest } = require('../middleware/auth')
const { supabase } = require('../db/supabase')
const {
  syncStripeBankTransactionsForUser,
  findUserForFcAccount,
} = require('../lib/syncStripeBankTransactions')
const { buildBillingSummary } = require('../lib/billingSummary')
const {
  deriveSubscriptionPricingFromStripeSubscription,
  mapStripeSubscriptionStatus,
} = require('../lib/stripeSubscriptionDerive')

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

/** Stripe customer id from DB: Financial Connections row first, then latest subscriptions row. */
async function getStripeCustomerIdFromDb(userId) {
  if (!userId || !supabase) return null
  const { data: fc } = await supabase
    .from('user_financial_connections')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (fc?.stripe_customer_id) return fc.stripe_customer_id
  const { data: subRow } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .not('stripe_customer_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (subRow?.stripe_customer_id) return subRow.stripe_customer_id
  return null
}

async function getStripeCustomerIdForUser(req) {
  return getStripeCustomerIdFromDb(req.user?.id)
}

/**
 * Ensure the user has a Stripe customer id persisted on user_financial_connections (or reuse existing from DB).
 */
async function ensureStripeCustomerForBilling(userId, email) {
  if (!stripe || !userId || !email || typeof email !== 'string' || !email.trim()) return null
  const existing = await getStripeCustomerIdFromDb(userId)
  if (existing) return existing
  const customer = await getOrCreateStripeCustomerByEmail(email)
  if (!customer?.id) return null
  if (supabase) {
    const { data: row } = await supabase
      .from('user_financial_connections')
      .select('account_ids')
      .eq('user_id', userId)
      .maybeSingle()
    const accountIds = Array.isArray(row?.account_ids) ? row.account_ids : []
    await supabase.from('user_financial_connections').upsert(
      {
        user_id: userId,
        stripe_customer_id: customer.id,
        account_ids: accountIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  }
  return customer.id
}

/** Set default invoice PM from first card if missing; return whether a default exists. */
async function ensureCustomerHasDefaultPaymentMethod(customerId) {
  if (!stripe || !customerId) return false
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  })
  let dpm = customer.invoice_settings?.default_payment_method
  if (dpm && typeof dpm === 'object' && dpm.id) return true
  if (typeof dpm === 'string' && dpm.length > 0) return true
  const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 5 })
  const first = pms.data?.[0]
  if (first?.id) {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: first.id },
    })
    return true
  }
  return false
}

async function trialDaysForPriceId(priceId) {
  if (!stripe || !priceId) return undefined
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] })
    const product = price.product
    const productName = typeof product === 'object' && product?.name ? product.name : ''
    if (productName.toLowerCase() === 'standard') return 30
  } catch {
    // ignore
  }
  return undefined
}

function subscriptionRowForDb(userId, customerId, sub, priceId) {
  const status = sub.status === 'trialing' ? 'trialing' : sub.status
  return {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    status,
    current_period_start: sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString()
      : null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }
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

const fcTxSyncLimiter = createRateLimiter({
  name: 'stripe_fc_tx_sync',
  windowMs: 60 * 1000,
  max: 20,
  keyFn: (req) => (req.user?.id ? String(req.user.id) : ipKey(req)),
})

/**
 * POST /api/stripe/financial-connections-sync-transactions
 * Subscribes linked FC accounts to transaction updates, requests refresh, pulls transactions into bank_transactions.
 */
router.post(
  '/financial-connections-sync-transactions',
  requireAuth,
  fcTxSyncLimiter,
  async (req, res) => {
    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
      })
    }
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured on server.' })
    }
    const userId = req.user?.id
    const email = req.user?.email
    if (!userId || !email) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const mappedCustomerId = await getStripeCustomerIdForUser(req)
      const customer = mappedCustomerId
        ? await stripe.customers.retrieve(mappedCustomerId)
        : await getOrCreateStripeCustomerByEmail(email)
      if (!customer || typeof customer !== 'object' || !customer.id) {
        return res.status(500).json({ error: 'Could not resolve Stripe customer' })
      }
      const result = await syncStripeBankTransactionsForUser({
        stripe,
        supabase,
        userId,
        customerId: customer.id,
      })
      if (result.error) {
        return res.status(500).json({ error: result.error })
      }
      return res.json({ synced: result.synced, accounts: result.accounts })
    } catch (err) {
      console.error('[stripe] financial-connections-sync-transactions:', err.message)
      return res.status(500).json({
        error: err.message || 'Failed to sync bank transactions',
      })
    }
  }
)

const billingSetupIntentLimiter = createRateLimiter({
  name: 'stripe_billing_setup_intent',
  windowMs: 10 * 60 * 1000,
  max: 15,
  keyFn: (req) => (req.user?.id ? String(req.user.id) : ipKey(req)),
})

/**
 * POST /api/stripe/billing-setup-intent
 * Authenticated SetupIntent to add/replace a card on the user's Stripe customer.
 */
router.post('/billing-setup-intent', requireAuth, billingSetupIntentLimiter, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  const userId = req.user?.id
  const email = req.user?.email
  if (!userId || !email) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const customerId = await ensureStripeCustomerForBilling(userId, email)
    if (!customerId) return res.status(500).json({ error: 'Could not resolve billing customer' })
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      customer: customerId,
    })
    return res.json({ client_secret: setupIntent.client_secret })
  } catch (err) {
    console.error('[stripe] billing-setup-intent error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to create setup intent',
    })
  }
})

/**
 * POST /api/stripe/set-default-payment-method
 * Sets invoice default PM after client confirms SetupIntent (must belong to user's customer).
 */
router.post('/set-default-payment-method', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  const userId = req.user?.id
  const email = req.user?.email
  const { payment_method_id } = req.body || {}
  if (!userId || !email) return res.status(401).json({ error: 'Unauthorized' })
  if (!payment_method_id || typeof payment_method_id !== 'string') {
    return res.status(400).json({ error: 'payment_method_id is required' })
  }
  try {
    const customerId = await ensureStripeCustomerForBilling(userId, email)
    if (!customerId) return res.status(500).json({ error: 'Could not resolve billing customer' })
    const pm = await stripe.paymentMethods.retrieve(payment_method_id)
    if (pm.customer !== customerId) {
      return res.status(403).json({ error: 'Invalid payment method for this account' })
    }
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id },
    })
    return res.json({ ok: true })
  } catch (err) {
    console.error('[stripe] set-default-payment-method error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to update payment method',
    })
  }
})

/**
 * GET /api/stripe/payment-method
 * Default card on file for the signed-in user (if any).
 */
router.get('/payment-method', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  const userId = req.user?.id
  const email = req.user?.email?.trim()
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  try {
    let customerId = await getStripeCustomerIdFromDb(userId)
    if (!customerId && email) {
      const list = await stripe.customers.list({ email, limit: 1 })
      customerId = list.data?.[0]?.id ?? null
    }
    if (!customerId) return res.json({ payment_method: null })
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    })
    let pm = customer.invoice_settings?.default_payment_method
    if (typeof pm === 'string' && pm) pm = await stripe.paymentMethods.retrieve(pm)
    if (!pm || typeof pm === 'string') {
      const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 })
      pm = pms.data?.[0] ?? null
    }
    if (!pm || pm.type !== 'card' || !pm.card) return res.json({ payment_method: null })
    return res.json({
      payment_method: {
        id: pm.id,
        brand: pm.card.brand || 'card',
        last4: pm.card.last4 || '',
        exp_month: pm.card.exp_month ?? null,
        exp_year: pm.card.exp_year ?? null,
      },
    })
  } catch (err) {
    console.error('[stripe] payment-method error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to load payment method',
    })
  }
})

/**
 * GET /api/stripe/subscription-invoices
 * Paid/open subscription invoices for billing history UI.
 */
router.get('/subscription-invoices', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  const userId = req.user?.id
  const email = req.user?.email?.trim()
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  try {
    let customerId = await getStripeCustomerIdFromDb(userId)
    if (!customerId && email) {
      const list = await stripe.customers.list({ email, limit: 1 })
      customerId = list.data?.[0]?.id ?? null
    }
    if (!customerId) return res.json({ invoices: [] })
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 100 })
    const out = (invoices.data || [])
      .filter((inv) => inv.subscription != null && inv.status === 'paid')
      .map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount_paid: inv.amount_paid,
        currency: inv.currency,
        status: inv.status,
        created: inv.created,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
      }))
    return res.json({ invoices: out })
  } catch (err) {
    console.error('[stripe] subscription-invoices error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to load invoices',
    })
  }
})

/**
 * POST /api/stripe/subscribe-plan
 * New subscription or change existing plan (proration). Requires a card on file.
 * Body: { price_id }
 */
router.post('/subscribe-plan', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured on server.' })
  }
  const userId = req.user?.id
  const email = req.user?.email
  const { price_id } = req.body || {}
  if (!userId || !email) return res.status(401).json({ error: 'Unauthorized' })
  if (!price_id || typeof price_id !== 'string') {
    return res.status(400).json({ error: 'price_id is required' })
  }
  try {
    const customerId = await ensureStripeCustomerForBilling(userId, email)
    if (!customerId) return res.status(500).json({ error: 'Could not resolve billing customer' })
    const hasPm = await ensureCustomerHasDefaultPaymentMethod(customerId)
    if (!hasPm) {
      return res.status(400).json({
        error: 'Add a payment method before choosing a plan.',
        code: 'NO_PAYMENT_METHOD',
      })
    }
    const { data: subRows } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    const activeSub = subRows?.find(
      (s) =>
        ['active', 'trialing', 'past_due'].includes(s.status) && s.stripe_subscription_id
    )
    if (activeSub?.stripe_subscription_id) {
      const stripeSub = await stripe.subscriptions.retrieve(activeSub.stripe_subscription_id)
      const itemId = stripeSub.items?.data?.[0]?.id
      if (!itemId) return res.status(500).json({ error: 'Invalid subscription state' })
      const updated = await stripe.subscriptions.update(activeSub.stripe_subscription_id, {
        items: [{ id: itemId, price: price_id }],
        proration_behavior: 'create_prorations',
        metadata: { ...(stripeSub.metadata || {}), user_id: String(userId) },
      })
      await supabase.from('subscriptions').upsert(
        subscriptionRowForDb(userId, customerId, updated, price_id),
        { onConflict: 'stripe_subscription_id' }
      )
      return res.json({ subscription_id: updated.id, updated: true })
    }
    const trialDays = await trialDaysForPriceId(price_id)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price_id }],
      ...(trialDays ? { trial_period_days: trialDays } : {}),
      metadata: { user_id: userId },
    })
    await supabase.from('subscriptions').upsert(
      subscriptionRowForDb(userId, customerId, subscription, price_id),
      { onConflict: 'stripe_subscription_id' }
    )
    return res.json({ subscription_id: subscription.id, updated: false })
  } catch (err) {
    console.error('[stripe] subscribe-plan error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to update subscription',
    })
  }
})

/**
 * POST /api/stripe/create-subscription
 * Creates a Stripe subscription. Standard plan gets 30-day trial; other plans charge immediately.
 * Requires auth (call after signUp with session).
 * Body: { email, price_id }. user_id from token.
 */
router.post('/create-subscription', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.',
    })
  }
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured on server.' })
  }
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const { email, price_id } = req.body || {}
  const resolvedEmail =
    email && typeof email === 'string' && email.trim() ? email.trim() : req.user?.email
  if (!resolvedEmail) {
    return res.status(400).json({ error: 'email is required' })
  }
  if (!price_id || typeof price_id !== 'string') {
    return res.status(400).json({ error: 'price_id is required' })
  }
  try {
    const customerId = await ensureStripeCustomerForBilling(userId, resolvedEmail)
    if (!customerId) {
      return res.status(400).json({ error: 'Could not resolve Stripe customer. Complete the payment step first.' })
    }
    const hasPm = await ensureCustomerHasDefaultPaymentMethod(customerId)
    if (!hasPm) {
      return res.status(400).json({ error: 'No payment method on file. Complete the payment step first.' })
    }
    const trialDays = await trialDaysForPriceId(price_id)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price_id }],
      ...(trialDays ? { trial_period_days: trialDays } : {}),
      metadata: { user_id: userId },
    })
    const sub = subscription
    await supabase.from('subscriptions').upsert(
      subscriptionRowForDb(userId, customerId, sub, price_id),
      { onConflict: 'stripe_subscription_id' }
    )
    return res.json({ subscription_id: sub.id })
  } catch (err) {
    console.error('[stripe] create-subscription error:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to create subscription',
    })
  }
})

/**
 * GET /api/stripe/billing
 * Same payload as GET /api/settings/billing (alias for older clients).
 */
router.get('/billing', requireAuth, async (req, res) => {
  try {
    const summary = await buildBillingSummary(req.user.id, req.supabase)
    res.json(summary)
  } catch (err) {
    if (err.statusCode === 401) return res.status(401).json({ error: 'Unauthorized' })
    console.error('[stripe] billing error:', err.message)
    res.status(500).json({ error: err.message || 'Failed to load billing' })
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

function affiliateCommissionAccrualEnabled() {
  return process.env.AFFILIATE_COMMISSION_ENABLED !== 'false'
}

/**
 * Idempotent commission row per Stripe invoice (affiliate referrals only).
 * amount_paid is in the smallest currency unit; commission_rate is 0–1.
 */
async function recordAffiliateCommissionFromInvoice({
  invoice,
  affiliateId,
  referralId,
  refereeUserId,
  commissionRate,
}) {
  if (!affiliateCommissionAccrualEnabled() || !supabase) return
  const invoiceId = typeof invoice?.id === 'string' ? invoice.id : ''
  if (!invoiceId || !affiliateId || !referralId || !refereeUserId) return

  const amountPaid =
    typeof invoice.amount_paid === 'number' ? invoice.amount_paid : Number(invoice.amount_paid)
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) return

  const rate = Number(commissionRate)
  if (!Number.isFinite(rate) || rate <= 0) return

  const amountCents = Math.round(amountPaid * rate)
  if (amountCents <= 0) return

  const currency = typeof invoice.currency === 'string' ? invoice.currency.toLowerCase() : 'usd'

  const { error } = await supabase.from('affiliate_commission_events').insert({
    affiliate_id: affiliateId,
    referral_id: referralId,
    referee_user_id: refereeUserId,
    stripe_invoice_id: invoiceId,
    amount_cents: amountCents,
    currency,
    commission_rate: rate,
  })

  if (error && error.code !== '23505') {
    console.error('[stripe] affiliate commission insert failed:', error.message)
  }
}

/**
 * Award referral credits only after Stripe confirms a real subscription payment (renewal cycle).
 * Requires billing_reason === subscription_cycle; looks up user via public.subscriptions.stripe_customer_id.
 * Affiliate codes: accrue commission from invoice amount_paid × snapshot rate; referee credits only (no referrer user).
 * Renewals: repeat commission accrual for completed affiliate referrals (same invoice idempotency).
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

  const invoiceId = typeof invoice.id === 'string' ? invoice.id : null
  if (!invoiceId) return

  const { data: existingComm } = await supabase
    .from('affiliate_commission_events')
    .select('id')
    .eq('stripe_invoice_id', invoiceId)
    .maybeSingle()
  if (existingComm?.id) return

  const { data: pendingRows, error: qErr } = await supabase
    .from('referrals')
    .select('id, referrer_id, affiliate_id, affiliate_commission_rate')
    .eq('referee_id', refereeUserId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)

  if (qErr) {
    console.error('[stripe] invoice.payment_succeeded referral: referrals query failed:', qErr.message)
    return
  }
  const pendingRow = pendingRows?.[0]

  if (pendingRow?.id) {
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

    if (pendingRow.affiliate_id) {
      if (pendingRow.referrer_id) {
        console.warn('[stripe] referral row has both affiliate_id and referrer_id; skipping referral credits')
        return
      }
      await recordAffiliateCommissionFromInvoice({
        invoice,
        affiliateId: pendingRow.affiliate_id,
        referralId: pendingRow.id,
        refereeUserId,
        commissionRate: pendingRow.affiliate_commission_rate,
      })
      const { error: refeErr } = await supabase.rpc('increment_referral_credits', {
        p_user_id: refereeUserId,
      })
      if (refeErr) {
        console.error('[stripe] invoice.payment_succeeded referral: increment referee failed:', refeErr.message)
      }
      return
    }

    if (pendingRow.referrer_id) {
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
      return
    }

    console.warn('[stripe] pending referral missing referrer_id and affiliate_id:', pendingRow.id)
    return
  }

  const { data: completedAffRows, error: affQErr } = await supabase
    .from('referrals')
    .select('id, affiliate_id, affiliate_commission_rate')
    .eq('referee_id', refereeUserId)
    .eq('status', 'completed')
    .not('affiliate_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)

  if (affQErr) {
    console.error('[stripe] affiliate renewal commission: referrals query failed:', affQErr.message)
    return
  }

  const affRef = completedAffRows?.[0]
  if (affRef?.affiliate_id && affRef?.id) {
    await recordAffiliateCommissionFromInvoice({
      invoice,
      affiliateId: affRef.affiliate_id,
      referralId: affRef.id,
      refereeUserId,
      commissionRate: affRef.affiliate_commission_rate,
    })
  }
}

/**
 * Upsert subscriptions row from Stripe subscription object; sync tier/addons/employees from price IDs.
 * Clears profiles.trial_ending_soon when the subscription is no longer in an active trial window.
 */
async function syncSubscriptionRowFromStripeWebhook(sub) {
  if (!supabase || !sub?.id) return

  const derived = deriveSubscriptionPricingFromStripeSubscription(sub)
  const { data: existing, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('user_id, tier, addons, employees')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle()
  if (fetchErr) {
    console.error('[stripe] webhook subscription fetch:', fetchErr.message)
  }

  const userId = sub.metadata?.user_id || existing?.user_id
  const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id

  const firstPriceId =
    sub.items?.data?.[0]?.price && typeof sub.items.data[0].price === 'object'
      ? sub.items.data[0].price.id
      : null

  const row = {
    ...(userId ? { user_id: userId } : {}),
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: sub.id,
    stripe_price_id: derived.primaryTierPriceId || firstPriceId || null,
    status: mapStripeSubscriptionStatus(sub.status),
    current_period_start: sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString()
      : null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    trial_ends_at:
      sub.trial_end != null && sub.trial_end > 0
        ? new Date(sub.trial_end * 1000).toISOString()
        : null,
    tier: derived.tier != null ? derived.tier : existing?.tier ?? null,
    addons: derived.addons,
    employees: derived.employees != null ? derived.employees : (existing?.employees ?? 5),
    updated_at: new Date().toISOString(),
  }

  const { error: upErr } = await supabase.from('subscriptions').upsert(row, {
    onConflict: 'stripe_subscription_id',
  })
  if (upErr) {
    console.error('[stripe] webhook subscription upsert:', upErr.message)
    return
  }

  if (userId) {
    const nowSec = Math.floor(Date.now() / 1000)
    const trialOver = sub.trial_end != null && sub.trial_end > 0 && sub.trial_end <= nowSec
    if (sub.status !== 'trialing' || trialOver) {
      await supabase
        .from('profiles')
        .update({ trial_ending_soon: false, updated_at: new Date().toISOString() })
        .eq('id', userId)
    }
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

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await syncSubscriptionRowFromStripeWebhook(event.data.object)
        break
      }
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object
        if (!supabase || !sub?.id) break
        const { data: row } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        if (row?.user_id) {
          await supabase
            .from('profiles')
            .update({ trial_ending_soon: true, updated_at: new Date().toISOString() })
            .eq('id', row.user_id)
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const delId = sub?.id
        if (supabase && delId) {
          const { data: prior } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', delId)
            .maybeSingle()
          const canceledAt =
            sub.canceled_at != null && sub.canceled_at > 0
              ? new Date(sub.canceled_at * 1000).toISOString()
              : new Date().toISOString()
          await supabase
            .from('subscriptions')
            .update({
              status: 'canceled',
              canceled_at: canceledAt,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', delId)
          if (prior?.user_id) {
            await supabase
              .from('profiles')
              .update({ trial_ending_soon: false, updated_at: new Date().toISOString() })
              .eq('id', prior.user_id)
          }
        }
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        const subIdFromInvoice =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id
        if (supabase && subIdFromInvoice) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subIdFromInvoice)
          const { data: subRow } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subIdFromInvoice)
            .maybeSingle()
          if (subRow?.user_id) {
            await supabase
              .from('profiles')
              .update({ payment_failed: false, updated_at: new Date().toISOString() })
              .eq('id', subRow.user_id)
          }
        }
        // Referral credits: idempotent if both events fire; gated inside by billing_reason === subscription_cycle
        await handleInvoicePaymentSucceededReferralCredits(event)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subIdFromInvoice =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id
        if (supabase && subIdFromInvoice) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subIdFromInvoice)
          const { data: subRow } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subIdFromInvoice)
            .maybeSingle()
          if (subRow?.user_id) {
            await supabase
              .from('profiles')
              .update({ payment_failed: true, updated_at: new Date().toISOString() })
              .eq('id', subRow.user_id)
          }
        }
        break
      }
      case 'invoice.created': {
        await handleInvoiceCreatedReferral(event)
        break
      }
      case 'checkout.session.completed': {
        const session = event.data?.object
        const meta = session?.metadata || {}
        if (meta.buildos_client_invoice === '1' && meta.invoice_id && supabase) {
          const now = new Date().toISOString()
          const { error: invPayErr } = await supabase
            .from('invoices')
            .update({ status: 'paid', paid_at: now, updated_at: now })
            .eq('id', meta.invoice_id)
          if (invPayErr) {
            console.error('[stripe] checkout.session.completed invoice update:', invPayErr.message)
          }
        }
        break
      }
      case 'financial_connections.account.refreshed_transactions': {
        const accountObj = event.data?.object
        const fcAccountId = accountObj?.id
        if (supabase && stripe && fcAccountId) {
          try {
            const mapping = await findUserForFcAccount(supabase, fcAccountId)
            if (mapping) {
              await syncStripeBankTransactionsForUser({
                stripe,
                supabase,
                userId: mapping.userId,
                customerId: mapping.customerId,
                onlyAccountId: fcAccountId,
              })
            }
          } catch (e) {
            console.error('[stripe] webhook refreshed_transactions:', e?.message || e)
          }
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
