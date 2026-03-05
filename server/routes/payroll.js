const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

router.get('/ytd', async (req, res, next) => {
  try {
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const year = parseInt(req.query.year, 10) || new Date().getFullYear()
    const from = `${year}-01-01T00:00:00.000Z`
    const to = `${year}-12-31T23:59:59.999Z`
    const { data: entries, error: entriesErr } = await supabase
      .from('time_entries')
      .select('id, employee_id, job_id, clock_in, clock_out, hours')
      .gte('clock_in', from)
      .lte('clock_in', to)
      .not('clock_out', 'is', null)
    if (entriesErr) throw entriesErr
    const { data: employees, error: empErr } = await supabase
      .from('employees')
      .select('id, name, current_compensation')
      .eq('user_id', req.user?.id)
    if (empErr) throw empErr
    const empMap = new Map((employees || []).map((e) => [e.id, e]))
    const byEmployee = new Map()
    for (const e of entries || []) {
      if (!empMap.has(e.employee_id)) continue
      const rate = empMap.get(e.employee_id).current_compensation || 0
      const h = e.hours ?? (e.clock_in && e.clock_out
        ? Math.round(((new Date(e.clock_out) - new Date(e.clock_in)) / (1000 * 60 * 60)) * 100) / 100
        : 0)
      const earnings = h * rate
      const rec = byEmployee.get(e.employee_id) || { employee_id: e.employee_id, total_earnings: 0, monthly_breakdown: {} }
      rec.total_earnings += earnings
      const month = new Date(e.clock_in).getMonth() + 1
      rec.monthly_breakdown[month] = (rec.monthly_breakdown[month] || 0) + earnings
      byEmployee.set(e.employee_id, rec)
    }
    const result = []
    for (const [empId, rec] of byEmployee) {
      const months = Object.entries(rec.monthly_breakdown).map(([m, v]) => ({ month: Number(m), earnings: v }))
      months.sort((a, b) => a.month - b.month)
      result.push({
        employee_id: empId,
        year,
        total_earnings: Math.round(rec.total_earnings * 100) / 100,
        monthly_breakdown: months,
      })
    }
    const companyTotal = result.reduce((s, r) => s + r.total_earnings, 0)
    res.json({ year, company_total: Math.round(companyTotal * 100) / 100, by_employee: result })
  } catch (err) {
    next(err)
  }
})

module.exports = router
