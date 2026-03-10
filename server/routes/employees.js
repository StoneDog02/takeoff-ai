const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')
const { sendInviteEmail } = require('../lib/sendInviteEmail')
const { INVITE_EXPIRY_DAYS, generateToken } = require('./invites')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    if (req.employee) {
      return res.json([req.employee])
    }
    const { status, job_id } = req.query
    let q = supabase
      .from('employees')
      .select('*')
      .eq('user_id', req.user?.id)
      .order('name')
    if (status) q = q.eq('status', status)
    const { data: employees, error } = await q
    if (error) throw error
    let list = employees || []
    if (job_id) {
      const { data: assignments } = await supabase
        .from('job_assignments')
        .select('employee_id')
        .eq('job_id', job_id)
        .is('ended_at', null)
      const ids = new Set((assignments || []).map((a) => a.employee_id))
      list = list.filter((e) => ids.has(e.id))
    }
    res.json(list)
  } catch (err) {
    next(err)
  }
})

/** GET /api/employees/invites — list pending/accepted invites for current user's employees (for Settings) */
router.get('/invites', async (req, res, next) => {
  try {
    if (req.employee) return res.json([])
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { data: employees } = await supabase.from('employees').select('id').eq('user_id', req.user?.id)
    const empIds = (employees || []).map((e) => e.id)
    if (empIds.length === 0) return res.json([])
    const { data: invites, error } = await supabase
      .from('employee_invites')
      .select('id, employee_id, email, expires_at, used_at, created_at')
      .in('employee_id', empIds)
      .order('created_at', { ascending: false })
    if (error) throw error
    const now = new Date().toISOString()
    const list = (invites || []).map((inv) => ({
      id: inv.id,
      employee_id: inv.employee_id,
      email: inv.email,
      status: inv.used_at ? 'accepted' : (new Date(inv.expires_at) < new Date(now) ? 'expired' : 'pending'),
      invitedAt: inv.created_at?.split('T')[0] || null,
    }))
    res.json(list)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    if (req.employee && req.params.id !== req.employee.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    let q = supabase.from('employees').select('*').eq('id', req.params.id)
    if (!req.employee) q = q.eq('user_id', req.user?.id)
    const { data: employee, error } = await q.single()
    if (error || !employee) return res.status(404).json({ error: 'Employee not found' })
    res.json(employee)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    if (req.employee) return res.status(403).json({ error: 'Employees cannot create other employees' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { name, role, email, phone, status, current_compensation } = req.body || {}
    const { data, error } = await supabase
      .from('employees')
      .insert({
        user_id: req.user?.id,
        name: name || '',
        role: role || '',
        email: email || '',
        phone: phone || '',
        status: status || 'off',
        current_compensation: current_compensation ?? null,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    if (req.employee) {
      if (req.params.id !== req.employee.id) return res.status(403).json({ error: 'Forbidden' })
      const { phone } = req.body || {}
      const updates = { updated_at: new Date().toISOString() }
      if (phone !== undefined) updates.phone = phone
      const { data, error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single()
      if (error) throw error
      return res.json(data)
    }
    const { name, role, email, phone, status, current_compensation } = req.body || {}
    const updates = {}
    if (name !== undefined) updates.name = name
    if (role !== undefined) updates.role = role
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    if (status !== undefined) updates.status = status
    if (current_compensation !== undefined) updates.current_compensation = current_compensation
    updates.updated_at = new Date().toISOString()
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user?.id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Employee not found' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.employee) return res.status(403).json({ error: 'Employees cannot delete employees' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user?.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

/** POST /api/employees/:id/invite - Contractor only. Create invite and return link (email optional later). */
router.post('/:id/invite', async (req, res, next) => {
  try {
    if (req.employee) return res.status(403).json({ error: 'Employees cannot send invites' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('id, name, email, auth_user_id')
      .eq('id', req.params.id)
      .eq('user_id', req.user?.id)
      .single()
    if (empErr || !employee) return res.status(404).json({ error: 'Employee not found' })
    if (employee.auth_user_id) return res.status(400).json({ error: 'Employee already has portal access' })
    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS)
    const { error: insertErr } = await supabase
      .from('employee_invites')
      .insert({
        employee_id: employee.id,
        email: employee.email,
        token,
        expires_at: expiresAt.toISOString(),
      })
    if (insertErr) throw insertErr
    const appOrigin = process.env.APP_ORIGIN || process.env.VITE_APP_ORIGIN || ''
    const inviteLink = appOrigin ? `${appOrigin.replace(/\/$/, '')}/accept-invite?token=${token}` : null
    let inviteEmailSent = false
    if (employee.email && inviteLink) {
      const emailResult = await sendInviteEmail({
        to: employee.email,
        inviteLink,
        employeeName: employee.name,
      })
      inviteEmailSent = emailResult.sent
    }
    res.status(201).json({
      ok: true,
      expires_at: expiresAt.toISOString(),
      invite_link: inviteLink,
      invite_email_sent: inviteEmailSent,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
