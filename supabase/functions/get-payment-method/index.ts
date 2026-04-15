import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

type StripeCardLike = {
  brand?: string | null
  last4?: string | null
  exp_month?: number | null
  exp_year?: number | null
}

type StripePm = {
  type?: string
  card?: StripeCardLike
}

type StripeCustomer = {
  id?: string
  error?: { message?: string }
  default_source?: unknown
  invoice_settings?: {
    default_payment_method?: string | StripePm | null
  }
}

function cardFromPaymentMethod(pm: StripePm | null | undefined): StripeCardLike | null {
  if (!pm || pm.type !== 'card' || !pm.card) return null
  return pm.card
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

  let body: { stripeCustomerId?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const stripeCustomerId =
    typeof body.stripeCustomerId === 'string' ? body.stripeCustomerId.trim() : ''
  if (!stripeCustomerId || !stripeCustomerId.startsWith('cus_')) {
    return jsonResponse({ error: 'stripeCustomerId must be a Stripe customer id (cus_…)' }, 400)
  }

  const { data: owns, error: ownErr } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userRes.user.id)
    .eq('stripe_customer_id', stripeCustomerId)
    .limit(1)
    .maybeSingle()

  if (ownErr || !owns) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const params = new URLSearchParams()
  params.append('expand[]', 'default_source')
  params.append('expand[]', 'invoice_settings.default_payment_method')

  const custRes = await fetch(
    `https://api.stripe.com/v1/customers/${encodeURIComponent(stripeCustomerId)}?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${stripeSecret}` },
    },
  )
  const customer = (await custRes.json()) as StripeCustomer
  if (!custRes.ok) {
    const msg = customer.error?.message || custRes.statusText || 'Stripe customer retrieve failed'
    return jsonResponse({ error: msg }, 400)
  }

  let pm: StripePm | null = null
  const def = customer.invoice_settings?.default_payment_method
  if (typeof def === 'object' && def !== null && 'object' in def && (def as { object?: string }).object === 'payment_method') {
    pm = def as StripePm
  }

  if (!pm?.card && customer.default_source && typeof customer.default_source === 'object') {
    const src = customer.default_source as { object?: string; brand?: string; last4?: string; exp_month?: number; exp_year?: number }
    if (src.object === 'card') {
      return jsonResponse({
        brand: src.brand ?? null,
        last4: src.last4 ?? null,
        expMonth: src.exp_month ?? null,
        expYear: src.exp_year ?? null,
      })
    }
  }

  let card = cardFromPaymentMethod(pm)

  if (!card) {
    const listRes = await fetch(
      `https://api.stripe.com/v1/payment_methods?customer=${encodeURIComponent(
        stripeCustomerId,
      )}&type=card&limit=1`,
      { headers: { Authorization: `Bearer ${stripeSecret}` } },
    )
    const listJson = (await listRes.json()) as { data?: StripePm[] }
    const first = listJson.data?.[0]
    card = cardFromPaymentMethod(first ?? null)
  }

  if (!card) {
    return new Response(JSON.stringify(null), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  return jsonResponse({
    brand: card.brand ?? null,
    last4: card.last4 ?? null,
    expMonth: card.exp_month ?? null,
    expYear: card.exp_year ?? null,
  })
})
