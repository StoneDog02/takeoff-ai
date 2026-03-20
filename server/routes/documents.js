const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const { supabase: defaultSupabase } = require('../db/supabase')
const { buildViewerEnvelope, attachProjectName } = require('../lib/documentViewerData')
const { sendEstimatePortalEmail, sendBidPortalEmail, sendInvoicePortalEmail } = require('../lib/sendPortalEmails')
const { isChangeOrderEstimateTitle } = require('../lib/estimatePortalKind')

function getSupabase(req) {
  return req.supabase || defaultSupabase
}

function displayProjectNameForDocument(row, projectMap) {
  if (row.project_id) return projectMap[row.project_id] ?? null
  const m = row.metadata
  if (m && typeof m === 'object' && typeof m.original_project_name === 'string' && m.original_project_name.trim()) {
    return m.original_project_name.trim()
  }
  return null
}

function estimateStorageBytes(row) {
  const m = row.metadata
  if (m && typeof m === 'object' && typeof m.file_bytes === 'number' && m.file_bytes > 0) {
    return m.file_bytes
  }
  if (row.file_url && String(row.file_url).trim()) return 90_000
  return 2_048
}

/**
 * GET /api/documents
 * Query: q, document_type, status, date_from, date_to, project_id (uuid | unlinked), show_archived (1|true)
 */
router.get('/', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = req.user.id
  const {
    q,
    document_type: docType,
    status: statusFilter,
    date_from: dateFrom,
    date_to: dateTo,
    project_id: projectFilter,
    show_archived: showArchivedRaw,
  } = req.query
  const showArchived = showArchivedRaw === '1' || showArchivedRaw === 'true'

  try {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('organization_id', userId)
      .order('created_at', { ascending: false })
      .limit(2500)

    if (!showArchived) {
      query = query.is('archived_at', null)
    }

    if (docType && docType !== 'all') {
      query = query.eq('document_type', String(docType))
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', String(statusFilter))
    }

    if (dateFrom && String(dateFrom).trim()) {
      const d = String(dateFrom).trim()
      query = query.gte('created_at', d.includes('T') ? d : `${d}T00:00:00.000Z`)
    }
    if (dateTo && String(dateTo).trim()) {
      const d = String(dateTo).trim()
      query = query.lte('created_at', d.includes('T') ? d : `${d}T23:59:59.999Z`)
    }

    if (projectFilter === 'unlinked') {
      query = query.is('project_id', null)
    } else if (projectFilter && projectFilter !== 'all') {
      query = query.eq('project_id', String(projectFilter))
    }

    const { data: rows, error } = await query
    if (error) throw error
    let list = rows || []

    const search = q && String(q).trim() ? String(q).trim().toLowerCase() : ''
    if (search) {
      list = list.filter((d) => {
        const title = (d.title || '').toLowerCase()
        const cn = (d.client_name || '').toLowerCase()
        const ce = (d.client_email || '').toLowerCase()
        const sub =
          d.metadata &&
          typeof d.metadata === 'object' &&
          typeof d.metadata.subcontractor_name === 'string'
            ? d.metadata.subcontractor_name.toLowerCase()
            : ''
        const origProj =
          d.metadata &&
          typeof d.metadata === 'object' &&
          typeof d.metadata.original_project_name === 'string'
            ? d.metadata.original_project_name.toLowerCase()
            : ''
        return (
          title.includes(search) ||
          cn.includes(search) ||
          ce.includes(search) ||
          sub.includes(search) ||
          origProj.includes(search)
        )
      })
    }

    const projectIds = [...new Set(list.map((r) => r.project_id).filter(Boolean))]
    let projectMap = {}
    if (projectIds.length > 0) {
      const { data: projs, error: pErr } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds)
        .eq('user_id', userId)
      if (!pErr && projs) {
        projectMap = Object.fromEntries(projs.map((p) => [p.id, p.name]))
      }
    }

    const documents = list.map((r) => ({
      ...r,
      project_name: displayProjectNameForDocument(r, projectMap),
    }))

    let storage_bytes_estimate = 0
    for (const r of documents) {
      storage_bytes_estimate += estimateStorageBytes(r)
    }

    res.set('Cache-Control', 'no-store')
    res.json({
      documents,
      total_count: documents.length,
      storage_bytes_estimate,
    })
  } catch (err) {
    console.error('[documents] list', err)
    res.status(500).json({ error: err.message || 'Failed to list documents' })
  }
})

/**
 * POST /api/documents/backfill — implemented in server/index.js (same process) so the route is always registered.
 */

/**
 * GET /api/documents/:id — single paper-trail row + typed viewer payload for in-app DocumentViewer.
 */
router.get('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params
  try {
    const { data: doc, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('organization_id', req.user.id)
      .maybeSingle()
    if (error) throw error
    if (!doc) return res.status(404).json({ error: 'Not found' })

    const withProj = await attachProjectName(supabase, req.user.id, doc)
    const viewer = await buildViewerEnvelope(supabase, req.user.id, doc)
    if (!viewer) {
      return res.status(404).json({ error: 'Source record missing or no longer accessible' })
    }

    res.set('Cache-Control', 'no-store')
    res.json({ document: withProj, viewer })
  } catch (err) {
    console.error('[documents] get', err)
    res.status(500).json({ error: err.message || 'Failed to load document' })
  }
})

/**
 * POST /api/documents/:id/resend — re-send portal email (estimate / invoice / bid package) using existing tokens when possible.
 */
router.post('/:id/resend', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = req.user.id
  const { id } = req.params

  const baseUrlRaw = process.env.PUBLIC_APP_URL || process.env.APP_URL || `${req.protocol}://${req.get('host') || 'localhost'}`
  const baseUrl = String(baseUrlRaw).replace(/\/$/, '')

  try {
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('id, organization_id, document_type, source_id, project_id, token')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!doc || doc.organization_id !== userId) {
      return res.status(404).json({ error: 'Not found' })
    }

    if (doc.document_type === 'estimate' && doc.source_id) {
      const { data: est, error: eErr } = await supabase
        .from('estimates')
        .select('id, user_id, client_token, recipient_emails, title, job_id')
        .eq('id', doc.source_id)
        .maybeSingle()
      if (eErr) throw eErr
      if (!est || est.user_id !== userId) return res.status(404).json({ error: 'Not found' })
      const token = est.client_token && String(est.client_token).trim() ? String(est.client_token).trim() : ''
      if (!token) {
        return res.status(400).json({ error: 'No portal link on file. Send this estimate from Estimates first.' })
      }
      const emails = est.recipient_emails
      const clientEmail = Array.isArray(emails) && emails[0] ? String(emails[0]).trim() : ''
      if (!clientEmail) {
        return res.status(400).json({ error: 'No client email on file for this estimate.' })
      }

      let projectDisplayName = 'your project'
      let clientDisplayName = 'there'
      if (est.job_id) {
        const { data: proj } = await supabase
          .from('projects')
          .select('name, assigned_to_name')
          .eq('id', est.job_id)
          .eq('user_id', userId)
          .maybeSingle()
        if (proj?.name) projectDisplayName = String(proj.name).trim()
        if (proj?.assigned_to_name && String(proj.assigned_to_name).trim()) {
          clientDisplayName = String(proj.assigned_to_name).trim()
        }
      }

      const { data: company } = await supabase.from('company_settings').select('name').eq('user_id', userId).maybeSingle()
      const gcDisplayName = company?.name && String(company.name).trim() ? String(company.name).trim() : 'Your contractor'

      const portalUrl = `${baseUrl}/estimate/${encodeURIComponent(token)}`
      await sendEstimatePortalEmail({
        to: clientEmail,
        clientName: clientDisplayName,
        gcName: gcDisplayName,
        projectName: projectDisplayName,
        portalUrl,
        documentKind: isChangeOrderEstimateTitle(est.title) ? 'change_order' : 'estimate',
      })
      return res.json({ ok: true, portal_url: portalUrl })
    }

    if (doc.document_type === 'invoice' && doc.source_id) {
      const { data: inv, error: iErr } = await supabase
        .from('invoices')
        .select('id, user_id, client_token, recipient_emails, job_id')
        .eq('id', doc.source_id)
        .maybeSingle()
      if (iErr) throw iErr
      if (!inv || inv.user_id !== userId) return res.status(404).json({ error: 'Not found' })

      let token =
        inv.client_token && String(inv.client_token).trim() ? String(inv.client_token).trim() : ''
      if (!token) {
        token = crypto.randomUUID()
        await supabase.from('invoices').update({ client_token: token, updated_at: new Date().toISOString() }).eq('id', inv.id)
      }

      const emails = inv.recipient_emails
      const clientEmail = Array.isArray(emails) && emails[0] ? String(emails[0]).trim() : ''
      if (!clientEmail) {
        return res.status(400).json({ error: 'No recipient email on file for this invoice.' })
      }

      let projectDisplayName = 'your project'
      let clientDisplayName = 'there'
      if (inv.job_id) {
        const { data: proj } = await supabase
          .from('projects')
          .select('name, assigned_to_name')
          .eq('id', inv.job_id)
          .eq('user_id', userId)
          .maybeSingle()
        if (proj?.name) projectDisplayName = String(proj.name).trim()
        if (proj?.assigned_to_name && String(proj.assigned_to_name).trim()) {
          clientDisplayName = String(proj.assigned_to_name).trim()
        }
      }

      const portalUrl = `${baseUrl}/invoice/${encodeURIComponent(token)}`
      await sendInvoicePortalEmail({
        to: clientEmail,
        clientName: clientDisplayName,
        projectName: projectDisplayName,
        portalUrl,
        isResend: true,
      })
      return res.json({ ok: true, portal_url: portalUrl })
    }

    if (doc.document_type === 'bid_package' && doc.source_id && doc.project_id) {
      const projectId = doc.project_id
      const pkgRes = await supabase.from('trade_packages').select('id').eq('project_id', projectId)
      const packageIds = (pkgRes.data || []).map((p) => p.id)
      const bidRes = await supabase
        .from('sub_bids')
        .select('id, trade_package_id, subcontractor_id, portal_token')
        .eq('id', doc.source_id)
        .maybeSingle()
      if (bidRes.error || !bidRes.data || !packageIds.includes(bidRes.data.trade_package_id)) {
        return res.status(404).json({ error: 'Sub bid not found' })
      }
      const subRes = await supabase
        .from('subcontractors')
        .select('email')
        .eq('project_id', projectId)
        .eq('id', bidRes.data.subcontractor_id)
        .maybeSingle()
      const subEmail = subRes.data?.email ? String(subRes.data.email).trim() : ''
      const token = bidRes.data.portal_token
      if (!token) return res.status(400).json({ error: 'No portal link for this bid' })

      const projRes = await supabase.from('projects').select('name').eq('id', projectId).eq('user_id', userId).maybeSingle()
      const projectName = projRes.data?.name ? String(projRes.data.name) : ''

      const portalUrl = `${baseUrl}/bid/${encodeURIComponent(token)}`
      const resendTs = new Date().toISOString()
      if (subEmail) {
        await sendBidPortalEmail({ to: subEmail, projectName, portalUrl, isResend: true })
      } else {
        console.log('[documents/resend] No sub email; bid portal link:', portalUrl)
      }
      await supabase.from('sub_bids').update({ dispatched_at: resendTs }).eq('id', bidRes.data.id)
      return res.json({ ok: true, portal_url: portalUrl, emailed: !!subEmail })
    }

    return res.status(400).json({ error: 'Send again is not available for this document type.' })
  } catch (err) {
    console.error('[documents] resend', err)
    res.status(500).json({ error: err.message || 'Resend failed' })
  }
})

/**
 * PATCH /api/documents/:id
 * Body: { archived?: boolean, project_id?: string | null }
 */
router.patch('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params
  const { archived, project_id: projectIdBody } = req.body || {}

  if (archived === undefined && projectIdBody === undefined) {
    return res.status(400).json({ error: 'Provide archived and/or project_id' })
  }

  try {
    const { data: row, error: fetchErr } = await supabase
      .from('documents')
      .select('id, organization_id, project_id')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!row || row.organization_id !== req.user.id) {
      return res.status(404).json({ error: 'Not found' })
    }

    const updates = {}

    if (typeof archived === 'boolean') {
      updates.archived_at = archived ? new Date().toISOString() : null
    }

    if (projectIdBody !== undefined) {
      if (projectIdBody === null) {
        updates.project_id = null
      } else {
        const pid = String(projectIdBody).trim()
        const { data: proj, error: projErr } = await supabase
          .from('projects')
          .select('id')
          .eq('id', pid)
          .eq('user_id', req.user.id)
          .maybeSingle()
        if (projErr) throw projErr
        if (!proj) {
          return res.status(400).json({ error: 'Project not found or not owned by you' })
        }
        updates.project_id = pid
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', req.user.id)
      .select('*')
      .single()
    if (updErr) throw updErr
    if (!updated) return res.status(404).json({ error: 'Not found' })

    const projectMap = {}
    if (updated.project_id) {
      const { data: p } = await supabase
        .from('projects')
        .select('name')
        .eq('id', updated.project_id)
        .eq('user_id', req.user.id)
        .maybeSingle()
      if (p?.name) projectMap[updated.project_id] = p.name
    }
    const project_name = displayProjectNameForDocument(updated, projectMap)

    res.json({ ...updated, project_name })
  } catch (err) {
    console.error('[documents] patch', err)
    res.status(500).json({ error: err.message || 'Update failed' })
  }
})

/**
 * DELETE /api/documents/:id — paper-trail rows are never removed; this archives the document (same as PATCH { archived: true }).
 */
router.delete('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params
  try {
    const { data: row, error: fetchErr } = await supabase
      .from('documents')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!row || row.organization_id !== req.user.id) {
      return res.status(404).json({ error: 'Not found' })
    }

    const archivedAt = new Date().toISOString()
    const { data: updated, error: updErr } = await supabase
      .from('documents')
      .update({ archived_at: archivedAt })
      .eq('id', id)
      .eq('organization_id', req.user.id)
      .select('*')
      .single()
    if (updErr) throw updErr
    if (!updated) return res.status(404).json({ error: 'Not found' })

    const projectMap = {}
    if (updated.project_id) {
      const { data: p } = await supabase
        .from('projects')
        .select('name')
        .eq('id', updated.project_id)
        .eq('user_id', req.user.id)
        .maybeSingle()
      if (p?.name) projectMap[updated.project_id] = p.name
    }
    const project_name = displayProjectNameForDocument(updated, projectMap)

    res.json({
      ...updated,
      project_name,
      archived: true,
      message:
        'Documents are kept permanently for legal and tax purposes. This document was archived instead of deleted.',
    })
  } catch (err) {
    console.error('[documents] delete→archive', err)
    res.status(500).json({ error: err.message || 'Update failed' })
  }
})

module.exports = router
