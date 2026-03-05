const express = require('express')
const multer = require('multer')
const { runTakeoff } = require('../claude/takeoff')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()
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
    ]
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Invalid file type.'))
  },
})

/** Load project and ensure user owns it. Sets req.project. */
async function loadProject(req, res, next) {
  const supabase = req.supabase || defaultSupabase
  if (!supabase) return res.status(503).json({ error: 'Database not configured' })
  const { id } = req.params
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.user?.id)
    .single()
  if (error || !project) return res.status(404).json({ error: 'Project not found' })
  req.project = project
  next()
}

// --- Projects CRUD ---
router.get('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.json([])
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, status, scope, created_at, updated_at, user_id, address_line_1, address_line_2, city, state, postal_code, expected_start_date, expected_end_date, estimated_value, assigned_to_name')
      .eq('user_id', req.user?.id)
      .order('updated_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
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

router.get('/:id', loadProject, async (req, res) => {
  res.json(req.project)
})

router.put('/:id', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { name, status, scope, expected_start_date, expected_end_date, assigned_to_name } = req.body || {}
    const updates = {}
    if (name !== undefined) updates.name = name
    if (status !== undefined) updates.status = status
    if (scope !== undefined) updates.scope = scope
    if (expected_start_date !== undefined) updates.expected_start_date = expected_start_date || null
    if (expected_end_date !== undefined) updates.expected_end_date = expected_end_date || null
    if (assigned_to_name !== undefined) updates.assigned_to_name = assigned_to_name || null
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

// --- Budget ---
router.get('/:id/budget', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const { data: items, error } = await supabase
      .from('budget_line_items')
      .select('*')
      .eq('project_id', req.params.id)
    if (error) throw error
    const list = items || []
    const predicted_total = list.reduce((s, i) => s + Number(i.predicted || 0), 0)
    const actual_total = list.reduce((s, i) => s + Number(i.actual || 0), 0)
    res.json({
      items: list,
      summary: {
        predicted_total,
        actual_total,
        profitability: actual_total - predicted_total,
      },
    })
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
      }
      if (it.id && existingIds.includes(it.id)) {
        const { data } = await supabase.from('budget_line_items').update(row).eq('id', it.id).select().single()
        if (data) result.push(data)
      } else {
        const { data } = await supabase.from('budget_line_items').insert(row).select().single()
        if (data) result.push(data)
      }
    }
    const list = result
    const predicted_total = list.reduce((s, i) => s + Number(i.predicted || 0), 0)
    const actual_total = list.reduce((s, i) => s + Number(i.actual || 0), 0)
    res.json({
      items: list,
      summary: { predicted_total, actual_total, profitability: actual_total - predicted_total },
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
    const { materialList } = await runTakeoff(req.file.buffer, req.file.mimetype, {
      useCustomProject: true,
    })
    const enriched = enrichMaterialList(materialList)

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
    const { name, trade, email, phone } = req.body || {}
    const { data, error } = await supabase
      .from('subcontractors')
      .insert({
        project_id: req.params.id,
        name: name || '',
        trade: trade || '',
        email: email || '',
        phone: phone || '',
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
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

router.put('/:id/bid-sheet', loadProject, async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    const projectId = req.params.id
    const { trade_packages, sub_bids, cost_buckets, proposal_lines } = req.body || {}

    if (Array.isArray(trade_packages)) {
      const existing = await supabase.from('trade_packages').select('id').eq('project_id', projectId)
      const existingIds = (existing.data || []).map((p) => p.id)
      for (const pkg of trade_packages) {
        const row = {
          project_id: projectId,
          trade_tag: pkg.trade_tag,
          line_items: pkg.line_items || [],
        }
        if (pkg.id && existingIds.includes(pkg.id)) {
          await supabase.from('trade_packages').update({ trade_tag: row.trade_tag, line_items: row.line_items }).eq('id', pkg.id)
        } else {
          await supabase.from('trade_packages').insert(row)
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
          await supabase.from('sub_bids').insert({
            trade_package_id: bid.trade_package_id,
            subcontractor_id: bid.subcontractor_id,
            amount: Number(bid.amount) || 0,
            notes: bid.notes || null,
            awarded: !!bid.awarded,
          })
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
    const trade_packages = packagesRes.data || []
    const packageIdsFinal = trade_packages.map((p) => p.id)
    const sub_bids = (bidsRes.data || []).filter((b) => packageIdsFinal.includes(b.trade_package_id))
    const sheet = sheetRes.data
    res.json({
      project_id: projectId,
      trade_packages,
      sub_bids,
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
