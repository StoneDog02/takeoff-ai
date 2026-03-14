require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const takeoffRoutes = require('./routes/takeoff')
const buildListsRoutes = require('./routes/build-lists')
const projectsRoutes = require('./routes/projects')
const jobsRoutes = require('./routes/jobs')
const estimatesRoutes = require('./routes/estimates')
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
const { router: invitesRouter } = require('./routes/invites')
const { requireAdmin } = require('./middleware/admin')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: true }))

// Stripe webhook needs raw body for signature verification; must be before express.json()
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => stripeRoutes.handleWebhook(req, res)
)

app.use(express.json())

const { requireAuth } = require('./middleware/auth')

app.use('/api/me', requireAuth, meRoutes)
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes)
app.use('/api/invites', invitesRouter)
app.use('/api/takeoff', requireAuth, takeoffRoutes)
app.use('/api/build-lists', requireAuth, buildListsRoutes)
app.use('/api/projects', requireAuth, projectsRoutes)
app.use('/api/jobs', requireAuth, jobsRoutes)
app.use('/api/estimates', requireAuth, estimatesRoutes)
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
app.use('/api/gps-clock-out', requireAuth, gpsClockOutRoutes)
app.use('/api/payroll', requireAuth, payrollRoutes)
app.use('/api/schedule', requireAuth, scheduleRoutes)
app.use('/api/dashboard', requireAuth, dashboardRoutes)
app.use('/api/conversations', requireAuth, conversationsRoutes)
app.use('/api/contractors', requireAuth, contractorsRoutes)
app.use('/api/settings', requireAuth, settingsRoutes)
app.use('/api/quickbooks', quickbooksRoutes)
app.use('/api/stripe', stripeRoutes)

// Unmatched API routes -> JSON 404 (avoids HTML "Cannot POST ...")
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Server error' })
})

// Optional: serve client build in production
const clientDist = path.join(__dirname, '../client/dist')
app.use(express.static(clientDist))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next()
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
