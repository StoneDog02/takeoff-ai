const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

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
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    req.supabase = supabase
    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

module.exports = { getSupabaseForRequest, requireAuth }
