const express = require('express')
const multer = require('multer')
const { PDFDocument } = require('pdf-lib')
const { supabase: defaultSupabase } = require('../db/supabase')

const SETTINGS_ASSETS_BUCKET = 'settings-assets'
const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Invalid file type. Use JPEG, PNG, GIF, or WebP.'))
  },
})

function getDb(req) {
  return defaultSupabase
}

/** GET /api/settings — return combined settings for current user */
router.get('/', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const [companyRes, brandingRes, notifRes, geofenceRes, taxRes, integrationsRes] = await Promise.all([
      db.from('company_settings').select('*').eq('user_id', userId).maybeSingle(),
      db.from('branding_settings').select('*').eq('user_id', userId).maybeSingle(),
      db.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle(),
      db.from('geofence_defaults').select('*').eq('user_id', userId).maybeSingle(),
      db.from('tax_compliance_settings').select('*').eq('user_id', userId).maybeSingle(),
      db.from('integration_connections').select('*').eq('user_id', userId).order('integration_id'),
    ])

    const company = companyRes.data
      ? rowToCompany(companyRes.data)
      : null
    const branding = brandingRes.data
      ? { logoUrl: brandingRes.data.logo_url, primaryColor: brandingRes.data.primary_color || '#b91c1c', invoiceTemplateStyle: brandingRes.data.invoice_template_style || 'standard' }
      : null
    const notification_preferences = notifRes.data
      ? { prefs: notifRes.data.prefs || {} }
      : null
    const geofence_defaults = geofenceRes.data
      ? { default_radius_meters: Number(geofenceRes.data.default_radius_meters), clock_out_tolerance_minutes: geofenceRes.data.clock_out_tolerance_minutes ?? 5 }
      : null
    const tax_compliance = taxRes.data
      ? {
          default_tax_rates: taxRes.data.default_tax_rates || [],
          contractor_license_number: taxRes.data.contractor_license_number || null,
          insurance_expiry_date: taxRes.data.insurance_expiry_date || null,
        }
      : null
    const integrations = (integrationsRes.data || []).map((r) => {
      let config = r.config || {}
      if (r.integration_id === 'quickbooks' && typeof config === 'object') {
        config = { realmId: config.realmId }
      }
      return { id: r.id, integration_id: r.integration_id, connected: r.connected, config }
    })

    res.json({
      company,
      branding,
      notification_preferences,
      geofence_defaults,
      tax_compliance,
      integrations,
    })
  } catch (err) {
    next(err)
  }
})

function rowToCompany(row) {
  return {
    name: row.name || '',
    logoUrl: row.logo_url || null,
    licenseNumber: row.license_number || null,
    address: {
      line1: row.address_line_1 || '',
      line2: row.address_line_2 || '',
      city: row.city || '',
      state: row.state || '',
      zip: row.postal_code || '',
    },
    phone: row.phone || '',
    email: row.email || '',
    website: row.website || null,
  }
}

function companyToRow(company, userId) {
  const a = company?.address || {}
  return {
    user_id: userId,
    name: company?.name ?? '',
    logo_url: company?.logoUrl ?? null,
    license_number: company?.licenseNumber ?? null,
    address_line_1: a.line1 ?? '',
    address_line_2: a.line2 ?? '',
    city: a.city ?? '',
    state: a.state ?? '',
    postal_code: a.zip ?? '',
    phone: company?.phone ?? '',
    email: company?.email ?? '',
    website: company?.website ?? null,
    updated_at: new Date().toISOString(),
  }
}

/** PUT /api/settings/company */
router.put('/company', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const row = companyToRow(req.body, userId)
    const { data, error } = await db
      .from('company_settings')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) throw error
    res.json(rowToCompany(data))
  } catch (err) {
    next(err)
  }
})

/** PUT /api/settings/branding */
router.put('/branding', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { logoUrl, primaryColor, invoiceTemplateStyle } = req.body || {}
    const style = ['standard', 'minimal', 'detailed'].includes(invoiceTemplateStyle) ? invoiceTemplateStyle : 'standard'
    const row = {
      user_id: userId,
      logo_url: logoUrl ?? null,
      primary_color: primaryColor || '#b91c1c',
      invoice_template_style: style,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await db
      .from('branding_settings')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) throw error
    res.json({ logoUrl: data.logo_url, primaryColor: data.primary_color, invoiceTemplateStyle: data.invoice_template_style })
  } catch (err) {
    next(err)
  }
})

/** PUT /api/settings/notification-preferences */
router.put('/notification-preferences', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const prefs = req.body?.prefs ?? req.body ?? {}
    const row = {
      user_id: userId,
      prefs: typeof prefs === 'object' ? prefs : {},
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await db
      .from('notification_preferences')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) throw error
    res.json({ prefs: data.prefs || {} })
  } catch (err) {
    next(err)
  }
})

/** PUT /api/settings/geofence-defaults */
router.put('/geofence-defaults', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { default_radius_meters, clock_out_tolerance_minutes } = req.body || {}
    const row = {
      user_id: userId,
      default_radius_meters: Number(default_radius_meters) || 100,
      clock_out_tolerance_minutes: Number(clock_out_tolerance_minutes) ?? 5,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await db
      .from('geofence_defaults')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) throw error
    res.json({
      default_radius_meters: Number(data.default_radius_meters),
      clock_out_tolerance_minutes: data.clock_out_tolerance_minutes,
    })
  } catch (err) {
    next(err)
  }
})

/** PUT /api/settings/tax-compliance */
router.put('/tax-compliance', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { default_tax_rates, contractor_license_number, insurance_expiry_date } = req.body || {}
    const row = {
      user_id: userId,
      default_tax_rates: Array.isArray(default_tax_rates) ? default_tax_rates : [],
      contractor_license_number: contractor_license_number ?? null,
      insurance_expiry_date: insurance_expiry_date || null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await db
      .from('tax_compliance_settings')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) throw error
    res.json({
      default_tax_rates: data.default_tax_rates || [],
      contractor_license_number: data.contractor_license_number,
      insurance_expiry_date: data.insurance_expiry_date,
    })
  } catch (err) {
    next(err)
  }
})

/** GET /api/settings/integrations — list integration connections */
router.get('/integrations', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data, error } = await db
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .order('integration_id')
    if (error) throw error
    res.json((data || []).map((r) => {
      let config = r.config || {}
      if (r.integration_id === 'quickbooks' && typeof config === 'object') {
        config = { realmId: config.realmId }
      }
      return { id: r.id, integration_id: r.integration_id, connected: r.connected, config }
    }))
  } catch (err) {
    next(err)
  }
})

/** PUT /api/settings/integrations/:id — id = integration_id (e.g. quickbooks, stripe) */
router.put('/integrations/:id', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const integrationId = req.params.id
    const { connected, config } = req.body || {}
    const row = {
      user_id: userId,
      integration_id: integrationId,
      connected: Boolean(connected),
      config: config && typeof config === 'object' ? config : {},
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await db
      .from('integration_connections')
      .upsert(row, { onConflict: 'user_id,integration_id' })
      .select()
      .single()
    if (error) throw error
    let outConfig = data.config || {}
    if (integrationId === 'quickbooks' && typeof outConfig === 'object') {
      outConfig = { realmId: outConfig.realmId }
    }
    res.json({ id: data.id, integration_id: data.integration_id, connected: data.connected, config: outConfig })
  } catch (err) {
    next(err)
  }
})

/** POST /api/settings/upload-logo — multipart file; type = company | branding */
router.post('/upload-logo', upload.single('file'), async (req, res, next) => {
  try {
    const db = defaultSupabase
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const file = req.file
    const type = (req.body?.type || 'company').toLowerCase()
    if (!file || !file.buffer) return res.status(400).json({ error: 'No file uploaded' })

    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/gif' ? 'gif' : file.mimetype === 'image/webp' ? 'webp' : 'jpg'
    const path = `${userId}/${type}-logo.${ext}`

    const { error: uploadError } = await db.storage
      .from(SETTINGS_ASSETS_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true })
    if (uploadError) throw uploadError

    const { data: signed } = await db.storage
      .from(SETTINGS_ASSETS_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 year for display
    const url = signed?.signedUrl || null
    res.json({ url, path })
  } catch (err) {
    next(err)
  }
})

/** POST /api/settings/export — body: { scope, format } -> CSV or PDF stream */
router.post('/export', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const scope = req.body?.scope || 'projects'
    const format = req.body?.format || 'csv'
    if (!['projects', 'employees', 'financial'].includes(scope)) return res.status(400).json({ error: 'Invalid scope' })
    if (!['csv', 'pdf'].includes(format)) return res.status(400).json({ error: 'Invalid format' })

    if (scope === 'projects') {
      const { data: projects, error } = await db.from('projects').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
      if (error) throw error
      if (format === 'csv') {
        const csv = toCsv(projects || [], ['id', 'name', 'status', 'scope', 'address_line_1', 'city', 'state', 'postal_code', 'expected_start_date', 'expected_end_date', 'estimated_value', 'created_at', 'updated_at'])
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename="projects-export.csv"')
        return res.send(csv)
      }
      const pdf = await simplePdf('Projects', projects || [], ['name', 'status', 'scope', 'estimated_value', 'created_at'])
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="projects-export.pdf"')
      return res.send(pdf)
    }

    if (scope === 'employees') {
      const { data: employees, error } = await db.from('employees').select('*').eq('user_id', userId).order('name')
      if (error) throw error
      if (format === 'csv') {
        const csv = toCsv(employees || [], ['id', 'name', 'email', 'role', 'phone', 'status', 'current_compensation', 'created_at'])
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename="employees-export.csv"')
        return res.send(csv)
      }
      const pdf = await simplePdf('Employees', employees || [], ['name', 'email', 'role', 'status'])
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="employees-export.pdf"')
      return res.send(pdf)
    }

    if (scope === 'financial') {
      const [estRes, invRes, expRes] = await Promise.all([
        db.from('estimates').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        db.from('invoices').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        db.from('job_expenses').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ])
      if (estRes.error) throw estRes.error
      if (invRes.error) throw invRes.error
      if (expRes.error) throw expRes.error
      const rows = [
        ...(estRes.data || []).map((r) => ({ ...r, _type: 'estimate' })),
        ...(invRes.data || []).map((r) => ({ ...r, _type: 'invoice' })),
        ...(expRes.data || []).map((r) => ({ ...r, _type: 'expense' })),
      ]
      if (format === 'csv') {
        const csv = toCsv(rows, ['_type', 'id', 'total_amount', 'status', 'created_at'])
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename="financial-export.csv"')
        return res.send(csv)
      }
      const pdf = await simplePdf('Financial', rows, ['_type', 'id', 'total_amount', 'status', 'created_at'])
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="financial-export.pdf"')
      return res.send(pdf)
    }

    res.status(400).json({ error: 'Invalid scope' })
  } catch (err) {
    next(err)
  }
})

function toCsv(rows, keys) {
  const header = keys.join(',')
  const escape = (v) => {
    if (v == null) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [header, ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))]
  return lines.join('\n')
}

async function simplePdf(title, rows, keys) {
  const pdfDoc = await PDFDocument.create()
  const lines = [title, '', ...rows.map((r) => keys.map((k) => `${String(r[k] ?? '')}`).join(' | '))]
  const fontSize = 11
  const lineHeight = 14
  const margin = 50
  const maxY = 750
  let page = pdfDoc.addPage([612, 792])
  let y = maxY - margin
  for (const line of lines) {
    if (y < margin) {
      page = pdfDoc.addPage([612, 792])
      y = maxY - margin
    }
    page.drawText(line.substring(0, 90), { x: margin, y, size: fontSize })
    y -= lineHeight
  }
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/** POST /api/settings/wipe-data — body: { confirm: true } */
router.post('/wipe-data', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    if (req.body?.confirm !== true) return res.status(400).json({ error: 'Confirmation required. Send { confirm: true }.' })

    // Get project IDs for this user
    const { data: projects, error: projErr } = await db.from('projects').select('id').eq('user_id', userId)
    if (projErr) throw projErr
    const projectIds = (projects || []).map((p) => p.id)
    if (projectIds.length > 0) {
      const { data: estRows } = await db.from('estimates').select('id').in('job_id', projectIds)
      const estIds = (estRows || []).map((e) => e.id)
      if (estIds.length > 0) await db.from('estimate_line_items').delete().in('estimate_id', estIds)
      await db.from('estimates').delete().in('job_id', projectIds)
      await db.from('invoices').delete().in('job_id', projectIds)
      await db.from('job_expenses').delete().in('job_id', projectIds)
      await db.from('job_assignments').delete().in('job_id', projectIds)
      await db.from('time_entries').delete().in('job_id', projectIds)
      await db.from('job_geofences').delete().in('job_id', projectIds)
      await db.from('gps_clock_out_log').delete().in('job_id', projectIds)
      await db.from('phases').delete().in('project_id', projectIds)
      await db.from('milestones').delete().in('project_id', projectIds)
      await db.from('project_tasks').delete().in('project_id', projectIds)
      await db.from('budget_line_items').delete().in('project_id', projectIds)
      await db.from('subcontractors').delete().in('project_id', projectIds)
      await db.from('project_work_types').delete().in('project_id', projectIds)
      await db.from('project_build_plans').delete().in('project_id', projectIds)
      await db.from('projects').delete().eq('user_id', userId)
    }
    const { data: employees } = await db.from('employees').select('id').eq('user_id', userId)
    const empIds = (employees || []).map((e) => e.id)
    if (empIds.length > 0) {
      await db.from('employee_invites').delete().in('employee_id', empIds)
      await db.from('job_assignments').delete().in('employee_id', empIds)
      await db.from('time_entries').delete().in('employee_id', empIds)
      await db.from('attendance_records').delete().in('employee_id', empIds)
      await db.from('pay_raises').delete().in('employee_id', empIds)
      await db.from('gps_clock_out_log').delete().in('employee_id', empIds)
      await db.from('employees').delete().eq('user_id', userId)
    }
    await db.from('custom_products').delete().eq('user_id', userId)
    await db.from('integration_connections').delete().eq('user_id', userId)
    await db.from('company_settings').delete().eq('user_id', userId)
    await db.from('branding_settings').delete().eq('user_id', userId)
    await db.from('notification_preferences').delete().eq('user_id', userId)
    await db.from('geofence_defaults').delete().eq('user_id', userId)
    await db.from('tax_compliance_settings').delete().eq('user_id', userId)

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/** POST /api/settings/delete-account — body: { confirm: true }; deletes user data then auth user */
router.post('/delete-account', async (req, res, next) => {
  try {
    const db = getDb(req)
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    if (req.body?.confirm !== true) return res.status(400).json({ error: 'Confirmation required. Send { confirm: true }.' })

    // Wipe all user data first (reuse same order as wipe-data)
    const { data: projects } = await db.from('projects').select('id').eq('user_id', userId)
    const projectIds = (projects || []).map((p) => p.id)
    if (projectIds.length > 0) {
      const estIds = (await db.from('estimates').select('id').in('job_id', projectIds)).data?.map((e) => e.id) || []
      if (estIds.length > 0) await db.from('estimate_line_items').delete().in('estimate_id', estIds)
      await db.from('estimates').delete().in('job_id', projectIds)
      await db.from('invoices').delete().in('job_id', projectIds)
      await db.from('job_expenses').delete().in('job_id', projectIds)
      await db.from('job_assignments').delete().in('job_id', projectIds)
      await db.from('time_entries').delete().in('job_id', projectIds)
      await db.from('job_geofences').delete().in('job_id', projectIds)
      await db.from('gps_clock_out_log').delete().in('job_id', projectIds)
      await db.from('phases').delete().in('project_id', projectIds)
      await db.from('milestones').delete().in('project_id', projectIds)
      await db.from('project_tasks').delete().in('project_id', projectIds)
      await db.from('budget_line_items').delete().in('project_id', projectIds)
      await db.from('subcontractors').delete().in('project_id', projectIds)
      await db.from('project_work_types').delete().in('project_id', projectIds)
      await db.from('project_build_plans').delete().in('project_id', projectIds)
      await db.from('projects').delete().eq('user_id', userId)
    }
    const { data: employees } = await db.from('employees').select('id').eq('user_id', userId)
    const empIds = (employees || []).map((e) => e.id)
    if (empIds.length > 0) {
      await db.from('employee_invites').delete().in('employee_id', empIds)
      await db.from('job_assignments').delete().in('employee_id', empIds)
      await db.from('time_entries').delete().in('employee_id', empIds)
      await db.from('attendance_records').delete().in('employee_id', empIds)
      await db.from('pay_raises').delete().in('employee_id', empIds)
      await db.from('gps_clock_out_log').delete().in('employee_id', empIds)
      await db.from('employees').delete().eq('user_id', userId)
    }
    await db.from('custom_products').delete().eq('user_id', userId)
    await db.from('integration_connections').delete().eq('user_id', userId)
    await db.from('company_settings').delete().eq('user_id', userId)
    await db.from('branding_settings').delete().eq('user_id', userId)
    await db.from('notification_preferences').delete().eq('user_id', userId)
    await db.from('geofence_defaults').delete().eq('user_id', userId)
    await db.from('tax_compliance_settings').delete().eq('user_id', userId)
    await db.from('contractors').delete().eq('user_id', userId)
    await db.from('profiles').delete().eq('id', userId)
    await db.from('takeoffs').delete().eq('user_id', userId)

    const { error: authErr } = await db.auth.admin.deleteUser(userId)
    if (authErr) throw authErr

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
