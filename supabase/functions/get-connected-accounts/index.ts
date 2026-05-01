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

type FcAccount = {
  id?: string
  institution_name?: string | null
  last4?: string | null
  status?: string | null
}

type FcList = {
  data?: FcAccount[]
  error?: { message?: string }
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

  const { data: ownsFc, error: ownFcErr } = await supabaseAdmin
    .from('user_financial_connections')
    .select('user_id')
    .eq('user_id', userRes.user.id)
    .eq('stripe_customer_id', stripeCustomerId)
    .limit(1)
    .maybeSingle()

  if (ownErr || ownFcErr || (!owns && !ownsFc)) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const params = new URLSearchParams()
  params.set('limit', '100')
  params.set('account_holder[type]', 'customer')
  params.set('account_holder[customer]', stripeCustomerId)

  const listRes = await fetch(`https://api.stripe.com/v1/financial_connections/accounts?${params}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${stripeSecret}` },
  })
  const listJson = (await listRes.json()) as FcList
  if (!listRes.ok) {
    const msg = listJson.error?.message || listRes.statusText || 'Failed to list linked accounts'
    return jsonResponse({ error: msg }, 400)
  }

  const accounts = (listJson.data ?? []).map((a) => ({
    id: a.id ?? '',
    institutionName: a.institution_name ?? null,
    last4: a.last4 ?? null,
    status: a.status ?? null,
  }))

  return jsonResponse({ accounts })
})
