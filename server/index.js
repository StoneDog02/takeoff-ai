require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const takeoffRoutes = require('./routes/takeoff')
const buildListsRoutes = require('./routes/build-lists')
const projectsRoutes = require('./routes/projects')
const jobsRoutes = require('./routes/jobs')
const estimatesRoutes = require('./routes/estimates')
const estimatePortalRoutes = require('./routes/estimatePortal')
const invoicePortalRoutes = require('./routes/invoicePortal')
const invoicesRoutes = require('./routes/invoices')
const customProductsRoutes = require('./routes/custom-products')
const jobExpensesRoutes = require('./routes/job-expenses')
const receiptsRoutes = require('./routes/receipts')
const employeesRoutes = require('./routes/employees')
const jobAssignmentsRoutes = require('./routes/job-assignments')
const timeEntriesRoutes = require('./routes/time-entries')
const attendanceRoutes = require('./routes/attendance')
const payRaisesRoutes = require('./routes/pay-raises')
const geofencesRoutes = require('./routes/geofences')
const geocodeRoutes = require('./routes/geocode')
const gpsClockOutRoutes = require('./routes/gps-clock-out')
const payrollRoutes = require('./routes/payroll')
const scheduleRoutes = require('./routes/schedule')
const dashboardRoutes = require('./routes/dashboard')
const conversationsRoutes = require('./routes/conversations')
const contractorsRoutes = require('./routes/contractors')
const meRoutes = require('./routes/me')
const adminRoutes = require('./routes/admin')
const settingsRoutes = require('./routes/settings')
const quickbooksRoutes = require('./routes/quickbooks')
const stripeRoutes = require('./routes/stripe')
const { router: referralsRouter, trackReferralEmailOpen } = require('./routes/referrals')
const authRoutes = require('./routes/auth')
const bidsRoutes = require('./routes/bids')
const documentsRoutes = require('./routes/documents')
const supportRoutes = require('./routes/support')
const { backfillPaperTrailDocuments } = require('./lib/paperTrailDocuments')
const { supabase: defaultSupabase } = require('./db/supabase')
const { router: invitesRouter } = require('./routes/invites')
const { requireAdmin } = require('./middleware/admin')

const app = express()
const PORT = process.env.PORT || 3001

// If running behind a proxy/load balancer (Render/Vercel/etc.), enable this so req.ip reflects the real client.
// Keep it on in production; can be overridden in local dev with TRUST_PROXY=0.
const trustProxyEnv = (process.env.TRUST_PROXY || '').trim()
const trustProxy =
  trustProxyEnv === '0' || trustProxyEnv.toLowerCase() === 'false'
    ? false
    : trustProxyEnv
      ? 1
      : process.env.NODE_ENV === 'production'
app.set('trust proxy', trustProxy)

app.use(cors({ origin: true }))

// Stripe webhook needs raw body for signature verification; must be before express.json()
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => stripeRoutes.handleWebhook(req, res)
)

app.use(express.json())

const clientDist = path.join(__dirname, '../client/dist')

/**
 * Subcontractor bid portal links go to /bid/:token.
 * If the API is on a different host than the SPA (e.g. Render API + Vercel client),
 * set PUBLIC_APP_URL to the SPA origin — we redirect here so old emails still work.
 */
app.get('/bid/:token', (req, res) => {
  const token = encodeURIComponent(req.params.token)
  const raw = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '')
  const reqHost = (req.get('host') || '').toLowerCase()

  if (raw) {
    try {
      const base = raw.startsWith('http') ? raw : `https://${raw}`
      const appHost = new URL(base).host.toLowerCase()
      if (!reqHost || appHost !== reqHost) {
        return res.redirect(302, `${base}/bid/${token}`)
      }
    } catch (e) {
      console.warn('[bid portal] PUBLIC_APP_URL / APP_URL invalid:', e.message)
    }
  }

  const indexHtml = path.join(clientDist, 'index.html')
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml)
  }

  res
    .status(503)
    .type('html')
    .send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bid portal</title></head><body style="font-family:system-ui,sans-serif;padding:2rem;max-width:28rem;line-height:1.5">
<h1 style="font-size:1.25rem">Bid link can’t load here</h1>
<p>This address is the API server. Set <strong>PUBLIC_APP_URL</strong> in your server environment to your <strong>web app URL</strong> (same site where you use Takeoff). New invite emails will use that link; existing links will redirect once <code>PUBLIC_APP_URL</code> is set.</p>
<p>Example: <code>PUBLIC_APP_URL=https://your-app.vercel.app</code></p>
</body></html>`)
})

/**
 * Client invoice portal links go to /invoice/:token.
 * Same pattern as /bid/:token — redirect to SPA when API host ≠ app host.
 */
app.get('/invoice/:token', (req, res) => {
  const token = encodeURIComponent(req.params.token)
  const raw = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '')
  const reqHost = (req.get('host') || '').toLowerCase()

  if (raw) {
    try {
      const base = raw.startsWith('http') ? raw : `https://${raw}`
      const appHost = new URL(base).host.toLowerCase()
      if (!reqHost || appHost !== reqHost) {
        return res.redirect(302, `${base}/invoice/${token}`)
      }
    } catch (e) {
      console.warn('[invoice portal] PUBLIC_APP_URL / APP_URL invalid:', e.message)
    }
  }

  const indexHtml = path.join(clientDist, 'index.html')
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml)
  }

  res
    .status(503)
    .type('html')
    .send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice</title></head><body style="font-family:system-ui,sans-serif;padding:2rem;max-width:28rem;line-height:1.5">
<h1 style="font-size:1.25rem">Invoice link can’t load here</h1>
<p>Set <strong>PUBLIC_APP_URL</strong> to your web app URL, or deploy the client next to the API.</p>
</body></html>`)
})

const { requireAuth } = require('./middleware/auth')
const { handleCloseStaleTimeEntries } = require('./routes/cron-stale-time-entries')

/** Scheduled (e.g. cron-job.org): closes open time entries older than STALE_TIME_ENTRY_MAX_HOURS. Requires CRON_SECRET. */
app.get('/api/cron/close-stale-time-entries', handleCloseStaleTimeEntries)
app.post('/api/cron/close-stale-time-entries', handleCloseStaleTimeEntries)

app.use('/api/me', requireAuth, meRoutes)
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/bids', bidsRoutes)
app.use('/api/invites', invitesRouter)
app.use('/api/takeoff', requireAuth, takeoffRoutes)
app.use('/api/build-lists', requireAuth, buildListsRoutes)
app.use('/api/projects', requireAuth, projectsRoutes)
/** Paper-trail backfill — registered on the app so POST /api/documents/backfill always matches (avoids proxy/path quirks). */
app.post('/api/documents/backfill', requireAuth, async (req, res) => {
  const supabase = req.supabase || defaultSupabase
  if (!supabase || !req.user) return res.status(401).json({ error: 'Unauthorized' })
  const demo = req.body?.demo === true || req.query?.demo === '1' || req.query?.demo === 'true'
  try {
    const result = await backfillPaperTrailDocuments(supabase, req.user.id, { demo })
    res.set('Cache-Control', 'no-store')
    res.json(result)
  } catch (err) {
    console.error('[documents] backfill', err)
    res.status(500).json({ error: err.message || 'Backfill failed' })
  }
})
app.use('/api/documents', requireAuth, documentsRoutes)
app.use('/api/jobs', requireAuth, jobsRoutes)
app.use('/api/estimates/portal', estimatePortalRoutes)
app.use('/api/estimates', requireAuth, estimatesRoutes)
app.use('/api/invoices/portal', invoicePortalRoutes)
app.use('/api/invoices', requireAuth, invoicesRoutes)
app.use('/api/custom-products', requireAuth, customProductsRoutes)
app.use('/api/job-expenses', requireAuth, jobExpensesRoutes)
app.use('/api/receipts', requireAuth, receiptsRoutes)
app.use('/api/employees', requireAuth, employeesRoutes)
app.use('/api/job-assignments', requireAuth, jobAssignmentsRoutes)
app.use('/api/time-entries', requireAuth, timeEntriesRoutes)
app.use('/api/attendance', requireAuth, attendanceRoutes)
app.use('/api/pay-raises', requireAuth, payRaisesRoutes)
app.use('/api/geofences', requireAuth, geofencesRoutes)
app.use('/api/geocode', requireAuth, geocodeRoutes)
app.use('/api/gps-clock-out', requireAuth, gpsClockOutRoutes)
app.use('/api/payroll', requireAuth, payrollRoutes)
app.use('/api/schedule', requireAuth, scheduleRoutes)
app.use('/api/dashboard', requireAuth, dashboardRoutes)
app.use('/api/conversations', requireAuth, conversationsRoutes)
app.use('/api/contractors', requireAuth, contractorsRoutes)
app.use('/api/support', requireAuth, supportRoutes)
app.use('/api/settings', requireAuth, settingsRoutes)
app.use('/api/quickbooks', quickbooksRoutes)
app.use('/api/stripe', stripeRoutes)
/** Public: referral invite email open pixel (must be before auth-mounted /api/referrals). */
app.get('/api/referrals/track-email-open', trackReferralEmailOpen)
app.use('/api/referrals', requireAuth, referralsRouter)

// Unmatched API routes -> JSON 404 (avoids HTML "Cannot POST ...")
app.use('/api', (req, res) => {
  const p = req.originalUrl?.split('?')[0] || req.path
  res.status(404).json({ error: `Route not found: ${req.method} ${p}` })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Server error' })
})

// Optional: serve client build in production (same host as API)
app.use(express.static(clientDist))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  const indexHtml = path.join(clientDist, 'index.html')
  if (!fs.existsSync(indexHtml)) {
    return res.status(404).type('text').send(`Not found. Set PUBLIC_APP_URL for bid links, or deploy the client build next to the API.`)
  }
  res.sendFile(indexHtml, (err) => {
    if (err) {
      console.error('[spa]', err.message)
      res.status(500).type('text').send('Could not load app')
    }
  })
})

const { warmKnowledgeCache } = require('./claude/knowledge-cache')

async function start() {
  await warmKnowledgeCache()
  if (projectsRoutes.ensureBuildPlansBucket) {
    projectsRoutes.ensureBuildPlansBucket().catch((err) => console.warn('Ensure build plans bucket:', err?.message))
  }
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`)
  })
}

start().catch((err) => {
  console.error('Server failed to start:', err)
  process.exit(1)
})
