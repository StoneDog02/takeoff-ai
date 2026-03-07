/**
 * Middleware: require admin role (profiles.role === 'admin').
 * Must run after requireAuth. Uses req.supabase to read current user's profile.
 */
async function requireAdmin(req, res, next) {
  if (!req.user || !req.supabase) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const { data: profile, error } = await req.supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .maybeSingle()
    if (error || !profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden' })
  }
}

module.exports = { requireAdmin }
