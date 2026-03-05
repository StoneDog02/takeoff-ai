import { useEffect, useState } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type { JobGeofence } from '@/types/global'

export function GeofenceConfig() {
  const [jobs, setJobs] = useState<{ id: string; name: string }[]>([])
  const [geofences, setGeofences] = useState<JobGeofence[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [form, setForm] = useState({
    center_lat: '',
    center_lng: '',
    radius_value: '',
    radius_unit: 'feet' as 'feet' | 'meters',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProjectsList().then((p) => p.map((x) => ({ id: x.id, name: x.name }))).then(setJobs).catch(() => setJobs([]))
    teamsApi.geofences.list().then(setGeofences).catch(() => setGeofences([]))
    setLoading(false)
  }, [])

  const current = selectedJobId ? geofences.find((g) => g.job_id === selectedJobId) : null
  useEffect(() => {
    if (current) {
      setForm({
        center_lat: String(current.center_lat),
        center_lng: String(current.center_lng),
        radius_value: String(current.radius_value),
        radius_unit: current.radius_unit,
      })
    } else if (selectedJobId) {
      setForm({ center_lat: '', center_lng: '', radius_value: '', radius_unit: 'feet' })
    }
  }, [selectedJobId, current?.id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedJobId || !form.center_lat || !form.center_lng || !form.radius_value) return
    setSaving(true)
    try {
      await teamsApi.geofences.save({
        job_id: selectedJobId,
        center_lat: Number(form.center_lat),
        center_lng: Number(form.center_lng),
        radius_value: Number(form.radius_value),
        radius_unit: form.radius_unit,
      })
      teamsApi.geofences.list().then(setGeofences)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="projects-card" style={{ marginBottom: 16 }}>
        <div className="projects-top">
          <span className="page-title">Geofence per job</span>
        </div>
        <form onSubmit={handleSave} style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
            <div>
              <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Job</label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="search-wrap"
                style={{ minWidth: 200 }}
              >
                <option value="">Select job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Center lat</label>
              <input
                type="number"
                step="any"
                value={form.center_lat}
                onChange={(e) => setForm((f) => ({ ...f, center_lat: e.target.value }))}
                className="search-wrap"
                placeholder="e.g. 37.7749"
              />
            </div>
            <div>
              <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Center lng</label>
              <input
                type="number"
                step="any"
                value={form.center_lng}
                onChange={(e) => setForm((f) => ({ ...f, center_lng: e.target.value }))}
                className="search-wrap"
                placeholder="e.g. -122.4194"
              />
            </div>
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
            <button type="submit" className="btn btn-primary" disabled={saving || !selectedJobId}>
              {saving ? 'Saving…' : current ? 'Update' : 'Save'} geofence
            </button>
          </div>
          {loading && <p className="timeline-val">Loading…</p>}
          {current && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Current: ({current.center_lat}, {current.center_lng}) radius {current.radius_value} {current.radius_unit}
            </p>
          )}
        </form>
      </div>
  )
}
