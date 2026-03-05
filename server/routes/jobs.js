const express = require('express')
const router = express.Router()
const { supabase: defaultSupabase } = require('../db/supabase')

/** GET /api/jobs - List projects as jobs for current user (for Estimates/Projects tabs) */
router.get('/', async (req, res) => {
  const supabase = req.supabase || defaultSupabase
  if (!supabase) return res.json([])
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    const jobs = (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      created_at: p.created_at,
    }))
    res.json(jobs)
  } catch (err) {
    console.error('Jobs list error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
