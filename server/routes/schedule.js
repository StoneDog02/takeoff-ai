/**
 * GET /schedule?date=YYYY-MM-DD
 * Returns schedule items (project_tasks + milestones) due or active on the given date
 * for all projects owned by the current user.
 */
const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const date = req.query.date
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Query param date=YYYY-MM-DD is required' })
    }
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    // User's projects
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, name')
      .eq('user_id', userId)
    if (projErr) throw projErr
    if (!projects?.length) return res.json([])

    const projectIds = projects.map((p) => p.id)
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]))
    const items = []

    // Tasks: start_date <= date <= end_date
    const { data: tasks, error: taskErr } = await supabase
      .from('project_tasks')
      .select('id, project_id, title, responsible, end_date, completed')
      .in('project_id', projectIds)
      .lte('start_date', date)
      .gte('end_date', date)
      .order('end_date', { ascending: true })
    if (taskErr) throw taskErr
    if (tasks?.length) {
      tasks.forEach((t) => {
        items.push({
          id: t.id,
          projectId: t.project_id,
          projectName: projectMap[t.project_id] || t.project_id,
          title: t.title,
          completed: t.completed,
          type: 'task',
          responsible: t.responsible || undefined,
          endDate: t.end_date,
        })
      })
    }

    // Milestones: due_date = date
    const { data: milestones, error: mileErr } = await supabase
      .from('milestones')
      .select('id, project_id, title, due_date, completed')
      .in('project_id', projectIds)
      .eq('due_date', date)
      .order('due_date', { ascending: true })
    if (mileErr) throw mileErr
    if (milestones?.length) {
      milestones.forEach((m) => {
        items.push({
          id: m.id,
          projectId: m.project_id,
          projectName: projectMap[m.project_id] || m.project_id,
          title: m.title,
          completed: m.completed,
          type: 'milestone',
          endDate: m.due_date,
        })
      })
    }

    items.sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''))
    res.json(items)
  } catch (err) {
    next(err)
  }
})

module.exports = router
