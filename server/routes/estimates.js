const crypto = require('crypto')
const express = require('express')
const { applyApprovedEstimateGroupsToBudget } = require('../lib/budgetFromEstimate')
const router = express.Router()
const { supabase: defaultSupabase } = require('../db/supabase')
const { sendEstimatePortalEmail } = require('../lib/sendPortalEmails')
const { recordEstimateSentPaperTrail, syncPaperTrailFromEstimate } = require('../lib/paperTrailDocuments')
const { isChangeOrderEstimateTitle } = require('../lib/estimatePortalKind')

function getSupabase(req) {
  return req.supabase || defaultSupabase
}

/** GET /api/estimates - list estimates (optional ?job_id=) */
router.get('/', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    let q = supabase
      .from('estimates')
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
    console.error('Estimates list error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** GET /api/estimates/:id - single estimate with line items */
router.get('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { data: est, error: estErr } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', id)
      .single()
    if (estErr || !est) return res.status(404).json({ error: 'Not found' })
    const { data: items, error: itemsErr } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', id)
    if (itemsErr) throw itemsErr
    res.json({
      ...est,
      recipient_emails: Array.isArray(est.recipient_emails) ? est.recipient_emails : [],
      line_items: items || [],
    })
  } catch (err) {
    console.error('Estimate get error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/estimates - create estimate */
router.post('/', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { job_id, title } = req.body
    const { data, error } = await supabase
      .from('estimates')
      .insert({
        job_id: job_id || null,
        user_id: req.user.id,
        title: title || 'Estimate',
        status: 'draft',
        total_amount: 0,
        recipient_emails: [],
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json({
      ...data,
      recipient_emails: [],
      line_items: [],
    })
  } catch (err) {
    console.error('Estimate create error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** PATCH /api/estimates/:id */
router.patch('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { data: prevRow, error: prevErr } = await supabase
      .from('estimates')
      .select('status, job_id')
      .eq('id', id)
      .maybeSingle()
    if (prevErr) throw prevErr
    if (!prevRow) return res.status(404).json({ error: 'Not found' })

    const {
      job_id,
      title,
      status,
      total_amount,
      recipient_emails,
      sent_at,
      client_notes,
      client_terms,
      estimate_groups_meta,
    } = req.body
    const updates = { updated_at: new Date().toISOString() }
    if (job_id !== undefined) updates.job_id = job_id
    if (title !== undefined) updates.title = title
    if (status !== undefined) updates.status = status
    if (total_amount !== undefined) updates.total_amount = Number(total_amount)
    if (recipient_emails !== undefined) updates.recipient_emails = recipient_emails
    if (sent_at !== undefined) updates.sent_at = sent_at
    if (client_notes !== undefined) updates.client_notes = client_notes == null || client_notes === '' ? null : String(client_notes)
    if (client_terms !== undefined) updates.client_terms = client_terms == null || client_terms === '' ? null : String(client_terms)
    if (estimate_groups_meta !== undefined) {
      updates.estimate_groups_meta = estimate_groups_meta == null ? null : estimate_groups_meta
    }
    const { data, error } = await supabase
      .from('estimates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found' })

    const prevStatus = (prevRow.status || '').toLowerCase()
    const nextStatus = (data.status || '').toLowerCase()
    const jobId = data.job_id || prevRow.job_id
    if (jobId && nextStatus === 'accepted' && prevStatus !== 'accepted') {
      const ts = new Date().toISOString()
      const { data: projRow } = await supabase
        .from('projects')
        .select('estimate_approved_at')
        .eq('id', jobId)
        .maybeSingle()
      if (projRow && !projRow.estimate_approved_at) {
        await supabase
          .from('projects')
          .update({ estimate_approved_at: ts, updated_at: ts })
          .eq('id', jobId)
      }
      try {
        await applyApprovedEstimateGroupsToBudget(supabase, jobId, id)
      } catch (budgetErr) {
        console.error('[estimates] budget sync on accept', budgetErr)
      }
    }

    await syncPaperTrailFromEstimate(supabase, id)
    res.json({ ...data, recipient_emails: data.recipient_emails || [] })
  } catch (err) {
    console.error('Estimate update error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** DELETE /api/estimates/:id */
router.delete('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { error } = await supabase.from('estimates').delete().eq('id', id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    console.error('Estimate delete error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/estimates/:id/sync-project-budget — replace project budget from line items (accepted estimates only). Call after bulk line edits. */
router.post('/:id/sync-project-budget', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { data: est, error } = await supabase
      .from('estimates')
      .select('status, job_id')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!est) return res.status(404).json({ error: 'Not found' })
    if ((est.status || '').toLowerCase() !== 'accepted') {
      return res.status(400).json({ error: 'Only accepted estimates sync to the project budget.' })
    }
    if (!est.job_id) return res.status(400).json({ error: 'Estimate is not linked to a project.' })
    await applyApprovedEstimateGroupsToBudget(supabase, est.job_id, id)
    res.json({ ok: true })
  } catch (err) {
    console.error('[estimates] sync-project-budget', err)
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/estimates/:id/line-items - add line item */
router.post('/:id/line-items', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const estimateId = req.params.id
    const { custom_product_id, description, quantity, unit, unit_price, section, total: bodyTotal } = req.body
    const qty = Number(quantity) || 1
    const u = String(unit || 'ea').trim()
    let price = Number(unit_price) || 0
    let total
    if (u === 'pct') {
      price = Math.min(100, Math.max(0, price))
      const t = bodyTotal !== undefined && bodyTotal !== null && bodyTotal !== '' ? Number(bodyTotal) : NaN
      total = Number.isFinite(t) ? Math.round(t * 100) / 100 : 0
    } else {
      total = Math.round(qty * price * 100) / 100
    }
    const insertPayload = {
      estimate_id: estimateId,
      custom_product_id: custom_product_id || null,
      description: description || '',
      quantity: qty,
      unit: unit || 'ea',
      unit_price: price,
      total,
    }
    if (section !== undefined && section !== null && String(section).trim() !== '') {
      insertPayload.section = String(section).trim()
    }
    const { data, error } = await supabase
      .from('estimate_line_items')
      .insert(insertPayload)
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    console.error('Line item create error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** PATCH /api/estimates/:estimateId/line-items/:lineId */
router.patch('/:estimateId/line-items/:lineId', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { lineId } = req.params
    const { description, quantity, unit, unit_price, section, total: bodyTotal } = req.body
    const qty = quantity !== undefined ? Number(quantity) : undefined
    const price = unit_price !== undefined ? Number(unit_price) : undefined
    const u = unit !== undefined ? String(unit).trim() : undefined
    let total
    if (bodyTotal !== undefined && bodyTotal !== null && bodyTotal !== '') {
      const t = Number(bodyTotal)
      total = Number.isFinite(t) ? Math.round(t * 100) / 100 : undefined
    } else if (qty !== undefined && price !== undefined && u !== 'pct') {
      total = Math.round(qty * price * 100) / 100
    }
    const updates = {}
    if (description !== undefined) updates.description = description
    if (qty !== undefined) updates.quantity = qty
    if (unit !== undefined) updates.unit = unit
    if (price !== undefined) updates.unit_price = price
    if (total !== undefined) updates.total = total
    if (section !== undefined) updates.section = section === '' || section == null ? null : String(section).trim()
    const { data, error } = await supabase
      .from('estimate_line_items')
      .update(updates)
      .eq('id', lineId)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  } catch (err) {
    console.error('Line item update error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** DELETE /api/estimates/:estimateId/line-items/:lineId */
router.delete('/:estimateId/line-items/:lineId', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { lineId } = req.params
    const { error } = await supabase.from('estimate_line_items').delete().eq('id', lineId)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    console.error('Line item delete error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/estimates/:id/convert-to-invoice - create invoice from estimate (full or partial) */
router.post('/:id/convert-to-invoice', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const estimateId = req.params.id
    const { due_date, amount, schedule_snapshot } = req.body
    const { data: est, error: estErr } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .single()
    if (estErr || !est) return res.status(404).json({ error: 'Not found' })
    const totalAmount = Number(est.total_amount) || 0
    const invoicedSoFar = Number(est.invoiced_amount) || 0
    const remaining = Math.max(0, totalAmount - invoicedSoFar)
    if (remaining <= 0) {
      return res.status(400).json({ error: 'Estimate is already fully invoiced.' })
    }
    let invoiceAmount = totalAmount - invoicedSoFar
    if (amount != null && amount !== '') {
      const requested = Number(amount)
      if (Number.isNaN(requested) || requested <= 0) {
        return res.status(400).json({ error: 'Invalid amount.' })
      }
      if (requested > remaining) {
        return res.status(400).json({ error: `Amount cannot exceed remaining (${remaining}).` })
      }
      invoiceAmount = requested
    }
    const insertPayload = {
      estimate_id: estimateId,
      job_id: est.job_id,
      user_id: req.user.id,
      status: 'draft',
      total_amount: invoiceAmount,
      recipient_emails: est.recipient_emails || [],
      due_date: due_date || null,
    }
    if (schedule_snapshot != null && typeof schedule_snapshot === 'object') {
      insertPayload.schedule_snapshot = schedule_snapshot
    }
    const { data: inv, error: invErr } = await supabase.from('invoices').insert(insertPayload)
      .select()
      .single()
    if (invErr) throw invErr
    const newInvoicedAmount = invoicedSoFar + invoiceAmount
    const { data: updatedEst, error: updateErr } = await supabase
      .from('estimates')
      .update({
        invoiced_amount: newInvoicedAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', estimateId)
      .select()
      .single()
    if (updateErr) {
      console.error('Update estimate invoiced_amount error:', updateErr)
    }
    res.status(201).json({
      invoice: { ...inv, recipient_emails: inv.recipient_emails || [] },
      estimate: updatedEst ? { ...updatedEst, recipient_emails: updatedEst.recipient_emails || [] } : null,
    })
  } catch (err) {
    console.error('Convert to invoice error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/estimates/:id/send - mark sent, set client_token, update project to awaiting_approval, send/log client portal link */
router.post('/:id/send', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { recipient_emails, client_name, project_name, gc_name } = req.body || {}
    const { data: est, error: fetchErr } = await supabase
      .from('estimates')
      .select('id, job_id, user_id')
      .eq('id', id)
      .single()
    if (fetchErr || !est) return res.status(404).json({ error: 'Not found' })
    if (est.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' })

    const clientToken = crypto.randomUUID()
    const updates = {
      client_token: clientToken,
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (Array.isArray(recipient_emails)) updates.recipient_emails = recipient_emails

    const { data, error } = await supabase
      .from('estimates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found' })

    if (est.job_id) {
      await supabase
        .from('projects')
        .update({ status: 'awaiting_approval', updated_at: new Date().toISOString() })
        .eq('id', est.job_id)
        .eq('user_id', req.user.id)
    }

    const baseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || (req.protocol + '://' + (req.get('host') || 'localhost'))
    const portalUrl = `${baseUrl.replace(/\/$/, '')}/estimate/${clientToken}`
    const clientEmail = Array.isArray(recipient_emails) && recipient_emails[0] ? recipient_emails[0] : null
    let projectDisplayName = project_name
    if (!projectDisplayName && est.job_id) {
      const { data: proj } = await supabase.from('projects').select('name').eq('id', est.job_id).single()
      projectDisplayName = (proj && proj.name) ? proj.name : 'your project'
    }
    if (!projectDisplayName) projectDisplayName = 'your project'
    const gcDisplayName = gc_name && String(gc_name).trim() ? String(gc_name).trim() : 'Your contractor'
    const clientDisplayName = client_name && String(client_name).trim() ? String(client_name).trim() : 'there'

    if (clientEmail) {
      const documentKind = isChangeOrderEstimateTitle(data.title) ? 'change_order' : 'estimate'
      await sendEstimatePortalEmail({
        to: clientEmail,
        clientName: clientDisplayName,
        gcName: gcDisplayName,
        projectName: projectDisplayName,
        portalUrl,
        documentKind,
      })
    } else {
      console.log('[estimates/send] No recipient email; portal link:', portalUrl)
    }

    recordEstimateSentPaperTrail(supabase, req.user.id, id, data)

    res.json({ ...data, recipient_emails: data.recipient_emails || [] })
  } catch (err) {
    console.error('Estimate send error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
