import { GeofenceConfig } from './GeofenceConfig'
import { GpsClockOutLogList } from './GpsClockOutLogList'
import type { Employee } from '@/types/global'

interface GeofenceTabProps {
  onSelectEmployee?: (emp: Employee) => void
  /** Current project (same as `job_id` on time entries / GPS log). */
  projectId: string
  projectName?: string
  projectAddress?: string
}

export function GeofenceTab({ onSelectEmployee, projectId, projectName, projectAddress }: GeofenceTabProps) {
  return (
    <div className="teams-tab-body">
      <section className="teams-geo-section teams-geo-section--full">
        <h3 className="teams-section-heading">Jobsite boundary</h3>
        <GeofenceConfig
          projectId={projectId}
          projectName={projectName}
          projectAddress={projectAddress}
        />
      </section>

      <section className="teams-geo-log-section">
        <div className="teams-card" style={{ overflow: 'hidden' }}>
          <div className="teams-detail-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span className="teams-roster-name">GPS-triggered clock-outs</span>
            <span className="teams-cell-muted" style={{ fontSize: 12 }}>
              This job only — employees who left this jobsite boundary while clocked in
            </span>
          </div>
          <GpsClockOutLogList key={projectId} onSelectEmployee={onSelectEmployee} fixedJobId={projectId} />
        </div>
      </section>
    </div>
  )
}
