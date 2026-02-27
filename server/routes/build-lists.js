const express = require('express')
const router = express.Router()
const { supabase: defaultSupabase } = require('../db/supabase')

// GET /api/build-lists
router.get('/', async (req, res) => {
  const supabase = req.supabase || defaultSupabase
  if (!supabase) return res.json([])
  try {
    const { data, error } = await supabase
      .from('takeoffs')
      .select('id, name, created_at, status')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Build lists list error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/build-lists/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const supabase = req.supabase || defaultSupabase
  if (!supabase) return res.status(404).json({ error: 'Not found' })
  try {
    const { data, error } = await supabase
      .from('takeoffs')
      .select('id, name, plan_file_name, plan_file_url, material_list, status, created_at')
      .eq('id', id)
      .single()
    if (error || !data) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  } catch (err) {
    console.error('Build list detail error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
