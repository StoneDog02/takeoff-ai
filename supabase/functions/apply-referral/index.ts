import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
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

type ApplyBody = {
  code?: string
  referee_id?: string
  referee_email?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: ApplyBody
  try {
    body = (await req.json()) as ApplyBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const codeRaw = typeof body.code === 'string' ? body.code.trim() : ''
  const refereeId = typeof body.referee_id === 'string' ? body.referee_id.trim() : undefined
  const refereeEmail =
    typeof body.referee_email === 'string' ? body.referee_email.trim().toLowerCase() : undefined

  if (!codeRaw) {
    return jsonResponse({ error: 'code is required' }, 400)
  }
  if (!refereeId && !refereeEmail) {
    return jsonResponse({ error: 'At least one of referee_id or referee_email is required' }, 400)
  }

  const { data: codeRow, error: codeError } = await supabaseAdmin
    .from('referral_codes')
    .select('user_id')
    .ilike('code', codeRaw)
    .maybeSingle()

  if (codeError) return jsonResponse({ error: 'Failed to look up referral code' }, 500)
  if (!codeRow?.user_id) return jsonResponse({ error: 'Referral code not found' }, 404)

  const referrerId = codeRow.user_id as string

  if (refereeId && refereeId === referrerId) {
    return jsonResponse({ error: 'cannot refer yourself' }, 400)
  }

  if (refereeId) {
    const nowIso = new Date().toISOString()

    /** Link email invite row → account when signup email matches the invited address. */
    const { data: authUserRes, error: authLookupErr } = await supabaseAdmin.auth.admin.getUserById(refereeId)
    if (authLookupErr) {
      console.warn('[apply-referral] getUserById:', authLookupErr.message)
    }
    const emailFromAuth = authUserRes?.user?.email?.toLowerCase()?.trim()
    if (emailFromAuth) {
      const { data: pendingEmailRow, error: pendingErr } = await supabaseAdmin
        .from('referrals')
        .select('id')
        .eq('referrer_id', referrerId)
        .eq('referee_email', emailFromAuth)
        .is('referee_id', null)
        .maybeSingle()

      if (pendingErr) return jsonResponse({ error: 'Failed to check existing referral' }, 500)
      if (pendingEmailRow?.id) {
        const { error: mergeErr } = await supabaseAdmin
          .from('referrals')
          .update({
            referee_id: refereeId,
            signed_up_at: nowIso,
          })
          .eq('id', pendingEmailRow.id)

        if (mergeErr) return jsonResponse({ error: 'Failed to update referral' }, 500)
        return jsonResponse({
          success: true,
          message: 'Referral linked to your account.',
        })
      }
    }

    const { data: existingByReferee, error: existingErr } = await supabaseAdmin
      .from('referrals')
      .select('id, status')
      .eq('referrer_id', referrerId)
      .eq('referee_id', refereeId)
      .maybeSingle()

    if (existingErr) return jsonResponse({ error: 'Failed to check existing referral' }, 500)

    if (existingByReferee) {
      if (existingByReferee.status === 'completed') {
        return jsonResponse({ error: 'already referred' }, 409)
      }
      return jsonResponse({
        success: true,
        message: 'Referral already recorded as pending.',
      })
    }

    const { data: anyRefForReferee, error: anyRefErr } = await supabaseAdmin
      .from('referrals')
      .select('id, referrer_id')
      .eq('referee_id', refereeId)
      .maybeSingle()

    if (anyRefErr) return jsonResponse({ error: 'Failed to check existing referral' }, 500)
    if (anyRefForReferee && anyRefForReferee.referrer_id !== referrerId) {
      return jsonResponse({ error: 'already referred' }, 409)
    }

    const { error: insertErr } = await supabaseAdmin.from('referrals').insert({
      referrer_id: referrerId,
      referee_id: refereeId,
      referee_email: refereeEmail ?? null,
      code: codeRaw,
      status: 'pending',
      completed_at: null,
      signed_up_at: nowIso,
    })

    if (insertErr) return jsonResponse({ error: 'Failed to create referral' }, 500)

    return jsonResponse({
      success: true,
      message: 'Referral recorded; credits apply after your first paid subscription cycle.',
    })
  }

  const { data: dupEmail, error: dupErr } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('referrer_id', referrerId)
    .eq('referee_email', refereeEmail!)
    .maybeSingle()

  if (dupErr) return jsonResponse({ error: 'Failed to check existing referral' }, 500)
  if (dupEmail) {
    return jsonResponse({ error: 'A referral for this email already exists' }, 409)
  }

  const { error: insertPendingErr } = await supabaseAdmin.from('referrals').insert({
    referrer_id: referrerId,
    referee_id: null,
    referee_email: refereeEmail!,
    code: codeRaw,
    status: 'pending',
    completed_at: null,
  })

  if (insertPendingErr) return jsonResponse({ error: 'Failed to create referral' }, 500)

  return jsonResponse({
    success: true,
    message: 'Referral recorded; pending until signup and first paid cycle.',
  })
})
