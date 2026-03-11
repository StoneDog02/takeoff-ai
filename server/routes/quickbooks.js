const express = require('express')
const crypto = require('crypto')
const { supabase: defaultSupabase } = require('../db/supabase')
const { requireAuth } = require('../middleware/auth')
const OAuthClient = require('intuit-oauth')

const router = express.Router()

const QB_SCOPES = [
  'com.intuit.quickbooks.accounting',
  'com.intuit.quickbooks.payment',
  'com.intuit.quickbooks.payroll',
]
const STATE_SECRET = process.env.QUICKBOOKS_STATE_SECRET || process.env.SUPABASE_JWT_SECRET || 'quickbooks-state-secret'

function getRedirectUri(req) {
  if (process.env.QUICKBOOKS_REDIRECT_URI) return process.env.QUICKBOOKS_REDIRECT_URI
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http'
  const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${process.env.PORT || 3001}`
  return `${protocol}://${host}/api/quickbooks/callback`
}

function signState(userId) {
  const payload = Buffer.from(userId, 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(userId).digest('base64url')
  return `${payload}.${sig}`
}

function verifyState(state) {
  if (!state || typeof state !== 'string') return null
  const [payload, sig] = state.split('.')
  if (!payload || !sig) return null
  try {
    const userId = Buffer.from(payload, 'base64url').toString('utf8')
    const expected = crypto.createHmac('sha256', STATE_SECRET).update(userId).digest('base64url')
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return userId
  } catch (_) {}
  return null
}

function getOAuthClient(redirectUri) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return new OAuthClient({
    clientId,
    clientSecret,
    environment: process.env.QUICKBOOKS_ENV === 'production' ? 'production' : 'sandbox',
    redirectUri,
  })
}

/** GET /api/quickbooks/connect — redirect to Intuit OAuth (requires auth). Use connect-url + client redirect when token is only in fetch headers. */
router.get('/connect', requireAuth, (req, res, next) => {
  try {
    const redirectUri = getRedirectUri(req)
    const oauthClient = getOAuthClient(redirectUri)
    if (!oauthClient) {
      return res.status(503).json({ error: 'QuickBooks integration not configured' })
    }
    const state = signState(req.user.id)
    const authUri = oauthClient.authorizeUri({ scope: QB_SCOPES, state })
    res.redirect(authUri)
  } catch (err) {
    next(err)
  }
})

/** GET /api/quickbooks/connect-url — return Intuit auth URL as JSON (for client to redirect with auth header) */
router.get('/connect-url', requireAuth, (req, res, next) => {
  try {
    const redirectUri = getRedirectUri(req)
    const oauthClient = getOAuthClient(redirectUri)
    if (!oauthClient) {
      return res.status(503).json({ error: 'QuickBooks integration not configured' })
    }
    const state = signState(req.user.id)
    const authUri = oauthClient.authorizeUri({ scope: QB_SCOPES, state })
    res.json({ url: authUri })
  } catch (err) {
    next(err)
  }
})

/** GET /api/quickbooks/callback — Intuit redirects here with code & realmId (no auth; state carries userId) */
router.get('/callback', async (req, res, next) => {
  try {
    const { code, realmId, state } = req.query
    const userId = verifyState(state)
    if (!userId || !code || !realmId) {
      return res.redirect(
        (process.env.VITE_APP_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:5173') +
          '?quickbooks=error&message=' +
          encodeURIComponent('Invalid or missing callback parameters')
      )
    }
    const redirectUri = getRedirectUri(req)
    const oauthClient = getOAuthClient(redirectUri)
    if (!oauthClient) {
      return res.redirect(
        (process.env.VITE_APP_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:5173') +
          '?quickbooks=error&message=' +
          encodeURIComponent('QuickBooks not configured')
      )
    }
    const tokenResponse = await oauthClient.createToken(req.url)
    const token = tokenResponse.getToken ? tokenResponse.getToken() : tokenResponse.getJson()
    if (!token || !token.access_token || !token.refresh_token) {
      return res.redirect(
        (process.env.VITE_APP_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:5173') +
          '?quickbooks=error&message=' +
          encodeURIComponent('Failed to get tokens')
      )
    }
    const db = defaultSupabase
    if (!db) {
      return res.redirect(
        (process.env.VITE_APP_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:5173') +
          '?quickbooks=error&message=' +
          encodeURIComponent('Database not configured')
      )
    }
    const expiresIn = token.expires_in != null ? Number(token.expires_in) : 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const row = {
      user_id: userId,
      integration_id: 'quickbooks',
      connected: true,
      config: {
        realmId: String(realmId),
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: expiresAt,
      },
      updated_at: new Date().toISOString(),
    }
    const { error } = await db
      .from('integration_connections')
      .upsert(row, { onConflict: 'user_id,integration_id' })
    if (error) {
      return res.redirect(
        (process.env.VITE_APP_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:5173') +
          '?quickbooks=error&message=' +
          encodeURIComponent('Failed to save connection')
      )
    }
    const successUrl =
      (process.env.VITE_APP_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:5173') +
      '/settings?quickbooks=connected'
    res.redirect(successUrl)
  } catch (err) {
    next(err)
  }
})

/** Load QuickBooks connection for user; refresh token if expired. Returns { realmId, accessToken } or null. */
async function getValidTokens(db, userId) {
  const { data: row, error } = await db
    .from('integration_connections')
    .select('config')
    .eq('user_id', userId)
    .eq('integration_id', 'quickbooks')
    .eq('connected', true)
    .maybeSingle()
  if (error || !row?.config?.realmId) return null
  const { realmId, access_token, refresh_token, expires_at } = row.config
  const now = new Date()
  const expiresAt = expires_at ? new Date(expires_at) : null
  if (expiresAt && expiresAt <= new Date(now.getTime() + 60 * 1000)) {
    const redirectUri =
      process.env.QUICKBOOKS_REDIRECT_URI ||
      `http://localhost:${process.env.PORT || 3001}/api/quickbooks/callback`
    const oauthClient = getOAuthClient(redirectUri)
    if (!oauthClient) return null
    try {
      const refreshResponse = await oauthClient.refreshUsingToken(refresh_token)
      const token = refreshResponse.getToken ? refreshResponse.getToken() : refreshResponse
      const newExpiresIn = token.expires_in != null ? Number(token.expires_in) : 3600
      const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000).toISOString()
      await db
        .from('integration_connections')
        .update({
          config: {
            ...row.config,
            access_token: token.access_token,
            refresh_token: token.refresh_token || refresh_token,
            expires_at: newExpiresAt,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('integration_id', 'quickbooks')
      return { realmId, accessToken: token.access_token }
    } catch (_) {
      return null
    }
  }
  return { realmId, accessToken: access_token }
}

/** GET /api/quickbooks/company — company info */
router.get('/company', requireAuth, async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const tokens = await getValidTokens(db, req.user.id)
    if (!tokens) return res.status(403).json({ error: 'QuickBooks not connected' })
    const baseUrl =
      process.env.QUICKBOOKS_ENV === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com'
    const r = await fetch(`${baseUrl}/v3/company/${tokens.realmId}/companyinfo/${tokens.realmId}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    if (!r.ok) {
      const text = await r.text()
      return res.status(r.status).json({ error: text || 'QuickBooks API error' })
    }
    const data = await r.json()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/** GET /api/quickbooks/invoices — list invoices */
router.get('/invoices', requireAuth, async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const tokens = await getValidTokens(db, req.user.id)
    if (!tokens) return res.status(403).json({ error: 'QuickBooks not connected' })
    const baseUrl =
      process.env.QUICKBOOKS_ENV === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com'
    const query = req.query.query || "select * from Invoice order by MetaData.CreateTime desc maxresults 50"
    const r = await fetch(
      `${baseUrl}/v3/company/${tokens.realmId}/query?query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
    )
    if (!r.ok) {
      const text = await r.text()
      return res.status(r.status).json({ error: text || 'QuickBooks API error' })
    }
    const data = await r.json()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/** GET /api/quickbooks/purchases — purchases (expenses) */
router.get('/purchases', requireAuth, async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const tokens = await getValidTokens(db, req.user.id)
    if (!tokens) return res.status(403).json({ error: 'QuickBooks not connected' })
    const baseUrl =
      process.env.QUICKBOOKS_ENV === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com'
    const query =
      req.query.query ||
      'select * from Purchase order by TxnDate desc maxresults 50'
    const r = await fetch(
      `${baseUrl}/v3/company/${tokens.realmId}/query?query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
    )
    if (!r.ok) {
      const text = await r.text()
      return res.status(r.status).json({ error: text || 'QuickBooks API error' })
    }
    const data = await r.json()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/** GET /api/quickbooks/expenses — BillPayment / Expense (simplified; use purchases for Purchase) */
router.get('/expenses', requireAuth, async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const tokens = await getValidTokens(db, req.user.id)
    if (!tokens) return res.status(403).json({ error: 'QuickBooks not connected' })
    const baseUrl =
      process.env.QUICKBOOKS_ENV === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com'
    const query =
      req.query.query ||
      "select * from Purchase where Type='Expense' order by TxnDate desc maxresults 50"
    const r = await fetch(
      `${baseUrl}/v3/company/${tokens.realmId}/query?query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
    )
    if (!r.ok) {
      const text = await r.text()
      return res.status(r.status).json({ error: text || 'QuickBooks API error' })
    }
    const data = await r.json()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ─── Payments API (different base URL) ─────────────────────────────────────
function getPaymentsBaseUrl() {
  return process.env.QUICKBOOKS_ENV === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

/** POST /api/quickbooks/payments/charges — create a charge (token from client tokenization) */
router.post('/payments/charges', requireAuth, async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const tokens = await getValidTokens(db, req.user.id)
    if (!tokens) return res.status(403).json({ error: 'QuickBooks not connected' })
    const baseUrl = getPaymentsBaseUrl()
    const url = `${baseUrl}/quickbooks/v4/payments/charges`
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        'Request-Id': requestId,
      },
      body: JSON.stringify(body),
    })
    const text = await r.text()
    let data
    try {
      data = text ? JSON.parse(text) : {}
    } catch (_) {
      data = { error: text || 'Unknown error' }
    }
    if (!r.ok) {
      return res.status(r.status).json({ error: data.error || data.message || text || 'Payments API error' })
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ─── Payroll API (stub until Intuit grants access) ─────────────────────────
/** GET /api/quickbooks/payroll/status — whether payroll API is available */
router.get('/payroll/status', requireAuth, async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const tokens = await getValidTokens(db, req.user.id)
    if (!tokens) return res.status(403).json({ error: 'QuickBooks not connected' })
    res.json({ enabled: false, message: 'Payroll API access requires Intuit onboarding. Use QuickBooks to correct payroll until then.' })
  } catch (err) {
    next(err)
  }
})

/** GET /api/quickbooks/payroll/corrections — stub: list correction requests (empty until API enabled) */
router.get('/payroll/corrections', requireAuth, async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const tokens = await getValidTokens(db, req.user.id)
    if (!tokens) return res.status(403).json({ error: 'QuickBooks not connected' })
    res.json({ corrections: [], message: 'Payroll API not yet enabled. Complete Intuit onboarding to list and submit corrections here.' })
  } catch (err) {
    next(err)
  }
})

/** POST /api/quickbooks/payroll/corrections — stub: submit correction (returns 501 until API enabled) */
router.post('/payroll/corrections', requireAuth, async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const tokens = await getValidTokens(db, req.user.id)
    if (!tokens) return res.status(403).json({ error: 'QuickBooks not connected' })
    res.status(501).json({ error: 'Payroll corrections API not yet enabled. Open QuickBooks to submit payroll corrections, or complete Intuit Payroll API onboarding.' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
