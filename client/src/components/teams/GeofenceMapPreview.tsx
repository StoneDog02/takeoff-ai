import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './GeofenceMapPreview.css'

type GeofenceMapPreviewProps = {
  centerLat: number
  centerLng: number
  /** Geofence radius in meters (preview may use a default until the user sets radius in the form) */
  radiusMeters: number
  height?: number
  /** When set, map can update the jobsite center (subject to `placementActive`). */
  onCenterChange?: (lat: number, lng: number) => void
  /**
   * When true, the user may drag the pin or click the map to move it.
   * When false, the map is for pan/zoom only until they use "Change pin location" (controlled by parent).
   */
  placementActive?: boolean
}

/**
 * OpenStreetMap tiles + circular geofence (radius in meters).
 */
export function GeofenceMapPreview({
  centerLat,
  centerLng,
  radiusMeters,
  height = 360,
  onCenterChange,
  placementActive = false,
}: GeofenceMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onCenterChangeRef = useRef(onCenterChange)
  const placementActiveRef = useRef(placementActive)

  onCenterChangeRef.current = onCenterChange
  placementActiveRef.current = placementActive

  const validCenter =
    Number.isFinite(centerLat) && Number.isFinite(centerLng) && Number.isFinite(radiusMeters) && radiusMeters > 0

  const canEditPin = typeof onCenterChange === 'function'

  useEffect(() => {
    if (!containerRef.current || !validCenter) return

    const centerIcon = L.divIcon({
      className: 'geofence-map__pin',
      html: '<div class="geofence-map__pin-dot"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([centerLat, centerLng], 17)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)

      const circle = L.circle([centerLat, centerLng], {
        radius: radiusMeters,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.22,
        weight: 2,
      }).addTo(map)

      const marker = L.marker([centerLat, centerLng], {
        draggable: canEditPin,
        icon: centerIcon,
        zIndexOffset: 1000,
      }).addTo(map)

      if (canEditPin && marker.dragging) {
        marker.dragging[placementActiveRef.current ? 'enable' : 'disable']()
      }

      const emitCenter = (lat: number, lng: number) => {
        onCenterChangeRef.current?.(lat, lng)
      }

      marker.on('dragend', () => {
        if (!placementActiveRef.current || !onCenterChangeRef.current) return
        const ll = marker.getLatLng()
        emitCenter(ll.lat, ll.lng)
      })

      map.on('click', (e: L.LeafletMouseEvent) => {
        if (!placementActiveRef.current || !onCenterChangeRef.current) return
        const ll = e.latlng
        marker.setLatLng(ll)
        circle.setLatLng(ll)
        emitCenter(ll.lat, ll.lng)
      })

      mapRef.current = map
      circleRef.current = circle
      markerRef.current = marker

      map.fitBounds(circle.getBounds(), { padding: [28, 28], maxZoom: 18 })
    } else {
      const circle = circleRef.current
      const marker = markerRef.current
      if (circle && marker) {
        circle.setLatLng([centerLat, centerLng])
        circle.setRadius(radiusMeters)
        marker.setLatLng([centerLat, centerLng])
      }
    }
  }, [centerLat, centerLng, radiusMeters, validCenter, canEditPin])

  useEffect(() => {
    const marker = markerRef.current
    if (!marker?.dragging || !canEditPin) return
    marker.dragging[placementActive ? 'enable' : 'disable']()
  }, [placementActive, canEditPin])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        circleRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  if (!validCenter) return null

  return (
    <div
      className={`geofence-map-wrap${placementActive && canEditPin ? ' geofence-map-wrap--placement' : ''}`}
      style={{ marginTop: 0 }}
    >
      <div
        ref={containerRef}
        style={{
          height,
          width: '100%',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--border-subtle, #e5e7eb)',
        }}
      />
      <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
        Map data © OpenStreetMap contributors. Shaded circle shows the geofence for the radius you set.
        {canEditPin
          ? placementActive
            ? ' Click the map or drag the pin to move it — then use Save when ready.'
            : ' Pan and zoom the map as usual. Use Change pin location to move the pin.'
          : null}
      </p>
    </div>
  )
}
