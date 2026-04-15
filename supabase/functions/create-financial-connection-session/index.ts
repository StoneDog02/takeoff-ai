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

type SessionResponse = {
  client_secret?: string
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

  if (ownErr || !owns) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const form = new URLSearchParams()
  form.set('account_holder[type]', 'customer')
  form.set('account_holder[customer]', stripeCustomerId)
  form.append('permissions[]', 'balances')
  form.append('permissions[]', 'transactions')
  form.append('filters[countries][]', 'US')

  const sessionRes = await fetch('https://api.stripe.com/v1/financial_connections/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })
  const session = (await sessionRes.json()) as SessionResponse
  if (!sessionRes.ok) {
    const msg = session.error?.message || sessionRes.statusText || 'Failed to create FC session'
    return jsonResponse({ error: msg }, 400)
  }
  if (!session.client_secret) {
    return jsonResponse({ error: 'Stripe did not return a client secret' }, 500)
  }

  return jsonResponse({ clientSecret: session.client_secret })
})
