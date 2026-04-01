const crypto = require('crypto')
const { supabase: defaultSupabase } = require('../db/supabase')
const { closeStaleTimeEntries } = require('../lib/closeStaleTimeEntries')

function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

function getExpectedSecret() {
  return (process.env.CRON_SECRET || process.env.STALE_TIME_ENTRIES_CRON_SECRET || '').trim()
}

/**
 * GET or POST /api/cron/close-stale-time-entries
 * Auth: Authorization: Bearer <CRON_SECRET>, header x-cron-secret, or query ?secret=
 */
async function handleCloseStaleTimeEntries(req, res) {
  const expected = getExpectedSecret()
  if (!expected) {
    return res.status(503).json({ error: 'CRON_SECRET is not configured' })
  }

  const authHeader = (req.get('authorization') || '').trim()
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
  const headerSecret = (req.get('x-cron-secret') || '').trim()
  const querySecret = typeof req.query?.secret === 'string' ? req.query.secret.trim() : ''

  const provided = bearer || headerSecret || querySecret
  if (!provided || !timingSafeEqualString(provided, expected)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!defaultSupabase) {
    return res.status(503).json({ error: 'Database not configured' })
  }

  try {
    const result = await closeStaleTimeEntries(defaultSupabase)
    res.set('Cache-Control', 'no-store')
    res.json({
      ok: true,
      closed: result.closed,
      entry_ids: result.ids,
      max_hours:
        Number(process.env.STALE_TIME_ENTRY_MAX_HOURS) > 0
          ? Number(process.env.STALE_TIME_ENTRY_MAX_HOURS)
          : 16,
    })
  } catch (err) {
    console.error('[cron] close-stale-time-entries', err)
    res.status(500).json({ error: err.message || 'Cron job failed' })
  }
}

module.exports = { handleCloseStaleTimeEntries }
