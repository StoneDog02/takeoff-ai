import { useEffect, useState } from 'react'
import { ClockInView } from './ClockInView'
import { GeofenceConfig } from './GeofenceConfig'
import { GpsClockOutLogList } from './GpsClockOutLogList'
import { teamsApi } from '@/api/teamsClient'
import type { Employee } from '@/types/global'

interface GeofenceTabProps {
  onSelectEmployee?: (emp: Employee) => void
}

export function GeofenceTab({ onSelectEmployee }: GeofenceTabProps) {
  const [gpsCount, setGpsCount] = useState(0)
  const [geofenceCount, setGeofenceCount] = useState(0)

  useEffect(() => {
    teamsApi.gpsClockOut.list().then((logs) => setGpsCount(logs.length)).catch(() => {})
    teamsApi.geofences.list().then((list) => setGeofenceCount(list.length)).catch(() => {})
  }, [])

  return (
    <div className="teams-tab-body">
      <div className="teams-metrics-row">
        <div className="teams-metric-card">
          <div className="teams-metric-label">GPS Clock-outs</div>
          <div className="teams-metric-value">{gpsCount}</div>
          <div className="teams-metric-sub">Last 30 days</div>
        </div>
        <div className="teams-metric-card accent-green">
          <div className="teams-metric-label">Geofences Active</div>
          <div className="teams-metric-value">{geofenceCount}</div>
          <div className="teams-metric-sub">Jobs configured</div>
        </div>
        <div className="teams-metric-card accent-blue">
          <div className="teams-metric-label">Compliance Rate</div>
          <div className="teams-metric-value">—</div>
          <div className="teams-metric-sub">Clocked out within boundary</div>
        </div>
      </div>

      <div className="teams-geo-layout">
        <section className="teams-geo-section">
          <h3 className="teams-section-heading">Clock in / out</h3>
          <ClockInView />
        </section>
        <section className="teams-geo-section">
          <h3 className="teams-section-heading">Geofence per job</h3>
          <GeofenceConfig />
        </section>
      </div>

      <section className="teams-geo-log-section">
        <div className="teams-card" style={{ overflow: 'hidden' }}>
          <div className="teams-detail-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span className="teams-roster-name">GPS-triggered clock-outs</span>
            <span className="teams-cell-muted" style={{ fontSize: 12 }}>Employees who left a geofenced job boundary while clocked in</span>
          </div>
          <GpsClockOutLogList onSelectEmployee={onSelectEmployee} />
        </div>
      </section>
    </div>
  )
}
