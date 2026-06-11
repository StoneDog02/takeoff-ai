/**
 * Resolve client email for estimate/invoice sends.
 * Project client_email is canonical when set; otherwise the document's saved recipient.
 */

const OPEN_ESTIMATE_STATUSES = ['draft', 'sent', 'viewed', 'changes_requested']
const OPEN_INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'overdue']

function firstSavedRecipient(recipientEmails) {
  const list = Array.isArray(recipientEmails)
    ? recipientEmails.map((e) => String(e || '').trim()).filter(Boolean)
    : []
  return list[0] || ''
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ job_id?: string | null, recipient_emails?: unknown }} doc
 * @returns {Promise<string>}
 */
async function resolveJobClientEmail(supabase, userId, doc) {
  const saved = firstSavedRecipient(doc.recipient_emails)
  const jobId = doc.job_id && String(doc.job_id).trim() ? String(doc.job_id).trim() : ''
  if (!jobId) return saved

  const { data: proj } = await supabase
    .from('projects')
    .select('client_email')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle()

  const projectEmail = proj?.client_email ? String(proj.client_email).trim() : ''
  return projectEmail || saved
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
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {'estimates' | 'invoices'} table
 * @param {string} id
 * @param {unknown} savedRecipients
 * @param {string} resolvedEmail
 */
async function persistResolvedRecipientIfChanged(supabase, table, id, savedRecipients, resolvedEmail) {
  const normalized = resolvedEmail ? String(resolvedEmail).trim() : ''
  if (!normalized) return
  if (firstSavedRecipient(savedRecipients) === normalized) return
  await supabase
    .from(table)
    .update({ recipient_emails: [normalized], updated_at: new Date().toISOString() })
    .eq('id', id)
}

module.exports = {
  OPEN_ESTIMATE_STATUSES,
  OPEN_INVOICE_STATUSES,
  firstSavedRecipient,
  resolveJobClientEmail,
  syncJobRecipientEmailsFromProjectClientEmail,
  persistResolvedRecipientIfChanged,
}
