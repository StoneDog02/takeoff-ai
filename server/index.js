require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const takeoffRoutes = require('./routes/takeoff')
const buildListsRoutes = require('./routes/build-lists')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: true }))
app.use(express.json())

const { requireAuth } = require('./middleware/auth')

app.use('/api/takeoff', requireAuth, takeoffRoutes)
app.use('/api/build-lists', requireAuth, buildListsRoutes)

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
