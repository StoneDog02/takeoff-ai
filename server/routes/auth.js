/**
 * Public auth helpers for signup flow (no auth required).
 * GET /api/auth/check-email?email=... — check if an account with this email already exists.
 * POST /api/auth/verify-recaptcha — verify reCAPTCHA v3 token (body: { token }). Returns { ok }.
 */
const express = require('express')
const router = express.Router()
const { supabase } = require('../db/supabase')

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || process.env.RECAPTCHA_SECRET
const RECAPTCHA_MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5', 10) || 0.5
const RECAPTCHA_ACTION = 'signup'

const PER_PAGE = 500
const MAX_PAGES = 20

router.get('/check-email', async (req, res) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim() : ''
  if (!email) {
    return res.status(400).json({ error: 'Email is required', exists: false })
  }
  if (!supabase) {
    return res.status(503).json({ error: 'Service unavailable', exists: false })
  }
  try {
    let page = 1
    while (page <= MAX_PAGES) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      })
      if (error) {
        console.error('[auth] check-email listUsers error:', error.message)
        return res.status(500).json({ error: error.message, exists: false })
      }
      const users = data?.users ?? []
      const normalized = email.toLowerCase()
      const found = users.some((u) => (u.email || '').toLowerCase() === normalized)
      if (found) return res.json({ exists: true })
      if (users.length < PER_PAGE) return res.json({ exists: false })
      page++
    }
    return res.json({ exists: false })
  } catch (err) {
    console.error('[auth] check-email error:', err)
    return res.status(500).json({ error: err.message || 'Server error', exists: false })
  }
})

/**
 * POST /api/auth/verify-recaptcha
 * Body: { token: string } — reCAPTCHA v3 token from the client.
 * Returns: { ok: true } or { ok: false, error?: string }.
 * Used before signup to ensure the request is from a human.
 */
router.post('/verify-recaptcha', express.json(), async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  if (!token) {
    return res.status(400).json({ ok: false, error: 'Token is required' })
  }
  if (!RECAPTCHA_SECRET) {
    console.warn('[auth] RECAPTCHA_SECRET_KEY not set; skipping reCAPTCHA verification')
    return res.json({ ok: true })
  }
  try {
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET,
      response: token,
    })
    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await verifyRes.json().catch(() => ({}))
    const success = data.success === true
    const score = typeof data.score === 'number' ? data.score : 0
    const action = data.action || ''
    if (!success) {
      const codes = data['error-codes'] || []
      console.warn('[auth] reCAPTCHA verify failed:', codes)
      return res.json({ ok: false, error: 'Verification failed. Please try again.' })
    }
    if (action !== RECAPTCHA_ACTION) {
      return res.json({ ok: false, error: 'Invalid action. Please try again.' })
    }
    if (score < RECAPTCHA_MIN_SCORE) {
      console.warn('[auth] reCAPTCHA score too low:', score)
      return res.json({ ok: false, error: 'Verification failed. Please try again.' })
    }
    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth] verify-recaptcha error:', err)
    return res.status(500).json({ ok: false, error: 'Verification failed. Please try again.' })
  }
})

module.exports = router
