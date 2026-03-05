import { useState, useEffect, useRef } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type { Employee, JobGeofence, TimeEntry } from '@/types/global'
import { dayjs, formatDateTime } from '@/lib/date'

/** Haversine distance in meters between two lat/lng points */
function distanceMeters(
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

function feetToMeters(feet: number) {
  return feet * 0.3048
}

export function ClockInView() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [jobs, setJobs] = useState<{ id: string; name: string }[]>([])
  const [geofenceByJob, setGeofenceByJob] = useState<Record<string, JobGeofence>>({})
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    teamsApi.employees.list().then(setEmployees).catch(() => setEmployees([]))
    getProjectsList().then((p) => p.map((x) => ({ id: x.id, name: x.name }))).then(setJobs).catch(() => setJobs([]))
  }, [])

  useEffect(() => {
    if (!selectedJob) return
    teamsApi.geofences.getByJob(selectedJob).then((g) => {
      if (g) setGeofenceByJob((prev) => ({ ...prev, [selectedJob]: g }))
    }).catch(() => {})
  }, [selectedJob])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setLocationError(err.message),
      { enableHighAccuracy: true }
    )
  }, [])

  useEffect(() => {
    if (!selectedEmployee) return
    setLoading(true)
    teamsApi.timeEntries
      .list({ employee_id: selectedEmployee })
      .then((entries) => {
        const open = entries.find((e) => !e.clock_out)
        setActiveEntry(open ?? null)
      })
      .catch(() => setActiveEntry(null))
      .finally(() => setLoading(false))
  }, [selectedEmployee])

  useEffect(() => {
    if (!activeEntry || !selectedJob) return
    const geofence = geofenceByJob[selectedJob]
    if (!geofence) return
    const radiusM =
      geofence.radius_unit === 'meters'
        ? geofence.radius_value
        : feetToMeters(geofence.radius_value)
    const checkPosition = (lat: number, lng: number) => {
      const dist = distanceMeters(
        geofence.center_lat,
        geofence.center_lng,
        lat,
        lng
      )
      if (dist > radiusM) {
        setMessage('Exited jobsite boundary — clocking out.')
        teamsApi.gpsClockOut
          .create({
            employee_id: activeEntry.employee_id,
            time_entry_id: activeEntry.id,
            job_id: activeEntry.job_id,
            lat,
            lng,
          })
          .then(() => {
            setActiveEntry(null)
            setMessage(null)
          })
          .catch(() => setMessage('Failed to clock out.'))
      }
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => checkPosition(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000 }
    )
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [activeEntry?.id, selectedJob, geofenceByJob])

  const geofence = selectedJob ? geofenceByJob[selectedJob] : null
  const isInsideGeofence =
    location && geofence
      ? distanceMeters(
          geofence.center_lat,
          geofence.center_lng,
          location.lat,
          location.lng
        ) <=
        (geofence.radius_unit === 'meters'
          ? geofence.radius_value
          : feetToMeters(geofence.radius_value))
      : null

  const handleClockIn = async () => {
    if (!selectedEmployee || !selectedJob) return
    if (geofence && isInsideGeofence === false) {
      setMessage('You must be inside the jobsite boundary to clock in.')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const entry = await teamsApi.timeEntries.create({
        employee_id: selectedEmployee,
        job_id: selectedJob,
        clock_in: dayjs().toISOString(),
        source: 'manual',
      })
      setActiveEntry(entry)
      setMessage('Clocked in.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to clock in')
    } finally {
      setLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!activeEntry) return
    setLoading(true)
    setMessage(null)
    try {
      await teamsApi.timeEntries.clockOut(activeEntry.id)
      setActiveEntry(null)
      setMessage('Clocked out.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to clock out')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="projects-card" style={{ marginBottom: 16 }}>
        <div className="projects-top">
          <span className="page-title">Clock in / out</span>
        </div>
        <div style={{ padding: 16 }}>
          {locationError && (
            <p className="timeline-val" style={{ color: 'var(--red)', marginBottom: 12 }}>{locationError}</p>
          )}
          {location && (
            <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              Your location: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              {geofence && isInsideGeofence !== null && (
                <span style={{ marginLeft: 8 }}>
                  — {isInsideGeofence ? 'Inside' : 'Outside'} jobsite boundary
                </span>
              )}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
            <div>
              <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="search-wrap"
                style={{ minWidth: 180 }}
              >
                <option value="">Select</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="sidebar-label" style={{ display: 'block', marginBottom: 4 }}>Job</label>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="search-wrap"
                style={{ minWidth: 180 }}
              >
                <option value="">Select</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
            </div>
            {!activeEntry ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || !selectedEmployee || !selectedJob}
                onClick={handleClockIn}
              >
                {loading ? '…' : 'Clock in'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={loading}
                onClick={handleClockOut}
              >
                {loading ? '…' : 'Clock out'}
              </button>
            )}
          </div>
          {message && (
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{message}</p>
          )}
          {activeEntry && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Clocked in at {formatDateTime(activeEntry.clock_in)}. GPS auto clock-out is active when a geofence is set for this job.
            </p>
          )}
        </div>
      </div>
  )
}
