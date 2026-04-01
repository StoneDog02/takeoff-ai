import { useCallback, useEffect, useState } from 'react'
import {
  getGeolocationPermissionState,
  requestGeolocationAccess,
  type GeolocationPermissionState,
} from '@/lib/geolocationPermission'

type BannerStatus = 'hidden' | 'blocked' | 'retry'

/**
 * On each employee-portal visit, nudges the browser to grant geolocation when possible.
 * Shows a banner if permission is denied (user must fix in site settings) or if the
 * first request failed (timeout / unavailable — user can retry, often after a tap).
 */
export function GeolocationPermissionBanner() {
  const [status, setStatus] = useState<BannerStatus>('hidden')

  const runPermissionFlow = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('blocked')
      return
    }

    let perm: GeolocationPermissionState = await getGeolocationPermissionState()

    if (perm === 'denied') {
      setStatus('blocked')
      return
    }

    if (perm === 'granted') {
      setStatus('hidden')
      return
    }

    const result = await requestGeolocationAccess()
    if (result === 'granted') {
      setStatus('hidden')
      return
    }
    if (result === 'denied') {
      setStatus('blocked')
      return
    }

    perm = await getGeolocationPermissionState()
    if (perm === 'denied') setStatus('blocked')
    else setStatus('retry')
  }, [])

  useEffect(() => {
    void runPermissionFlow()
  }, [runPermissionFlow])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return

    const permRef: { current: PermissionStatus | null } = { current: null }
    const onChange = () => {
      if (permRef.current?.state === 'granted') setStatus('hidden')
      if (permRef.current?.state === 'denied') setStatus('blocked')
    }
    let cancelled = false

    void navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (cancelled) return
        permRef.current = p
        p.addEventListener('change', onChange)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      permRef.current?.removeEventListener('change', onChange)
    }
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void (async () => {
        const p = await getGeolocationPermissionState()
        if (p === 'granted') setStatus('hidden')
        if (p === 'denied') setStatus('blocked')
      })()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const handleRetry = () => {
    void (async () => {
      const result = await requestGeolocationAccess()
      if (result === 'granted') setStatus('hidden')
      else if (result === 'denied') setStatus('blocked')
      else setStatus('retry')
    })()
  }

  if (status === 'hidden') return null

  return (
    <div
      className={`geolocation-banner ${status === 'blocked' ? 'geolocation-banner--blocked' : ''}`}
      role="status"
      aria-live="polite"
    >
      <svg
        className="geolocation-banner-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span className="geolocation-banner-text">
        {status === 'blocked' ? (
          <>
            Location access is off or blocked for this site. Turn on location and allow Proj-X in your browser
            settings so geofence clock-in and auto clock-out work.
          </>
        ) : (
          <>
            We couldn&apos;t read your location (signal timeout or sensors off). Allow location when prompted, or
            try again — needed for job geofence and automatic clock-out when you leave the site.
          </>
        )}
      </span>
      {status === 'retry' ? (
        <div className="geolocation-banner-actions">
          <button type="button" className="geolocation-banner-btn" onClick={handleRetry}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  )
}
