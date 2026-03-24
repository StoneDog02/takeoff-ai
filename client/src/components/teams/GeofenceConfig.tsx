import { useEffect, useState } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import { geofenceRadiusMeters } from '@/lib/geofenceUnits'
import type { JobGeofence } from '@/types/global'
import { AddressAutocompleteField } from './AddressAutocompleteField'
import { GeofenceMapPreview } from './GeofenceMapPreview'

type JobOption = { id: string; name: string; address: string }

/** Default ring on the map before the user enters a radius (preview only). */
const DEFAULT_PREVIEW_RADIUS_FT = 200

export type GeofenceConfigProps = {
  /** When set, configure geofence for this project only (project id = job_id in API). Hides job picker. */
  projectId?: string
  projectName?: string
  /** Single-line jobsite address for this project (used when no saved geofence yet). */
  projectAddress?: string
}

export function GeofenceConfig(props: GeofenceConfigProps = {}) {
  const { projectId, projectName, projectAddress } = props
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [geofences, setGeofences] = useState<JobGeofence[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>(projectId ?? '')
  const [form, setForm] = useState({
    address: '',
    center_lat: '',
    center_lng: '',
    radius_value: '',
    radius_unit: 'feet' as 'feet' | 'meters',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addressMessage, setAddressMessage] = useState<string | null>(null)
  /** When true, map allows dragging/clicking the pin; otherwise pan/zoom only until user chooses "Change pin location". */
  const [pinPlacementMode, setPinPlacementMode] = useState(false)

  useEffect(() => {
    if (projectId) {
      setJobs([
        {
          id: projectId,
          name: projectName?.trim() || 'Project',
          address: projectAddress?.trim() || '',
        },
      ])
      setSelectedJobId(projectId)
    } else {
      getProjectsList()
        .then((p) =>
          p.map((x) => ({
            id: x.id,
            name: x.name,
            address: [x.address_line_1, x.address_line_2, [x.city, x.state, x.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', '),
          }))
        )
        .then(setJobs)
        .catch(() => setJobs([]))
    }
    teamsApi.geofences.list().then(setGeofences).catch(() => setGeofences([]))
    setLoading(false)
  }, [projectId, projectName, projectAddress])

  const current = selectedJobId ? geofences.find((g) => g.job_id === selectedJobId) : null
  const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) : null

  useEffect(() => {
    if (current) {
      setForm({
        address: selectedJob?.address || '',
        center_lat: String(current.center_lat),
        center_lng: String(current.center_lng),
        radius_value: String(current.radius_value),
        radius_unit: current.radius_unit,
      })
    } else if (selectedJobId) {
      setForm({
        address: selectedJob?.address || '',
        center_lat: '',
        center_lng: '',
        radius_value: '',
        radius_unit: 'feet',
      })
    }
    setAddressMessage(null)
    setPinPlacementMode(false)
  }, [selectedJobId, current?.id, jobs])

  const hasCenter =
    Number.isFinite(parseFloat(form.center_lat)) && Number.isFinite(parseFloat(form.center_lng))

  const previewLat = parseFloat(form.center_lat)
  const previewLng = parseFloat(form.center_lng)
  const previewRadiusVal = parseFloat(form.radius_value)

  const hasValidRadius =
    Number.isFinite(previewRadiusVal) && previewRadiusVal > 0

  /** Map ring: real radius when set, otherwise a default preview ring */
  const mapRadiusMeters = hasValidRadius
    ? geofenceRadiusMeters(previewRadiusVal, form.radius_unit)
    : geofenceRadiusMeters(DEFAULT_PREVIEW_RADIUS_FT, 'feet')

  const showMapPreview = !!selectedJobId && hasCenter

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedJobId || !form.center_lat || !form.center_lng || !form.radius_value) return
    const rv = parseFloat(form.radius_value)
    if (!Number.isFinite(rv) || rv <= 0) return
    setSaving(true)
    try {
      await teamsApi.geofences.save({
        job_id: selectedJobId,
        center_lat: Number(form.center_lat),
        center_lng: Number(form.center_lng),
        radius_value: rv,
        radius_unit: form.radius_unit,
      })
      teamsApi.geofences.list().then(setGeofences)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    selectedJobId &&
    hasCenter &&
    hasValidRadius

  return (
    <div className="geofence-config-split" style={{ marginBottom: 16 }}>
      <div className="projects-card geofence-per-job-card">
        <div className="projects-top">
          <span className="page-title">{projectId ? 'Jobsite geofence' : 'Geofence per job'}</span>
        </div>
        <form onSubmit={handleSave} style={{ padding: 16 }}>
          {!projectId && (
            <div style={{ marginBottom: 16 }}>
              <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Job</label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="search-wrap"
                style={{ minWidth: 240, maxWidth: '100%' }}
              >
                <option value="">Select job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
            </div>
          )}
          {projectId && (
            <div style={{ marginBottom: 16 }}>
              <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Project</label>
              <div className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{projectName?.trim() || selectedJob?.name || 'Project'}</div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="sidebar-label" htmlFor="geofence-address-autocomplete" style={{ display: 'block', marginBottom: 4 }}>
              Jobsite address
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
              <AddressAutocompleteField
                value={form.address}
                onChange={(address) => setForm((f) => ({ ...f, address }))}
                onPick={(s) => {
                  setPinPlacementMode(false)
                  setForm((f) => ({
                    ...f,
                    address: s.label,
                    center_lat: String(s.lat),
                    center_lng: String(s.lng),
                  }))
                  setAddressMessage(
                    'Pin placed from search — use Change pin location on the map if you need to adjust, then set radius and save.'
                  )
                }}
                disabled={!selectedJobId}
                placeholder="Start typing — pick an address from the list"
              />
            </div>
          </div>

          {addressMessage && (
            <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              {addressMessage}
            </p>
          )}

          <details style={{ marginBottom: 16 }}>
            <summary className="text-sm" style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>
              Adjust latitude / longitude manually
            </summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginTop: 12 }}>
              <div>
                <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.center_lat}
                  onChange={(e) => {
                    setPinPlacementMode(false)
                    setForm((f) => ({ ...f, center_lat: e.target.value }))
                  }}
                  className="search-wrap"
                  placeholder="e.g. 37.7749"
                />
              </div>
              <div>
                <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.center_lng}
                  onChange={(e) => {
                    setPinPlacementMode(false)
                    setForm((f) => ({ ...f, center_lng: e.target.value }))
                  }}
                  className="search-wrap"
                  placeholder="e.g. -122.4194"
                />
              </div>
            </div>
          </details>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
            <div>
              <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Radius</label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.radius_value}
                onChange={(e) => setForm((f) => ({ ...f, radius_value: e.target.value }))}
                className="search-wrap"
                placeholder="e.g. 500"
              />
            </div>
            <div>
              <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Unit</label>
              <select
                value={form.radius_unit}
                onChange={(e) => setForm((f) => ({ ...f, radius_unit: e.target.value as 'feet' | 'meters' }))}
                className="search-wrap"
              >
                <option value="feet">Feet</option>
                <option value="meters">Meters</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving || !canSave}>
              {saving ? 'Saving…' : current ? 'Update' : 'Save'} geofence
            </button>
          </div>

          {loading && <p className="timeline-val">Loading…</p>}
          {!hasCenter && selectedJobId && !loading && (
            <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
              Pick an address from the <strong>suggestions list</strong> (or enter coordinates manually) to load the map.
            </p>
          )}
          {hasCenter && !hasValidRadius && selectedJobId && (
            <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
              Enter a <strong>radius</strong> to save the geofence.
            </p>
          )}
          {current && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Saved radius: {current.radius_value} {current.radius_unit}
            </p>
          )}
        </form>
      </div>

      <div className="projects-card geofence-config-map-card">
        <div className="projects-top">
          <span className="page-title">Jobsite map</span>
          {showMapPreview && (
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {!pinPlacementMode ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setPinPlacementMode(true)}
                >
                  Change pin location
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setPinPlacementMode(false)}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ padding: 16 }}>
          {showMapPreview ? (
            <>
              <GeofenceMapPreview
                centerLat={previewLat}
                centerLng={previewLng}
                radiusMeters={mapRadiusMeters}
                height={300}
                placementActive={pinPlacementMode}
                onCenterChange={(lat, lng) => {
                  setPinPlacementMode(false)
                  setForm((f) => ({
                    ...f,
                    center_lat: String(lat),
                    center_lng: String(lng),
                  }))
                }}
              />
              {!hasValidRadius && (
                <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
                  Preview ring is ~{DEFAULT_PREVIEW_RADIUS_FT} ft until you enter a radius on the left.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              {selectedJobId
                ? 'Pick an address from the suggestions list, or enter latitude and longitude manually, to load the map.'
                : 'Select a job first.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
