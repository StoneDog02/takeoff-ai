const express = require('express')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

// ----- Payroll contact (who receives the report) -----
router.get('/contact', async (req, res, next) => {
  try {
    if (req.employee) return res.status(403).json({ error: 'Employees cannot access payroll contact' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { data, error } = await supabase
      .from('payroll_contact')
      .select('name, email, phone')
      .eq('user_id', req.user?.id)
      .maybeSingle()
    if (error) throw error
    if (!data) return res.json(null)
    res.json({
      name: data.name ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
    })
  } catch (err) {
    next(err)
  }
})

router.put('/contact', async (req, res, next) => {
  try {
    if (req.employee) return res.status(403).json({ error: 'Employees cannot update payroll contact' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { name, email, phone } = req.body || {}
    const payload = {
      user_id: req.user?.id,
      name: typeof name === 'string' ? name.trim() : '',
      email: typeof email === 'string' ? email.trim() : '',
      phone: typeof phone === 'string' ? phone.trim() || null : null,
      updated_at: new Date().toISOString(),
    }
    if (!payload.email) return res.status(400).json({ error: 'Email is required' })
    const { data, error } = await supabase
      .from('payroll_contact')
      .upsert(payload, { onConflict: 'user_id' })
      .select('name, email, phone')
      .single()
    if (error) throw error
    res.json({ name: data.name ?? '', email: data.email ?? '', phone: data.phone ?? '' })
  } catch (err) {
    next(err)
  }
})

// ----- Payroll runs (audit when user confirms Approve & Run) -----
router.post('/runs', async (req, res, next) => {
  try {
    if (req.employee) return res.status(403).json({ error: 'Employees cannot record payroll runs' })
    const supabase = req.supabase || defaultSupabase
    if (!supabase) return res.status(503).json({ error: 'Database not configured' })
    const { period_from, period_to, recipient_email, recipient_name, employee_count, total_hours, gross_pay } = req.body || {}
    if (!period_from || !period_to || !recipient_email) {
      return res.status(400).json({ error: 'period_from, period_to, and recipient_email are required' })
    }
    const { data, error } = await supabase
      .from('payroll_runs')
      .insert({
        user_id: req.user?.id,
        period_from,
        period_to,
        recipient_email: recipient_email.trim(),
        recipient_name: typeof recipient_name === 'string' ? recipient_name.trim() || null : null,
        employee_count: Number(employee_count) || 0,
        total_hours: Number(total_hours) || 0,
        gross_pay: Number(gross_pay) || 0,
      })
      .select('id, sent_at')
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

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
    let employees
    if (req.employee) {
      employees = [req.employee]
    } else {
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('id, name, current_compensation')
        .eq('user_id', req.user?.id)
      if (empErr) throw empErr
      employees = empData || []
    }
    const empMap = new Map(employees.map((e) => [e.id, e]))
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
