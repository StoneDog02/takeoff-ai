/**
 * Build authenticated document viewer payloads (mirrors public portal shapes where applicable).
 */
const { isChangeOrderEstimateTitle } = require('./estimatePortalKind')
const { fetchPublicCompanyProfile, companyRowToPublic } = require('./publicCompanyProfile')
const { fetchInvoiceBranding } = require('./invoiceBranding')

const COMPLETION_LABELS = {
  on_phase_completion: 'Due when phase completes',
  net_15: '15 days after completion',
  net_30: '30 days after completion',
  net_45: '45 days after completion',
  net_60: '60 days after completion',
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatDueDisplay(row) {
  if (row.mode === 'specific_date' && row.specificDate) {
    const d = String(row.specificDate).slice(0, 10)
    return `Due ${d}`
  }
  const key = row.completionTerms || row.completion_terms
  return COMPLETION_LABELS[key] || 'On completion'
}

function computeInvoiceRowStatus(row, invoiceStatus, meta) {
  const st = String(invoiceStatus || '').toLowerCase()
  if (st === 'paid') return 'paid'

  const readyIds = Array.isArray(meta?.milestone_ready_for_payment)
    ? meta.milestone_ready_for_payment.map(String)
    : []
  const mid = String(row.milestone_id || '')
  const ready = readyIds.includes(mid)

  if (row.mode === 'specific_date' && row.specificDate) {
    const due = String(row.specificDate).slice(0, 10)
    if (todayIsoDate() >= due) return 'due_now'
    return 'upcoming'
  }
  if (row.mode === 'on_completion') {
    const ct = row.completionTerms || row.completion_terms
    if (ct === 'on_phase_completion' && ready) return 'due_now'
    if (typeof ct === 'string' && ct.startsWith('net_') && ready) return 'due_now'
    return 'upcoming'
  }
  return 'upcoming'
}

function normStatus(s) {
  return (s || '').toLowerCase().trim()
}

function normTrade(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
}

function categoryMatchesTrade(catName, tradeName) {
  const a = normTrade(catName)
  const b = normTrade(tradeName)
  if (!b) return false
  if (!a) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  const parts = a
    .split(/[/,&]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  for (const p of parts) {
    if (p === b || p.includes(b) || b.includes(p)) return true
  }
  return false
}

function scopeItemsFromTakeoff(materialList, tradeName) {
  const cats = materialList?.categories
  if (!Array.isArray(cats) || !normTrade(tradeName)) return []

  let matchedCat = null
  for (const cat of cats) {
    if (categoryMatchesTrade(cat?.name, tradeName)) {
      matchedCat = cat
      break
    }
  }

  const rawItems = matchedCat && Array.isArray(matchedCat.items) ? matchedCat.items : []

  return rawItems.map((it) => ({
    description: it.description != null ? String(it.description) : '',
    quantity:
      typeof it.quantity === 'number' && !Number.isNaN(it.quantity)
        ? it.quantity
        : Number(it.quantity) || 0,
    unit: it.unit != null ? String(it.unit) : '',
  }))
}

function estimatePayloadFromRows(est, project, lineItems) {
  const address = project
    ? [project.address_line_1, project.address_line_2, project.city, project.state, project.postal_code]
        .filter(Boolean)
        .join(', ')
    : ''
  const clientName = project && project.assigned_to_name ? String(project.assigned_to_name).trim() : null
  const gcName = 'Your contractor'
  const milestones = []
  if (Number(est.invoiced_amount) > 0) {
    milestones.push({ label: 'Invoiced to date', amount: Number(est.invoiced_amount) })
  }
  const estimateNumber = est.id ? `EST-${String(est.id).slice(-6).toUpperCase()}` : ''
  const totalAmount = Number(est.total_amount) || 0

  const section_notes = (() => {
    const out = []
    const meta = est.estimate_groups_meta
    if (!Array.isArray(meta)) return out
    for (const g of meta) {
      if (!g || typeof g !== 'object' || g.source === 'custom') continue
      const sec = g.categoryName != null ? String(g.categoryName).trim() : ''
      if (!sec) continue
      const gc = g.gcSectionNote != null ? String(g.gcSectionNote).trim() : ''
      const subs = Array.isArray(g.subNotes)
        ? g.subNotes
            .map((n) => ({
              subcontractor:
                n && n.subcontractor != null ? String(n.subcontractor).trim() : 'Subcontractor',
              text: n && n.text != null ? String(n.text).trim() : '',
            }))
            .filter((n) => n.text)
        : []
      if (gc || subs.length) out.push({ section: sec, gc_note: gc || null, sub_notes: subs })
    }
    return out
  })()

  const section_work_types = (() => {
    const map = {}
    const meta = est.estimate_groups_meta
    if (!Array.isArray(meta)) return map
    for (const g of meta) {
      if (!g || typeof g !== 'object' || g.source === 'custom') continue
      const key = g.categoryName != null ? String(g.categoryName).trim() : ''
      if (!key) continue
      if (g.source === 'bid') map[key] = 'subcontractor'
      else if (g.source === 'takeoff') {
        map[key] = /\(your\s*work\)\s*$/i.test(key) ? 'gc_self_perform' : 'scope_detail'
      }
    }
    return map
  })()

  milestones.forEach((m) => {
    if (totalAmount > 0) {
      m.percentage = Math.round((Number(m.amount) / totalAmount) * 100)
    } else {
      m.percentage = 0
    }
  })

  const portal_document_kind = isChangeOrderEstimateTitle(est.title) ? 'change_order' : 'estimate'

  return {
    estimate_id: est.id,
    estimate_number: estimateNumber,
    portal_document_kind,
    date_issued: est.sent_at || null,
    expiry_date: null,
    projectName: project && project.name ? project.name : est.title || 'Estimate',
    address,
    clientName,
    clientAddress: address,
    gcName,
    company: null,
    line_items: lineItems || [],
    total: totalAmount,
    invoiced_amount: Number(est.invoiced_amount) || 0,
    milestones,
    notes: est.client_notes != null && String(est.client_notes).trim() ? String(est.client_notes).trim() : null,
    terms: est.client_terms != null && String(est.client_terms).trim() ? String(est.client_terms).trim() : null,
    section_notes,
    section_work_types,
    status: (est.status || 'sent').toLowerCase(),
    sent_at: est.sent_at || null,
    viewed_at: est.viewed_at || null,
    actioned_at: est.actioned_at || null,
    source_change_order_id: est.source_change_order_id || null,
    estimate_groups_meta: Array.isArray(est.estimate_groups_meta) ? est.estimate_groups_meta : null,
  }
}

async function buildEstimateViewer(supabase, userId, estimateId) {
  const { data: est, error } = await supabase
    .from('estimates')
    .select(
      'id, job_id, user_id, title, status, total_amount, invoiced_amount, recipient_emails, sent_at, viewed_at, actioned_at, changes_requested_at, changes_requested_message, client_notes, client_terms, estimate_groups_meta, source_change_order_id'
    )
    .eq('id', estimateId)
    .maybeSingle()
  if (error) throw error
  if (!est || est.user_id !== userId) return null

  let project = null
  if (est.job_id) {
    const { data: proj } = await supabase
      .from('projects')
      .select('id, name, address_line_1, address_line_2, city, state, postal_code, assigned_to_name')
      .eq('id', est.job_id)
      .eq('user_id', userId)
      .maybeSingle()
    project = proj
  }

  const { data: lineItems } = await supabase
    .from('estimate_line_items')
    .select('id, description, quantity, unit, unit_price, total, section')
    .eq('estimate_id', est.id)
    .order('id')

  const payload = estimatePayloadFromRows(est, project, lineItems)
  const company = await fetchPublicCompanyProfile(supabase, est.user_id)
  if (company) {
    payload.company = company
    payload.gcName = company.name || 'Your contractor'
  }
  let change_order_reference = null
  if (est.source_change_order_id && est.job_id) {
    const { data: co } = await supabase
      .from('project_change_orders')
      .select('id, description, amount, status')
      .eq('id', est.source_change_order_id)
      .eq('project_id', est.job_id)
      .maybeSingle()
    if (co) {
      change_order_reference = {
        description: co.description || null,
        amount: co.amount != null ? Number(co.amount) : null,
        status: co.status || null,
      }
    }
  }
  return { payload, change_order_reference }
}

async function buildInvoiceViewer(supabase, userId, invoiceId) {
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .select(
      'id, user_id, estimate_id, job_id, status, total_amount, recipient_emails, due_date, paid_at, sent_at, created_at, schedule_snapshot, client_token'
    )
    .eq('id', invoiceId)
    .maybeSingle()
  if (invErr) throw invErr
  if (!inv || inv.user_id !== userId) return null

  let estimate = null
  if (inv.estimate_id) {
    const { data: est } = await supabase
      .from('estimates')
      .select('id, client_notes, client_terms, estimate_groups_meta, title')
      .eq('id', inv.estimate_id)
      .maybeSingle()
    estimate = est
  }

  let project = null
  if (inv.job_id) {
    const { data: proj } = await supabase
      .from('projects')
      .select('id, name, address_line_1, address_line_2, city, state, postal_code, assigned_to_name')
      .eq('id', inv.job_id)
      .eq('user_id', userId)
      .maybeSingle()
    project = proj
  }

  const address = project
    ? [project.address_line_1, project.address_line_2, project.city, project.state, project.postal_code].filter(Boolean).join(', ')
    : ''
  const clientName = project?.assigned_to_name ? String(project.assigned_to_name).trim() : null

  const meta =
    estimate?.estimate_groups_meta && typeof estimate.estimate_groups_meta === 'object' && !Array.isArray(estimate.estimate_groups_meta)
      ? estimate.estimate_groups_meta
      : {}

  const snap = inv.schedule_snapshot && typeof inv.schedule_snapshot === 'object' ? inv.schedule_snapshot : {}
  const rawRows = Array.isArray(snap.rows) ? snap.rows : []

  const schedule_rows = rawRows.map((row) => {
    const due_display = formatDueDisplay(row)
    const status = computeInvoiceRowStatus(row, inv.status, meta)
    return {
      milestone_id: String(row.milestone_id || ''),
      label: String(row.label || 'Milestone'),
      amount: Number(row.amount) || 0,
      mode: row.mode === 'on_completion' ? 'on_completion' : 'specific_date',
      specific_date: row.specificDate || row.specific_date || null,
      completion_terms: row.completionTerms || row.completion_terms || null,
      due_display,
      status,
    }
  })

  let line_items = []
  if (schedule_rows.length === 0 && inv.estimate_id) {
    const { data: items } = await supabase
      .from('estimate_line_items')
      .select('id, description, quantity, unit, unit_price, total, section')
      .eq('estimate_id', inv.estimate_id)
      .order('id')
    line_items = (items || []).map((li) => ({
      id: li.id,
      description: li.description,
      quantity: Number(li.quantity) || 0,
      unit: li.unit || 'ea',
      unit_price: Number(li.unit_price) || 0,
      total: Number(li.total) || 0,
      section: li.section,
    }))
  }

  const amount_due_now = schedule_rows.filter((r) => r.status === 'due_now').reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

  const company = await fetchPublicCompanyProfile(supabase, inv.user_id)
  const branding = await fetchInvoiceBranding(supabase, inv.user_id)

  const payload = {
    invoice_id: inv.id,
    estimate_id: inv.estimate_id,
    job_id: inv.job_id,
    status: (inv.status || 'draft').toLowerCase(),
    total_amount: Number(inv.total_amount) || 0,
    amount_due_now,
    due_date: inv.due_date || null,
    paid_at: inv.paid_at || null,
    sent_at: inv.sent_at || null,
    projectName: project?.name || estimate?.title || 'Invoice',
    address,
    clientName,
    gcName: company?.name || 'Your contractor',
    company,
    invoice_kind: schedule_rows.length > 0 ? 'progress_series' : 'single',
    schedule_rows,
    line_items,
    notes:
      estimate?.client_notes != null && String(estimate.client_notes).trim() ? String(estimate.client_notes).trim() : null,
    terms:
      estimate?.client_terms != null && String(estimate.client_terms).trim() ? String(estimate.client_terms).trim() : null,
    branding,
  }

  const overdue_days = (() => {
    const st = (inv.status || '').toLowerCase()
    if (st === 'paid' || inv.paid_at) return null
    if (!inv.due_date) return null
    const due = new Date(`${String(inv.due_date).slice(0, 10)}T12:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    if (Number.isNaN(due.getTime()) || due >= today) return null
    return Math.ceil((today.getTime() - due.getTime()) / 86400000)
  })()

  return { payload, overdue_days }
}

async function buildBidViewer(supabase, userId, subBidId) {
  const { data: bid, error: bidErr } = await supabase
    .from('sub_bids')
    .select(
      'id, trade_package_id, subcontractor_id, amount, notes, availability, quote_url, compliance_documents, awarded, response_status, responded_at, dispatched_at, response_deadline, portal_token'
    )
    .eq('id', subBidId)
    .maybeSingle()
  if (bidErr) throw bidErr
  if (!bid) return null

  const [{ data: pkg }, { data: sub }] = await Promise.all([
    supabase.from('trade_packages').select('id, project_id, trade_tag, line_items').eq('id', bid.trade_package_id).maybeSingle(),
    supabase.from('subcontractors').select('id, name').eq('id', bid.subcontractor_id).maybeSingle(),
  ])
  const projectId = pkg?.project_id
  const tradeName = pkg?.trade_tag || ''

  const { data: proj } = projectId
    ? await supabase
        .from('projects')
        .select('id, name, status, user_id, address_line_1, address_line_2, city, state, postal_code')
        .eq('id', projectId)
        .maybeSingle()
    : { data: null }

  if (!proj || proj.user_id !== userId) return null

  const [takeoffRes, companyRes] = await Promise.all([
    projectId
      ? supabase
          .from('project_takeoffs')
          .select('material_list')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    proj.user_id
      ? supabase
          .from('company_settings')
          .select(
            'name, logo_url, phone, email, website, license_number, address_line_1, address_line_2, city, state, postal_code'
          )
          .eq('user_id', proj.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const materialList = takeoffRes?.data?.material_list
  const scope_items =
    materialList && typeof materialList === 'object' ? scopeItemsFromTakeoff(materialList, tradeName) : []

  const status = bid.awarded ? 'awarded' : bid.response_status || 'pending'
  const project_address = proj
    ? [proj.address_line_1, proj.address_line_2, proj.city, proj.state, proj.postal_code].filter(Boolean).join(', ')
    : ''
  const scope = Array.isArray(pkg?.line_items) ? pkg.line_items : []
  const project_name = proj?.name || ''
  const company = companyRowToPublic(companyRes?.data)
  const gc_name = (company?.name && String(company.name).trim()) || ''
  const gc_email_raw = companyRes?.data?.email != null ? String(companyRes.data.email).trim() : ''
  const gc_email = gc_email_raw && /^[^\s@]+@[^\s@]+\.[^\s@]+/.test(gc_email_raw) ? gc_email_raw : ''
  const sub_name = sub?.name || ''
  const dispatched_at = bid.dispatched_at || null
  const response_deadline = bid.response_deadline || null

  const project_cancelled = normStatus(proj.status) === 'cancelled'

  const payload = {
    project_name,
    project_address,
    gc_name: gc_name || null,
    gc_email: gc_email || null,
    company,
    trade_name: tradeName,
    sub_name,
    dispatched_at,
    response_deadline,
    scope_items,
    projectName: project_name,
    address: project_address,
    tradeName,
    scope,
    subName: sub_name,
    status,
    bid_amount: bid.amount != null ? Number(bid.amount) : null,
    notes: bid.notes || null,
    availability: bid.availability || null,
    attachment_url: bid.quote_url || null,
    compliance_documents:
      bid.compliance_documents && typeof bid.compliance_documents === 'object' ? bid.compliance_documents : {},
    responded_at: bid.responded_at || null,
    project_cancelled,
  }

  return { payload }
}

async function buildChangeOrderBudgetViewer(supabase, userId, doc) {
  const meta = doc.metadata && typeof doc.metadata === 'object' ? doc.metadata : {}
  const projectId = doc.project_id
  let project_name = null
  let reference_estimate_number = null
  if (projectId) {
    const { data: proj } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .eq('user_id', userId)
      .maybeSingle()
    project_name = proj?.name ?? null
    const { data: acc } = await supabase
      .from('estimates')
      .select('id')
      .eq('job_id', projectId)
      .eq('status', 'accepted')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (acc?.id) {
      reference_estimate_number = `EST-${String(acc.id).slice(-6).toUpperCase()}`
    }
  }
  const refSuffix = doc.source_id ? String(doc.source_id).replace(/-/g, '').slice(-6).toUpperCase() : '—'
  return {
    co_number_suffix: refSuffix,
    title: doc.title || 'Change order',
    total_amount: doc.total_amount != null ? Number(doc.total_amount) : null,
    category: meta.category != null ? String(meta.category) : null,
    unit: meta.unit != null ? String(meta.unit) : null,
    source: meta.source != null ? String(meta.source) : null,
    predicted: meta.predicted != null ? Number(meta.predicted) : null,
    actual: meta.actual != null ? Number(meta.actual) : null,
    project_name,
    reference_estimate_number,
    status: doc.status || null,
    created_at: doc.created_at || null,
  }
}

function buildReceiptViewer(doc) {
  const meta = doc.metadata && typeof doc.metadata === 'object' ? doc.metadata : {}
  return {
    file_url: doc.file_url || null,
    title: doc.title || 'Receipt',
    vendor: meta.vendor != null ? String(meta.vendor) : null,
    date: meta.date != null ? String(meta.date) : null,
    description: meta.description != null ? String(meta.description) : null,
    category: meta.category != null ? String(meta.category) : null,
    total_amount: doc.total_amount != null ? Number(doc.total_amount) : null,
  }
}

/**
 * @returns {Promise<{ type: string, data: object, overdue_days?: number | null, change_order_reference?: object | null } | null>}
 */
async function buildViewerEnvelope(supabase, userId, doc) {
  const t = doc.document_type
  try {
    if (t === 'estimate' && doc.source_id) {
      const r = await buildEstimateViewer(supabase, userId, doc.source_id)
      if (!r) return null
      return { type: 'estimate', data: r.payload, change_order_reference: r.change_order_reference }
    }
    if (t === 'invoice' && doc.source_id) {
      const r = await buildInvoiceViewer(supabase, userId, doc.source_id)
      if (!r) return null
      return { type: 'invoice', data: r.payload, overdue_days: r.overdue_days }
    }
    if (t === 'bid_package' && doc.source_id) {
      const r = await buildBidViewer(supabase, userId, doc.source_id)
      if (!r) return null
      return { type: 'bid_package', data: r.payload }
    }
    if (t === 'change_order') {
      if (doc.source_id) {
        const { data: estRow } = await supabase
          .from('estimates')
          .select('id')
          .eq('id', doc.source_id)
          .eq('user_id', userId)
          .maybeSingle()
        if (estRow) {
          const r = await buildEstimateViewer(supabase, userId, doc.source_id)
          if (r) return { type: 'estimate', data: r.payload, change_order_reference: r.change_order_reference }
        }
      }
      const data = await buildChangeOrderBudgetViewer(supabase, userId, doc)
      return { type: 'change_order', data }
    }
    if (t === 'receipt') {
      return { type: 'receipt', data: buildReceiptViewer(doc) }
    }
    return {
      type: 'generic',
      data: {
        title: doc.title || t,
        document_type: t,
        status: doc.status,
        total_amount: doc.total_amount,
        metadata: doc.metadata || {},
      },
    }
  } catch (e) {
    console.error('[documentViewerData]', e)
    return null
  }
}

function originalProjectNameFromMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null
  const n = metadata.original_project_name
  return typeof n === 'string' && n.trim() ? n.trim() : null
}

async function attachProjectName(supabase, userId, doc) {
  if (doc.project_id) {
    const { data: p } = await supabase
      .from('projects')
      .select('name')
      .eq('id', doc.project_id)
      .eq('user_id', userId)
      .maybeSingle()
    return { ...doc, project_name: p?.name ?? null }
  }
  return { ...doc, project_name: originalProjectNameFromMetadata(doc.metadata) }
}

module.exports = {
  buildViewerEnvelope,
  attachProjectName,
}
