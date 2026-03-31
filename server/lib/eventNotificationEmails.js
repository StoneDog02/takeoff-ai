/**
 * GC account notification emails (Resend) driven by Settings → Notification preferences.
 * Recipients: project / invoice owner (auth user). Uses service-role Supabase + auth.admin for email.
 */
const { sendEmail, getPortalFrom, escapeHtml } = require('./emailUtils')

const NOTIF_DEFAULTS = {
  newBids: { email: true },
  invoiceStatus: { email: true },
  clockInOut: { email: false },
  gpsClockOut: { email: true },
  budgetThreshold: { email: true },
}

function mergeEventEmailPref(prefs, eventKey) {
  const d = NOTIF_DEFAULTS[eventKey] || { email: false }
  const raw = prefs && typeof prefs === 'object' ? prefs[eventKey] : null
  if (!raw || typeof raw !== 'object') return d.email
  if (typeof raw.email !== 'boolean') return d.email
  return raw.email
}

async function fetchNotifPrefs(supabase, userId) {
  const { data } = await supabase.from('notification_preferences').select('prefs').eq('user_id', userId).maybeSingle()
  return data?.prefs && typeof data.prefs === 'object' ? data.prefs : {}
}

async function wantsEventEmail(supabase, userId, eventKey) {
  const prefs = await fetchNotifPrefs(supabase, userId)
  return mergeEventEmailPref(prefs, eventKey) === true
}

async function getAuthUserEmail(supabase, userId) {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId)
    if (error || !data?.user?.email) return null
    const e = String(data.user.email).trim()
    return e || null
  } catch {
    return null
  }
}

function appBaseUrl() {
  const b = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '')
  if (!b) return ''
  return b.startsWith('http') ? b : `https://${b}`
}

async function sendGcEventEmail(supabase, userId, eventKey, subject, html, text) {
  if (!(await wantsEventEmail(supabase, userId, eventKey))) return
  const to = await getAuthUserEmail(supabase, userId)
  if (!to) return
  const from = getPortalFrom()
  await sendEmail({ from, to, subject, html, text })
}

function wrapEmail(title, bodyParagraphs) {
  const inner = bodyParagraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.5;color:#333;">${p}</p>`).join('')
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:18px;margin:0 0 16px;">${escapeHtml(title)}</h1>
    ${inner}
    <p style="margin:20px 0 0;font-size:12px;color:#888;">Takeoff AI</p>
  </div>`
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function notifyNewBidReceived(supabase, { projectUserId, projectName, tradeName, subName, bidAmount }) {
  if (!projectUserId) return
  const amt =
    bidAmount != null && !Number.isNaN(Number(bidAmount))
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(bidAmount))
      : '—'
  const sub = subName ? escapeHtml(String(subName)) : 'A subcontractor'
  const proj = escapeHtml(projectName || 'Your project')
  const trade = tradeName ? escapeHtml(String(tradeName)) : 'trade'
  const base = appBaseUrl()
  const link = base
    ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(`${base}/projects`)}">Open projects</a></p>`
    : ''
  const subject = `New bid received — ${projectName || 'Project'}`
  const html =
    wrapEmail('New bid received', [
      `${sub} submitted a <strong>${amt}</strong> bid for <strong>${trade}</strong> on <strong>${proj}</strong>.`,
    ]) + link
  const textSub = subName ? String(subName) : 'A subcontractor'
  const textTrade = tradeName ? String(tradeName) : 'trade'
  const text = `${textSub} submitted a ${amt} bid for ${textTrade} on ${projectName || 'your project'}.`
  try {
    await sendGcEventEmail(supabase, projectUserId, 'newBids', subject, html, text)
  } catch (e) {
    console.warn('[notifyNewBidReceived]', e?.message || e)
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function notifyInvoiceStatusChange(supabase, { userId, projectName, oldStatus, newStatus }) {
  if (!userId || !newStatus) return
  const o = String(oldStatus || '—').toLowerCase()
  const n = String(newStatus).toLowerCase()
  if (o === n) return
  const proj = escapeHtml(projectName || 'Project')
  const subject = `Invoice ${n} — ${projectName || 'Update'}`
  const html = wrapEmail('Invoice status update', [
    `An invoice for <strong>${proj}</strong> changed from <strong>${escapeHtml(o)}</strong> to <strong>${escapeHtml(n)}</strong>.`,
  ])
  const text = `Invoice for ${projectName || 'project'}: ${o} → ${n}`
  try {
    await sendGcEventEmail(supabase, userId, 'invoiceStatus', subject, html, text)
  } catch (e) {
    console.warn('[notifyInvoiceStatusChange]', e?.message || e)
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function notifyClockInOut(supabase, { projectUserId, projectName, employeeName, kind, clockIn, clockOut }) {
  if (!projectUserId) return
  const emp = escapeHtml(employeeName || 'Team member')
  const proj = escapeHtml(projectName || 'a job')
  let line = ''
  if (kind === 'in') {
    line = `<strong>${emp}</strong> clocked in on <strong>${proj}</strong>.`
  } else if (kind === 'out') {
    line = `<strong>${emp}</strong> clocked out on <strong>${proj}</strong>.`
  } else if (kind === 'session') {
    line = `<strong>${emp}</strong> recorded a completed shift on <strong>${proj}</strong>.`
  } else {
    line = `<strong>${emp}</strong> recorded a time entry on <strong>${proj}</strong>.`
  }
  const detail =
    clockIn || clockOut
      ? ` In: ${escapeHtml(clockIn || '—')}${clockOut ? ` · Out: ${escapeHtml(clockOut)}` : ''}`
      : ''
  const subject =
    kind === 'in'
      ? `Clock-in — ${projectName || 'Job'}`
      : kind === 'out'
        ? `Clock-out — ${projectName || 'Job'}`
        : kind === 'session'
          ? `Time entry — ${projectName || 'Job'}`
          : `Time entry — ${projectName || 'Job'}`
  const html = wrapEmail('Time tracking', [line + detail])
  const action =
    kind === 'in' ? 'clocked in' : kind === 'out' ? 'clocked out' : kind === 'session' ? 'recorded a completed shift' : 'time entry'
  const text = `${employeeName || 'Team member'} — ${action} on ${projectName || 'job'}.`
  try {
    await sendGcEventEmail(supabase, projectUserId, 'clockInOut', subject, html, text)
  } catch (e) {
    console.warn('[notifyClockInOut]', e?.message || e)
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function notifyGpsClockOut(supabase, { projectUserId, projectName, employeeName, exitedAt }) {
  if (!projectUserId) return
  const emp = escapeHtml(employeeName || 'Team member')
  const proj = escapeHtml(projectName || 'a job')
  const when = exitedAt ? escapeHtml(String(exitedAt)) : ''
  const subject = `GPS clock-out — ${projectName || 'Job'}`
  const html = wrapEmail('GPS clock-out', [
    `<strong>${emp}</strong> was automatically clocked out on <strong>${proj}</strong>${when ? ` at ${when}.` : '.'}`,
  ])
  const text = `${employeeName || 'Team member'} GPS clock-out on ${projectName || 'job'}${when ? ` at ${when}` : ''}.`
  try {
    await sendGcEventEmail(supabase, projectUserId, 'gpsClockOut', subject, html, text)
  } catch (e) {
    console.warn('[notifyGpsClockOut]', e?.message || e)
  }
}

async function approvedChangeOrdersTotal(supabase, projectId) {
  const { data } = await supabase
    .from('project_change_orders')
    .select('amount')
    .eq('project_id', projectId)
    .eq('status', 'Approved')
  let t = 0
  for (const r of data || []) t += Number(r.amount) || 0
  return t
}

function sumBudgetRows(rows) {
  let predicted = 0
  let actual = 0
  for (const r of rows || []) {
    predicted += Number(r.predicted) || 0
    actual += Number(r.actual) || 0
  }
  return { predicted, actual }
}

async function budgetOverSummary(supabase, projectId, rows) {
  const { predicted, actual } = sumBudgetRows(rows)
  const co = await approvedChangeOrdersTotal(supabase, projectId)
  const revised = predicted + co
  const isOver = revised > 0 && actual > revised
  return { isOver, predicted, actual, revised, overBy: isOver ? actual - revised : 0 }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function notifyBudgetThresholdCrossed(supabase, { projectUserId, projectName, predicted, actual, revised, overBy }) {
  if (!projectUserId) return
  const usd = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0)
  const over = usd(Math.max(0, overBy || 0))
  const proj = escapeHtml(projectName || 'Project')
  const subject = `Budget warning — ${projectName || 'Project'}`
  const html = wrapEmail('Budget threshold', [
    `Actual spend on <strong>${proj}</strong> has exceeded the revised budget (predicted + approved change orders) by <strong>${escapeHtml(over)}</strong>.`,
    `Revised budget: ${escapeHtml(usd(revised))} · Actual: ${escapeHtml(usd(actual))}.`,
  ])
  const text = `Budget over on ${projectName || 'project'}: ${over} over revised budget (${usd(revised)} revised, ${usd(actual)} actual).`
  try {
    await sendGcEventEmail(supabase, projectUserId, 'budgetThreshold', subject, html, text)
  } catch (e) {
    console.warn('[notifyBudgetThresholdCrossed]', e?.message || e)
  }
}

module.exports = {
  notifyNewBidReceived,
  notifyInvoiceStatusChange,
  notifyClockInOut,
  notifyGpsClockOut,
  budgetOverSummary,
  notifyBudgetThresholdCrossed,
}
