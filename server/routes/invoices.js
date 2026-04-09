const crypto = require('crypto')
const { randomUUID } = require('crypto')
const express = require('express')
const multer = require('multer')
const router = express.Router()
const { supabase: defaultSupabase } = require('../db/supabase')
const { recordInvoiceSentPaperTrail } = require('../lib/paperTrailDocuments')
const { notifyInvoiceStatusChange } = require('../lib/eventNotificationEmails')
const {
  validateAndNormalizeClientAttachments,
  getClientAttachmentsArray,
  resolveClientAttachmentUrl,
  BUILD_PLANS_BUCKET,
  INVOICE_ATTACH_PREFIX,
} = require('../lib/invoiceClientAttachments')
const { sendInvoicePortalEmail } = require('../lib/sendPortalEmails')
const { parseManualInvoiceSnapshot } = require('../lib/invoiceManualSnapshot')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })
const invoiceAttachmentUploadSingle = upload.single('file')

async function ensureInvoiceStorageBucket() {
  if (!defaultSupabase) return
  const { error } = await defaultSupabase.storage.createBucket(BUILD_PLANS_BUCKET, {
    public: true,
    fileSizeLimit: 25 * 1024 * 1024,
  })
  if (error && error.message !== 'Bucket already exists') {
    console.warn('[invoices/attachments] ensure bucket:', error.message)
  }
}

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

/** POST /api/invoices — create draft (optional job_id for standalone / generic invoices) */
router.post('/', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { job_id, estimate_id, total_amount, recipient_emails, due_date, status, schedule_snapshot } = req.body
    const uid = req.user.id
    if (total_amount == null || total_amount === '') {
      return res.status(400).json({ error: 'total_amount is required' })
    }
    const amt = Number(total_amount)
    if (Number.isNaN(amt) || amt < 0) {
      return res.status(400).json({ error: 'Invalid total_amount' })
    }
    let jid = job_id != null && String(job_id).trim() ? String(job_id).trim() : null
    if (jid) {
      const { data: proj, error: pErr } = await supabase
        .from('projects')
        .select('id')
        .eq('id', jid)
        .eq('user_id', uid)
        .maybeSingle()
      if (pErr) throw pErr
      if (!proj) return res.status(400).json({ error: 'Invalid job_id' })
    }
    let eid = estimate_id != null && String(estimate_id).trim() ? String(estimate_id).trim() : null
    if (eid) {
      const { data: est, error: eErr } = await supabase
        .from('estimates')
        .select('id')
        .eq('id', eid)
        .eq('user_id', uid)
        .maybeSingle()
      if (eErr) throw eErr
      if (!est) return res.status(400).json({ error: 'Invalid estimate_id' })
    }
    const insertPayload = {
      user_id: uid,
      job_id: jid,
      estimate_id: eid,
      total_amount: amt,
      recipient_emails: Array.isArray(recipient_emails) ? recipient_emails : [],
      due_date: due_date || null,
      status: status && String(status).trim() ? String(status).trim() : 'draft',
    }
    if (schedule_snapshot != null && typeof schedule_snapshot === 'object' && !Array.isArray(schedule_snapshot)) {
      const snap = { ...schedule_snapshot }
      if (Array.isArray(snap.client_attachments)) {
        const preFiltered = snap.client_attachments.filter(
          (a) => a && (a.kind === 'sub_bid_quote' || a.kind === 'project_bid_document')
        )
        snap.client_attachments = await validateAndNormalizeClientAttachments(supabase, uid, jid, preFiltered, {
          allowUploads: false,
        })
      }
      insertPayload.schedule_snapshot = snap
    }
    const { data, error } = await supabase.from('invoices').insert(insertPayload).select().single()
    if (error) throw error
    if (!data) return res.status(500).json({ error: 'Insert failed' })
    res.status(201).json({ ...data, recipient_emails: Array.isArray(data.recipient_emails) ? data.recipient_emails : [] })
  } catch (err) {
    console.error('Invoice create error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** GET /api/invoices/:id/attachments/:attachmentId/view — owner-only signed redirect or JSON { url } */
async function getInvoiceAttachmentView(req, res) {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id, attachmentId } = req.params
    const { data: inv, error } = await supabase
      .from('invoices')
      .select('id, user_id, job_id, schedule_snapshot')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!inv || inv.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' })
    const list = getClientAttachmentsArray(inv.schedule_snapshot)
    const att = list.find((a) => String(a.id) === String(attachmentId))
    if (!att) return res.status(404).json({ error: 'Not found' })
    const db = defaultSupabase || supabase
    const url = await resolveClientAttachmentUrl(db, inv, att)
    if (!url) return res.status(404).json({ error: 'File not available' })
    const asJson = String(req.query.format || '').toLowerCase() === 'json'
    if (asJson) {
      res.set('Cache-Control', 'no-store')
      return res.json({ url })
    }
    return res.redirect(302, url)
  } catch (err) {
    console.error('Invoice attachment view error:', err)
    res.status(500).json({ error: err.message })
  }
}

router.get('/:id/attachments/:attachmentId/view', getInvoiceAttachmentView)

/** POST /api/invoices/:id/attachments — upload supporting doc for client invoice (generic / extra) */
async function postInvoiceAttachment(req, res) {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const storage = defaultSupabase || supabase
  if (!storage) return res.status(503).json({ error: 'Storage not configured' })
  try {
    const { id } = req.params
    const uid = req.user.id
    const { data: inv, error: loadErr } = await supabase
      .from('invoices')
      .select('id, user_id, job_id, schedule_snapshot')
      .eq('id', id)
      .maybeSingle()
    if (loadErr) throw loadErr
    if (!inv || inv.user_id !== uid) return res.status(404).json({ error: 'Not found' })
    await ensureInvoiceStorageBucket()
    const safeName = (req.file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
    const attachId = randomUUID()
    const path = `${INVOICE_ATTACH_PREFIX}/${uid}/${id}/${attachId}-${safeName}`
    const { error: uploadErr } = await storage.storage.from(BUILD_PLANS_BUCKET).upload(path, req.file.buffer, {
      contentType: req.file.mimetype || 'application/octet-stream',
      upsert: false,
    })
    if (uploadErr) throw uploadErr
    const snap =
      inv.schedule_snapshot && typeof inv.schedule_snapshot === 'object' && !Array.isArray(inv.schedule_snapshot)
        ? { ...inv.schedule_snapshot }
        : {}
    const existing = getClientAttachmentsArray(snap)
    const newRow = {
      id: attachId,
      kind: 'invoice_upload',
      label: req.file.originalname || safeName,
      storage_path: path,
    }
    const merged = [...existing, newRow]
    snap.client_attachments = await validateAndNormalizeClientAttachments(supabase, uid, inv.job_id, merged, {
      allowUploads: true,
    })
    const { data: updated, error: updErr } = await supabase
      .from('invoices')
      .update({ schedule_snapshot: snap, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (updErr) throw updErr
    res.status(201).json({ invoice: { ...updated, recipient_emails: updated.recipient_emails || [] }, attachment: newRow })
  } catch (err) {
    console.error('Invoice attachment upload error:', err)
    res.status(500).json({ error: err.message })
  }
}

router.post('/:id/attachments', invoiceAttachmentUploadSingle, postInvoiceAttachment)

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
    const { data: before, error: loadErr } = await supabase
      .from('invoices')
      .select('id, status, user_id, job_id')
      .eq('id', id)
      .maybeSingle()
    if (loadErr) throw loadErr
    if (!before) return res.status(404).json({ error: 'Not found' })
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
    if (status !== undefined) {
      const oldS = String(before.status || '')
      const newS = String(status || '')
      if (oldS.toLowerCase() !== newS.toLowerCase()) {
        const userId = data.user_id || before.user_id || req.user?.id
        let projectName = null
        if (data.job_id || before.job_id) {
          const jid = data.job_id || before.job_id
          const { data: p } = await supabase.from('projects').select('name').eq('id', jid).maybeSingle()
          projectName = p?.name || null
        }
        if (userId) {
          void notifyInvoiceStatusChange(supabase, {
            userId,
            projectName,
            oldStatus: oldS,
            newStatus: newS,
          })
        }
      }
    }
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

/** POST /api/invoices/:id/send - mark sent, email client portal link (same pattern as estimates/send) */
router.post('/:id/send', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { recipient_emails } = req.body
    const { data: existingSend } = await supabase
      .from('invoices')
      .select('client_token, status, user_id, job_id, estimate_id, schedule_snapshot')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle()
    if (!existingSend) return res.status(404).json({ error: 'Not found' })
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
      .eq('user_id', req.user.id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found' })

    const baseUrlRaw = (
      process.env.PUBLIC_APP_URL ||
      process.env.APP_URL ||
      `${req.protocol}://${req.get('host') || 'localhost'}`
    )
      .trim()
      .replace(/\/$/, '')
    const portalBase = baseUrlRaw.startsWith('http') ? baseUrlRaw : `https://${baseUrlRaw}`
    const portalUrl = `${portalBase}/invoice/${encodeURIComponent(clientToken)}`

    const emailsAfter = Array.isArray(data.recipient_emails) ? data.recipient_emails : []
    const clientEmail = emailsAfter[0] ? String(emailsAfter[0]).trim() : ''
    const manualSnap = parseManualInvoiceSnapshot(data.schedule_snapshot)

    let projectDisplayName = null
    let clientDisplayName = 'there'
    if (data.job_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('name, assigned_to_name')
        .eq('id', data.job_id)
        .eq('user_id', req.user.id)
        .maybeSingle()
      if (proj?.name && String(proj.name).trim()) projectDisplayName = String(proj.name).trim()
      if (proj?.assigned_to_name && String(proj.assigned_to_name).trim()) {
        clientDisplayName = String(proj.assigned_to_name).trim()
      }
    }
    if (!projectDisplayName && data.estimate_id) {
      const { data: est } = await supabase
        .from('estimates')
        .select('title')
        .eq('id', data.estimate_id)
        .eq('user_id', req.user.id)
        .maybeSingle()
      if (est?.title && String(est.title).trim()) projectDisplayName = String(est.title).trim()
    }
    if (!projectDisplayName) {
      const { data: company } = await supabase
        .from('company_settings')
        .select('name')
        .eq('user_id', req.user.id)
        .maybeSingle()
      projectDisplayName = company?.name && String(company.name).trim() ? String(company.name).trim() : 'Invoice'
    }
    if (manualSnap?.client_name) clientDisplayName = manualSnap.client_name

    const prevSt = String(existingSend.status || '').toLowerCase()
    const isResend = prevSt === 'sent' || prevSt === 'viewed'

    if (clientEmail) {
      await sendInvoicePortalEmail({
        to: clientEmail,
        clientName: clientDisplayName,
        projectName: projectDisplayName,
        portalUrl,
        isResend,
      })
    } else {
      console.log('[invoices/send] No recipient email; portal link:', portalUrl)
    }

    const ownerId = data.user_id || req.user?.id
    if (ownerId) recordInvoiceSentPaperTrail(supabase, ownerId, data)
    const notifyUserId = data.user_id || existingSend?.user_id || req.user?.id
    if (notifyUserId && prevSt !== 'sent') {
      let projectName = null
      if (data.job_id || existingSend?.job_id) {
        const jid = data.job_id || existingSend?.job_id
        const { data: p } = await supabase.from('projects').select('name').eq('id', jid).maybeSingle()
        projectName = p?.name || null
      }
      void notifyInvoiceStatusChange(supabase, {
        userId: notifyUserId,
        projectName,
        oldStatus: existingSend?.status || 'draft',
        newStatus: 'sent',
      })
    }
    res.json({ ...data, recipient_emails: data.recipient_emails || [] })
  } catch (err) {
    console.error('Invoice send error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
module.exports.postInvoiceAttachment = postInvoiceAttachment
module.exports.invoiceAttachmentUploadSingle = invoiceAttachmentUploadSingle
module.exports.getInvoiceAttachmentView = getInvoiceAttachmentView
