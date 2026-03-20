const crypto = require('crypto')
const express = require('express')
const router = express.Router()
const { supabase: defaultSupabase } = require('../db/supabase')
const { recordInvoiceSentPaperTrail } = require('../lib/paperTrailDocuments')

function getSupabase(req) {
  return req.supabase || defaultSupabase
}

/** GET /api/invoices - list invoices (optional ?job_id=) */
router.get('/', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    let q = supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    if (req.query.job_id) q = q.eq('job_id', req.query.job_id)
    const { data, error } = await q
    if (error) throw error
    const list = (data || []).map((row) => ({
      ...row,
      recipient_emails: Array.isArray(row.recipient_emails) ? row.recipient_emails : [],
    }))
    res.json(list)
  } catch (err) {
    console.error('Invoices list error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** GET /api/invoices/:id */
router.get('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return res.status(404).json({ error: 'Not found' })
    res.json({
      ...data,
      recipient_emails: Array.isArray(data.recipient_emails) ? data.recipient_emails : [],
    })
  } catch (err) {
    console.error('Invoice get error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** PATCH /api/invoices/:id - update status and other fields */
router.patch('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const {
      status,
      total_amount,
      recipient_emails,
      due_date,
      sent_at,
      paid_at,
      schedule_snapshot,
    } = req.body
    const updates = { updated_at: new Date().toISOString() }
    if (status !== undefined) updates.status = status
    if (total_amount !== undefined) updates.total_amount = Number(total_amount)
    if (recipient_emails !== undefined) updates.recipient_emails = recipient_emails
    if (due_date !== undefined) updates.due_date = due_date
    if (sent_at !== undefined) updates.sent_at = sent_at
    if (paid_at !== undefined) updates.paid_at = paid_at
    if (schedule_snapshot !== undefined) updates.schedule_snapshot = schedule_snapshot
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found' })
    res.json({ ...data, recipient_emails: data.recipient_emails || [] })
  } catch (err) {
    console.error('Invoice update error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** DELETE /api/invoices/:id */
router.delete('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    console.error('Invoice delete error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/invoices/:id/send - mark sent */
router.post('/:id/send', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { recipient_emails } = req.body
    const { data: existingSend } = await supabase
      .from('invoices')
      .select('client_token')
      .eq('id', id)
      .maybeSingle()
    const clientToken =
      existingSend?.client_token && String(existingSend.client_token).trim()
        ? String(existingSend.client_token).trim()
        : crypto.randomUUID()
    const updates = {
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      client_token: clientToken,
    }
    if (Array.isArray(recipient_emails)) updates.recipient_emails = recipient_emails
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found' })
    const baseUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '')
    if (baseUrl) {
      try {
        const portalUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/invoice/${clientToken}`
        console.log('[invoices/send] Client invoice portal:', portalUrl)
      } catch (e) {
        /* ignore */
      }
    }
    const ownerId = data.user_id || req.user?.id
    if (ownerId) recordInvoiceSentPaperTrail(supabase, ownerId, data)
    res.json({ ...data, recipient_emails: data.recipient_emails || [] })
  } catch (err) {
    console.error('Invoice send error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
