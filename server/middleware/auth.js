const { createClient } = require('@supabase/supabase-js')
const { supabase: defaultSupabase } = require('../db/supabase')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

function isUuidLike(s) {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
  )
}

/** True when API should use employee-scoped data (real employee session or owner/admin acting as a roster employee). */
function isEmployeePortalRequest(req) {
  if (req.actingAsEmployee && req.employee) return true
  if (req.profile?.role === 'employee' && req.employee) return true
  return false
}

/**
 * Returns a Supabase client using the request's Bearer token so RLS applies.
 * Otherwise returns null.
 */
function getSupabaseForRequest(req) {
  if (!supabaseUrl || !supabaseAnonKey) return null
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

/**
 * Middleware: require auth for /api/takeoff and /api/build-lists.
 * Sets req.supabase (user-scoped client) and req.user when valid token present; otherwise sends 401.
 */
async function requireAuth(req, res, next) {
  const supabase = getSupabaseForRequest(req)
  if (!supabase) {
    const hasUrl = !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)
    const hasKey = !!(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)
    const hasToken = !!req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
    console.warn('[auth] 401: supabase client not ready', { hasUrl, hasKey, hasToken })
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      console.warn('[auth] 401: getUser failed', error?.message || 'no user')
      return res.status(401).json({ error: 'Unauthorized' })
    }
    req.supabase = supabase
    req.user = user
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    req.profile = profile || null
    req.actingAsEmployee = false
    req.employee = null
    if (profile?.role === 'employee') {
      const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      req.employee = employee || null
    } else {
      const actAsHeader = req.headers['x-act-as-employee-id'] || req.headers['X-Act-As-Employee-Id']
      const raw = Array.isArray(actAsHeader) ? actAsHeader[0] : actAsHeader
      const actAsId = typeof raw === 'string' ? raw.trim() : ''
      if (actAsId && isUuidLike(actAsId) && defaultSupabase) {
        const { data: actEmp, error: actErr } = await defaultSupabase
          .from('employees')
          .select('*')
          .eq('id', actAsId)
          .maybeSingle()
        if (!actErr && actEmp) {
          const canAct = profile?.role === 'admin' || actEmp.user_id === user.id
          if (canAct) {
            req.employee = actEmp
            req.actingAsEmployee = true
          }
        }
      }
    }
    next()
  } catch (err) {
    console.warn('[auth] 401: exception', err?.message || err)
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

module.exports = { getSupabaseForRequest, requireAuth, isEmployeePortalRequest }
