import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  items: LineItem[]
  trial_period_days: number
  payment_behavior: string
  save_default_payment_method: string
  expand: string[]
}): string {
  const p = new URLSearchParams()
  p.set('customer', opts.customer)
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

type StripeSubResponse = {
  id?: string
  trial_end?: number | null
  latest_invoice?: unknown
  error?: { message?: string; type?: string }
}

function getClientSecretFromSubscription(sub: StripeSubResponse): string | null {
  const inv = sub.latest_invoice
  if (!inv || typeof inv !== 'object' || inv === null) return null
  const pi = (inv as { payment_intent?: unknown }).payment_intent
  if (!pi || typeof pi !== 'object' || pi === null) return null
  const cs = (pi as { client_secret?: string | null }).client_secret
  return typeof cs === 'string' && cs ? cs : null
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
  if (!authHeader?.startsWith('Bearer ')) {
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
    return jsonResponse({ error: 'Unauthorized' }, 401)
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

  const formBody = encodeSubscriptionBody({
    customer: stripeCustomerId,
    items,
    trial_period_days: 30,
    payment_behavior: 'default_incomplete',
    save_default_payment_method: 'on_subscription',
    expand: ['latest_invoice.payment_intent'],
  })

  const stripeRes = await fetch('https://api.stripe.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
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

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: insertErr } = await supabaseAdmin.from('subscriptions').insert({
    user_id: userId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: primaryPriceId,
    tier: sel.tier,
    addons: sel.addons,
    employees: Math.round(sel.employees),
    status: 'trialing',
    trial_ends_at: trialEndsAt,
  })

  if (insertErr) {
    console.error('[create-subscription] DB insert failed:', insertErr.message)
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

  return jsonResponse({
    clientSecret,
    subscriptionId,
    trialEndsAt,
  })
})
