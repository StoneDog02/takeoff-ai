const express = require('express')
const crypto = require('crypto')
const { supabase: supabaseAdmin } = require('../db/supabase')

const router = express.Router()

const INVITE_EXPIRY_DAYS = 7

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * GET /api/invites/validate/:token - Public validation of invite token (no auth).
 * Returns { valid, email?, expires_at? } for the accept-invite page.
 */
router.get('/validate/:token', async (req, res, next) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database not configured' })
    const { data: invite, error } = await supabaseAdmin
      .from('employee_invites')
      .select('email, expires_at, used_at')
      .eq('token', req.params.token)
      .maybeSingle()
    if (error) throw error
    if (!invite || invite.used_at) {
      return res.json({ valid: false })
    }
    const now = new Date()
    const expiresAt = new Date(invite.expires_at)
    if (expiresAt < now) {
      return res.json({ valid: false, email: invite.email, expires_at: invite.expires_at })
    }
    res.json({ valid: true, email: invite.email, expires_at: invite.expires_at })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/invites/accept - Accept invite: create auth user and link to employee (no auth).
 * Body: { token, password }
 */
router.post('/accept', async (req, res, next) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database not configured' })
    const { token, password } = req.body || {}
    if (!token || !password || password.length < 6) {
      return res.status(400).json({ error: 'token and password (min 6 characters) required' })
    }
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from('employee_invites')
      .select('id, employee_id, email, expires_at, used_at')
      .eq('token', token)
      .maybeSingle()
    if (inviteErr) throw inviteErr
    if (!invite || invite.used_at) {
      return res.status(400).json({ error: 'Invalid or already used invite' })
    }
    const now = new Date()
    if (new Date(invite.expires_at) < now) {
      return res.status(400).json({ error: 'Invite has expired' })
    }
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    })
    if (createErr) {
      if (createErr.message && createErr.message.includes('already been registered')) {
        return res.status(400).json({ error: 'An account with this email already exists. Sign in instead.' })
      }
      throw createErr
    }
    const userId = created.user.id
    const { error: updateEmpErr } = await supabaseAdmin
      .from('employees')
      .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
      .eq('id', invite.employee_id)
    if (updateEmpErr) throw updateEmpErr
    const { error: updateInviteErr } = await supabaseAdmin
      .from('employee_invites')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id)
    if (updateInviteErr) throw updateInviteErr
    const nowIso = new Date().toISOString()
    await supabaseAdmin.from('profiles').upsert(
      { id: userId, role: 'employee', updated_at: nowIso },
      { onConflict: 'id' }
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

module.exports = { router, INVITE_EXPIRY_DAYS, generateToken }
