const express = require('express')

const ALLOWED_TYPES = new Set(['bug', 'feature', 'question', 'other'])

const router = express.Router()

router.post('/', async (req, res, next) => {
  try {
    const supabase = req.supabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const user = req.user
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' })

    const { type, message, page_url, page_title, metadata } = req.body || {}
    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ error: 'Invalid type' })
    }
    const text = typeof message === 'string' ? message.trim() : ''
    if (!text) return res.status(400).json({ error: 'Message is required' })

    const meta =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : null

    const userName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.display_name ||
      null
    const userEmail = user.email || null

    const { data, error } = await supabase
      .from('support_messages')
      .insert({
        user_id: user.id,
        user_name: userName,
        user_email: userEmail,
        type,
        message: text,
        page_url: typeof page_url === 'string' ? page_url : null,
        page_title: typeof page_title === 'string' ? page_title : null,
        metadata: meta,
      })
      .select('id')
      .single()

    if (error) throw error
    res.status(201).json({ id: data.id })
  } catch (err) {
    next(err)
  }
})

module.exports = router
