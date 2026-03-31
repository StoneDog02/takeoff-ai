import type { JobGeofence } from '@/types/global'
import { feetToMeters } from '@/lib/geofenceUnits'

/** Haversine distance in meters between two lat/lng points */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function geofenceRadiusMeters(geofence: JobGeofence): number {
  return geofence.radius_unit === 'meters' ? geofence.radius_value : feetToMeters(geofence.radius_value)
}

export function isOutsideJobGeofence(
  lat: number,
  lng: number,
  geofence: JobGeofence
): boolean {
  const radiusM = geofenceRadiusMeters(geofence)
  return distanceMeters(geofence.center_lat, geofence.center_lng, lat, lng) > radiusM
}

export const DEFAULT_CLOCK_OUT_TOLERANCE_MINUTES = 5

/**
 * Require staying outside the geofence for `toleranceMinutes` before calling `onTrigger`.
 * Resets the timer when position returns inside. `toleranceMinutes` 0 triggers on first outside fix.
 */
export function createOutsideBoundaryTracker(options: {
  toleranceMinutes: number
  onTrigger: (lat: number, lng: number) => void
  onFirstOutside?: () => void
  onBackInside?: () => void
}) {
  let firstOutsideMs: number | null = null
  /** True after threshold met; cleared by reset() so a failed clock-out can retry. */
  let fired = false
  const tolMs = Math.max(0, options.toleranceMinutes) * 60_000

  function reset() {
    firstOutsideMs = null
    fired = false
    options.onBackInside?.()
  }

  function onPosition(lat: number, lng: number, outside: boolean) {
    if (fired) return
    if (!outside) {
      if (firstOutsideMs != null) reset()
      return
    }
    const now = Date.now()
    if (firstOutsideMs == null) {
      firstOutsideMs = now
      options.onFirstOutside?.()
    }
    if (now - firstOutsideMs < tolMs) return
    fired = true
    options.onTrigger(lat, lng)
  }

  return { onPosition, reset }
}
