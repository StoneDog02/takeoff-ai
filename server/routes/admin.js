const express = require('express')
const router = express.Router()
const { supabase: supabaseAdmin } = require('../db/supabase')

const PER_PAGE = 50

/** GET /api/admin/stats - Aggregates for admin dashboard (user counts) */
router.get('/stats', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let totalUsers = 0
    let newUsersLast7Days = 0
    let newUsersLast30Days = 0
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      })
      if (error) {
        return res.status(500).json({ error: error.message })
      }
      const users = data?.users ?? []
      totalUsers += users.length
      for (const u of users) {
        const createdAt = u.created_at ? new Date(u.created_at) : null
        if (createdAt && createdAt >= thirtyDaysAgo) newUsersLast30Days++
        if (createdAt && createdAt >= sevenDaysAgo) newUsersLast7Days++
      }
      hasMore = users.length === PER_PAGE
      page++
    }

    res.json({
      totalUsers,
      newUsersLast7Days,
      newUsersLast30Days,
    })
  } catch (err) {
    next(err)
  }
})

/** GET /api/admin/users - Paginated list of users (id, email, created_at, last_sign_in_at) */
router.get('/users', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page, 10) || 20))

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    })
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    const users = (data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }))
    res.json({ users, page, perPage })
  } catch (err) {
    next(err)
  }
})

const SUPPORT_STATUSES = new Set(['new', 'seen', 'in_progress', 'resolved'])
const SUPPORT_PRIORITIES = new Set(['low', 'normal', 'high', 'critical'])
const SUPPORT_TYPES = new Set(['bug', 'feature', 'question', 'other'])

/** GET /api/admin/support/new-count — messages with status new */
router.get('/support/new-count', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const { count, error } = await supabaseAdmin
      .from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new')
    if (error) throw error
    res.json({ count: count ?? 0 })
  } catch (err) {
    next(err)
  }
})

/** GET /api/admin/support — list with optional filters, newest first */
router.get('/support', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const status = typeof req.query.status === 'string' ? req.query.status : ''
    const type = typeof req.query.type === 'string' ? req.query.type : ''
    const q = typeof req.query.q === 'string' ? req.query.trim() : ''

    let query = supabaseAdmin.from('support_messages').select('*').order('created_at', { ascending: false })

    if (status && status !== 'all' && SUPPORT_STATUSES.has(status)) {
      query = query.eq('status', status)
    }
    if (type && type !== 'all' && SUPPORT_TYPES.has(type)) {
      query = query.eq('type', type)
    }
    if (q) {
      const esc = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
      const pattern = `%${esc}%`
      query = query.or(
        `message.ilike.${pattern},user_email.ilike.${pattern},user_name.ilike.${pattern}`
      )
    }

    const { data, error } = await query
    if (error) throw error
    res.json({ messages: data ?? [] })
  } catch (err) {
    next(err)
  }
})

/** PATCH /api/admin/support/:id — admin update */
router.patch('/support/:id', async (req, res, next) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Admin client not configured' })
    }
    const id = req.params.id
    const body = req.body || {}
    const patch = {}

    if (body.status !== undefined) {
      if (!SUPPORT_STATUSES.has(body.status)) {
        return res.status(400).json({ error: 'Invalid status' })
      }
      patch.status = body.status
      if (body.status === 'resolved') {
        patch.resolved_at = new Date().toISOString()
      } else {
        patch.resolved_at = null
      }
    }
    if (body.priority !== undefined) {
      if (!SUPPORT_PRIORITIES.has(body.priority)) {
        return res.status(400).json({ error: 'Invalid priority' })
      }
      patch.priority = body.priority
    }
    if (body.admin_notes !== undefined) {
      patch.admin_notes = typeof body.admin_notes === 'string' ? body.admin_notes : null
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error } = await supabaseAdmin
      .from('support_messages')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

module.exports = router
