/**
 * Dashboard aggregates: alerts, KPIs, clocked-in, projects with summary.
 * All scoped to current user's projects (req.user.id).
 */
const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

const ESTIMATE_AWAITING_DAYS = 7

function getSupabase(req) {
  return req.supabase || defaultSupabase
}

/** Get project IDs for current user */
async function getUserProjectIds(supabase, userId) {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []).map((p) => p.id)
}

/** GET /api/dashboard/alerts - invoice overdue, estimate awaiting, budget overrun */
router.get('/alerts', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const projectIds = await getUserProjectIds(supabase, userId)
    if (!projectIds.length) return res.json([])

    const today = new Date().toISOString().slice(0, 10)
    const alerts = []

    // Invoice overdue: due_date < today, status not in ('paid','draft')
    const { data: overdueInvoices, error: invErr } = await supabase
      .from('invoices')
      .select('id, job_id, total_amount, due_date, status')
      .in('job_id', projectIds)
      .lt('due_date', today)
      .not('status', 'in', '("paid","draft")')
    if (!invErr && overdueInvoices?.length) {
      const { data: projNames } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', [...new Set(overdueInvoices.map((i) => i.job_id))])
      const nameMap = Object.fromEntries((projNames || []).map((p) => [p.id, p.name]))
      overdueInvoices.forEach((inv) => {
        const due = inv.due_date ? new Date(inv.due_date) : null
        const daysPast = due ? Math.max(0, Math.floor((Date.now() - due.getTime()) / (24 * 60 * 60 * 1000))) : 0
        alerts.push({
          id: `invoice-${inv.id}`,
          type: 'invoice',
          urgency: 'high',
          label: `Invoice overdue`,
          sub: `${nameMap[inv.job_id] || 'Project'} · ${daysPast} days past due`,
          action: 'View Invoice',
          entityId: inv.id,
          entityType: 'invoice',
          jobId: inv.job_id,
        })
      })
    }

    // Estimate awaiting: status = 'sent', sent_at older than ESTIMATE_AWAITING_DAYS
    const sentCutoff = new Date()
    sentCutoff.setDate(sentCutoff.getDate() - ESTIMATE_AWAITING_DAYS)
    const sentCutoffIso = sentCutoff.toISOString()
    const { data: sentEstimates, error: estErr } = await supabase
      .from('estimates')
      .select('id, job_id, title, sent_at')
      .in('job_id', projectIds)
      .eq('status', 'sent')
      .lt('sent_at', sentCutoffIso)
    if (!estErr && sentEstimates?.length) {
      const jobIds = [...new Set(sentEstimates.map((e) => e.job_id))]
      const { data: projNames } = await supabase.from('projects').select('id, name').in('id', jobIds)
      const nameMap = Object.fromEntries((projNames || []).map((p) => [p.id, p.name]))
      sentEstimates.forEach((est) => {
        const sent = est.sent_at ? new Date(est.sent_at) : null
        const daysAgo = sent ? Math.floor((Date.now() - sent.getTime()) / (24 * 60 * 60 * 1000)) : 0
        alerts.push({
          id: `estimate-${est.id}`,
          type: 'estimate',
          urgency: 'medium',
          label: `Estimate awaiting client response`,
          sub: `${nameMap[est.job_id] || 'Project'} · Sent ${daysAgo} days ago`,
          action: 'Follow Up',
          entityId: est.id,
          entityType: 'estimate',
          jobId: est.job_id,
        })
      })
    }

    // Budget overrun: per project SUM(actual) > SUM(predicted)
    const { data: budgetItems, error: budgetErr } = await supabase
      .from('budget_line_items')
      .select('project_id, predicted, actual')
      .in('project_id', projectIds)
    if (!budgetErr && budgetItems?.length) {
      const byProject = {}
      budgetItems.forEach((row) => {
        const pid = row.project_id
        if (!byProject[pid]) byProject[pid] = { predicted: 0, actual: 0 }
        byProject[pid].predicted += Number(row.predicted || 0)
        byProject[pid].actual += Number(row.actual || 0)
      })
      const overrunProjectIds = Object.keys(byProject).filter(
        (pid) => byProject[pid].predicted > 0 && byProject[pid].actual > byProject[pid].predicted
      )
      if (overrunProjectIds.length) {
        const { data: projs } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', overrunProjectIds)
        const nameMap = Object.fromEntries((projs || []).map((p) => [p.id, p.name]))
        overrunProjectIds.forEach((pid) => {
          const over = byProject[pid].actual - byProject[pid].predicted
          alerts.push({
            id: `budget-${pid}`,
            type: 'budget_overrun',
            urgency: 'high',
            label: `Project over budget`,
            sub: `${nameMap[pid] || 'Project'} · $${Math.round(over).toLocaleString()} over`,
            action: 'View Budget',
            entityId: pid,
            entityType: 'project',
            jobId: pid,
          })
        })
      }
    }

    res.json(alerts)
  } catch (err) {
    next(err)
  }
})

/** POST /api/dashboard/alerts/dismiss - record a dismissed alert for the notifications panel */
router.post('/alerts/dismiss', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const alert = req.body?.alert
    if (!alert || !alert.id) return res.status(400).json({ error: 'Missing alert payload' })

    const { error } = await supabase.from('user_dismissed_alerts').insert({
      user_id: userId,
      alert_id: alert.id,
      label: alert.label ?? '',
      sub: alert.sub ?? '',
      type: alert.type ?? 'invoice',
      action: alert.action ?? '',
      entity_id: alert.entityId ?? '',
      entity_type: alert.entityType ?? 'invoice',
      job_id: alert.jobId ?? '',
      urgency: alert.urgency ?? 'medium',
    })
    if (error) throw error
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

/** GET /api/dashboard/alerts/dismissed - list closed alerts for the notifications panel */
router.get('/alerts/dismissed', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data, error } = await supabase
      .from('user_dismissed_alerts')
      .select('id, alert_id, dismissed_at, label, sub, type, action, entity_id, entity_type, job_id, urgency')
      .eq('user_id', userId)
      .order('dismissed_at', { ascending: false })
      .limit(50)
    if (error) throw error

    const list = (data || []).map((row) => ({
      id: row.id,
      alertId: row.alert_id,
      dismissedAt: row.dismissed_at,
      label: row.label,
      sub: row.sub,
      type: row.type,
      action: row.action,
      entityId: row.entity_id,
      entityType: row.entity_type,
      jobId: row.job_id,
      urgency: row.urgency,
    }))
    res.json(list)
  } catch (err) {
    next(err)
  }
})

/** GET /api/dashboard/kpis */
router.get('/kpis', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const projectIds = await getUserProjectIds(supabase, userId)
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

    let totalRevenue = 0
    let totalExpense = 0
    let outstanding = 0
    let openInvoicesCount = 0
    let revenueTrend = []
    let expenseTrend = []

    if (projectIds.length) {
      const { data: paidInvoices } = await supabase
        .from('invoices')
        .select('total_amount, paid_at')
        .in('job_id', projectIds)
        .eq('status', 'paid')
      totalRevenue = (paidInvoices || []).reduce((s, i) => s + Number(i.total_amount || 0), 0)

      const { data: openInvoices } = await supabase
        .from('invoices')
        .select('total_amount')
        .in('job_id', projectIds)
        .in('status', ['sent', 'viewed', 'overdue'])
      openInvoicesCount = (openInvoices || []).length
      outstanding = (openInvoices || []).reduce((s, i) => s + Number(i.total_amount || 0), 0)

      const { data: expenses } = await supabase
        .from('job_expenses')
        .select('amount, created_at')
        .in('job_id', projectIds)
      totalExpense = (expenses || []).reduce((s, i) => s + Number(i.amount || 0), 0)

      // Optional: last 12 months trend for sparklines (by month)
      const months = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        months.push({ year: d.getFullYear(), month: d.getMonth(), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
      }
      const { data: allInvoices } = await supabase
        .from('invoices')
        .select('total_amount, paid_at')
        .in('job_id', projectIds)
        .eq('status', 'paid')
        .not('paid_at', 'is', null)
      const revByMonth = {}
      months.forEach((m) => (revByMonth[m.key] = 0))
      ;(allInvoices || []).forEach((i) => {
        if (i.paid_at) {
          const d = new Date(i.paid_at)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (revByMonth[key] !== undefined) revByMonth[key] += Number(i.total_amount || 0)
        }
      })
      revenueTrend = months.map((m) => revByMonth[m.key] ?? 0)

      const { data: allExpenses } = await supabase
        .from('job_expenses')
        .select('amount, created_at')
        .in('job_id', projectIds)
      const expByMonth = {}
      months.forEach((m) => (expByMonth[m.key] = 0))
      ;(allExpenses || []).forEach((i) => {
        const d = new Date(i.created_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (expByMonth[key] !== undefined) expByMonth[key] += Number(i.amount || 0)
      })
      expenseTrend = months.map((m) => expByMonth[m.key] ?? 0)
    }

    const { data: projects } = await supabase
      .from('projects')
      .select('id, status')
      .eq('user_id', userId)
    const totalProjects = (projects || []).length
    const activeJobs = (projects || []).filter((p) => p.status === 'active').length

    res.json({
      totalRevenue,
      totalExpense,
      outstanding,
      openInvoicesCount,
      activeJobs,
      totalProjects,
      revenueTrend: revenueTrend || [],
      expenseTrend: expenseTrend || [],
    })
  } catch (err) {
    next(err)
  }
})

/** GET /api/dashboard/clocked-in */
router.get('/clocked-in', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const projectIds = await getUserProjectIds(supabase, userId)
    if (!projectIds.length) return res.json([])

    const { data: entries, error: entErr } = await supabase
      .from('time_entries')
      .select('id, employee_id, job_id, clock_in')
      .in('job_id', projectIds)
      .is('clock_out', null)
    if (entErr) throw entErr
    if (!entries?.length) return res.json([])

    const employeeIds = [...new Set(entries.map((e) => e.employee_id))]
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name')
      .in('id', employeeIds)
    const empMap = Object.fromEntries((employees || []).map((e) => [e.id, e]))
    const jobIds = [...new Set(entries.map((e) => e.job_id))]
    const { data: projs } = await supabase.from('projects').select('id, name').in('id', jobIds)
    const jobMap = Object.fromEntries((projs || []).map((p) => [p.id, p.name]))

    const now = Date.now()
    const result = entries.map((e) => {
      const emp = empMap[e.employee_id]
      const name = emp?.name || 'Unknown'
      const initials = name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
      const clockIn = e.clock_in ? new Date(e.clock_in) : null
      const hoursSoFar = clockIn ? Math.round(((now - clockIn.getTime()) / (1000 * 60 * 60)) * 100) / 100 : 0
      const clockInFormatted = clockIn
        ? clockIn.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : ''
      return {
        employeeId: e.employee_id,
        employeeName: name,
        initials,
        jobName: jobMap[e.job_id] || e.job_id,
        jobId: e.job_id,
        clockIn: e.clock_in,
        clockInFormatted,
        hoursSoFar,
      }
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
})

/** GET /api/dashboard/projects - projects with budget and timeline summary */
router.get('/projects', async (req, res, next) => {
  try {
    const supabase = getSupabase(req)
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, name, status, expected_start_date, expected_end_date, estimated_value, assigned_to_name')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (projErr) throw projErr
    if (!projects?.length) return res.json([])

    const projectIds = projects.map((p) => p.id)

    const { data: budgetRows } = await supabase
      .from('budget_line_items')
      .select('project_id, predicted, actual')
      .in('project_id', projectIds)
    const budgetByProject = {}
    projectIds.forEach((id) => (budgetByProject[id] = { predicted: 0, actual: 0 }))
    ;(budgetRows || []).forEach((r) => {
      budgetByProject[r.project_id].predicted += Number(r.predicted || 0)
      budgetByProject[r.project_id].actual += Number(r.actual || 0)
    })

    const { data: phases } = await supabase
      .from('phases')
      .select('project_id, start_date, end_date')
      .in('project_id', projectIds)
    const timelineByProject = {}
    projectIds.forEach((id) => (timelineByProject[id] = { start: null, end: null }))
    ;(phases || []).forEach((p) => {
      const t = timelineByProject[p.project_id]
      if (p.start_date && (!t.start || p.start_date < t.start)) t.start = p.start_date
      if (p.end_date && (!t.end || p.end_date > t.end)) t.end = p.end_date
    })

    const today = new Date().toISOString().slice(0, 10)
    const result = projects.map((p) => {
      const budget = budgetByProject[p.id]
      let budgetTotal = budget.predicted || 0
      let spentTotal = budget.actual || 0
      if (budgetTotal === 0 && p.estimated_value != null) budgetTotal = Number(p.estimated_value)
      const timelineStart = timelineByProject[p.id].start || p.expected_start_date
      const timelineEnd = timelineByProject[p.id].end || p.expected_end_date
      let timelinePct = null
      if (timelineStart && timelineEnd) {
        const start = new Date(timelineStart).getTime()
        const end = new Date(timelineEnd).getTime()
        const now = new Date(today).getTime()
        if (end > start) timelinePct = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
      }
      const clientName = p.assigned_to_name || ''
      const initials = clientName
        ? clientName
            .split(/\s+/)
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : (p.name || 'P').slice(0, 2).toUpperCase()

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        client: clientName,
        initials,
        budget_total: budgetTotal,
        spent_total: spentTotal,
        timeline_start: timelineStart,
        timeline_end: timelineEnd,
        timeline_pct: timelinePct,
      }
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
})

module.exports = router
