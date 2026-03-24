/**
 * Weekly schedule shape: mon..sun, each { enabled, start, end } as HH:mm (24h) in `timezone`.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function dayKeyFromYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return DAY_KEYS[dt.getUTCDay()]
}

function parseHm(hm) {
  if (!hm || typeof hm !== 'string') return null
  const m = hm.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/** Minutes since midnight for an ISO timestamp in IANA timezone. */
function wallMinutesInZone(iso, timeZone) {
  try {
    const d = new Date(iso)
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(d)
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
    return hour * 60 + minute
  } catch {
    return null
  }
}

/**
 * Expected shift for a calendar work date (YYYY-MM-DD from clock_in).
 * @returns {{ start: string, end: string } | null}
 */
function getExpectedShiftForDate(weeklySchedule, workDateYmd, timeZone) {
  if (!weeklySchedule || typeof weeklySchedule !== 'object') return null
  const key = dayKeyFromYmd(workDateYmd)
  if (!key) return null
  const day = weeklySchedule[key]
  if (!day || !day.enabled) return null
  const start = typeof day.start === 'string' ? day.start : null
  const end = typeof day.end === 'string' ? day.end : null
  if (!start || !end) return null
  return { start, end }
}

/**
 * Late arrival (minutes after expected start) and early departure (minutes before expected end).
 * Null if no schedule or day off.
 */
function computeAttendanceVariance(clockInIso, clockOutIso, weeklySchedule, workDateYmd, timeZone) {
  const shift = getExpectedShiftForDate(weeklySchedule, workDateYmd, timeZone)
  if (!shift || !timeZone) {
    return { late_arrival_minutes: null, early_departure_minutes: null }
  }
  const expStart = parseHm(shift.start)
  const expEnd = parseHm(shift.end)
  if (expStart == null || expEnd == null) {
    return { late_arrival_minutes: null, early_departure_minutes: null }
  }
  const inM = wallMinutesInZone(clockInIso, timeZone)
  const outM = clockOutIso ? wallMinutesInZone(clockOutIso, timeZone) : null
  if (inM == null) return { late_arrival_minutes: null, early_departure_minutes: null }

  let late = Math.max(0, inM - expStart)
  if (late === 0) late = null

  let early = null
  if (outM != null && expEnd != null) {
    const e = Math.max(0, expEnd - outM)
    early = e === 0 ? null : e
  }

  return { late_arrival_minutes: late, early_departure_minutes: early }
}

function normalizeWeeklySchedule(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const k of DAY_KEYS) {
    const d = raw[k]
    if (!d || typeof d !== 'object') continue
    const enabled = !!d.enabled
    const start = typeof d.start === 'string' ? d.start.trim() : ''
    const end = typeof d.end === 'string' ? d.end.trim() : ''
    if (!enabled) {
      out[k] = { enabled: false, start: '', end: '' }
      continue
    }
    if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) continue
    out[k] = { enabled: true, start, end }
  }
  return out
}

module.exports = {
  DAY_KEYS,
  dayKeyFromYmd,
  getExpectedShiftForDate,
  computeAttendanceVariance,
  normalizeWeeklySchedule,
}
