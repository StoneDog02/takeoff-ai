const express = require('express')
const router = express.Router()
const { supabase: defaultSupabase } = require('../db/supabase')

const VALID_CATEGORIES = ['materials', 'labor', 'equipment', 'subs', 'misc']

function getSupabase(req) {
  return req.supabase || defaultSupabase
}

/** GET /api/job-expenses - list by job (?job_id= optional; omit to return all for pipeline) */
router.get('/', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const jobId = req.query.job_id
  try {
    let q = supabase
      .from('job_expenses')
      .select('*')
      .order('created_at', { ascending: false })
    if (jobId) q = q.eq('job_id', jobId)
    const { data, error } = await q
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Job expenses list error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** GET /api/job-expenses/summary - spend summary per job (for Projects tab) */
router.get('/summary', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { data, error } = await supabase
      .from('job_expenses')
      .select('job_id, amount, category')
    if (error) throw error
    const byJob = {}
    for (const row of data || []) {
      if (!byJob[row.job_id]) {
        byJob[row.job_id] = { job_id: row.job_id, total_spend: 0, by_category: {} }
      }
      byJob[row.job_id].total_spend += Number(row.amount)
      const cat = row.category
      if (VALID_CATEGORIES.includes(cat)) {
        byJob[row.job_id].by_category[cat] =
          (byJob[row.job_id].by_category[cat] || 0) + Number(row.amount)
      }
    }
    res.json(Object.values(byJob))
  } catch (err) {
    console.error('Job expenses summary error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/job-expenses */
router.post('/', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { job_id, amount, category, description, receipt_file_url, billable, vendor } = req.body
    if (!job_id || amount == null) {
      return res.status(400).json({ error: 'job_id and amount required' })
    }
    const cat = category && VALID_CATEGORIES.includes(category) ? category : 'misc'
    const insertPayload = {
      job_id,
      user_id: req.user.id,
      amount: Number(amount),
      category: cat,
      description: description || null,
      receipt_file_url: receipt_file_url || null,
    }
    if (billable !== undefined) insertPayload.billable = Boolean(billable)
    if (vendor !== undefined) insertPayload.vendor = vendor == null || vendor === '' ? null : String(vendor)
    const { data, error } = await supabase
      .from('job_expenses')
      .insert(insertPayload)
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    console.error('Job expense create error:', err)
    res.status(500).json({ error: err.message })
  }
})

/** DELETE /api/job-expenses/:id */
router.delete('/:id', async (req, res) => {
  const supabase = getSupabase(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { id } = req.params
    const { error } = await supabase.from('job_expenses').delete().eq('id', id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    console.error('Job expense delete error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
