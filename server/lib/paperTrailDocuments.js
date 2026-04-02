/**
 * Fire-and-forget inserts into public.documents (paper trail).
 * Uses SUPABASE_SERVICE_ROLE_KEY when set so organization_id is always the GC user_id
 * even if RLS or caller context differs; otherwise uses the request-scoped client.
 */

const { supabase: defaultSupabase } = require('../db/supabase')
const { isChangeOrderEstimateTitle } = require('./estimatePortalKind')

function getPaperTrailClient(userSupabase) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && defaultSupabase) return defaultSupabase
  return userSupabase
}

function recordPaperTrailDocument(userSupabase, organizationUserId, row) {
  if (!organizationUserId || !row?.document_type) return
  const db = getPaperTrailClient(userSupabase)
  if (!db) return
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {}
  const payload = {
    ...row,
    organization_id: organizationUserId,
    metadata,
  }
  void db
    .from('documents')
    .insert(payload)
    .then(({ error }) => {
      if (error) console.error('[paperTrail]', row.document_type, error.message || error)
    })
    .catch((err) => console.error('[paperTrail]', row.document_type, err))
}

/** Snapshot line items after estimate is marked sent (async fetch, non-blocking). */
function recordEstimateSentPaperTrail(userSupabase, organizationUserId, estimateId, estimateSnapshot) {
  const run = async () => {
    const db = getPaperTrailClient(userSupabase)
    if (!db) return
    const { data: lines } = await db
      .from('estimate_line_items')
      .select('description, quantity, unit, unit_price, total, section')
      .eq('estimate_id', estimateId)
    const emails = estimateSnapshot.recipient_emails
    const clientEmail = Array.isArray(emails) && emails[0] ? String(emails[0]).trim() : null
    const title = estimateSnapshot.title || 'Estimate'
    const isCo = isChangeOrderEstimateTitle(title)
    const snapshotAt = isCo ? 'change_order_sent' : 'estimate_sent'
    recordPaperTrailDocument(userSupabase, organizationUserId, {
      document_type: isCo ? 'change_order' : 'estimate',
      project_id: estimateSnapshot.job_id || null,
      title,
      status: 'sent',
      total_amount: estimateSnapshot.total_amount != null ? Number(estimateSnapshot.total_amount) : null,
      client_name: null,
      client_email: clientEmail,
      token: estimateSnapshot.client_token || null,
      source_id: estimateId,
      sent_at: estimateSnapshot.sent_at || null,
      metadata: {
        snapshot_at: snapshotAt,
        recipient_emails: emails || [],
        client_notes: estimateSnapshot.client_notes ?? null,
        client_terms: estimateSnapshot.client_terms ?? null,
        estimate_groups_meta: estimateSnapshot.estimate_groups_meta ?? null,
        line_items: lines || [],
        source_change_order_id: estimateSnapshot.source_change_order_id ?? null,
      },
    })
  }
  void run().catch((e) => console.error('[paperTrail] estimate_sent async', e))
}

function recordInvoiceSentPaperTrail(userSupabase, organizationUserId, invoiceRow) {
  const emails = invoiceRow.recipient_emails
  const clientEmail = Array.isArray(emails) && emails[0] ? String(emails[0]).trim() : null
  recordPaperTrailDocument(userSupabase, organizationUserId, {
    document_type: 'invoice',
    project_id: invoiceRow.job_id || null,
    title: 'Invoice',
    status: 'sent',
    total_amount: invoiceRow.total_amount != null ? Number(invoiceRow.total_amount) : null,
    client_name: null,
    client_email: clientEmail,
    token: invoiceRow.client_token || null,
    source_id: invoiceRow.id,
    sent_at: invoiceRow.sent_at || null,
    metadata: {
      snapshot_at: 'invoice_sent',
      recipient_emails: emails || [],
      due_date: invoiceRow.due_date ?? null,
      schedule_snapshot: invoiceRow.schedule_snapshot ?? null,
      estimate_id: invoiceRow.estimate_id ?? null,
    },
  })
}

function recordBidPackageDispatchedPaperTrail(userSupabase, organizationUserId, fields) {
  recordPaperTrailDocument(userSupabase, organizationUserId, {
    document_type: 'bid_package',
    project_id: fields.project_id,
    title: fields.trade_tag ? `Bid — ${fields.trade_tag}` : 'Bid package',
    status: 'dispatched',
    total_amount: fields.amount != null ? Number(fields.amount) : null,
    client_name: fields.subcontractor_name || null,
    client_email: fields.subcontractor_email || null,
    token: fields.token || null,
    source_id: fields.sub_bid_id || null,
    sent_at: fields.dispatched_at || null,
    metadata: {
      snapshot_at: 'bid_dispatched',
      trade_tag: fields.trade_tag || null,
      trade_package_id: fields.trade_package_id || null,
      subcontractor_id: fields.subcontractor_id || null,
      notes: fields.notes ?? null,
      response_deadline: fields.response_deadline ?? null,
      project_name: fields.project_name || null,
      portal_url: fields.portal_url || null,
    },
  })
}

function recordReceiptScanPaperTrail(userSupabase, organizationUserId, parsed, projectId) {
  const vendor = parsed.vendor != null ? String(parsed.vendor).trim() : ''
  recordPaperTrailDocument(userSupabase, organizationUserId, {
    document_type: 'receipt',
    project_id: projectId || null,
    title: vendor ? `Receipt — ${vendor}` : 'Receipt scan',
    status: 'scanned',
    total_amount: parsed.total != null ? Number(parsed.total) : null,
    client_name: vendor || null,
    metadata: {
      snapshot_at: 'receipt_scan',
      vendor: parsed.vendor ?? '',
      date: parsed.date ?? '',
      description: parsed.description ?? '',
      category: parsed.category ?? '',
    },
  })
}

async function documentExistsForSource(db, organizationUserId, sourceId, documentType) {
  if (!sourceId || !documentType) return false
  const { data: row } = await db
    .from('documents')
    .select('id')
    .eq('organization_id', organizationUserId)
    .eq('source_id', sourceId)
    .eq('document_type', documentType)
    .maybeSingle()
  return !!row
}

function bidPaperStatus(bid) {
  if (bid.awarded) return 'awarded'
  const rs = (bid.response_status || '').toLowerCase()
  if (!rs || rs === 'pending') return 'dispatched'
  return rs
}

/**
 * Keep paper-trail row in sync after client portal updates estimate (accept / decline / request changes / viewed).
 * Uses service-role client when available so public portal routes can update without user JWT.
 */
async function syncPaperTrailFromEstimate(supabase, estimateId) {
  const db = getPaperTrailClient(supabase)
  if (!db || !estimateId) return
  const { data: est, error: fetchErr } = await db
    .from('estimates')
    .select('user_id, status, viewed_at, actioned_at, sent_at, portal_client_acceptance_at')
    .eq('id', estimateId)
    .maybeSingle()
  if (fetchErr || !est) return
  const st = (est.status || 'sent').toLowerCase()
  const { error } = await db
    .from('documents')
    .update({
      status: st,
      viewed_at: est.viewed_at || null,
      actioned_at: est.actioned_at || null,
    })
    .eq('source_id', estimateId)
    .in('document_type', ['estimate', 'change_order'])
    .eq('organization_id', est.user_id)
  if (error) console.error('[paperTrail] sync estimate', estimateId, error.message || error)

  const acceptanceAt = est.portal_client_acceptance_at || null
  const { data: docRows, error: metaErr } = await db
    .from('documents')
    .select('id, metadata')
    .eq('source_id', estimateId)
    .in('document_type', ['estimate', 'change_order'])
    .eq('organization_id', est.user_id)
  if (metaErr || !docRows?.length) return
  for (const row of docRows) {
    const base =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? { ...row.metadata } : {}
    if (acceptanceAt) base.client_portal_acceptance_at = acceptanceAt
    else delete base.client_portal_acceptance_at
    const { error: upMeta } = await db.from('documents').update({ metadata: base }).eq('id', row.id)
    if (upMeta) console.error('[paperTrail] sync estimate metadata', estimateId, upMeta.message || upMeta)
  }
}

/**
 * Keep paper-trail bid_package row in sync after sub portal or GC bid-sheet updates.
 */
async function syncPaperTrailFromSubBid(supabase, bidId) {
  const db = getPaperTrailClient(supabase)
  if (!db || !bidId) return
  const { data: bid, error: bidErr } = await db
    .from('sub_bids')
    .select(
      'id, awarded, response_status, dispatched_at, viewed_at, responded_at, trade_package_id'
    )
    .eq('id', bidId)
    .maybeSingle()
  if (bidErr || !bid) return
  const { data: docRow } = await db
    .from('documents')
    .select('organization_id')
    .eq('source_id', bidId)
    .eq('document_type', 'bid_package')
    .maybeSingle()
  if (!docRow?.organization_id) return
  const status = bidPaperStatus(bid)
  const { error } = await db
    .from('documents')
    .update({
      status,
      sent_at: bid.dispatched_at || null,
    })
    .eq('source_id', bidId)
    .eq('document_type', 'bid_package')
    .eq('organization_id', docRow.organization_id)
  if (error) console.error('[paperTrail] sync bid', bidId, error.message || error)
}

async function documentExistsForEstimateSource(db, organizationUserId, estimateId) {
  const { data: row } = await db
    .from('documents')
    .select('id')
    .eq('organization_id', organizationUserId)
    .eq('source_id', estimateId)
    .in('document_type', ['estimate', 'change_order'])
    .maybeSingle()
  return !!row
}

/**
 * Insert missing paper-trail rows for sent estimates / invoices and dispatched bid packages
 * (e.g. created before paper trail existed or if the async insert failed).
 * @param {{ demo?: boolean }} opts — if demo and nothing was inserted from sources, adds sample receipt rows for UI testing.
 * @returns {Promise<{ estimates: number, invoices: number, bid_packages: number, demo: number, errors: string[] }>}
 */
async function backfillPaperTrailDocuments(userSupabase, organizationUserId, opts = {}) {
  const demo = opts.demo === true
  const db = getPaperTrailClient(userSupabase)
  const errors = []
  let estimates = 0
  let invoices = 0
  let bid_packages = 0
  let demoCount = 0

  if (!db || !organizationUserId) {
    return { estimates: 0, invoices: 0, bid_packages: 0, demo: 0, errors: ['No database client'] }
  }

  let docCountBefore = 0
  const { count: docCountRaw, error: countErr } = await db
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationUserId)
  if (!countErr && typeof docCountRaw === 'number') docCountBefore = docCountRaw

  const { data: estRows, error: estListErr } = await db
    .from('estimates')
    .select('*')
    .eq('user_id', organizationUserId)
    .not('sent_at', 'is', null)
  if (estListErr) errors.push(`list estimates: ${estListErr.message}`)
  else {
    for (const est of estRows || []) {
      if (await documentExistsForEstimateSource(db, organizationUserId, est.id)) continue
      const { data: lines } = await db
        .from('estimate_line_items')
        .select('description, quantity, unit, unit_price, total, section')
        .eq('estimate_id', est.id)
      const emails = est.recipient_emails
      const clientEmail = Array.isArray(emails) && emails[0] ? String(emails[0]).trim() : null
      const st = (est.status || 'sent').toLowerCase()
      const title = est.title || 'Estimate'
      const isCo = isChangeOrderEstimateTitle(title)
      const payload = {
        organization_id: organizationUserId,
        document_type: isCo ? 'change_order' : 'estimate',
        project_id: est.job_id || null,
        title,
        status: st,
        total_amount: est.total_amount != null ? Number(est.total_amount) : null,
        client_name: null,
        client_email: clientEmail,
        token: est.client_token || null,
        source_id: est.id,
        sent_at: est.sent_at || null,
        viewed_at: est.viewed_at || null,
        actioned_at: est.actioned_at || null,
        metadata: {
          snapshot_at: isCo ? 'backfill_change_order' : 'backfill_estimate',
          recipient_emails: emails || [],
          client_notes: est.client_notes ?? null,
          client_terms: est.client_terms ?? null,
          estimate_groups_meta: est.estimate_groups_meta ?? null,
          line_items: lines || [],
          source_change_order_id: est.source_change_order_id ?? null,
        },
      }
      const { error: insErr } = await db.from('documents').insert(payload)
      if (insErr) errors.push(`estimate ${est.id}: ${insErr.message}`)
      else estimates += 1
    }
  }

  const { data: invRows, error: invListErr } = await db
    .from('invoices')
    .select('*')
    .eq('user_id', organizationUserId)
    .not('sent_at', 'is', null)
  if (invListErr) errors.push(`list invoices: ${invListErr.message}`)
  else {
    for (const inv of invRows || []) {
      if (await documentExistsForSource(db, organizationUserId, inv.id, 'invoice')) continue
      const emails = inv.recipient_emails
      const clientEmail = Array.isArray(emails) && emails[0] ? String(emails[0]).trim() : null
      const st = (inv.status || 'sent').toLowerCase()
      const payload = {
        organization_id: organizationUserId,
        document_type: 'invoice',
        project_id: inv.job_id || null,
        title: 'Invoice',
        status: st,
        total_amount: inv.total_amount != null ? Number(inv.total_amount) : null,
        client_name: null,
        client_email: clientEmail,
        token: inv.client_token || null,
        source_id: inv.id,
        sent_at: inv.sent_at || null,
        viewed_at: inv.viewed_at || null,
        metadata: {
          snapshot_at: 'backfill_invoice',
          recipient_emails: emails || [],
          due_date: inv.due_date ?? null,
          schedule_snapshot: inv.schedule_snapshot ?? null,
          estimate_id: inv.estimate_id ?? null,
        },
      }
      const { error: insErr } = await db.from('documents').insert(payload)
      if (insErr) errors.push(`invoice ${inv.id}: ${insErr.message}`)
      else invoices += 1
    }
  }

  const { data: projectRows } = await db.from('projects').select('id').eq('user_id', organizationUserId)
  const projectIds = (projectRows || []).map((p) => p.id)
  if (projectIds.length > 0) {
    const { data: tpRows } = await db
      .from('trade_packages')
      .select('id, trade_tag, project_id')
      .in('project_id', projectIds)
    const tpById = Object.fromEntries((tpRows || []).map((tp) => [tp.id, tp]))
    const tpIds = Object.keys(tpById)
    if (tpIds.length > 0) {
      const { data: bidRows, error: bidListErr } = await db
        .from('sub_bids')
        .select(
          'id, trade_package_id, subcontractor_id, amount, notes, portal_token, dispatched_at, response_deadline, response_status, awarded, quote_url'
        )
        .in('trade_package_id', tpIds)
      if (bidListErr) errors.push(`list sub_bids: ${bidListErr.message}`)
      else {
        const subIds = [...new Set((bidRows || []).map((b) => b.subcontractor_id).filter(Boolean))]
        let subById = {}
        if (subIds.length > 0) {
          const { data: subs } = await db.from('subcontractors').select('id, name, email').in('id', subIds)
          subById = Object.fromEntries((subs || []).map((s) => [s.id, s]))
        }
        for (const bid of bidRows || []) {
          const dispatched = bid.dispatched_at || bid.portal_token
          if (!dispatched) continue
          if (await documentExistsForSource(db, organizationUserId, bid.id, 'bid_package')) continue
          const tp = tpById[bid.trade_package_id]
          const projectId = tp?.project_id || null
          const tradeTag = tp?.trade_tag || null
          const sub = subById[bid.subcontractor_id]
          const baseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:5173'
          const portalUrl =
            bid.portal_token && String(bid.portal_token).trim()
              ? `${String(baseUrl).replace(/\/$/, '')}/bid/${encodeURIComponent(bid.portal_token)}`
              : null
          let projectName = ''
          if (projectId) {
            const { data: proj } = await db.from('projects').select('name').eq('id', projectId).maybeSingle()
            projectName = proj?.name ? String(proj.name) : ''
          }
          const payload = {
            organization_id: organizationUserId,
            document_type: 'bid_package',
            project_id: projectId,
            title: tradeTag ? `Bid — ${tradeTag}` : 'Bid package',
            status: bidPaperStatus(bid),
            total_amount: bid.amount != null ? Number(bid.amount) : null,
            client_name: sub?.name || null,
            client_email: sub?.email ? String(sub.email).trim() : null,
            token: bid.portal_token || null,
            source_id: bid.id,
            sent_at: bid.dispatched_at || null,
            metadata: {
              snapshot_at: 'backfill_bid',
              trade_tag: tradeTag,
              trade_package_id: bid.trade_package_id || null,
              subcontractor_id: bid.subcontractor_id || null,
              notes: bid.notes ?? null,
              response_deadline: bid.response_deadline ?? null,
              project_name: projectName || null,
              portal_url: portalUrl,
            },
          }
          const { error: insErr } = await db.from('documents').insert(payload)
          if (insErr) errors.push(`bid ${bid.id}: ${insErr.message}`)
          else bid_packages += 1
        }
      }
    }
  }

  const inserted = estimates + invoices + bid_packages
  if (demo && inserted === 0 && (docCountBefore === 0 || docCountBefore == null)) {
    const { data: existingDemo } = await db
      .from('documents')
      .select('id')
      .eq('organization_id', organizationUserId)
      .eq('title', 'Demo — UI sample (receipt)')
      .maybeSingle()
    if (!existingDemo) {
      const { error: dErr } = await db.from('documents').insert({
        organization_id: organizationUserId,
        document_type: 'receipt',
        project_id: null,
        title: 'Demo — UI sample (receipt)',
        status: 'scanned',
        total_amount: 127.5,
        client_name: 'Demo Supply Co.',
        metadata: {
          snapshot_at: 'demo_seed',
          vendor: 'Demo Supply Co.',
          date: new Date().toISOString().slice(0, 10),
          description: 'Sample receipt for layout testing (safe to archive).',
          category: 'Materials',
        },
      })
      if (dErr) errors.push(`demo receipt: ${dErr.message}`)
      else demoCount += 1
    }
  }

  return { estimates, invoices, bid_packages, demo: demoCount, errors }
}

module.exports = {
  recordPaperTrailDocument,
  recordEstimateSentPaperTrail,
  recordInvoiceSentPaperTrail,
  recordBidPackageDispatchedPaperTrail,
  recordReceiptScanPaperTrail,
  backfillPaperTrailDocuments,
  syncPaperTrailFromEstimate,
  syncPaperTrailFromSubBid,
  bidPaperStatus,
}
