const crypto = require('crypto')
const express = require('express')
const multer = require('multer')
const { runTakeoff } = require('../claude/takeoff')
const { TRADE_MAP, TRADE_ORDER } = require('../claude/trade-definitions')
const { supabase: defaultSupabase } = require('../db/supabase')
const { applyApprovedEstimateGroupsToBudget } = require('../lib/budgetFromEstimate')
const { sendBidPortalEmail, sendEstimatePortalEmail } = require('../lib/sendPortalEmails')
const {
  recordBidPackageDispatchedPaperTrail,
  recordPaperTrailDocument,
  recordEstimateSentPaperTrail,
  syncPaperTrailFromSubBid,
} = require('../lib/paperTrailDocuments')

const BUILD_PLANS_BUCKET = 'job-walk-media'

/** Ensure storage bucket exists (create if not). Use service-role client. */
async function ensureBuildPlansBucket() {
  if (!defaultSupabase) return
  const { error } = await defaultSupabase.storage.createBucket(BUILD_PLANS_BUCKET, {
    public: true,
    fileSizeLimit: 25 * 1024 * 1024,
  })
  if (error && error.message !== 'Bucket already exists') {
    console.warn('[projects] ensureBuildPlansBucket:', error.message)
  }
}

const router = express.Router()

/** ISO timestamptz or null; invalid dates become null. */
function parseBidResponseDeadline(v) {
  if (v == null || v === '') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Invalid file type.'))
  },
})

/** Load project and ensure user owns it. Sets req.project. */
async function loadProject(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params
  const trimmed = typeof id === 'string' ? id.trim() : ''
  if (!trimmed || trimmed === 'undefined') {
    return res.status(400).json({ error: 'Project ID is missing or invalid. Close the dialog and open the project again.' })
  }
  // Use service-role client so RLS doesn't block the lookup; we check ownership explicitly.
  const db = defaultSupabase
  if (!db) return res.status(503).json({ error: 'Database not configured' })
  const { data: project, error } = await db
    .from('projects')
    .select('*')
    .eq('id', trimmed)
    .maybeSingle()
  if (error) {
    console.warn('[projects] loadProject error', { projectId: trimmed, error: error.message })
    return res.status(500).json({ error: 'Failed to load project' })
  }
  if (!project) {
    console.warn('[projects] loadProject 404 no project', { projectId: trimmed, userId: req.user?.id })
    return res.status(404).json({ error: 'Project not found. You may need to refresh the page or open the project again.' })
  }
  if (project.user_id !== req.user.id) {
    console.warn('[projects] loadProject 404 wrong owner', { projectId: trimmed, projectUserId: project.user_id, requestUserId: req.user?.id })
    return res.status(404).json({ error: 'Project not found. You may need to refresh the page or open the project again.' })
  }
  req.params.id = trimmed
  req.project = project
  next()
}

/** Like loadProject, but also allows employees with an active assignment to this job (read-only flows, e.g. work types for clock-in). */
async function loadProjectForOwnerOrAssignedEmployee(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params
  const trimmed = typeof id === 'string' ? id.trim() : ''
  if (!trimmed || trimmed === 'undefined') {
    return res.status(400).json({ error: 'Project ID is missing or invalid. Close the dialog and open the project again.' })
  }
  const db = defaultSupabase
  if (!db) return res.status(503).json({ error: 'Database not configured' })
  const { data: project, error } = await db
    .from('projects')
    .select('*')
    .eq('id', trimmed)
    .maybeSingle()
  if (error) {
    console.warn('[projects] loadProjectForOwnerOrAssignedEmployee error', { projectId: trimmed, error: error.message })
    return res.status(500).json({ error: 'Failed to load project' })
  }
  if (!project) {
    return res.status(404).json({ error: 'Project not found. You may need to refresh the page or open the project again.' })
  }
  if (project.user_id === req.user.id) {
    req.params.id = trimmed
    req.project = project
    return next()
  }
  if (req.employee) {
    const { data: assignment } = await db
      .from('job_assignments')
      .select('id')
      .eq('employee_id', req.employee.id)
      .eq('job_id', trimmed)
      .is('ended_at', null)
      .maybeSingle()
    if (assignment) {
      req.params.id = trimmed
      req.project = project
      return next()
    }
  }
  return res.status(404).json({ error: 'Project not found. You may need to refresh the page or open the project again.' })
}

// --- Projects CRUD ---
/** GET / - list projects with summary for cards (phases, budget actual, days left) */
router.get('/', (req, res, next) => {
  console.log('[projects GET /] request received')
  next()
}, async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    const supabase = req.supabase || defaultSupabase
    if (!supabase) {
      console.warn('[projects GET /] no supabase client')
      return res.json([])
    }
    // Contractors: only their projects. Employees: omit owner filter — RLS (projects_employee_select) limits to job assignments.
    let projectsQuery = supabase
      .from('projects')
      .select('id, name, status, scope, created_at, updated_at, user_id, address_line_1, address_line_2, city, state, postal_code, expected_start_date, expected_end_date, estimated_value, assigned_to_name, client_email, client_phone, plan_type')
      .order('updated_at', { ascending: false })
    if (!req.employee) {
      projectsQuery = projectsQuery.eq('user_id', req.user?.id)
    }
    const { data: projects, error: projErr } = await projectsQuery
    if (projErr) {
      console.warn('[projects GET /] projects query error', projErr.message)
      throw projErr
    }
    if (!projects?.length) {
      console.log('[projects GET /] no projects, returning []')
      return res.json([])
    }
    console.log('[projects GET /] got', projects.length, 'projects, fetching phases + budget')

    const projectIds = projects.map((p) => p.id)
    const db = defaultSupabase || supabase

    const { data: budgetRows } = await db
      .from('budget_line_items')
      .select('project_id, predicted, actual')
      .in('project_id', projectIds)
    const budgetByProject = {}
    projectIds.forEach((id) => (budgetByProject[id] = { predicted: 0, actual: 0 }))
    ;(budgetRows || []).forEach((r) => {
      budgetByProject[r.project_id].predicted += Number(r.predicted || 0)
      budgetByProject[r.project_id].actual += Number(r.actual || 0)
    })

    const { data: phases } = await db
      .from('phases')
      .select('project_id, name, start_date, end_date, "order"')
      .in('project_id', projectIds)
    const timelineByProject = {}
    const phasesByProject = {}
    projectIds.forEach((id) => {
      timelineByProject[id] = { start: null, end: null }
      phasesByProject[id] = []
    })
    ;(phases || []).forEach((p) => {
      const t = timelineByProject[p.project_id]
      if (p.start_date && (!t.start || p.start_date < t.start)) t.start = p.start_date
      if (p.end_date && (!t.end || p.end_date > t.end)) t.end = p.end_date
      const orderVal = p.order != null ? p.order : (p['order'] != null ? p['order'] : 999)
      phasesByProject[p.project_id].push({
        name: p.name || 'Phase',
        start_date: p.start_date,
        end_date: p.end_date,
        order: orderVal,
      })
    })
    projectIds.forEach((id) => {
      phasesByProject[id].sort((a, b) => a.order - b.order)
    })

    const today = new Date().toISOString().slice(0, 10)
    const todayTime = new Date(today).getTime()
    const result = projects.map((p) => {
      const budget = budgetByProject[p.id]
      let budgetTotal = budget.predicted || 0
      let spentTotal = budget.actual || 0
      if (budgetTotal === 0 && p.estimated_value != null) budgetTotal = Number(p.estimated_value)
      const timelineStart = timelineByProject[p.id].start || p.expected_start_date
      const timelineEnd = timelineByProject[p.id].end || p.expected_end_date
      const phaseList = phasesByProject[p.id].map((ph) => ({
        name: ph.name,
        completed: !!(ph.end_date && ph.end_date < today),
      }))
      const firstIncomplete = phaseList.findIndex((ph) => !ph.completed)
      const nextStep =
        firstIncomplete >= 0
          ? (phaseList[firstIncomplete] && phaseList[firstIncomplete].name ? `Next: ${phaseList[firstIncomplete].name}` : '—')
          : phaseList.length > 0
            ? 'All phases complete – closed out'
            : '—'
      let daysLeft = null
      if (timelineEnd) {
        const endTime = new Date(timelineEnd).getTime()
        const diffMs = endTime - todayTime
        daysLeft = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
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

      let timelinePct = null
      if (timelineStart && timelineEnd) {
        const start = new Date(timelineStart).getTime()
        const end = new Date(timelineEnd).getTime()
        const now = new Date(today).getTime()
        if (end > start) timelinePct = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
      }
      return {
        ...p,
        budget_total: budgetTotal,
        spent_total: spentTotal,
        timeline_start: timelineStart,
        timeline_end: timelineEnd,
        timeline_pct: timelinePct,
        phases: phaseList,
        next_step: nextStep,
        days_left: daysLeft,
        client: clientName,
        initials,
      }
    })
    const first = result[0]
    console.log('[projects GET /] returning', result.length, 'projects. first has phases:', first?.phases?.length ?? 0, 'budget_total:', first?.budget_total, 'days_left:', first?.days_left)
    res.json(result)
  } catch (err) {
    console.warn('[projects GET /] error', err?.message || err)
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const {
      name,
      status,
      scope,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      expected_start_date,
      expected_end_date,
      estimated_value,
      assigned_to_name,
      client_email,
      client_phone,
      plan_type,
    } = req.body || {}
    const insert = {
      user_id: req.user?.id,
      name: name || 'New Project',
      status: status || 'active',
      scope: scope ?? '',
    }
    if (address_line_1 !== undefined) insert.address_line_1 = address_line_1 || null
    if (address_line_2 !== undefined) insert.address_line_2 = address_line_2 || null
    if (city !== undefined) insert.city = city || null
    if (state !== undefined) insert.state = state || null
    if (postal_code !== undefined) insert.postal_code = postal_code || null
    if (expected_start_date !== undefined) insert.expected_start_date = expected_start_date || null
    if (expected_end_date !== undefined) insert.expected_end_date = expected_end_date || null
    if (estimated_value !== undefined) insert.estimated_value = estimated_value != null ? Number(estimated_value) : null
    if (assigned_to_name !== undefined) insert.assigned_to_name = assigned_to_name || null
    if (client_email !== undefined) insert.client_email = client_email ? String(client_email).trim() || null : null
    if (client_phone !== undefined) insert.client_phone = client_phone ? String(client_phone).trim() || null : null
    if (plan_type !== undefined) insert.plan_type = ['residential', 'commercial', 'civil', 'auto'].includes(plan_type) ? plan_type : 'residential'
    const { data, error } = await supabase
      .from('projects')
      .insert(insert)
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

/** Trade options for takeoff scope (single or multi-select). */
router.get('/trades', (req, res) => {
  res.json(TRADE_ORDER.map((key) => ({ key, label: TRADE_MAP[key].label, csiDivision: TRADE_MAP[key].csi })))
})

router.get('/:id', loadProject, async (req, res) => {
  res.json(req.project)
})

router.put('/:id', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const {
      name,
      status,
      scope,
      address_line_1,
      expected_start_date,
      expected_end_date,
      estimated_value,
      assigned_to_name,
      client_email,
      client_phone,
      plan_type,
    } = req.body || {}
    const updates = {}
    if (name !== undefined) updates.name = name
    if (status !== undefined) updates.status = status
    if (scope !== undefined) updates.scope = scope
    if (address_line_1 !== undefined) updates.address_line_1 = address_line_1 || null
    if (expected_start_date !== undefined) updates.expected_start_date = expected_start_date || null
    if (expected_end_date !== undefined) updates.expected_end_date = expected_end_date || null
    if (estimated_value !== undefined) updates.estimated_value = estimated_value != null ? Number(estimated_value) : null
    if (assigned_to_name !== undefined) updates.assigned_to_name = assigned_to_name || null
    if (client_email !== undefined) updates.client_email = client_email ? String(client_email).trim() || null : null
    if (client_phone !== undefined) updates.client_phone = client_phone ? String(client_phone).trim() || null : null
    if (plan_type !== undefined) updates.plan_type = ['residential', 'commercial', 'civil', 'auto'].includes(plan_type) ? plan_type : req.project.plan_type
    updates.updated_at = new Date().toISOString()
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { error } = await supabase.from('projects').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// --- Phases ---
router.get('/:id/phases', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data, error } = await supabase
      .from('phases')
      .select('*')
      .eq('project_id', req.params.id)
      .order('order', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.post('/:id/phases', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { name, start_date, end_date, order } = req.body || {}
    const { data, error } = await supabase
      .from('phases')
      .insert({
        project_id: req.params.id,
        name: name || 'Phase',
        start_date: start_date || new Date().toISOString().slice(0, 10),
        end_date: end_date || new Date().toISOString().slice(0, 10),
        order: order ?? 0,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

router.put('/:id/phases/:phaseId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { phaseId } = req.params
    const { name, start_date, end_date, order } = req.body || {}
    const updates = {}
    if (name !== undefined) updates.name = name
    if (start_date !== undefined) updates.start_date = start_date
    if (end_date !== undefined) updates.end_date = end_date
    if (order !== undefined) updates.order = order
    const { data, error } = await supabase
      .from('phases')
      .update(updates)
      .eq('id', phaseId)
      .eq('project_id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/phases/:phaseId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { error } = await supabase
      .from('phases')
      .delete()
      .eq('id', req.params.phaseId)
      .eq('project_id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// --- Milestones ---
router.get('/:id/milestones', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', req.params.id)
      .order('due_date', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.post('/:id/milestones', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { phase_id, title, due_date, completed } = req.body || {}
    const { data, error } = await supabase
      .from('milestones')
      .insert({
        project_id: req.params.id,
        phase_id: phase_id || null,
        title: title || 'Milestone',
        due_date: due_date || new Date().toISOString().slice(0, 10),
        completed: completed ?? false,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

router.put('/:id/milestones/:milestoneId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { milestoneId } = req.params
    const { phase_id, title, due_date, completed } = req.body || {}
    const updates = {}
    if (phase_id !== undefined) updates.phase_id = phase_id
    if (title !== undefined) updates.title = title
    if (due_date !== undefined) updates.due_date = due_date
    if (completed !== undefined) updates.completed = completed
    const { data, error } = await supabase
      .from('milestones')
      .update(updates)
      .eq('id', milestoneId)
      .eq('project_id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/milestones/:milestoneId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', req.params.milestoneId)
      .eq('project_id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// --- Project tasks (schedule task rows for Gantt + Today's Schedule) ---
router.get('/:id/tasks', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data, error } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', req.params.id)
      .order('order', { ascending: true })
      .order('start_date', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.post('/:id/tasks', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { phase_id, title, responsible, start_date, end_date, duration_weeks, order, completed } = req.body || {}
    const { data, error } = await supabase
      .from('project_tasks')
      .insert({
        project_id: req.params.id,
        phase_id: phase_id || null,
        title: title || 'Task',
        responsible: responsible ?? '',
        start_date: start_date || new Date().toISOString().slice(0, 10),
        end_date: end_date || new Date().toISOString().slice(0, 10),
        duration_weeks: duration_weeks != null ? Number(duration_weeks) : null,
        order: order ?? 0,
        completed: completed ?? false,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/tasks/:taskId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { taskId } = req.params
    const { phase_id, title, responsible, start_date, end_date, duration_weeks, order, completed } = req.body || {}
    const updates = { updated_at: new Date().toISOString() }
    if (phase_id !== undefined) updates.phase_id = phase_id
    if (title !== undefined) updates.title = title
    if (responsible !== undefined) updates.responsible = responsible
    if (start_date !== undefined) updates.start_date = start_date
    if (end_date !== undefined) updates.end_date = end_date
    if (duration_weeks !== undefined) updates.duration_weeks = duration_weeks != null ? Number(duration_weeks) : null
    if (order !== undefined) updates.order = order
    if (completed !== undefined) updates.completed = completed
    const { data, error } = await supabase
      .from('project_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('project_id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/tasks/:taskId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { error } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', req.params.taskId)
      .eq('project_id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// --- Activity feed (unified recent activity for Live Activity panel) ---
router.get('/:id/activity', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.json([])
    const projectId = req.params.id
    const limit = 30
    const activities = []

    const [mediaRes, timeRes, tasksRes, milestonesRes, bidSheetRes, takeoffsRes] = await Promise.all([
      supabase.from('job_walk_media').select('id, uploaded_at, uploader_name, type').eq('project_id', projectId).order('uploaded_at', { ascending: false }).limit(limit),
      supabase.from('time_entries').select('id, employee_id, clock_in, clock_out, hours').eq('job_id', projectId).order('clock_in', { ascending: false }).limit(limit),
      supabase.from('project_tasks').select('id, title, created_at, updated_at').eq('project_id', projectId),
      supabase.from('milestones').select('id, title, due_date, completed').eq('project_id', projectId),
      supabase.from('bid_sheets').select('updated_at').eq('project_id', projectId).maybeSingle(),
      supabase.from('project_takeoffs').select('id, created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(5),
    ])

    const media = mediaRes.data || []
    const timeEntries = timeRes.data || []
    const tasks = tasksRes.data || []
    const milestones = milestonesRes.data || []
    const bidSheet = bidSheetRes.data
    const takeoffs = takeoffsRes.data || []

    const employeeIds = [...new Set(timeEntries.map((e) => e.employee_id).filter(Boolean))]
    let employeeMap = {}
    if (employeeIds.length) {
      const { data: employees } = await supabase.from('employees').select('id, name').in('id', employeeIds)
      employeeMap = (employees || []).reduce((acc, emp) => { acc[emp.id] = emp.name || 'Unknown'; return acc }, {})
    }

    media.forEach((m) => {
      activities.push({
        at: m.uploaded_at,
        tag: 'Media',
        who: m.uploader_name || 'Unknown',
        action: m.type === 'video' ? 'Added job walk video' : 'Added job walk photo',
      })
    })

    timeEntries.forEach((e) => {
      const hours = e.hours ?? (e.clock_in && e.clock_out ? Math.round(((new Date(e.clock_out) - new Date(e.clock_in)) / (1000 * 60 * 60)) * 100) / 100 : null)
      const hrs = hours != null ? `${hours}hrs` : 'time'
      activities.push({
        at: e.clock_in,
        tag: 'Time',
        who: employeeMap[e.employee_id] || 'Crew',
        action: `Logged ${hrs}`,
      })
    })

    tasks.forEach((t) => {
      if (t.created_at) {
        activities.push({ at: t.created_at, tag: 'Schedule', who: '', action: 'Task added', detail: t.title })
      }
      if (t.updated_at && t.updated_at !== t.created_at) {
        activities.push({ at: t.updated_at, tag: 'Schedule', who: '', action: 'Task updated', detail: t.title })
      }
    })

    milestones.forEach((m) => {
      if (m.completed) {
        activities.push({ at: m.due_date + 'T12:00:00Z', tag: 'Schedule', who: '', action: 'Milestone completed', detail: m.title })
      }
    })

    if (bidSheet?.updated_at) {
      activities.push({ at: bidSheet.updated_at, tag: 'Bid', who: '', action: 'Bid sheet updated' })
    }

    takeoffs.forEach((t) => {
      activities.push({ at: t.created_at, tag: 'Takeoff', who: '', action: 'Takeoff created' })
    })

    activities.sort((a, b) => new Date(b.at) - new Date(a.at))
    res.json(activities.slice(0, limit))
  } catch (err) {
    console.warn('[projects] activity feed error', err?.message || err)
    res.json([])
  }
})

// --- Job walk media ---
router.get('/:id/media', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data, error } = await supabase
      .from('job_walk_media')
      .select('*')
      .eq('project_id', req.params.id)
      .order('uploaded_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.post('/:id/media', loadProject, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const supabaseClient = req.supabase || defaultSupabase
    const supabaseStorage = defaultSupabase || supabaseClient
    if (!supabaseClient) return res.status(503).json({ error: 'Database not configured' })
    const projectId = req.params.id
    const uploaderName = (req.body && req.body.uploader_name) || req.user?.email || 'Unknown'
    const caption = req.body && req.body.caption
    const ext = req.file.originalname?.split('.').pop() || 'bin'
    const isVideo = (req.file.mimetype || '').startsWith('video/')
    const type = isVideo ? 'video' : 'photo'
    const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadErr } = await supabaseStorage.storage.from('job-walk-media').upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    })
    if (uploadErr) throw uploadErr
    let url = path
    const { data: urlData } = supabaseStorage.storage.from('job-walk-media').getPublicUrl(path)
    if (urlData?.publicUrl) url = urlData.publicUrl

    const { data: row, error } = await supabaseClient
      .from('job_walk_media')
      .insert({
        project_id: projectId,
        url,
        type,
        uploader_name: uploaderName,
        caption: caption || null,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(row)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/media/:mediaId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { error } = await supabase
      .from('job_walk_media')
      .delete()
      .eq('id', req.params.mediaId)
      .eq('project_id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// --- Build plans (reference PDFs/drawings) ---
router.get('/:id/build-plans', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data, error } = await supabase
      .from('project_build_plans')
      .select('*')
      .eq('project_id', req.params.id)
      .order('uploaded_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.post('/:id/build-plans', loadProject, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const supabaseClient = req.supabase || defaultSupabase
    const supabaseStorage = defaultSupabase || supabaseClient
    if (!supabaseClient) return res.status(503).json({ error: 'Database not configured' })
    await ensureBuildPlansBucket()
    const projectId = req.params.id
    const uploaderName = (req.body && req.body.uploader_name) || req.user?.email || 'Unknown'
    const safeName = (req.file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
    const ext = safeName.split('.').pop() || 'bin'
    const path = `build-plans/${projectId}/${Date.now()}-${safeName}`

    const { error: uploadErr } = await supabaseStorage.storage.from(BUILD_PLANS_BUCKET).upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    })
    if (uploadErr) throw uploadErr
    let url = path
    const { data: urlData } = supabaseStorage.storage.from(BUILD_PLANS_BUCKET).getPublicUrl(path)
    if (urlData?.publicUrl) url = urlData.publicUrl

    const { data: row, error } = await supabaseClient
      .from('project_build_plans')
      .insert({
        project_id: projectId,
        file_name: req.file.originalname || safeName,
        url,
        uploader_name: uploaderName,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(row)
  } catch (err) {
    next(err)
  }
})

/** GET view URL for a build plan (signed URL so file opens even if bucket is private). */
router.get('/:id/build-plans/:planId/view', loadProject, async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { planId } = req.params
    const { data: plan, error: planErr } = await db
      .from('project_build_plans')
      .select('url')
      .eq('id', planId)
      .eq('project_id', req.params.id)
      .maybeSingle()
    if (planErr || !plan) return res.status(404).json({ error: 'Build plan not found' })
    let path = plan.url
    if (path.startsWith('http')) {
      const match = path.match(/\/object\/public\/[^/]+\/(.+)$/) || path.match(/\/storage\/v1\/object\/[^/]+\/[^/]+\/(.+)$/)
      path = match ? match[1] : path
    }
    const { data: signed, error: signErr } = await db.storage.from(BUILD_PLANS_BUCKET).createSignedUrl(path, 3600)
    if (signErr) return res.status(502).json({ error: 'Could not generate view link', detail: signErr.message })
    res.json({ url: signed.signedUrl })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/build-plans/:planId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { error } = await supabase
      .from('project_build_plans')
      .delete()
      .eq('id', req.params.planId)
      .eq('project_id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// --- Budget ---
/** Normalize category for matching labor/subs. */
function budgetCategoryKey(cat) {
  if (!cat) return 'other'
  const c = String(cat).toLowerCase().trim()
  if (c === 'labor') return 'labor'
  if (c === 'subs' || c === 'subcontractors' || c === 'subcontractor' || c.includes('subcontractor')) return 'subs'
  return c
}

router.get('/:id/budget', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const db = defaultSupabase || supabase
    const projectId = req.params.id

    const { data: items, error } = await supabase
      .from('budget_line_items')
      .select('*')
      .eq('project_id', projectId)
    if (error) throw error
    let list = items || []

    // Labor actual from time entries + pay rates
    let laborActualFromTimeEntries = 0
    if (db) {
      const { data: timeRows } = await db
        .from('time_entries')
        .select('id, employee_id, hours')
        .eq('job_id', projectId)
      const entries = timeRows || []
      if (entries.length > 0) {
        const employeeIds = [...new Set(entries.map((e) => e.employee_id))]
        const { data: raises } = await db
          .from('pay_raises')
          .select('employee_id, new_rate, amount_type, effective_date')
          .in('employee_id', employeeIds)
          .eq('amount_type', 'dollar')
          .order('effective_date', { ascending: false })
        const rateByEmployee = {}
        for (const r of raises || []) {
          if (rateByEmployee[r.employee_id] == null) rateByEmployee[r.employee_id] = Number(r.new_rate) || 0
        }
        for (const e of entries) {
          const hours = Number(e.hours) || 0
          const rate = rateByEmployee[e.employee_id] ?? 0
          laborActualFromTimeEntries += hours * rate
        }
      }
    }

    // Subs actual from bid sheet awarded bids (use same supabase as budget_line_items for consistent auth context)
    const clientForSubs = supabase
    let subsActualFromBidSheet = 0
    if (clientForSubs) {
      const { data: packages } = await clientForSubs.from('trade_packages').select('id').eq('project_id', projectId)
      const pkgIds = (packages || []).map((p) => p.id)
      if (pkgIds.length > 0) {
        const { data: bids } = await clientForSubs
          .from('sub_bids')
          .select('amount')
          .in('trade_package_id', pkgIds)
          .eq('awarded', true)
        for (const b of bids || []) subsActualFromBidSheet += Number(b.amount) || 0
      }
    }

    // Merge into line items: first labor line gets labor actual, first subs line gets subs actual; others in same category keep DB actual or 0
    const laborKey = 'labor'
    const subsKey = 'subs'
    let firstLaborIdx = -1
    let firstSubsIdx = -1
    list.forEach((item, i) => {
      const key = budgetCategoryKey(item.category)
      if (key === laborKey && firstLaborIdx < 0) firstLaborIdx = i
      if (key === subsKey && firstSubsIdx < 0) firstSubsIdx = i
    })
    // If no row matched by category but we have awarded subs, use first row whose label looks like "Subcontractors"
    if (firstSubsIdx < 0 && subsActualFromBidSheet > 0) {
      const byLabel = list.findIndex((item) => (item.label || '').toLowerCase().includes('subcontractor'))
      if (byLabel >= 0) firstSubsIdx = byLabel
    }
    list = list.map((item, i) => {
      const key = budgetCategoryKey(item.category)
      const row = { ...item, actual: Number(item.actual) || 0 }
      if (key === laborKey) {
        if (i === firstLaborIdx) row.actual = laborActualFromTimeEntries
        else row.actual = 0
      } else if (key === subsKey || (firstSubsIdx >= 0 && i === firstSubsIdx)) {
        // Apply subs actual to the first subs row (by category or by label fallback when category is "other")
        if (i === firstSubsIdx) row.actual = subsActualFromBidSheet
        else row.actual = 0
      }
      return row
    })

    const predicted_total = list.reduce((s, i) => s + Number(i.predicted || 0), 0)
    const actual_total = list.reduce((s, i) => s + Number(i.actual || 0), 0)
    let approved_change_orders_total = 0
    const { data: coRows } = await supabase
      .from('project_change_orders')
      .select('amount')
      .eq('project_id', projectId)
      .eq('status', 'Approved')
    ;(coRows || []).forEach((r) => { approved_change_orders_total += Number(r.amount) || 0 })
    const revised_budget = predicted_total + approved_change_orders_total
    res.set('Cache-Control', 'no-store')
    res.json({
      items: list,
      summary: {
        predicted_total,
        actual_total,
        profitability: revised_budget - actual_total,
      },
      labor_actual_from_time_entries: laborActualFromTimeEntries,
      subs_actual_from_bid_sheet: subsActualFromBidSheet,
      approved_change_orders_total,
    })
  } catch (err) {
    next(err)
  }
})

/** GET /projects/:id/documents — paper-trail rows for this project (newest first). Query: show_archived=1|true */
router.get('/:id/documents', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const projectId = req.params.id
    const showArchived = req.query.show_archived === '1' || req.query.show_archived === 'true'
    let q = supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (!showArchived) {
      q = q.is('archived_at', null)
    }
    const { data, error } = await q
    if (error) throw error
    res.set('Cache-Control', 'no-store')
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.put('/:id/budget', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { items } = req.body || {}
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' })
    const projectId = req.params.id
    const existing = await supabase.from('budget_line_items').select('id').eq('project_id', projectId)
    const existingIds = (existing.data || []).map((r) => r.id)
    const toDelete = existingIds.filter((id) => !items.some((i) => i.id === id))
    for (const id of toDelete) {
      await supabase.from('budget_line_items').delete().eq('id', id)
    }
    const result = []
    for (const it of items) {
      const row = {
        project_id: projectId,
        label: it.label,
        predicted: Number(it.predicted) || 0,
        actual: Number(it.actual) || 0,
        category: it.category || 'other',
        ...(it.source !== undefined && it.source !== '' ? { source: it.source } : {}),
        ...(it.unit != null && String(it.unit).trim() !== ''
          ? { unit: String(it.unit).trim() }
          : { unit: null }),
      }
      if (it.id && existingIds.includes(it.id)) {
        const { data } = await supabase.from('budget_line_items').update(row).eq('id', it.id).select().single()
        if (data) result.push(data)
      } else {
        const { data } = await supabase.from('budget_line_items').insert(row).select().single()
        if (data) result.push(data)
        const postApproval =
          req.project &&
          req.project.estimate_approved_at &&
          (it.source || '') !== 'estimate'
        if (data && postApproval) {
          recordPaperTrailDocument(supabase, req.project.user_id, {
            document_type: 'change_order',
            project_id: projectId,
            title: data.label || 'Budget line',
            status: 'added',
            total_amount: data.predicted != null ? Number(data.predicted) : null,
            source_id: data.id,
            metadata: {
              snapshot_at: 'budget_line_added_post_approval',
              category: data.category,
              predicted: data.predicted,
              actual: data.actual,
              unit: data.unit ?? null,
              source: data.source ?? null,
            },
          })
        }
      }
    }
    const list = result
    const predicted_total = list.reduce((s, i) => s + Number(i.predicted || 0), 0)
    const actual_total = list.reduce((s, i) => s + Number(i.actual || 0), 0)
    res.json({
      items: list,
      summary: { predicted_total, actual_total, profitability: predicted_total - actual_total },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /projects/:id/seed-budget-from-estimate
 * Re-applies budget rows from the accepted estimate (estimate_groups_meta). Idempotent.
 * Optional body: { estimate_id } — must belong to this project and be accepted; otherwise latest accepted estimate for the project is used.
 */
router.post('/:id/seed-budget-from-estimate', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const projectId = req.params.id
    const bodyEstimateId =
      req.body && req.body.estimate_id != null && String(req.body.estimate_id).trim()
        ? String(req.body.estimate_id).trim()
        : null

    let estimateId = bodyEstimateId

    if (estimateId) {
      const { data: est, error: estErr } = await supabase
        .from('estimates')
        .select('id, job_id, status')
        .eq('id', estimateId)
        .maybeSingle()
      if (estErr) throw estErr
      if (!est || String(est.job_id) !== String(projectId)) {
        return res.status(400).json({ error: 'Estimate not found for this project.' })
      }
      if ((est.status || '').toLowerCase() !== 'accepted') {
        return res.status(400).json({ error: 'Only accepted estimates can seed the project budget.' })
      }
    } else {
      const { data: rows, error: findErr } = await supabase
        .from('estimates')
        .select('id')
        .eq('job_id', projectId)
        .eq('status', 'accepted')
        .order('updated_at', { ascending: false })
        .limit(1)
      if (findErr) throw findErr
      if (!rows || !rows.length) {
        return res.json({ ok: true, skipped: true, reason: 'no_accepted_estimate' })
      }
      estimateId = rows[0].id
    }

    await applyApprovedEstimateGroupsToBudget(supabase, projectId, estimateId)
    res.json({ ok: true, estimate_id: estimateId })
  } catch (err) {
    next(err)
  }
})

// --- Change orders ---
router.get('/:id/change-orders', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data, error } = await supabase
      .from('project_change_orders')
      .select('*')
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    const rows = (data || []).map((r) => ({
      id: r.id,
      project_id: r.project_id,
      description: r.description,
      amount: Number(r.amount) || 0,
      status: r.status === 'Approved' ? 'Approved' : 'Pending',
      date: r.date || '',
      category: r.category || 'other',
      created_at: r.created_at,
    }))
    res.set('Cache-Control', 'no-store')
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/:id/change-orders', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const projectId = req.project?.id ?? req.params.id
    const { description, amount, status, date, category } = req.body || {}
    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'description required' })
    }
    const numAmount = Number(amount)
    if (Number.isNaN(numAmount) || numAmount < 0) return res.status(400).json({ error: 'amount must be a non-negative number' })
    const row = {
      project_id: projectId,
      description: String(description).trim(),
      amount: numAmount,
      status: status === 'Approved' ? 'Approved' : 'Pending',
      date: typeof date === 'string' ? date : '',
      category: typeof category === 'string' && category ? category : 'other',
    }
    const { data, error } = await supabase.from('project_change_orders').insert(row).select().single()
    if (error) throw error
    res.status(201).json({
      id: data.id,
      project_id: data.project_id,
      description: data.description,
      amount: Number(data.amount) || 0,
      status: data.status,
      date: data.date || '',
      category: data.category || 'other',
      created_at: data.created_at,
    })
  } catch (err) {
    next(err)
  }
})

router.put('/:id/change-orders/:coId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { coId } = req.params
    const { description, amount, status, date, category } = req.body || {}
    const updates = {}
    if (description !== undefined) updates.description = String(description).trim()
    if (amount !== undefined) {
      const num = Number(amount)
      if (!Number.isNaN(num) && num >= 0) updates.amount = num
    }
    if (status !== undefined) updates.status = status === 'Approved' ? 'Approved' : 'Pending'
    if (date !== undefined) updates.date = String(date)
    if (category !== undefined) updates.category = String(category) || 'other'
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'no updates provided' })
    const { data, error } = await supabase
      .from('project_change_orders')
      .update(updates)
      .eq('id', coId)
      .eq('project_id', req.params.id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Change order not found' })
    res.json({
      id: data.id,
      project_id: data.project_id,
      description: data.description,
      amount: Number(data.amount) || 0,
      status: data.status,
      date: data.date || '',
      category: data.category || 'other',
      created_at: data.created_at,
    })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/change-orders/:coId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { error } = await supabase
      .from('project_change_orders')
      .delete()
      .eq('id', req.params.coId)
      .eq('project_id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

const CHANGE_ORDER_CATEGORY_LABELS = {
  labor: 'Labor',
  materials: 'Materials',
  subs: 'Subcontractors',
  equipment: 'Equipment',
  permits: 'Permits & Fees',
  overhead: 'Overhead',
  other: 'Other',
}

/**
 * POST /projects/:id/change-orders/:coId/send
 * Create a one-line estimate from a change order and send through the estimate portal flow.
 */
router.post('/:id/change-orders/:coId/send', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase || !req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
    const projectId = req.params.id
    const { coId } = req.params
    const { recipient_emails, client_name, gc_name } = req.body || {}

    const { data: co, error: coErr } = await supabase
      .from('project_change_orders')
      .select('id, project_id, description, amount, status, category')
      .eq('id', coId)
      .eq('project_id', projectId)
      .maybeSingle()
    if (coErr) throw coErr
    if (!co) return res.status(404).json({ error: 'Change order not found' })

    const fallbackEmails = req.project?.client_email ? [String(req.project.client_email).trim()] : []
    const outEmails = Array.isArray(recipient_emails)
      ? recipient_emails.map((e) => String(e || '').trim()).filter(Boolean)
      : fallbackEmails
    if (!outEmails.length) {
      return res.status(400).json({ error: 'No recipient email found. Add a client email or provide recipient_emails.' })
    }

    const amount = Math.max(0, Number(co.amount) || 0)
    const categoryKey = String(co.category || 'other').toLowerCase()
    const sectionLabel = CHANGE_ORDER_CATEGORY_LABELS[categoryKey] || CHANGE_ORDER_CATEGORY_LABELS.other
    const estimateTitle = `Change Order${co.status === 'Approved' ? ' (Approved)' : ''}: ${String(co.description || '').slice(0, 80)}`

    const { data: estimate, error: estErr } = await supabase
      .from('estimates')
      .insert({
        job_id: projectId,
        user_id: req.user.id,
        title: estimateTitle,
        status: 'draft',
        total_amount: amount,
        recipient_emails: outEmails,
        source_change_order_id: coId,
      })
      .select('id')
      .single()
    if (estErr) throw estErr

    const { error: lineErr } = await supabase
      .from('estimate_line_items')
      .insert({
        estimate_id: estimate.id,
        custom_product_id: null,
        description: String(co.description || 'Change order').trim() || 'Change order',
        quantity: 1,
        unit: 'ls',
        unit_price: amount,
        total: amount,
        section: sectionLabel,
      })
    if (lineErr) throw lineErr

    const clientToken = crypto.randomUUID()
    const { error: sendPrepErr } = await supabase
      .from('estimates')
      .update({
        client_token: clientToken,
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', estimate.id)
    if (sendPrepErr) throw sendPrepErr

    const baseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || (req.protocol + '://' + (req.get('host') || 'localhost'))
    const portalUrl = `${baseUrl.replace(/\/$/, '')}/estimate/${clientToken}`
    const clientDisplayName = client_name && String(client_name).trim()
      ? String(client_name).trim()
      : (req.project?.assigned_to_name || 'there')
    const gcDisplayName = gc_name && String(gc_name).trim()
      ? String(gc_name).trim()
      : 'Your contractor'
    const projectName = req.project?.name || 'your project'

    await sendEstimatePortalEmail({
      to: outEmails[0],
      clientName: clientDisplayName,
      gcName: gcDisplayName,
      projectName,
      portalUrl,
      documentKind: 'change_order',
    })

    const { data: estForTrail, error: estTrailErr } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimate.id)
      .single()
    if (!estTrailErr && estForTrail) {
      recordEstimateSentPaperTrail(supabase, req.user.id, estimate.id, estForTrail)
    }

    res.status(201).json({
      estimate_id: estimate.id,
      portal_url: portalUrl,
      recipient_emails: outEmails,
    })
  } catch (err) {
    next(err)
  }
})

// --- Launch Takeoff (enrich with trade_tag, cost_estimate) ---
function enrichMaterialList(materialList) {
  if (!materialList || !Array.isArray(materialList.categories)) return materialList
  const categories = materialList.categories.map((cat) => ({
    ...cat,
    items: (cat.items || []).map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
      trade_tag: item.trade_tag || 'TBD',
      cost_estimate: item.cost_estimate ?? null,
      subcategory: item.subcategory ?? '',
      drawing_refs: item.drawing_refs ?? undefined,
    })),
  }))
  return { ...materialList, categories }
}

router.post('/:id/launch-takeoff', loadProject, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 25MB)' })
      return res.status(400).json({ error: err.message || 'Invalid file' })
    }
    next()
  })
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const supabase = req.supabase || defaultSupabase
    const projectId = req.params.id
    // Client can send planType in body (e.g. from Takeoff tab selector); else use project's saved plan_type
    const allowed = ['residential', 'commercial', 'civil', 'auto']
    const bodyPlanType = req.body?.planType || req.body?.plan_type
    const planType = allowed.includes(bodyPlanType)
      ? bodyPlanType
      : (allowed.includes(req.project?.plan_type) ? req.project.plan_type : 'auto')
    let tradeFilter = req.body?.tradeFilter ?? null
    if (typeof tradeFilter === 'string' && tradeFilter.trim().startsWith('[')) {
      try {
        tradeFilter = JSON.parse(tradeFilter)
      } catch (_) {
        tradeFilter = tradeFilter.trim() || null
      }
    }
    const { materialList, truncated = false } = await runTakeoff(req.file.buffer, req.file.mimetype, {
      useCustomProject: true,
      planType,
      tradeFilter,
    })
    // Ensure we always send a valid shape: { categories: array, summary? }
    const safeList = materialList && Array.isArray(materialList.categories)
      ? materialList
      : { categories: [], summary: materialList?.summary || 'Takeoff completed; no categories extracted.' }
    const enriched = enrichMaterialList(safeList)

    let row = null
    if (supabase) {
      const { data, error } = await supabase
        .from('project_takeoffs')
        .insert({
          project_id: projectId,
          material_list: enriched,
        })
        .select()
        .single()
      if (!error) row = data
    }

    res.status(201).json({
      id: row?.id || `temp-${Date.now()}`,
      material_list: enriched,
      created_at: row?.created_at,
      truncated: Boolean(truncated),
    })
  } catch (err) {
    next(err)
  }
})

// --- Subcontractors ---
router.get('/:id/subcontractors', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data, error } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('project_id', req.params.id)
      .order('name')
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.post('/:id/subcontractors', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const projectId = req.params.id
    const subBody = req.body || {}
    const { name, trade, email, phone, dispatch_portal } = subBody
    const hasSubResponseDeadline = Object.prototype.hasOwnProperty.call(subBody, 'response_deadline')
    const subResponseDeadline = hasSubResponseDeadline ? parseBidResponseDeadline(subBody.response_deadline) : undefined
    const subEmail = email != null ? String(email).trim() : ''
    const tradeTag = trade != null ? String(trade).trim() : ''

    const { data: sub, error } = await supabase
      .from('subcontractors')
      .insert({
        project_id: projectId,
        name: name || '',
        trade: tradeTag,
        email: subEmail,
        phone: phone != null ? String(phone) : '',
      })
      .select()
      .single()
    if (error) throw error

    if (!dispatch_portal) {
      return res.status(201).json(sub)
    }

    if (!tradeTag) {
      return res.status(400).json({ error: 'trade is required when dispatch_portal is true' })
    }

    const { data: pkgs } = await supabase.from('trade_packages').select('id, trade_tag').eq('project_id', projectId)
    let tradePackageId
    const found = (pkgs || []).find((p) => p.trade_tag === tradeTag)
    if (found) {
      tradePackageId = found.id
    } else {
      const ins = await supabase
        .from('trade_packages')
        .insert({
          project_id: projectId,
          trade_tag: tradeTag,
          line_items: [],
        })
        .select('id')
        .single()
      if (ins.error || !ins.data) throw ins.error || new Error('Failed to create trade package')
      tradePackageId = ins.data.id
    }

    const existing = await supabase
      .from('sub_bids')
      .select('id')
      .eq('trade_package_id', tradePackageId)
      .eq('subcontractor_id', sub.id)
      .maybeSingle()

    const token = crypto.randomUUID()
    let subBidId
    const dispatchTs = new Date().toISOString()
    if (existing?.data?.id) {
      const subUpd = { portal_token: token, amount: 0, notes: null, dispatched_at: dispatchTs }
      if (hasSubResponseDeadline) subUpd.response_deadline = subResponseDeadline
      await supabase.from('sub_bids').update(subUpd).eq('id', existing.data.id)
      subBidId = existing.data.id
    } else {
      const bidIns = await supabase
        .from('sub_bids')
        .insert({
          trade_package_id: tradePackageId,
          subcontractor_id: sub.id,
          amount: 0,
          awarded: false,
          portal_token: token,
          dispatched_at: dispatchTs,
          response_deadline: hasSubResponseDeadline ? subResponseDeadline : null,
        })
        .select('id')
        .single()
      if (bidIns.error || !bidIns.data) throw bidIns.error || new Error('Failed to create sub bid')
      subBidId = bidIns.data.id
    }

    const baseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || req.protocol + '://' + (req.get('host') || 'localhost')
    const portalUrl = `${baseUrl.replace(/\/$/, '')}/bid/${token}`

    let projectName = ''
    const projRes = await supabase.from('projects').select('name').eq('id', projectId).maybeSingle()
    if (projRes.data?.name) projectName = projRes.data.name

    let emailSent = false
    if (subEmail) {
      try {
        await sendBidPortalEmail({ to: subEmail, projectName, portalUrl, isResend: false })
        emailSent = true
      } catch (e) {
        console.warn('[subcontractors] Bid portal email failed:', e?.message || e)
      }
    } else {
      console.log('[subcontractors/dispatch_portal] No email; portal link:', portalUrl)
    }

    recordBidPackageDispatchedPaperTrail(supabase, req.project.user_id, {
      project_id: projectId,
      trade_tag: tradeTag,
      trade_package_id: tradePackageId,
      subcontractor_id: sub.id,
      subcontractor_name: sub.name,
      subcontractor_email: subEmail || null,
      amount: 0,
      notes: null,
      response_deadline: hasSubResponseDeadline ? subResponseDeadline : null,
      token,
      sub_bid_id: subBidId,
      dispatched_at: dispatchTs,
      project_name: projectName,
      portal_url: portalUrl,
    })

    return res.status(201).json({
      subcontractor: sub,
      portal_url: portalUrl,
      sub_bid_id: subBidId,
      email_sent: emailSent,
    })
  } catch (err) {
    next(err)
  }
})

router.put('/:id/subcontractors/:subId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { subId } = req.params
    const { name, trade, email, phone } = req.body || {}
    const updates = {}
    if (name !== undefined) updates.name = name
    if (trade !== undefined) updates.trade = trade
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    const { data, error } = await supabase
      .from('subcontractors')
      .update(updates)
      .eq('id', subId)
      .eq('project_id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/subcontractors/:subId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { error } = await supabase
      .from('subcontractors')
      .delete()
      .eq('id', req.params.subId)
      .eq('project_id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.post('/:id/subcontractors/bulk-send', loadProject, async (req, res, next) => {
  try {
    const { sub_ids, subject, body } = req.body || {}
    if (!Array.isArray(sub_ids) || sub_ids.length === 0) {
      return res.status(400).json({ error: 'sub_ids array required' })
    }
    // Stub: log or queue; no email provider configured
    console.log('Bulk send (stub):', { projectId: req.params.id, sub_ids, subject, body })
    res.json({ ok: true, message: 'Bulk send queued (stub)' })
  } catch (err) {
    next(err)
  }
})

// --- Project work types ---
router.get('/:id/work-types', loadProjectForOwnerOrAssignedEmployee, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data, error } = await supabase
      .from('project_work_types')
      .select('*')
      .eq('project_id', req.params.id)
      .order('name')
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.post('/:id/work-types', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { name, description, rate, unit, type_key, custom_color } = req.body || {}
    const { data, error } = await supabase
      .from('project_work_types')
      .insert({
        project_id: req.params.id,
        name: name ?? '',
        description: description || null,
        rate: Number(rate) || 0,
        unit: unit ?? 'hr',
        type_key: type_key || null,
        custom_color: custom_color || null,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

router.put('/:id/work-types/:wtId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { wtId } = req.params
    const { name, description, rate, unit, type_key, custom_color } = req.body || {}
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description || null
    if (rate !== undefined) updates.rate = Number(rate) || 0
    if (unit !== undefined) updates.unit = unit
    if (type_key !== undefined) updates.type_key = type_key || null
    if (custom_color !== undefined) updates.custom_color = custom_color || null
    const { data, error } = await supabase
      .from('project_work_types')
      .update(updates)
      .eq('id', wtId)
      .eq('project_id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/work-types/:wtId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { error } = await supabase
      .from('project_work_types')
      .delete()
      .eq('id', req.params.wtId)
      .eq('project_id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// --- Bid documents (uploaded bids from subs for reference) ---
const BID_DOCUMENTS_PATH_PREFIX = 'bid-documents'

router.get('/:id/bid-documents', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data, error } = await supabase
      .from('project_bid_documents')
      .select('*')
      .eq('project_id', req.params.id)
      .order('uploaded_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

router.post('/:id/bid-documents', loadProject, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const supabaseClient = req.supabase || defaultSupabase
    const supabaseStorage = defaultSupabase || supabaseClient
    if (!supabaseClient) return res.status(503).json({ error: 'Database not configured' })
    await ensureBuildPlansBucket()
    const projectId = req.params.id
    const uploaderName = (req.body && req.body.uploader_name) || req.user?.email || 'Unknown'
    const safeName = (req.file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
    const ext = safeName.split('.').pop() || 'bin'
    const path = `${BID_DOCUMENTS_PATH_PREFIX}/${projectId}/${Date.now()}-${safeName}`

    const { error: uploadErr } = await supabaseStorage.storage.from(BUILD_PLANS_BUCKET).upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    })
    if (uploadErr) throw uploadErr
    let url = path
    const { data: urlData } = supabaseStorage.storage.from(BUILD_PLANS_BUCKET).getPublicUrl(path)
    if (urlData?.publicUrl) url = urlData.publicUrl

    const { data: row, error } = await supabaseClient
      .from('project_bid_documents')
      .insert({
        project_id: projectId,
        file_name: req.file.originalname || safeName,
        url,
        uploader_name: uploaderName,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(row)
  } catch (err) {
    next(err)
  }
})

router.get('/:id/bid-documents/:docId/view', loadProject, async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { docId } = req.params
    const { data: doc, error: docErr } = await db
      .from('project_bid_documents')
      .select('url')
      .eq('id', docId)
      .eq('project_id', req.params.id)
      .maybeSingle()
    if (docErr || !doc) return res.status(404).json({ error: 'Bid document not found' })
    let path = doc.url
    if (path.startsWith('http')) {
      const match = path.match(/\/object\/public\/[^/]+\/(.+)$/) || path.match(/\/storage\/v1\/object\/[^/]+\/[^/]+\/(.+)$/)
      path = match ? match[1] : path
    }
    const { data: signed, error: signErr } = await db.storage.from(BUILD_PLANS_BUCKET).createSignedUrl(path, 3600)
    if (signErr) return res.status(502).json({ error: 'Could not generate view link', detail: signErr.message })
    res.json({ url: signed.signedUrl })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/bid-documents/:docId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { error } = await supabase
      .from('project_bid_documents')
      .delete()
      .eq('id', req.params.docId)
      .eq('project_id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

/** GC in-house scope + estimate lines (creates trade package if needed). Shared by bid-sheet + legacy paths. */
async function handleGcSelfPerform(req, res, next) {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const projectId = req.params.id
    const { trade_tag, gc_self_perform, estimate_lines } = req.body || {}
    if (trade_tag == null || !String(trade_tag).trim()) {
      return res.status(400).json({ error: 'trade_tag is required' })
    }
    const tag = String(trade_tag).trim()
    const wantSelf = !!gc_self_perform
    const lines = Array.isArray(estimate_lines) ? estimate_lines : []

    if (wantSelf) {
      if (lines.length === 0) {
        return res.status(400).json({ error: 'Add at least one priced line item for this scope.' })
      }
      const hasValue = lines.some((l) => {
        const q = Number(l.quantity) || 0
        const p = Number(l.unit_price) || 0
        return q * p > 0 || p > 0
      })
      if (!hasValue) {
        return res.status(400).json({ error: 'Enter a unit price (and quantity) so this scope has a dollar amount.' })
      }
    }

    const normalized = lines.map((l) => ({
      description: String(l.description || '').trim() || 'Line item',
      quantity: Math.max(0, Number(l.quantity) || 0) || 1,
      unit: String(l.unit || 'ea').trim() || 'ea',
      unit_price: Math.max(0, Number(l.unit_price) || 0),
    }))

    const { data: existingList, error: findErr } = await supabase
      .from('trade_packages')
      .select('id')
      .eq('project_id', projectId)
      .eq('trade_tag', tag)
      .limit(1)
    if (findErr) throw findErr

    let pkgId
    if (existingList?.length) {
      pkgId = existingList[0].id
      const { error: upErr } = await supabase
        .from('trade_packages')
        .update({
          gc_self_perform: wantSelf,
          gc_estimate_lines: wantSelf ? normalized : [],
        })
        .eq('id', pkgId)
      if (upErr) throw upErr
    } else {
      const { data: ins, error: insErr } = await supabase
        .from('trade_packages')
        .insert({
          project_id: projectId,
          trade_tag: tag,
          line_items: [],
          gc_self_perform: wantSelf,
          gc_estimate_lines: wantSelf ? normalized : [],
        })
        .select('id')
        .single()
      if (insErr) throw insErr
      pkgId = ins.id
    }

    const { data: pkg, error: pkgErr } = await supabase.from('trade_packages').select('*').eq('id', pkgId).single()
    if (pkgErr) throw pkgErr
    res.json({ trade_package: pkg })
  } catch (err) {
    next(err)
  }
}

// --- Bid sheet ---
router.get('/:id/bid-sheet', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const projectId = req.params.id
    const [packagesRes, bidsRes, sheetRes] = await Promise.all([
      supabase.from('trade_packages').select('*').eq('project_id', projectId),
      supabase.from('sub_bids').select('*'),
      supabase.from('bid_sheets').select('*').eq('project_id', projectId).maybeSingle(),
    ])
    const trade_packages = packagesRes.data || []
    const packageIds = trade_packages.map((p) => p.id)
    const sub_bids = (bidsRes.data || []).filter((b) => packageIds.includes(b.trade_package_id))
    const sheet = sheetRes.data
    const cost_buckets = sheet?.cost_buckets || {
      awarded_bids: 0,
      self_supplied_materials: 0,
      own_labor: 0,
      overhead_margin: 0,
    }
    const proposal_lines = sheet?.proposal_lines || []
    res.json({
      project_id: projectId,
      trade_packages,
      sub_bids,
      cost_buckets,
      proposal_lines,
    })
  } catch (err) {
    next(err)
  }
})

/** POST …/bid-sheet/gc-self-perform — primary path (with other bid-sheet APIs). */
router.post('/:id/bid-sheet/gc-self-perform', loadProject, handleGcSelfPerform)
/** POST …/trade-packages/gc-self-perform — legacy/alternate path. */
router.post('/:id/trade-packages/gc-self-perform', loadProject, handleGcSelfPerform)

/** POST /projects/:id/bid-sheet/dispatch — generate portal token for a sub bid, store it, and send portal link (email TODO). */
router.post('/:id/bid-sheet/dispatch', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const projectId = req.params.id
    const body = req.body || {}
    const { trade_package_id, subcontractor_id, amount, notes } = body
    const hasResponseDeadline = Object.prototype.hasOwnProperty.call(body, 'response_deadline')
    const responseDeadline = hasResponseDeadline ? parseBidResponseDeadline(body.response_deadline) : undefined
    if (!trade_package_id || !subcontractor_id) {
      return res.status(400).json({ error: 'trade_package_id and subcontractor_id are required' })
    }

    const pkgRes = await supabase.from('trade_packages').select('id').eq('project_id', projectId).eq('id', trade_package_id).maybeSingle()
    if (pkgRes.error || !pkgRes.data) {
      return res.status(404).json({ error: 'Trade package not found' })
    }
    const subRes = await supabase
      .from('subcontractors')
      .select('id, email, name, trade')
      .eq('project_id', projectId)
      .eq('id', subcontractor_id)
      .maybeSingle()
    if (subRes.error || !subRes.data) {
      return res.status(404).json({ error: 'Subcontractor not found' })
    }
    const subEmail = subRes.data.email || ''

    const pkgTagRes = await supabase.from('trade_packages').select('trade_tag').eq('id', trade_package_id).maybeSingle()
    const tradeTag = (pkgTagRes.data && pkgTagRes.data.trade_tag) || ''

    const existing = await supabase
      .from('sub_bids')
      .select('id, portal_token')
      .eq('trade_package_id', trade_package_id)
      .eq('subcontractor_id', subcontractor_id)
      .maybeSingle()
    const token = crypto.randomUUID()
    const bidAmount = amount != null ? Number(amount) : 0
    const bidNotes = notes != null ? String(notes) : null

    const dispatchTs = new Date().toISOString()
    let subBidId
    if (existing?.data?.id) {
      subBidId = existing.data.id
      const upd = { portal_token: token, amount: bidAmount, notes: bidNotes, dispatched_at: dispatchTs }
      if (hasResponseDeadline) upd.response_deadline = responseDeadline
      const { error: bidUpdErr } = await supabase.from('sub_bids').update(upd).eq('id', subBidId)
      if (bidUpdErr) throw bidUpdErr
    } else {
      const ins = await supabase
        .from('sub_bids')
        .insert({
          trade_package_id,
          subcontractor_id,
          amount: bidAmount,
          notes: bidNotes,
          awarded: false,
          portal_token: token,
          dispatched_at: dispatchTs,
          response_deadline: hasResponseDeadline ? responseDeadline : null,
        })
        .select('id')
        .single()
      if (ins.error || !ins.data?.id) throw ins.error || new Error('Failed to create sub bid')
      subBidId = ins.data.id
    }

    const baseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || req.protocol + '://' + (req.get('host') || 'localhost')
    const portalUrl = `${baseUrl.replace(/\/$/, '')}/bid/${token}`

    let projectName = ''
    const projRes = await supabase.from('projects').select('name').eq('id', projectId).maybeSingle()
    if (projRes.data && projRes.data.name) projectName = projRes.data.name

    if (subEmail) {
      await sendBidPortalEmail({ to: subEmail, projectName, portalUrl, isResend: false })
    } else {
      console.log('[bid-sheet/dispatch] No sub email; portal link:', portalUrl)
    }

    recordBidPackageDispatchedPaperTrail(supabase, req.project.user_id, {
      project_id: projectId,
      trade_tag: tradeTag,
      trade_package_id,
      subcontractor_id,
      subcontractor_name: subRes.data.name,
      subcontractor_email: subEmail || null,
      amount: bidAmount,
      notes: bidNotes,
      response_deadline: hasResponseDeadline ? responseDeadline : null,
      token,
      sub_bid_id: subBidId,
      dispatched_at: dispatchTs,
      project_name: projectName,
      portal_url: portalUrl,
    })

    return res.status(200).json({ token, portal_url: portalUrl })
  } catch (err) {
    next(err)
  }
})

/** POST /projects/:id/bid-sheet/resend — resend portal link email for a sub bid. Body: { sub_bid_id }. */
router.post('/:id/bid-sheet/resend', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const projectId = req.params.id
    const { sub_bid_id } = req.body || {}
    if (!sub_bid_id) return res.status(400).json({ error: 'sub_bid_id is required' })

    const pkgRes = await supabase.from('trade_packages').select('id').eq('project_id', projectId)
    const packageIds = (pkgRes.data || []).map((p) => p.id)
    const bidRes = await supabase
      .from('sub_bids')
      .select('id, trade_package_id, subcontractor_id, portal_token')
      .eq('id', sub_bid_id)
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
    const subEmail = (subRes.data && subRes.data.email) ? subRes.data.email : ''
    const token = bidRes.data.portal_token
    if (!token) return res.status(400).json({ error: 'No portal link for this bid' })

    const baseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || req.protocol + '://' + (req.get('host') || 'localhost')
    const portalUrl = `${baseUrl.replace(/\/$/, '')}/bid/${token}`

    let projectName = ''
    const projRes = await supabase.from('projects').select('name').eq('id', projectId).maybeSingle()
    if (projRes.data && projRes.data.name) projectName = projRes.data.name

    const resendTs = new Date().toISOString()
    if (subEmail) {
      await sendBidPortalEmail({ to: subEmail, projectName, portalUrl, isResend: true })
    } else {
      console.log('[bid-sheet/resend] No sub email; portal link:', portalUrl)
    }
    await supabase.from('sub_bids').update({ dispatched_at: resendTs }).eq('id', bidRes.data.id)

    return res.status(200).json({ ok: true, portal_url: portalUrl })
  } catch (err) {
    next(err)
  }
})

/** PATCH /projects/:id/bid-sheet/sub-bids/:bidId — set awarded (only one awarded per trade package when true). */
router.patch('/:id/bid-sheet/sub-bids/:bidId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const projectId = req.params.id
    const bidId = req.params.bidId
    const awarded = !!req.body?.awarded

    const pkgRes = await supabase.from('trade_packages').select('id').eq('project_id', projectId)
    const packageIds = (pkgRes.data || []).map((p) => p.id)
    const bidRes = await supabase.from('sub_bids').select('id, trade_package_id').eq('id', bidId).maybeSingle()
    if (bidRes.error || !bidRes.data || !packageIds.includes(bidRes.data.trade_package_id)) {
      return res.status(404).json({ error: 'Sub bid not found' })
    }
    const pkgId = bidRes.data.trade_package_id
    if (awarded) {
      await supabase.from('sub_bids').update({ awarded: false }).eq('trade_package_id', pkgId)
      await supabase.from('sub_bids').update({ awarded: true }).eq('id', bidId)
    } else {
      await supabase.from('sub_bids').update({ awarded: false }).eq('id', bidId)
    }
    await syncPaperTrailFromSubBid(supabase, bidId)
    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/** DELETE /projects/:id/bid-sheet/sub-bids/:bidId — remove declined bid row only. */
router.delete('/:id/bid-sheet/sub-bids/:bidId', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const projectId = req.params.id
    const bidId = req.params.bidId

    const pkgRes = await supabase.from('trade_packages').select('id').eq('project_id', projectId)
    const packageIds = (pkgRes.data || []).map((p) => p.id)
    const bidRes = await supabase
      .from('sub_bids')
      .select('id, trade_package_id, response_status')
      .eq('id', bidId)
      .maybeSingle()
    if (bidRes.error || !bidRes.data || !packageIds.includes(bidRes.data.trade_package_id)) {
      return res.status(404).json({ error: 'Sub bid not found' })
    }
    const st = String(bidRes.data.response_status || '').toLowerCase()
    if (st !== 'declined') {
      return res.status(400).json({ error: 'Only declined bids can be removed this way' })
    }
    const { error: delErr } = await supabase.from('sub_bids').delete().eq('id', bidId)
    if (delErr) throw delErr
    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.put('/:id/bid-sheet', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const projectId = req.params.id
    const { trade_packages, sub_bids, cost_buckets, proposal_lines } = req.body || {}

    if (Array.isArray(trade_packages)) {
      const existing = await supabase.from('trade_packages').select('id, gc_self_perform, gc_estimate_lines').eq('project_id', projectId)
      const existingIds = (existing.data || []).map((p) => p.id)
      const existingById = new Map((existing.data || []).map((p) => [p.id, p]))
      for (const pkg of trade_packages) {
        const row = {
          project_id: projectId,
          trade_tag: pkg.trade_tag,
          line_items: pkg.line_items || [],
        }
        if (pkg.gc_self_perform !== undefined) row.gc_self_perform = !!pkg.gc_self_perform
        if (pkg.gc_estimate_lines !== undefined) row.gc_estimate_lines = pkg.gc_estimate_lines
        if (pkg.id && existingIds.includes(pkg.id)) {
          const prev = existingById.get(pkg.id)
          const updatePayload = {
            trade_tag: row.trade_tag,
            line_items: row.line_items,
            gc_self_perform: row.gc_self_perform !== undefined ? row.gc_self_perform : prev?.gc_self_perform,
            gc_estimate_lines:
              row.gc_estimate_lines !== undefined ? row.gc_estimate_lines : prev?.gc_estimate_lines || [],
          }
          await supabase.from('trade_packages').update(updatePayload).eq('id', pkg.id)
        } else {
          await supabase.from('trade_packages').insert({
            ...row,
            gc_self_perform: row.gc_self_perform ?? false,
            gc_estimate_lines: row.gc_estimate_lines ?? [],
          })
        }
      }
      const toRemove = existingIds.filter((id) => !trade_packages.some((p) => p.id === id))
      if (toRemove.length) await supabase.from('trade_packages').delete().in('id', toRemove)
    }

    const pkgIds = (await supabase.from('trade_packages').select('id').eq('project_id', projectId)).data?.map((p) => p.id) || []
    if (Array.isArray(sub_bids)) {
      if (pkgIds.length) await supabase.from('sub_bids').delete().in('trade_package_id', pkgIds)
      for (const bid of sub_bids) {
        if (bid.trade_package_id && bid.subcontractor_id != null && pkgIds.includes(bid.trade_package_id)) {
          const row = {
            trade_package_id: bid.trade_package_id,
            subcontractor_id: bid.subcontractor_id,
            amount: Number(bid.amount) || 0,
            notes: bid.notes || null,
            awarded: !!bid.awarded,
          }
          if (bid.portal_token != null && String(bid.portal_token).trim()) row.portal_token = bid.portal_token
          await supabase.from('sub_bids').insert(row)
        }
      }
    }

    if (cost_buckets || proposal_lines) {
      const updates = { updated_at: new Date().toISOString() }
      if (cost_buckets) updates.cost_buckets = cost_buckets
      if (proposal_lines) updates.proposal_lines = proposal_lines
      await supabase.from('bid_sheets').upsert(
        { project_id: projectId, ...updates },
        { onConflict: 'project_id' }
      )
    }

    const [packagesRes, bidsRes, sheetRes] = await Promise.all([
      supabase.from('trade_packages').select('*').eq('project_id', projectId),
      supabase.from('sub_bids').select('*'),
      supabase.from('bid_sheets').select('*').eq('project_id', projectId).maybeSingle(),
    ])
    const packages = packagesRes.data || []
    const packageIdsFinal = packages.map((p) => p.id)
    const bids = (bidsRes.data || []).filter((b) => packageIdsFinal.includes(b.trade_package_id))
    const sheet = sheetRes.data
    res.json({
      project_id: projectId,
      trade_packages: packages,
      sub_bids: bids,
      cost_buckets: sheet?.cost_buckets || {},
      proposal_lines: sheet?.proposal_lines || [],
    })
  } catch (err) {
    next(err)
  }
})

// --- Project takeoffs (list for Launch Takeoff display) ---
router.get('/:id/takeoffs', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data, error } = await supabase
      .from('project_takeoffs')
      .select('*')
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

module.exports = router
module.exports.ensureBuildPlansBucket = ensureBuildPlansBucket
