import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  })
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function randomUpperAlnum(length: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

function buildReferralCode(email: string | null | undefined) {
  const prefixRaw = (email ?? '').split('@')[0] ?? ''
  const alnum = prefixRaw.replace(/[^a-z0-9]/gi, '')
  let base = (alnum.length > 0 ? alnum : 'USER').slice(0, 6).toUpperCase()
  if (base.length === 0) base = 'USER'
  return `${base}${randomUpperAlnum(4)}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const token = getBearerToken(req)
  if (!token) return jsonResponse({ error: 'Unauthorized' }, 401)

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  const user = userData?.user
  if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('referral_codes')
    .select('code')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) return jsonResponse({ error: 'Failed to load referral code' }, 500)
  if (existing?.code) return jsonResponse({ code: existing.code }, 200)

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = buildReferralCode(user.email)

    const { error: insertError } = await supabaseAdmin
      .from('referral_codes')
      .insert({ user_id: user.id, code })

    if (!insertError) return jsonResponse({ code }, 200)

    // Unique violation (either user already has one, or code collision): retry.
    const pgCode = (insertError as { code?: string } | null)?.code
    if (pgCode === '23505') continue

    return jsonResponse({ error: 'Failed to create referral code' }, 500)
  }

  return jsonResponse({ error: 'Failed to create referral code' }, 500)
})
