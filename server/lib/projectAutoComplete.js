/**
 * When billing reaches the full contract, set project status to completed.
 * Idempotent for already-completed jobs.
 *
 * "Billable" estimates = accepted or sent (excludes draft/declined). Completes when either:
 * - estimate.invoiced_amount meets total_amount for every billable row, or
 * - sum of non-draft invoices for the job ≥ sum of billable estimate totals
 *   (covers legacy rows where invoiced_amount drifted from actual invoices).
 */

const EPS = 0.02

/**
 * @returns {Promise<{ completed: boolean }>}
 */
async function maybeAutoCompleteProjectAfterBilling(supabase, userId, jobId) {
  if (!supabase || !userId || !jobId) return { completed: false }
  const jid = String(jobId).trim()
  if (!jid) return { completed: false }

  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('id, status, estimated_value')
    .eq('id', jid)
    .eq('user_id', userId)
    .maybeSingle()
  if (pErr || !project) return { completed: false }

  const st = String(project.status || '').toLowerCase()
  if (st === 'completed') return { completed: false }

  const { data: estimates, error: eErr } = await supabase
    .from('estimates')
    .select('total_amount, invoiced_amount, status')
    .eq('job_id', jid)
    .eq('user_id', userId)
  if (eErr) return { completed: false }

  const { data: invoices, error: iErr } = await supabase
    .from('invoices')
    .select('total_amount, status')
    .eq('job_id', jid)
    .eq('user_id', userId)
  if (iErr) return { completed: false }

  const nonDraft = (invoices || []).filter((i) => String(i.status || '').toLowerCase() !== 'draft')
  const invoiceSumNonDraft = nonDraft.reduce((s, i) => s + (Number(i.total_amount) || 0), 0)

  const billableEstimates = (estimates || []).filter((e) => {
    const s = String(e.status || '').toLowerCase()
    return s === 'accepted' || s === 'sent'
  })

  if (billableEstimates.length > 0) {
    const billableTotalSum = billableEstimates.reduce((s, e) => s + (Number(e.total_amount) || 0), 0)
    const allBillableFullyInvoiced = billableEstimates.every((e) => {
      const tot = Number(e.total_amount) || 0
      const inv = Number(e.invoiced_amount) || 0
      if (tot <= EPS) return true
      return inv >= tot - EPS
    })
    const byInvoiceTotals = billableTotalSum > EPS && invoiceSumNonDraft >= billableTotalSum - EPS

    if (allBillableFullyInvoiced || byInvoiceTotals) {
      const now = new Date().toISOString()
      await supabase
        .from('projects')
        .update({ status: 'completed', updated_at: now, completed_at: now })
        .eq('id', jid)
        .eq('user_id', userId)
      return { completed: true }
    }
    return { completed: false }
  }

  const estVal = Number(project.estimated_value)
  if (!(estVal > EPS)) return { completed: false }

  if (invoiceSumNonDraft >= estVal - EPS) {
    const now = new Date().toISOString()
    await supabase
      .from('projects')
      .update({ status: 'completed', updated_at: now, completed_at: now })
      .eq('id', jid)
      .eq('user_id', userId)
    return { completed: true }
  }

  return { completed: false }
}

/**
 * Re-run completion rules for non-completed projects (backfill after deploy or data fixes).
 * @returns {Promise<{ checked: number, completed: number }>}
 */
async function reconcileBillingCompletionForUser(supabase, userId, opts = {}) {
  if (!supabase || !userId) return { checked: 0, completed: 0 }
  const projectId = opts.projectId != null && String(opts.projectId).trim() ? String(opts.projectId).trim() : null

  const { data: rows, error } = await supabase.from('projects').select('id, status').eq('user_id', userId)
  if (error) throw error

  const open = (rows || []).filter((r) => String(r.status || '').toLowerCase() !== 'completed')
  const targets = projectId ? open.filter((r) => r.id === projectId) : open

  let completed = 0
  for (const row of targets) {
    const r = await maybeAutoCompleteProjectAfterBilling(supabase, userId, row.id)
    if (r.completed) completed += 1
  }
  return { checked: targets.length, completed }
}

module.exports = {
  maybeAutoCompleteProjectAfterBilling,
  reconcileBillingCompletionForUser,
}
