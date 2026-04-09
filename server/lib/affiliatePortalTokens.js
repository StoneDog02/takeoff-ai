const crypto = require('crypto')

const SETUP_TOKEN_BYTES = 32
const SETUP_TOKEN_DAYS = 14

function publicAppOrigin() {
  const raw = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '')
  if (!raw) return ''
  return raw.startsWith('http') ? raw : `https://${raw}`
}

function generateSetupToken() {
  return crypto.randomBytes(SETUP_TOKEN_BYTES).toString('hex')
}

function setupExpiresAtIso() {
  const d = new Date()
  d.setDate(d.getDate() + SETUP_TOKEN_DAYS)
  return d.toISOString()
}

module.exports = { publicAppOrigin, generateSetupToken, setupExpiresAtIso }
