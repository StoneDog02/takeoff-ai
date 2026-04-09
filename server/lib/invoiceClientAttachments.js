const crypto = require('crypto')
const { randomUUID } = crypto

const BUILD_PLANS_BUCKET = 'job-walk-media'
const INVOICE_ATTACH_PREFIX = 'invoice-client-attachments'

function getStoragePathFromUrlOrPath(value, bucket) {
  if (!value || typeof value !== 'string') return null
  if (!value.startsWith('http')) return value
  const patterns = [
    new RegExp(`/object/public/${bucket}/(.+)$`),
    new RegExp(`/object/sign/${bucket}/(.+?)(\\?|$)`),
    new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`),
    new RegExp(`/storage/v1/object/sign/${bucket}/(.+?)(\\?|$)`),
  ]
  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function getClientAttachmentsArray(scheduleSnapshot) {
  if (!scheduleSnapshot || typeof scheduleSnapshot !== 'object' || Array.isArray(scheduleSnapshot)) return []
  const raw = scheduleSnapshot.client_attachments
  return Array.isArray(raw) ? raw : []
}

/**
 * Validate + normalize attachments from client. Drops invalid rows.
 * @returns {Promise<Array<{id: string, label: string, kind: string, sub_bid_id?: string, project_bid_document_id?: string, project_id?: string, storage_path?: string}>>}
 */
async function validateAndNormalizeClientAttachments(supabase, userId, jobId, rawList, opts = {}) {
  const { allowUploads = false } = opts
  if (!Array.isArray(rawList) || rawList.length === 0) return []
  const out = []
  for (const row of rawList) {
    if (!row || typeof row !== 'object') continue
    const kind = String(row.kind || '').trim()
    const id = String(row.id || '').trim() || randomUUID()
    if (kind === 'sub_bid_quote') {
      const subBidId = String(row.sub_bid_id || '').trim()
      if (!subBidId || !jobId) continue
      const { data: sb, error } = await supabase
        .from('sub_bids')
        .select('id, quote_url, awarded, trade_package_id, subcontractor_id')
        .eq('id', subBidId)
        .eq('awarded', true)
        .maybeSingle()
      if (error || !sb) continue
      const { data: tp } = await supabase
        .from('trade_packages')
        .select('project_id, trade_tag')
        .eq('id', sb.trade_package_id)
        .maybeSingle()
      if (String(tp?.project_id) !== String(jobId)) continue
      const qu = sb.quote_url != null ? String(sb.quote_url).trim() : ''
      if (!qu) continue
      const { data: proj } = await supabase.from('projects').select('id').eq('id', jobId).eq('user_id', userId).maybeSingle()
      if (!proj) continue
      const { data: subRow } = await supabase
        .from('subcontractors')
        .select('name')
        .eq('id', sb.subcontractor_id)
        .maybeSingle()
      const subName = subRow?.name ? String(subRow.name).trim() : 'Subcontractor'
      const trade = tp?.trade_tag ? String(tp.trade_tag).trim() : 'Trade'
      out.push({
        id,
        kind: 'sub_bid_quote',
        label: String(row.label || '').trim() || `Awarded quote — ${trade} — ${subName}`,
        sub_bid_id: subBidId,
      })
      continue
    }
    if (kind === 'project_bid_document') {
      const docId = String(row.project_bid_document_id || '').trim()
      if (!docId || !jobId) continue
      const { data: doc, error } = await supabase
        .from('project_bid_documents')
        .select('id, file_name, project_id')
        .eq('id', docId)
        .eq('project_id', jobId)
        .maybeSingle()
      if (error || !doc) continue
      const { data: proj } = await supabase.from('projects').select('id').eq('id', jobId).eq('user_id', userId).maybeSingle()
      if (!proj) continue
      out.push({
        id,
        kind: 'project_bid_document',
        label: String(row.label || '').trim() || String(doc.file_name || 'Bid document'),
        project_bid_document_id: docId,
        project_id: String(jobId),
      })
      continue
    }
    if (kind === 'invoice_upload') {
      if (!allowUploads) continue
      const storagePath = String(row.storage_path || '').trim()
      if (!storagePath || !storagePath.startsWith(`${INVOICE_ATTACH_PREFIX}/`)) continue
      const parts = storagePath.split('/')
      if (parts.length < 4 || parts[1] !== String(userId)) continue
      out.push({
        id,
        kind: 'invoice_upload',
        label: String(row.label || '').trim() || 'Attachment',
        storage_path: storagePath,
      })
    }
  }
  return out
}

/**
 * Merge validated attachments into schedule_snapshot (immutable copy).
 */
function mergeClientAttachmentsIntoSnapshot(scheduleSnapshot, validatedAttachments) {
  const base =
    scheduleSnapshot && typeof scheduleSnapshot === 'object' && !Array.isArray(scheduleSnapshot) ? { ...scheduleSnapshot } : {}
  if (!validatedAttachments || validatedAttachments.length === 0) {
    if ('client_attachments' in base) delete base.client_attachments
    return base
  }
  base.client_attachments = validatedAttachments
  return base
}

/**
 * Resolve one attachment to a time-limited signed URL (or external https quote URL).
 * @returns {Promise<string|null>}
 */
async function resolveClientAttachmentUrl(supabase, invoice, attachment) {
  if (!attachment || typeof attachment !== 'object') return null
  const kind = String(attachment.kind || '')
  const jobId = invoice.job_id || null

  if (kind === 'sub_bid_quote') {
    const subBidId = String(attachment.sub_bid_id || '')
    if (!subBidId || !jobId) return null
    const { data: sb, error } = await supabase
      .from('sub_bids')
      .select('quote_url, awarded, trade_package_id')
      .eq('id', subBidId)
      .eq('awarded', true)
      .maybeSingle()
    if (error || !sb?.quote_url) return null
    const { data: tp } = await supabase.from('trade_packages').select('project_id').eq('id', sb.trade_package_id).maybeSingle()
    if (String(tp?.project_id) !== String(jobId)) return null
    const raw = String(sb.quote_url).trim()
    if (!raw) return null
    const path = getStoragePathFromUrlOrPath(raw, BUILD_PLANS_BUCKET)
    if (path) {
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUILD_PLANS_BUCKET)
        .createSignedUrl(path, 3600)
      if (!signErr && signed?.signedUrl) return signed.signedUrl
    }
    if (raw.startsWith('https://') || raw.startsWith('http://')) {
      return raw
    }
    return null
  }

  if (kind === 'project_bid_document') {
    const docId = String(attachment.project_bid_document_id || '')
    const pid = String(attachment.project_id || jobId || '')
    if (!docId || !pid) return null
    const { data: doc, error } = await supabase
      .from('project_bid_documents')
      .select('url')
      .eq('id', docId)
      .eq('project_id', pid)
      .maybeSingle()
    if (error || !doc?.url) return null
    let path = doc.url
    if (typeof path === 'string' && path.startsWith('http')) {
      const m =
        path.match(/\/object\/public\/[^/]+\/(.+)$/) || path.match(/\/storage\/v1\/object\/[^/]+\/[^/]+\/(.+)$/)
      path = m ? m[1] : path
    }
    const storagePath = getStoragePathFromUrlOrPath(String(path), BUILD_PLANS_BUCKET) || (typeof path === 'string' && !path.startsWith('http') ? path : null)
    if (!storagePath) return null
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUILD_PLANS_BUCKET)
      .createSignedUrl(storagePath, 3600)
    if (!signErr && signed?.signedUrl) return signed.signedUrl
    return null
  }

  if (kind === 'invoice_upload') {
    const p = String(attachment.storage_path || '').trim()
    if (!p.startsWith(`${INVOICE_ATTACH_PREFIX}/`)) return null
    const { data: signed, error: signErr } = await supabase.storage.from(BUILD_PLANS_BUCKET).createSignedUrl(p, 3600)
    if (!signErr && signed?.signedUrl) return signed.signedUrl
    return null
  }

  return null
}

module.exports = {
  BUILD_PLANS_BUCKET,
  INVOICE_ATTACH_PREFIX,
  getClientAttachmentsArray,
  validateAndNormalizeClientAttachments,
  mergeClientAttachmentsIntoSnapshot,
  resolveClientAttachmentUrl,
  getStoragePathFromUrlOrPath,
}
