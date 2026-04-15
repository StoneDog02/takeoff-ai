import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

/** Same rules as `create-subscription` / client `buildLineItems`. */
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

function encodeSubscriptionUpdate(items: { id?: string; deleted?: boolean; price?: string; quantity?: number }[]) {
  const p = new URLSearchParams()
  items.forEach((item, i) => {
    if (item.id) p.set(`items[${i}][id]`, item.id)
    if (item.deleted) p.set(`items[${i}][deleted]`, 'true')
    if (item.price) p.set(`items[${i}][price]`, item.price)
    if (item.quantity != null) p.set(`items[${i}][quantity]`, String(item.quantity))
  })
  p.set('proration_behavior', 'create_prorations')
  return p.toString()
}

type StripeSubRetrieve = {
  id?: string
  items?: { data?: { id: string }[] }
  error?: { message?: string }
  current_period_end?: number
  cancel_at_period_end?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')?.trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()

  if (!stripeSecret || !supabaseUrl || !supabaseServiceRole) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userRes, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !userRes.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: {
    userId?: string
    stripeSubscriptionId?: string
    tier?: PricingTier
    addons?: string[]
    employees?: number
    cancelAtPeriodEnd?: boolean
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const stripeSubscriptionId =
    typeof body.stripeSubscriptionId === 'string' ? body.stripeSubscriptionId.trim() : ''

  if (!userId || !isUuid(userId)) {
    return jsonResponse({ error: 'userId must be a valid UUID' }, 400)
  }
  if (userRes.user.id !== userId) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }
  if (!stripeSubscriptionId || !stripeSubscriptionId.startsWith('sub_')) {
    return jsonResponse({ error: 'stripeSubscriptionId must be a Stripe subscription id (sub_…)' }, 400)
  }

  const { data: row, error: rowErr } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id, user_id')
    .eq('user_id', userId)
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .maybeSingle()

  if (rowErr || !row) {
    return jsonResponse({ error: 'Subscription not found for this user' }, 404)
  }

  /** Schedule / undo cancel at period end (no tier/addons body). */
  if (typeof body.cancelAtPeriodEnd === 'boolean') {
    const form = new URLSearchParams()
    form.set('cancel_at_period_end', body.cancelAtPeriodEnd ? 'true' : 'false')

    const cancelRes = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    )
    const cancelJson = (await cancelRes.json()) as StripeSubRetrieve
    if (!cancelRes.ok) {
      const msg = cancelJson.error?.message || cancelRes.statusText || 'Stripe update failed'
      return jsonResponse({ error: msg }, 400)
    }

    const { error: upErr } = await supabaseAdmin
      .from('subscriptions')
      .update({
        cancel_at_period_end: !!cancelJson.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .eq('user_id', userId)

    if (upErr) {
      console.error('[update-subscription] DB update (cancel) failed:', upErr.message)
      return jsonResponse({ error: 'Failed to update subscription row' }, 500)
    }

    return jsonResponse({ success: true })
  }

  const tier = body.tier
  const addons = Array.isArray(body.addons) ? body.addons : null
  const employees = body.employees

  if (tier !== 'core' && tier !== 'plus' && tier !== 'pro') {
    return jsonResponse({ error: 'tier must be core, plus, or pro' }, 400)
  }
  if (!addons || typeof employees !== 'number' || !Number.isFinite(employees) || employees < 1) {
    return jsonResponse({ error: 'addons (array) and employees (number >= 1) are required' }, 400)
  }

  const sel: PricingSelection = { tier, addons, employees: Math.round(employees) }

  if (!tierPriceId(sel.tier)) {
    return jsonResponse({ error: 'Stripe price for the selected tier is not configured' }, 400)
  }

  const newItems = buildLineItems(sel)
  if (newItems.length === 0 || !newItems[0]?.price) {
    return jsonResponse({ error: 'No valid Stripe prices configured for this selection' }, 400)
  }

  const retrieveRes = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${stripeSecret}` },
    },
  )
  const existing = (await retrieveRes.json()) as StripeSubRetrieve
  if (!retrieveRes.ok) {
    const msg = existing.error?.message || retrieveRes.statusText || 'Stripe retrieve failed'
    return jsonResponse({ error: msg }, 400)
  }

  const existingItems = existing.items?.data ?? []
  const updatePayload: { id?: string; deleted?: boolean; price?: string; quantity?: number }[] = [
    ...existingItems.map((it) => ({ id: it.id, deleted: true as const })),
    ...newItems.map((li) => ({ price: li.price, quantity: li.quantity })),
  ]

  const formBody = encodeSubscriptionUpdate(updatePayload)

  const updateRes = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    },
  )
  const updated = (await updateRes.json()) as StripeSubRetrieve
  if (!updateRes.ok) {
    const msg = updated.error?.message || updateRes.statusText || 'Stripe update failed'
    return jsonResponse({ error: msg }, 400)
  }

  const primaryPriceId = newItems[0]?.price ?? null
  const periodEnd =
    updated.current_period_end != null
      ? new Date(updated.current_period_end * 1000).toISOString()
      : null

  const { error: upErr } = await supabaseAdmin
    .from('subscriptions')
    .update({
      tier: sel.tier,
      addons: sel.addons,
      employees: sel.employees,
      stripe_price_id: primaryPriceId,
      current_period_end: periodEnd,
      cancel_at_period_end: !!updated.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .eq('user_id', userId)

  if (upErr) {
    console.error('[update-subscription] DB update failed:', upErr.message)
    return jsonResponse({ error: 'Failed to update subscription row' }, 500)
  }

  return jsonResponse({ success: true })
})
