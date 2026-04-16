import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Stripe Price IDs (set in Supabase Edge secrets). Mirror your VITE_STRIPE_PRICE_* values from `.env`.
 * Prefer STRIPE_PRICE_* names here (no VITE_ prefix). Falls back to VITE_STRIPE_PRICE_* if set.
 */
function priceId(core: string): string {
  const direct = Deno.env.get(`STRIPE_PRICE_${core}`)?.trim()
  if (direct) return direct
  return Deno.env.get(`VITE_STRIPE_PRICE_${core}`)?.trim() ?? ''
}

const PRICE_IDS = {
  core: () => priceId('CORE'),
  plus: () => priceId('PLUS'),
  pro: () => priceId('PRO'),
  estimating: () => priceId('ESTIMATING'),
  portals: () => priceId('PORTALS'),
  aiTakeoff: () => priceId('AI_TAKEOFF'),
  financials: () => priceId('FINANCIALS'),
  fieldPayrollBase: () => priceId('FIELD_PAYROLL_BASE'),
  fieldPayrollPerEmp: () => priceId('FIELD_PAYROLL_PER_EMP'),
  docs: () => priceId('DOCS'),
  directory: () => priceId('DIRECTORY'),
} as const

type PricingTier = 'core' | 'plus' | 'pro'

type PricingSelection = {
  tier: PricingTier
  addons: string[]
  employees: number
}

type LineItem = { price: string; quantity: number }

function tierPriceId(tier: PricingTier): string {
  switch (tier) {
    case 'core':
      return PRICE_IDS.core()
    case 'plus':
      return PRICE_IDS.plus()
    case 'pro':
      return PRICE_IDS.pro()
  }
}

function hasFieldPayrollAddon(addons: string[]): boolean {
  return addons.includes('fieldpayroll') || addons.includes('field-ops')
}

/** Same rules as client `src/lib/stripeProducts.ts` `buildLineItems`. */
function buildLineItems(pricingSelection: PricingSelection): LineItem[] {
  const { tier, addons, employees } = pricingSelection
  const set = new Set(addons)
  const items: LineItem[] = []

  const tid = tierPriceId(tier)
  if (tid) items.push({ price: tid, quantity: 1 })

  const est = PRICE_IDS.estimating()
  if (set.has('estimating') && tier === 'core' && est) {
    items.push({ price: est, quantity: 1 })
  }

  const port = PRICE_IDS.portals()
  if (set.has('portals') && (tier === 'core' || tier === 'plus') && port) {
    items.push({ price: port, quantity: 1 })
  }

  const ai = PRICE_IDS.aiTakeoff()
  if (set.has('ai-takeoff') && ai) items.push({ price: ai, quantity: 1 })

  const fin = PRICE_IDS.financials()
  if (set.has('financial') && fin) items.push({ price: fin, quantity: 1 })

  if (hasFieldPayrollAddon(addons)) {
    const fb = PRICE_IDS.fieldPayrollBase()
    if (fb) items.push({ price: fb, quantity: 1 })
    const overQty = Math.max(0, employees - 5)
    const fe = PRICE_IDS.fieldPayrollPerEmp()
    if (overQty > 0 && fe) items.push({ price: fe, quantity: overQty })
  }

  const docs = PRICE_IDS.docs()
  if ((set.has('vault') || set.has('docs')) && docs) items.push({ price: docs, quantity: 1 })

  const dir = PRICE_IDS.directory()
  if (set.has('directory') && dir) items.push({ price: dir, quantity: 1 })

  return items
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

function encodeSubscriptionBody(opts: {
  customer: string
  userId: string
  items: LineItem[]
  trial_period_days: number
  payment_behavior: string
  save_default_payment_method: string
  expand: string[]
  /** Persisted on the Stripe subscription so webhooks can restore tier/addons if server env price IDs are missing. */
  metadataExtra?: Record<string, string>
}): string {
  const p = new URLSearchParams()
  p.set('customer', opts.customer)
  p.set('metadata[user_id]', opts.userId)
  if (opts.metadataExtra) {
    for (const [k, v] of Object.entries(opts.metadataExtra)) {
      if (!k || !v) continue
      p.set(`metadata[${k}]`, v)
    }
  }
  opts.items.forEach((item, i) => {
    p.set(`items[${i}][price]`, item.price)
    p.set(`items[${i}][quantity]`, String(item.quantity))
  })
  p.set('trial_period_days', String(opts.trial_period_days))
  p.set('payment_behavior', opts.payment_behavior)
  p.set('payment_settings[save_default_payment_method]', opts.save_default_payment_method)
  for (const ex of opts.expand) {
    p.append('expand[]', ex)
  }
  return p.toString()
}

/** After SetupIntent, the card is attached but may not be the invoice default — Stripe often requires this for subscriptions. */
async function ensureDefaultCardPaymentMethod(
  stripeSecret: string,
  customerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const listRes = await fetch(
    `https://api.stripe.com/v1/payment_methods?customer=${encodeURIComponent(customerId)}&type=card&limit=10`,
    { headers: { Authorization: `Bearer ${stripeSecret}` } },
  )
  const listJson = (await listRes.json()) as {
    data?: { id: string }[]
    error?: { message?: string }
  }
  if (!listRes.ok) {
    const msg = listJson.error?.message || 'Could not list payment methods'
    return { ok: false, message: msg }
  }
  const pmId = listJson.data?.[0]?.id
  if (!pmId) {
    return {
      ok: false,
      message: 'No card on file for this customer. Complete the payment step again.',
    }
  }
  const up = new URLSearchParams()
  up.set('invoice_settings[default_payment_method]', pmId)
  const upRes = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: up.toString(),
  })
  const upJson = (await upRes.json()) as { error?: { message?: string } }
  if (!upRes.ok) {
    return { ok: false, message: upJson.error?.message || 'Could not set default payment method' }
  }
  return { ok: true }
}

type StripeSubResponse = {
  id?: string
  status?: string
  trial_end?: number | null
  latest_invoice?: unknown
  error?: { message?: string; type?: string }
}

function normalizeDbSubscriptionStatus(st: string | undefined): string {
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
  if (st && allowed.has(st)) return st
  return 'trialing'
}

function getClientSecretFromSubscription(sub: StripeSubResponse): string | null {
  const inv = sub.latest_invoice
  if (!inv || typeof inv !== 'object' || inv === null) return null
  const pi = (inv as { payment_intent?: unknown }).payment_intent
  if (!pi || typeof pi !== 'object' || pi === null) return null
  const cs = (pi as { client_secret?: string | null }).client_secret
  return typeof cs === 'string' && cs ? cs : null
}

/** If Stripe already has a non-canceled sub for this user, sync DB and return JSON. Otherwise null. */
async function tryRespondWithExistingStripeSubscription(opts: {
  supabaseAdmin: SupabaseClient
  stripeSecret: string
  stripeCustomerId: string
  userId: string
  sel: PricingSelection
  items: LineItem[]
}): Promise<Response | null> {
  const { supabaseAdmin, stripeSecret, stripeCustomerId, userId, sel, items } = opts

  const listExistingRes = await fetch(
    `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=all&limit=30`,
    { headers: { Authorization: `Bearer ${stripeSecret}` } },
  )
  const listExistingJson = (await listExistingRes.json()) as {
    data?: Array<{ id?: string; status?: string; metadata?: Record<string, string>; created?: number }>
  }
  if (!listExistingRes.ok || !Array.isArray(listExistingJson.data)) return null

  const subsForUser = listExistingJson.data.filter(
    (s) =>
      s?.id &&
      s?.metadata?.user_id === userId &&
      s?.status &&
      !['canceled', 'incomplete_expired'].includes(s.status),
  )
  if (subsForUser.length === 0) return null

  subsForUser.sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
  const keep = subsForUser[0]!
  for (const dup of subsForUser.slice(1)) {
    if (!dup.id) continue
    try {
      await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(dup.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${stripeSecret}` },
      })
    } catch {
      /* ignore */
    }
  }
  const getExisting = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(keep.id!)}?expand[]=latest_invoice.payment_intent`,
    { headers: { Authorization: `Bearer ${stripeSecret}` } },
  )
  const existingSub = (await getExisting.json()) as StripeSubResponse
  if (!getExisting.ok || !existingSub.id) {
    return jsonResponse({ error: 'Could not load existing subscription' }, 500)
  }
  const trialEndsAt =
    existingSub.trial_end != null && existingSub.trial_end > 0
      ? new Date(existingSub.trial_end * 1000).toISOString()
      : null
  const primaryPriceId = items[0]?.price ?? null
  const rowStatus = normalizeDbSubscriptionStatus(existingSub.status)

  const { error: upErr } = await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: existingSub.id,
      stripe_price_id: primaryPriceId,
      tier: sel.tier,
      addons: sel.addons,
      employees: Math.round(sel.employees),
      status: rowStatus,
      trial_ends_at: trialEndsAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' },
  )
  if (upErr) {
    console.error('[create-subscription] idempotent upsert:', upErr.message)
    return jsonResponse({ error: 'Could not save subscription state' }, 500)
  }

  return jsonResponse({
    clientSecret: getClientSecretFromSubscription(existingSub),
    subscriptionId: existingSub.id,
    trialEndsAt,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')?.trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()

  if (!stripeSecret || !supabaseUrl || !supabaseAnon || !supabaseServiceRole) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ') || authHeader.length <= 'Bearer '.length) {
    return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401)
  }

  let body: {
    userId?: string
    stripeCustomerId?: string
    pricingSelection?: PricingSelection
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const stripeCustomerId =
    typeof body.stripeCustomerId === 'string' ? body.stripeCustomerId.trim() : ''
  const sel = body.pricingSelection

  if (!userId || !isUuid(userId)) {
    return jsonResponse({ error: 'userId must be a valid UUID' }, 400)
  }
  if (!stripeCustomerId || !stripeCustomerId.startsWith('cus_')) {
    return jsonResponse({ error: 'stripeCustomerId must be a Stripe customer id (cus_…)' }, 400)
  }
  if (
    !sel ||
    typeof sel !== 'object' ||
    (sel.tier !== 'core' && sel.tier !== 'plus' && sel.tier !== 'pro') ||
    !Array.isArray(sel.addons) ||
    typeof sel.employees !== 'number' ||
    !Number.isFinite(sel.employees) ||
    sel.employees < 1
  ) {
    return jsonResponse(
      {
        error:
          'pricingSelection must include tier (core|plus|pro), addons (string[]), and employees (number >= 1)',
      },
      400,
    )
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser()
  if (userErr || !userData.user) {
    console.error('[create-subscription] auth.getUser failed:', userErr?.message ?? userErr)
    return jsonResponse(
      {
        error:
          'Session could not be validated. Sign in again, or verify Edge secrets SUPABASE_URL and SUPABASE_ANON_KEY for this Supabase project.',
      },
      401,
    )
  }
  if (userData.user.id !== userId) {
    return jsonResponse({ error: 'userId does not match authenticated user' }, 403)
  }

  if (!tierPriceId(sel.tier)) {
    return jsonResponse({ error: 'Stripe price for the selected tier is not configured' }, 400)
  }

  const items = buildLineItems(sel)
  if (items.length === 0 || !items[0]?.price) {
    return jsonResponse({ error: 'No valid Stripe prices configured for this selection' }, 400)
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: lockErr } = await supabaseAdmin
    .from('initial_subscription_create_lock')
    .insert({ user_id: userId })
  let ownsCreateLock = false

  if (lockErr?.code === '23505') {
    const deadline = Date.now() + 28000
    while (Date.now() < deadline) {
      const waiterResp = await tryRespondWithExistingStripeSubscription({
        supabaseAdmin,
        stripeSecret,
        stripeCustomerId,
        userId,
        sel,
        items,
      })
      if (waiterResp) return waiterResp
      await new Promise((r) => setTimeout(r, 450))
    }
    return jsonResponse(
      {
        error:
          'Subscription setup is still in progress. Wait a few seconds and refresh, or sign in again.',
      },
      409,
    )
  }
  if (lockErr) {
    console.error('[create-subscription] lock insert:', lockErr.message)
    return jsonResponse({ error: 'Could not start subscription setup' }, 500)
  }
  ownsCreateLock = true

  const existingResp = await tryRespondWithExistingStripeSubscription({
    supabaseAdmin,
    stripeSecret,
    stripeCustomerId,
    userId,
    sel,
    items,
  })
  if (existingResp) return existingResp

  let persistedOk = false
  try {
    const pmOk = await ensureDefaultCardPaymentMethod(stripeSecret, stripeCustomerId)
    if (!pmOk.ok) {
      return jsonResponse({ error: pmOk.message }, 400)
    }

    const formBody = encodeSubscriptionBody({
      customer: stripeCustomerId,
      userId,
      items,
      trial_period_days: 30,
      payment_behavior: 'default_incomplete',
      save_default_payment_method: 'on_subscription',
      expand: ['latest_invoice.payment_intent'],
      metadataExtra: {
        takeoff_tier: sel.tier,
        takeoff_addons: JSON.stringify(sel.addons),
        takeoff_employees: String(Math.round(sel.employees)),
      },
    })

    // Same key for this user → Stripe coalesces concurrent POSTs into one subscription.
    const idempotencyKey = `takeoff-initial-sub-${userId}`.slice(0, 255)

    const stripeRes = await fetch('https://api.stripe.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body: formBody,
    })

    const sub = (await stripeRes.json()) as StripeSubResponse

    if (!stripeRes.ok) {
      const msg = sub.error?.message || stripeRes.statusText || 'Stripe request failed'
      return jsonResponse({ error: msg }, 400)
    }

    const subscriptionId = sub.id
    if (!subscriptionId) {
      return jsonResponse({ error: 'Stripe did not return a subscription id' }, 400)
    }

    const trialEndsAt =
      sub.trial_end != null && sub.trial_end > 0
        ? new Date(sub.trial_end * 1000).toISOString()
        : null

    const primaryPriceId = items[0]?.price ?? null

    const { error: upsertNewErr } = await supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: primaryPriceId,
        tier: sel.tier,
        addons: sel.addons,
        employees: Math.round(sel.employees),
        status: 'trialing',
        trial_ends_at: trialEndsAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' },
    )

    if (upsertNewErr) {
      console.error('[create-subscription] DB upsert failed:', upsertNewErr.message)
      try {
        await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${stripeSecret}` },
        })
      } catch (e) {
        console.error('[create-subscription] Stripe cancel failed:', e)
      }
      return jsonResponse({ error: 'Failed to save subscription; subscription was canceled.' }, 500)
    }

    const clientSecret = getClientSecretFromSubscription(sub)

    persistedOk = true
    return jsonResponse({
      clientSecret,
      subscriptionId,
      trialEndsAt,
    })
  } finally {
    if (ownsCreateLock && !persistedOk) {
      const { error: delLockErr } = await supabaseAdmin
        .from('initial_subscription_create_lock')
        .delete()
        .eq('user_id', userId)
      if (delLockErr) {
        console.warn('[create-subscription] lock release:', delLockErr.message)
      }
    }
  }
})
