/**
 * Messaging: conversations, messages, read state.
 * Uses service-role Supabase so we can read all participants; all access scoped by req.user.id.
 */
const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

function getSupabase(_req) {
  return defaultSupabase
}

/** GET /api/conversations - list for current user with last message and unread count */
router.get('/', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: myParticipants, error: partErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId)
    if (partErr) throw partErr
    if (!myParticipants?.length) return res.json([])

    const conversationIds = myParticipants.map((p) => p.conversation_id)

    const { data: convos, error: convErr } = await supabase
      .from('conversations')
      .select('id, created_at, updated_at')
      .in('id', conversationIds)
      .order('updated_at', { ascending: false })
    if (convErr) throw convErr
    if (!convos?.length) return res.json([])

    const { data: reads, error: readErr } = await supabase
      .from('conversation_reads')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)
      .in('conversation_id', conversationIds)
    if (readErr) throw readErr
    const readMap = Object.fromEntries((reads || []).map((r) => [r.conversation_id, r.last_read_at]))

    const { data: lastMessages, error: msgErr } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .in('conversation_id', conversationIds)
    if (msgErr) throw msgErr
    const messagesByConv = {}
    ;(lastMessages || []).forEach((m) => {
      if (!messagesByConv[m.conversation_id] || new Date(m.created_at) > new Date(messagesByConv[m.conversation_id].created_at)) {
        messagesByConv[m.conversation_id] = m
      }
    })

    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds)
    const otherByConv = {}
    ;(allParticipants || []).forEach((p) => {
      if (p.user_id !== userId) {
        if (!otherByConv[p.conversation_id]) otherByConv[p.conversation_id] = []
        otherByConv[p.conversation_id].push(p.user_id)
      }
    })

    const list = convos.map((c) => {
      const last = messagesByConv[c.id]
      const lastRead = readMap[c.id] ? new Date(readMap[c.id]) : null
      const convMessages = (lastMessages || []).filter((m) => m.conversation_id === c.id)
      const unreadCount = lastRead
        ? convMessages.filter((m) => new Date(m.created_at) > lastRead).length
        : convMessages.length
      return {
        id: c.id,
        updated_at: c.updated_at,
        last_message: last
          ? {
              id: last.id,
              sender_id: last.sender_id,
              body: last.body,
              created_at: last.created_at,
            }
          : null,
        unread_count: unreadCount,
        other_participant_ids: otherByConv[c.id] || [],
      }
    })

    res.json(list)
  } catch (err) {
    next(err)
  }
})

/** GET /api/conversations/unread-count - total unread messages for current user */
router.get('/unread-count', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: myParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId)
    if (!myParticipants?.length) return res.json({ count: 0 })

    const conversationIds = myParticipants.map((p) => p.conversation_id)
    const { data: reads } = await supabase
      .from('conversation_reads')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)
      .in('conversation_id', conversationIds)
    const readMap = Object.fromEntries((reads || []).map((r) => [r.conversation_id, r.last_read_at]))

    const { data: messages } = await supabase
      .from('messages')
      .select('conversation_id, created_at')
      .in('conversation_id', conversationIds)
    let count = 0
    ;(messages || []).forEach((m) => {
      const lastRead = readMap[m.conversation_id] ? new Date(readMap[m.conversation_id]) : null
      if (!lastRead || new Date(m.created_at) > lastRead) count++
    })
    res.json({ count })
  } catch (err) {
    next(err)
  }
})

/** GET /api/conversations/find-or-create?other_user_id= - find existing 1:1 or create */
router.get('/find-or-create', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const otherUserId = req.query.other_user_id
    if (!otherUserId) return res.status(400).json({ error: 'other_user_id required' })
    if (otherUserId === userId) return res.status(400).json({ error: 'Cannot message yourself' })

    const { data: myConvos } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId)
    const myIds = (myConvos || []).map((c) => c.conversation_id)
    if (!myIds.length) {
      const { data: conv, error: insErr } = await supabase
        .from('conversations')
        .insert({})
        .select('id, created_at, updated_at')
        .single()
      if (insErr) throw insErr
      await supabase.from('conversation_participants').insert([
        { conversation_id: conv.id, user_id: userId },
        { conversation_id: conv.id, user_id: otherUserId },
      ])
      return res.json(conv)
    }

    const { data: otherInSame } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', myIds)
    const shared = (otherInSame || []).map((c) => c.conversation_id)
    if (shared.length) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, created_at, updated_at')
        .eq('id', shared[0])
        .single()
      if (conv) return res.json(conv)
    }

    const { data: conv, error: insErr } = await supabase
      .from('conversations')
      .insert({})
      .select('id, created_at, updated_at')
      .single()
    if (insErr) throw insErr
    await supabase.from('conversation_participants').insert([
      { conversation_id: conv.id, user_id: userId },
      { conversation_id: conv.id, user_id: otherUserId },
    ])
    res.status(201).json(conv)
  } catch (err) {
    next(err)
  }
})

/** POST /api/conversations - create with participant user_ids (e.g. [currentUser, otherUser] for 1:1) */
router.post('/', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { participant_ids: participantIds } = req.body || {}
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'participant_ids array required' })
    }
    const unique = [...new Set([userId, ...participantIds])]

    const { data: conv, error: insErr } = await supabase
      .from('conversations')
      .insert({})
      .select('id, created_at, updated_at')
      .single()
    if (insErr) throw insErr

    await supabase.from('conversation_participants').insert(
      unique.map((uid) => ({ conversation_id: conv.id, user_id: uid }))
    )

    res.status(201).json(conv)
  } catch (err) {
    next(err)
  }
})

/** GET /api/conversations/:id/messages - paginated (optional ?limit=50&before=message_id) */
router.get('/:id/messages', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { id } = req.params
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100)
    const before = req.query.before

    const { data: part, error: partErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', id)
      .eq('user_id', userId)
      .single()
    if (partErr || !part) return res.status(404).json({ error: 'Conversation not found' })

    let q = supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(limit + 1)
    if (before) {
      const { data: beforeMsg } = await supabase.from('messages').select('created_at').eq('id', before).single()
      if (beforeMsg) q = q.lt('created_at', beforeMsg.created_at)
    }
    const { data: rows, error } = await q
    if (error) throw error
    const messages = (rows || []).slice(0, limit).reverse()
    const has_more = (rows || []).length > limit
    res.json({ messages, has_more })
  } catch (err) {
    next(err)
  }
})

/** POST /api/conversations/:id/messages - send message */
router.post('/:id/messages', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { id } = req.params
    const { body } = req.body || {}
    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'body required' })
    }

    const { data: part, error: partErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', id)
      .eq('user_id', userId)
      .single()
    if (partErr || !part) return res.status(404).json({ error: 'Conversation not found' })

    const { data: msg, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id: userId,
        body: body.trim(),
      })
      .select('id, conversation_id, sender_id, body, created_at')
      .single()
    if (error) throw error
    res.status(201).json(msg)
  } catch (err) {
    next(err)
  }
})

/** POST /api/conversations/:id/read - mark conversation as read for current user */
router.post('/:id/read', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { id } = req.params
    const { data: part, error: partErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', id)
      .eq('user_id', userId)
      .single()
    if (partErr || !part) return res.status(404).json({ error: 'Conversation not found' })

    await supabase
      .from('conversation_reads')
      .upsert(
        { conversation_id: id, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: 'conversation_id,user_id', ignoreDuplicates: false }
      )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
