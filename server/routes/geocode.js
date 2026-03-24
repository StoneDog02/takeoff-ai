/**
 * Forward geocoding via OpenStreetMap Nominatim (free, no API key).
 * Many real US addresses are missing house-level data in OSM; we fall back to city/state/ZIP.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
const express = require('express')

const router = express.Router()
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
const PHOTON_API = 'https://photon.komoot.io/api'

const FETCH_TIMEOUT_MS = 15000

function fetchWithTimeout(url, init = {}) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

/** Photon Point, or bbox center from properties.extent [minLon, maxLat, maxLon, minLat] */
function photonCoordsFromFeature(feature) {
  const g = feature.geometry
  if (g && g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    const lng = Number(g.coordinates[0])
    const lat = Number(g.coordinates[1])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }
  const ext = feature.properties?.extent
  if (Array.isArray(ext) && ext.length >= 4) {
    const [a, b, c, d] = ext
    const minLon = Math.min(a, c)
    const maxLon = Math.max(a, c)
    const minLat = Math.min(b, d)
    const maxLat = Math.max(b, d)
    const lng = (minLon + maxLon) / 2
    const lat = (minLat + maxLat) / 2
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }
  return null
}

/** ~radiusKm box around a point — for Nominatim viewbox (soft regional bias) */
function boundingBoxFromCenter(lat, lng, radiusKm = 150) {
  const dLat = radiusKm / 111
  const cos = Math.cos((lat * Math.PI) / 180)
  const dLng = cos > 0.05 ? radiusKm / (111 * cos) : radiusKm / 111
  return {
    minLon: lng - dLng,
    maxLat: lat + dLat,
    maxLon: lng + dLng,
    minLat: lat - dLat,
  }
}

/** Photon (OSM) → single-line label + coordinates [lng,lat] → lat,lng */
function photonFeatureToSuggestion(feature, index) {
  const p = feature.properties || {}
  const coords = photonCoordsFromFeature(feature)
  if (!coords) return null
  const { lat, lng } = coords

  let line1 = ''
  if (p.housenumber && p.street) line1 = `${p.housenumber} ${p.street}`.trim()
  else if (p.name && p.street) line1 = `${p.name}, ${p.street}`.trim()
  else if (p.street) line1 = String(p.street).trim()
  else if (p.name) line1 = String(p.name).trim()

  const place = [p.city || p.town || p.locality || p.district, p.state, p.postcode]
    .filter(Boolean)
    .join(', ')

  const label = [line1, place].filter(Boolean).join(', ') || line1 || place || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  const id = [p.osm_type, p.osm_id, index].join(':')

  return { id, label, lat, lng }
}

/** Nominatim search row → same shape as Photon suggestions */
function nominatimItemToSuggestion(item, index) {
  if (!item || item.lat == null || item.lon == null) return null
  const lat = Number(item.lat)
  const lng = Number(item.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const label = String(item.display_name || '').trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  const id = `nominatim:${item.osm_id ?? item.place_id ?? index}`
  return { id, label, lat, lng }
}

async function nominatimAutocompleteSuggestions(q, limit, userAgent, bias) {
  const params = new Map([
    ['format', 'json'],
    ['limit', String(limit)],
    ['q', q],
    /** US jobsites — without this, "Nibley" can resolve to the UK */
    ['countrycodes', 'us'],
  ])
  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    const b = boundingBoxFromCenter(bias.lat, bias.lng, 180)
    /** min lon, max lat, max lon, min lat — biases ranking toward this map extent */
    params.set('viewbox', `${b.minLon},${b.maxLat},${b.maxLon},${b.minLat}`)
  }
  const { ok, data } = await nominatimFetch(params, userAgent)
  if (!ok || !Array.isArray(data)) return []
  return data.map((row, i) => nominatimItemToSuggestion(row, i)).filter(Boolean)
}

function looksLikeUsAddress(q) {
  return /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(q)
}

/** e.g. "3106 S 350 W, Nibley, UT 84321" → "Nibley, UT 84321" */
function usCityStateZipTail(q) {
  const m = String(q)
    .trim()
    .match(/,\s*([^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)\s*$/i)
  return m ? m[1].trim() : null
}

async function nominatimFetch(searchParams, userAgent) {
  const url = new URL(NOMINATIM_SEARCH)
  searchParams.forEach((v, k) => url.searchParams.set(k, v))
  const r = await fetchWithTimeout(url.toString(), {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  })
  if (!r.ok) return { ok: false, data: null }
  const data = await r.json()
  return { ok: true, data: Array.isArray(data) ? data : [] }
}

router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q) return res.status(400).json({ error: 'Missing q' })

    const userAgent =
      process.env.GEOCODING_USER_AGENT ||
      'TakeoffAI/1.0 (set GEOCODING_USER_AGENT in .env for production)'

    const baseParams = new Map([
      ['format', 'json'],
      ['limit', '1'],
    ])
    if (looksLikeUsAddress(q)) baseParams.set('countrycodes', 'us')

    const tryQuery = async (query, fallback) => {
      const params = new Map(baseParams)
      params.set('q', query)
      const { ok, data } = await nominatimFetch(params, userAgent)
      if (!ok || !data[0] || data[0].lat == null || data[0].lon == null) return null
      const lat = Number(data[0].lat)
      const lng = Number(data[0].lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        lat,
        lng,
        display_name: data[0].display_name || null,
        fallback,
      }
    }

    let result = await tryQuery(q, false)

    if (!result) {
      const tail = usCityStateZipTail(q)
      if (tail && tail.toLowerCase() !== q.toLowerCase()) {
        const tailMap = new Map([
          ['format', 'json'],
          ['limit', '1'],
          ['q', tail],
          ['countrycodes', 'us'],
        ])
        const { ok, data } = await nominatimFetch(tailMap, userAgent)
        if (ok && data[0] && data[0].lat != null && data[0].lon != null) {
          const lat = Number(data[0].lat)
          const lng = Number(data[0].lon)
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            result = {
              lat,
              lng,
              display_name: data[0].display_name || null,
              fallback: true,
            }
          }
        }
      }
    }

    if (!result) {
      return res.json({ lat: null, lng: null, display_name: null, fallback: false })
    }

    res.json({
      lat: result.lat,
      lng: result.lng,
      display_name: result.display_name,
      provider: 'nominatim',
      fallback: result.fallback,
    })
  } catch (err) {
    console.error('geocode', err)
    res.status(502).json({ error: err?.message || 'Failed to geocode address' })
  }
})

/**
 * Address autocomplete (debounced on client). Proxies Photon — OSM-based, no API key.
 * @see https://photon.komoot.io/
 */
router.get('/autocomplete', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 3) return res.json({ suggestions: [] })

    let limit = parseInt(String(req.query.limit || '8'), 10)
    if (!Number.isFinite(limit) || limit < 1) limit = 8
    if (limit > 15) limit = 15

    const userAgent =
      process.env.GEOCODING_USER_AGENT ||
      'TakeoffAI/1.0 (set GEOCODING_USER_AGENT in .env for production)'

    const bl = parseFloat(String(req.query.bias_lat ?? ''))
    const bLng = parseFloat(String(req.query.bias_lng ?? ''))
    const bias =
      Number.isFinite(bl) &&
      Number.isFinite(bLng) &&
      Math.abs(bl) <= 90 &&
      Math.abs(bLng) <= 180
        ? { lat: bl, lng: bLng }
        : null

    let suggestions = []
    let provider = 'none'

    try {
      const url = new URL(PHOTON_API)
      url.searchParams.set('q', q)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('lang', 'en')
      if (bias) {
        url.searchParams.set('lat', String(bias.lat))
        url.searchParams.set('lon', String(bias.lng))
      }

      const r = await fetchWithTimeout(url.toString(), {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
      })

      if (r.ok) {
        const json = await r.json()
        const features = Array.isArray(json.features) ? json.features : []
        suggestions = features.map((f, i) => photonFeatureToSuggestion(f, i)).filter(Boolean)
        if (suggestions.length) provider = 'photon'
      }
    } catch (err) {
      console.warn('geocode autocomplete photon', err?.message || err)
    }

    if (suggestions.length === 0) {
      try {
        suggestions = await nominatimAutocompleteSuggestions(q, limit, userAgent, bias)
        if (suggestions.length) provider = 'nominatim'
      } catch (err) {
        console.warn('geocode autocomplete nominatim', err?.message || err)
      }
    }

    res.json({ suggestions, provider, bias: bias ? { lat: bias.lat, lng: bias.lng } : null })
  } catch (err) {
    console.error('geocode autocomplete', err)
    res.json({ suggestions: [], provider: 'error' })
  }
})

module.exports = router
