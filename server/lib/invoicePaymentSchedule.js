/**
 * Payment schedule rows on invoices (progress milestones + manual deposit/balance).
 */

const COMPLETION_LABELS = {
  on_phase_completion: 'Due when phase completes',
  net_15: '15 days after completion',
  net_30: '30 days after completion',
  net_45: '45 days after completion',
  net_60: '60 days after completion',
  on_invoice_sent: 'Due upon receipt',
  net_15_from_sent: '15 days from invoice date',
  net_30_from_sent: '30 days from invoice date',
  net_45_from_sent: '45 days from invoice date',
  net_60_from_sent: '60 days from invoice date',
  net_90_from_sent: '90 days from invoice date',
  on_request: 'When contractor requests payment',
}

const FROM_SENT_TERM_KEYS = [
  'on_invoice_sent',
  'net_15_from_sent',
  'net_30_from_sent',
  'net_45_from_sent',
  'net_60_from_sent',
  'net_90_from_sent',
]

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function parseNetDaysFromSent(term) {
  const m = String(term || '').match(/^net_(\d+)_from_sent$/)
  return m ? parseInt(m[1], 10) : null
}

function addDaysIso(isoDate, days) {
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function invoiceAnchorDate(inv) {
  const sent = inv?.sent_at || inv?.created_at
  if (!sent) return null
  return String(sent).slice(0, 10)
}

function getPaidMilestoneIds(snap) {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return []
  return Array.isArray(snap.paid_milestone_ids) ? snap.paid_milestone_ids.map(String) : []
}

function getMilestoneReadyIds(snap) {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return []
  return Array.isArray(snap.milestone_ready_for_payment)
    ? snap.milestone_ready_for_payment.map(String)
    : []
}

/** Merge ready-for-payment flags from invoice snapshot and linked estimate meta. */
function resolvePaymentScheduleMeta(snap, estimateMeta) {
  const est =
    estimateMeta && typeof estimateMeta === 'object' && !Array.isArray(estimateMeta) ? estimateMeta : {}
  const readyFromSnap = getMilestoneReadyIds(snap)
  const readyFromEst = Array.isArray(est.milestone_ready_for_payment)
    ? est.milestone_ready_for_payment.map(String)
    : []
  return {
    ...est,
    milestone_ready_for_payment: [...new Set([...readyFromEst, ...readyFromSnap])],
  }
}

function getScheduleRowIds(snap) {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return []
  const rows = Array.isArray(snap.rows) ? snap.rows : []
  return rows.map((r) => String(r.milestone_id || '')).filter(Boolean)
}

function formatDueDisplay(row, inv) {
  if (row.mode === 'specific_date' && (row.specificDate || row.specific_date)) {
    return `Due ${String(row.specificDate || row.specific_date).slice(0, 10)}`
  }
  const key = row.completionTerms || row.completion_terms
  if (key === 'on_request') {
    return COMPLETION_LABELS.on_request
  }
  if (key === 'on_invoice_sent') {
    const anchor = invoiceAnchorDate(inv)
    if (anchor) return `Due ${anchor} (upon receipt)`
    return COMPLETION_LABELS.on_invoice_sent
  }
  const days = parseNetDaysFromSent(key)
  if (days != null) {
    const anchor = invoiceAnchorDate(inv)
    if (anchor) {
      const dueDate = addDaysIso(anchor, days)
      const mid = String(row.milestone_id || '')
      if (mid === 'manual-deposit') {
        return `Due by ${dueDate}`
      }
      return `Due ${dueDate}`
    }
    return COMPLETION_LABELS[key] || `${days} days from invoice date`
  }
  return COMPLETION_LABELS[key] || 'On completion'
}

/**
 * @param {object} row
 * @param {string} invoiceStatus
 * @param {{ milestone_ready_for_payment?: string[] }} meta
 * @param {{ sent_at?: string, created_at?: string }} inv
 * @param {object} snap schedule_snapshot
 */
function computeRowStatus(row, invoiceStatus, meta, inv, snap) {
  const st = String(invoiceStatus || '').toLowerCase()
  const mid = String(row.milestone_id || '')
  const paidIds = getPaidMilestoneIds(snap)
  if (paidIds.includes(mid)) return 'paid'
  if (st === 'paid') return 'paid'

  const readyIds = Array.isArray(meta?.milestone_ready_for_payment)
    ? meta.milestone_ready_for_payment.map(String)
    : []
  const ready = readyIds.includes(mid)

  if (row.mode === 'specific_date' && (row.specificDate || row.specific_date)) {
    const due = String(row.specificDate || row.specific_date).slice(0, 10)
    if (todayIsoDate() >= due) return 'due_now'
    return 'upcoming'
  }

  const ct = row.completionTerms || row.completion_terms

  if (ct === 'on_request') {
    if (!['sent', 'viewed', 'overdue'].includes(st)) return 'upcoming'
    if (mid === 'manual-balance') {
      if (!getPaidMilestoneIds(snap).includes('manual-deposit')) return 'upcoming'
      if (ready) return 'due_now'
      return 'upcoming'
    }
    if (ready) return 'due_now'
    return 'upcoming'
  }

  if (ct === 'on_invoice_sent') {
    if (['sent', 'viewed', 'overdue'].includes(st)) return 'due_now'
    return 'upcoming'
  }

  const netFromSentDays = parseNetDaysFromSent(ct)
  if (netFromSentDays != null) {
    if (!['sent', 'viewed', 'overdue'].includes(st)) return 'upcoming'
    const anchor = invoiceAnchorDate(inv)
    if (!anchor) return 'upcoming'
    const dueDate = addDaysIso(anchor, netFromSentDays)
    if (mid === 'manual-balance') {
      const paidIds = getPaidMilestoneIds(snap)
      if (!paidIds.includes('manual-deposit')) return 'upcoming'
      if (todayIsoDate() >= dueDate) return 'due_now'
      return 'upcoming'
    }
    if (mid === 'manual-deposit') {
      return 'due_now'
    }
    if (todayIsoDate() >= dueDate) return 'due_now'
    return 'upcoming'
  }

  if (row.mode === 'on_completion') {
    if (ct === 'on_phase_completion' && ready) return 'due_now'
    if (typeof ct === 'string' && ct.startsWith('net_') && ready) return 'due_now'
    return 'upcoming'
  }

  return 'upcoming'
}

function mapScheduleRows(rawRows, invoiceStatus, meta, inv, snap) {
  return (rawRows || []).map((row) => {
    const due_display = formatDueDisplay(row, inv)
    const status = computeRowStatus(row, invoiceStatus, meta, inv, snap)
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
}

function amountDueNowFromRows(scheduleRows) {
  return scheduleRows
    .filter((r) => r.status === 'due_now')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
}

/**
 * Build deposit + balance rows for manual invoices.
 * @returns {object[]}
 */
function buildManualDepositScheduleRows(total, depositPct, depositTerms, balanceTerms) {
  const pct = Math.min(100, Math.max(0, Number(depositPct) || 0))
  if (pct <= 0 || pct >= 100) return []
  const t = round2(Math.max(0, total))
  const depositAmt = round2(t * (pct / 100))
  const balanceAmt = round2(t - depositAmt)
  if (depositAmt <= 0 || balanceAmt <= 0) return []
  return [
    {
      milestone_id: 'manual-deposit',
      label: `Deposit (${pct}%)`,
      amount: depositAmt,
      mode: 'on_completion',
      completionTerms: depositTerms,
    },
    {
      milestone_id: 'manual-balance',
      label: 'Balance',
      amount: balanceAmt,
      mode: 'on_completion',
      completionTerms: balanceTerms,
    },
  ]
}

function applyMilestoneReadyToSnapshot(snap, milestoneIds) {
  const base = snap && typeof snap === 'object' && !Array.isArray(snap) ? { ...snap } : {}
  const prev = getMilestoneReadyIds(base)
  const add = (Array.isArray(milestoneIds) ? milestoneIds : [milestoneIds]).map(String).filter(Boolean)
  base.milestone_ready_for_payment = [...new Set([...prev, ...add])]
  return base
}

/**
 * Mark milestone(s) paid in snapshot; returns updated snapshot object.
 */
function applyMilestonePaymentsToSnapshot(snap, milestoneIds) {
  const base = snap && typeof snap === 'object' && !Array.isArray(snap) ? { ...snap } : {}
  const prev = getPaidMilestoneIds(base)
  const add = (Array.isArray(milestoneIds) ? milestoneIds : [milestoneIds])
    .map(String)
    .filter(Boolean)
  base.paid_milestone_ids = [...new Set([...prev, ...add])]
  return base
}

function allScheduleRowsPaid(snap) {
  const rowIds = getScheduleRowIds(snap)
  if (rowIds.length === 0) return false
  const paid = new Set(getPaidMilestoneIds(snap))
  return rowIds.every((id) => paid.has(id))
}

module.exports = {
  COMPLETION_LABELS,
  FROM_SENT_TERM_KEYS,
  todayIsoDate,
  formatDueDisplay,
  computeRowStatus,
  mapScheduleRows,
  amountDueNowFromRows,
  buildManualDepositScheduleRows,
  applyMilestonePaymentsToSnapshot,
  applyMilestoneReadyToSnapshot,
  allScheduleRowsPaid,
  getPaidMilestoneIds,
  getMilestoneReadyIds,
  getScheduleRowIds,
  resolvePaymentScheduleMeta,
}
