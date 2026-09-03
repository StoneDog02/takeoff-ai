/**
 * Resolve client email(s) for estimate/invoice sends.
 * Document recipient_emails (full list) wins when present; otherwise project client_email.
 */

const OPEN_ESTIMATE_STATUSES = ['draft', 'sent', 'viewed', 'changes_requested']
const OPEN_INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'overdue']

/**
 * Normalize a recipient list: trim, drop empties, dedupe case-insensitively (keep first casing).
 * @param {unknown} input
 * @returns {string[]}
 */
function normalizeRecipientEmails(input) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[,;\s]+/)
      : []
  const seen = new Set()
  const out = []
  for (const item of raw) {
    const email = String(item || '').trim()
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(email)
  }
  return out
}

function firstSavedRecipient(recipientEmails) {
  return normalizeRecipientEmails(recipientEmails)[0] || ''
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ job_id?: string | null, recipient_emails?: unknown }} doc
 * @returns {Promise<string>}
 */
async function resolveJobClientEmail(supabase, userId, doc) {
  const list = await resolveRecipientEmailsForSend(supabase, userId, doc)
  return list[0] || ''
}

/**
 * Prefer all saved document recipients; if empty, fall back to project client_email.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ job_id?: string | null, recipient_emails?: unknown }} doc
 * @returns {Promise<string[]>}
 */
async function resolveRecipientEmailsForSend(supabase, userId, doc) {
  const saved = normalizeRecipientEmails(doc.recipient_emails)
  if (saved.length > 0) return saved

  const jobId = doc.job_id && String(doc.job_id).trim() ? String(doc.job_id).trim() : ''
  if (!jobId) return []

  const { data: proj } = await supabase
    .from('projects')
    .select('client_email')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle()

  const projectEmail = proj?.client_email ? String(proj.client_email).trim() : ''
  return projectEmail ? [projectEmail] : []
}

/**
 * When project client info changes, keep open estimate/invoice recipient lists in sync.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} projectId
 * @param {string} clientEmail
 */
async function syncJobRecipientEmailsFromProjectClientEmail(supabase, userId, projectId, clientEmail) {
  const email = clientEmail ? String(clientEmail).trim() : ''
  if (!projectId || !email) return

  const recipients = [email]
  const ts = new Date().toISOString()

  await supabase
    .from('estimates')
    .update({ recipient_emails: recipients, updated_at: ts })
    .eq('job_id', projectId)
    .eq('user_id', userId)
    .in('status', OPEN_ESTIMATE_STATUSES)

  await supabase
    .from('invoices')
    .update({ recipient_emails: recipients, updated_at: ts })
    .eq('job_id', projectId)
    .eq('user_id', userId)
    .in('status', OPEN_INVOICE_STATUSES)
}

/**
 * Persist resolved recipients only when the document had none saved (project fallback used).
 * Never collapse an existing multi-recipient list.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {'estimates' | 'invoices'} table
 * @param {string} id
 * @param {unknown} savedRecipients
 * @param {string | string[]} resolvedEmails
 */
async function persistResolvedRecipientIfChanged(supabase, table, id, savedRecipients, resolvedEmails) {
  const saved = normalizeRecipientEmails(savedRecipients)
  if (saved.length > 0) return

  const resolved = normalizeRecipientEmails(resolvedEmails)
  if (resolved.length === 0) return

  await supabase
    .from(table)
    .update({ recipient_emails: resolved, updated_at: new Date().toISOString() })
    .eq('id', id)
}

module.exports = {
  OPEN_ESTIMATE_STATUSES,
  OPEN_INVOICE_STATUSES,
  normalizeRecipientEmails,
  firstSavedRecipient,
  resolveJobClientEmail,
  resolveRecipientEmailsForSend,
  syncJobRecipientEmailsFromProjectClientEmail,
  persistResolvedRecipientIfChanged,
}
