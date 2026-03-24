/**
 * OSM geocoders often return street/city without housenumber. If the user typed
 * a leading number (and optional N/S/E/W), prepend it to the suggestion label when missing.
 */
export function mergeHousePrefixOntoLabel(query: string, label: string): string {
  const q = query.trim()
  const lt = label.trim()
  if (q.length < 4 || !lt) return lt

  const m = q.match(/^(\d+[A-Za-z]?(?:\s*-\s*\d+)?)\s+([NSEW]{1,2}\s+)?/i)
  if (!m) return lt

  const house = m[1]
  const predir = (m[2] || '').trim()
  const prefix = predir ? `${house} ${predir}`.replace(/\s+/g, ' ').trim() : house

  const low = lt.toLowerCase()
  const pLow = prefix.toLowerCase()
  if (low.startsWith(pLow + ' ') || low.startsWith(pLow + ',')) return lt
  if (low.startsWith(house.toLowerCase() + ' ') || low.startsWith(house.toLowerCase() + ',')) return lt

  return `${prefix} ${lt}`.replace(/\s+/g, ' ').trim()
}
