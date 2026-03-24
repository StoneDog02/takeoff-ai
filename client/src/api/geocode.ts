import { API_BASE } from '@/api/config'
import { getSessionAuthHeaders } from '@/api/authHeaders'
import { mergeHousePrefixOntoLabel } from '@/lib/addressSuggestionLabel'

export type GeocodeLookupResult = {
  lat: number
  lng: number
  /** True when OSM had no street match; coordinates are city/ZIP area center */
  fallback?: boolean
} | null

export type AddressSuggestion = {
  id: string
  label: string
  lat: number
  lng: number
}

/** Server proxies OSM Nominatim; sets center lat/lng from a free-text address. */
export async function lookupAddress(address: string): Promise<GeocodeLookupResult> {
  const q = address.trim()
  if (!q) return null

  const headers = await getSessionAuthHeaders()
  const res = await fetch(`${API_BASE}/geocode?q=${encodeURIComponent(q)}`, { headers })
  const data = (await res.json()) as {
    error?: string
    lat?: number | null
    lng?: number | null
    fallback?: boolean
  }

  if (!res.ok) {
    throw new Error(data.error || 'Failed to geocode address')
  }

  if (data.lat == null || data.lng == null) return null
  return {
    lat: data.lat,
    lng: data.lng,
    fallback: data.fallback === true,
  }
}

export type FetchAddressSuggestionsOpts = {
  limit?: number
  signal?: AbortSignal
  /** Browser or company anchor — Photon/Nominatim rank results near this point */
  biasLat?: number
  biasLng?: number
}

/** Type-ahead suggestions (Photon / Nominatim via server). Min ~3 characters on the client. */
export async function fetchAddressSuggestions(
  query: string,
  opts?: FetchAddressSuggestionsOpts
): Promise<AddressSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const limit = opts?.limit ?? 8
  const headers = await getSessionAuthHeaders()
  const params = new URLSearchParams()
  params.set('q', q)
  params.set('limit', String(limit))
  if (
    opts?.biasLat != null &&
    opts?.biasLng != null &&
    Number.isFinite(opts.biasLat) &&
    Number.isFinite(opts.biasLng)
  ) {
    params.set('bias_lat', String(opts.biasLat))
    params.set('bias_lng', String(opts.biasLng))
  }

  const res = await fetch(`${API_BASE}/geocode/autocomplete?${params.toString()}`, {
    headers,
    signal: opts?.signal,
  })
  let data: { suggestions?: AddressSuggestion[]; error?: string }
  try {
    data = (await res.json()) as { suggestions?: AddressSuggestion[]; error?: string }
  } catch {
    return []
  }

  if (!res.ok) return []
  if (!Array.isArray(data.suggestions)) return []
  const raw = data.suggestions.filter(
    (s) => s && typeof s.label === 'string' && Number.isFinite(s.lat) && Number.isFinite(s.lng)
  )
  return raw.map((s) => ({
    ...s,
    label: mergeHousePrefixOntoLabel(q, s.label),
  }))
}
