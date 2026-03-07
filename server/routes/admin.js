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

module.exports = router
