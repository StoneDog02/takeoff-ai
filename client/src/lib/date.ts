/**
 * Central date/time handling with Day.js.
 * Display format: MM/DD/YYYY everywhere. Use this module for all parsing, formatting, and comparisons.
 */
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

/** Display format for dates (no time). */
export const DISPLAY_DATE_FORMAT = 'MM/DD/YYYY'

/** Display format for date + time. */
export const DISPLAY_DATETIME_FORMAT = 'MM/DD/YYYY, h:mm A'

/** Short date range (e.g. for phases). */
export const DISPLAY_DATE_RANGE_FORMAT = 'MM/DD/YYYY'

/** Short label for Gantt bars (e.g. "Jan 5", "03/11"). */
export const DISPLAY_SHORT_LABEL = 'MMM D'

/**
 * Format an ISO date string or Date for display (MM/DD/YYYY).
 */
export function formatDate(isoOrDate: string | Date | dayjs.Dayjs | number | null | undefined): string {
  if (isoOrDate == null) return '—'
  const d = dayjs(isoOrDate)
  return d.isValid() ? d.format(DISPLAY_DATE_FORMAT) : '—'
}

/**
 * Format an ISO datetime for display (MM/DD/YYYY, h:mm A).
 */
export function formatDateTime(isoOrDate: string | Date | dayjs.Dayjs | number | null | undefined): string {
  if (isoOrDate == null) return '—'
  const d = dayjs(isoOrDate)
  return d.isValid() ? d.format(DISPLAY_DATETIME_FORMAT) : '—'
}

/**
 * Format a date range for display (MM/DD/YYYY – MM/DD/YYYY).
 */
export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  const s = formatDate(start)
  const e = formatDate(end)
  if (s === '—' && e === '—') return '—'
  if (s === '—') return e
  if (e === '—') return s
  return `${s} – ${e}`
}

/**
 * Return today's date as YYYY-MM-DD for API/input and string comparisons.
 */
export function todayISO(): string {
  return dayjs().format('YYYY-MM-DD')
}

/**
 * Convert a value to YYYY-MM-DD for API requests and input[type="date"].
 */
export function toISODate(isoOrDate: string | Date | dayjs.Dayjs | null | undefined): string {
  if (isoOrDate == null) return ''
  const d = dayjs(isoOrDate)
  return d.isValid() ? d.format('YYYY-MM-DD') : ''
}

/**
 * Format for short labels (e.g. Gantt bar: "Jan 5").
 */
export function formatShortDate(isoOrDate: string | Date | dayjs.Dayjs | number | null | undefined): string {
  if (isoOrDate == null) return '—'
  const d = dayjs(isoOrDate)
  return d.isValid() ? d.format(DISPLAY_SHORT_LABEL) : '—'
}

/**
 * Parse a date string to timestamp for comparisons (min/max, etc.).
 */
export function parseToTimestamp(isoOrDate: string | Date | null | undefined): number {
  if (isoOrDate == null) return NaN
  return dayjs(isoOrDate).valueOf()
}

/**
 * Day.js instance for advanced use (e.g. startOf('month'), add(1, 'day')).
 */
export { dayjs }
