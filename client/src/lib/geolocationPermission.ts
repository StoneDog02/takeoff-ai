/**
 * Browser geolocation permission helpers. Note: if the user chose "Block",
 * the site cannot show the OS prompt again — they must reset the permission in browser settings.
 */

export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown'

export async function getGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unknown'
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return result.state as GeolocationPermissionState
  } catch {
    // Safari and some browsers omit or reject Permissions API for geolocation.
    return 'unknown'
  }
}

export type GeolocationRequestResult = 'granted' | 'denied' | 'error'

/** Invokes the OS / browser location prompt when still allowed (non-denied). */
export function requestGeolocationAccess(): Promise<GeolocationRequestResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (err: GeolocationPositionError) => {
        if (err.code === err.PERMISSION_DENIED) resolve('denied')
        else resolve('error')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 }
    )
  })
}
