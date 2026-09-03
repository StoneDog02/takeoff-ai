/**
 * In-memory rate limits for public token portals (estimate / invoice / bid).
 * Keys by IP + token so shared NATs don't lock unrelated documents.
 */

const DEFAULT_WINDOW_MS = 60 * 60 * 1000
/** GET + viewed (and similar reads) per IP+token per hour */
const DEFAULT_READ_MAX = 120
/** approve / decline / respond / etc. per IP+token per hour */
const DEFAULT_ACTION_MAX = 30

/**
 * @param {{ label: string, readMax?: number, actionMax?: number, windowMs?: number }} opts
 */
function createPortalRateLimit(opts) {
  const label = opts.label || 'portal'
  const readMax = opts.readMax ?? DEFAULT_READ_MAX
  const actionMax = opts.actionMax ?? DEFAULT_ACTION_MAX
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS
  const rateMap = new Map()

  setInterval(() => {
    const now = Date.now()
    for (const [key, v] of rateMap.entries()) {
      if (v.resetAt < now) rateMap.delete(key)
    }
  }, 60 * 1000).unref?.()

  function clientIp(req) {
    return req.ip || req.socket?.remoteAddress || 'unknown'
  }

  function allow(key, max) {
    const now = Date.now()
    const r = rateMap.get(key)
    if (!r || r.resetAt < now) {
      rateMap.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }
    r.count += 1
    return r.count <= max
  }

  function deny(req, res, kind) {
    const ip = clientIp(req)
    console.warn(`[${label}] rate limited`, { ip, path: req.originalUrl || req.path, kind })
    return res.status(429).json({ error: 'Too many requests. Try again later.' })
  }

  function rateLimitRead(req, res, next) {
    const ip = clientIp(req)
    const token = req.params.token || 'unknown'
    if (!allow(`read:${ip}:${token}`, readMax)) return deny(req, res, 'read')
    next()
  }

  function rateLimitAction(req, res, next) {
    const ip = clientIp(req)
    const token = req.params.token || 'unknown'
    if (!allow(`action:${ip}:${token}`, actionMax)) return deny(req, res, 'action')
    next()
  }

  return { rateLimitRead, rateLimitAction }
}

module.exports = {
  createPortalRateLimit,
  DEFAULT_READ_MAX,
  DEFAULT_ACTION_MAX,
  DEFAULT_WINDOW_MS,
}
