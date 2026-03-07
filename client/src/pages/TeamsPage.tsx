import { useState } from 'react'
import { EmployeeRoster } from '@/components/teams/EmployeeRoster'
import { ManHoursTab } from '@/components/teams/ManHoursTab'
import { AttendanceRecordList } from '@/components/teams/AttendanceRecordList'
import { PayrollTab } from '@/components/teams/PayrollTab'
import { GeofenceTab } from '@/components/teams/GeofenceTab'
import { EmployeePanel } from '@/components/teams/EmployeePanel'
import type { Employee } from '@/types/global'

type TeamsTab = 'roster' | 'man-hours' | 'attendance' | 'payroll' | 'geofence'

const TABS: { id: TeamsTab; label: string }[] = [
  { id: 'roster', label: 'Roster' },
  { id: 'man-hours', label: 'Man Hours' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'geofence', label: 'GPS / Geofence' },
]

export function TeamsPage() {
  const [tab, setTab] = useState<TeamsTab>('roster')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  return (
    <div className="dashboard-app teams-page">
      <div className="teams-page-inner">
        <div className="teams-page-header teams-page-header-new">
          <div>
            <div className="teams-page-header-label">Workforce</div>
            <h1 className="teams-page-title">Teams</h1>
          </div>
          <button type="button" className="teams-btn teams-btn-primary teams-btn-add-employee">
            <span className="teams-btn-add-icon">+</span> Add Employee
          </button>
        </div>

        <div className="teams-tab-bar">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`teams-tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="teams-page-content">
          {tab === 'roster' && (
            <EmployeeRoster onSelectEmployee={setSelectedEmp} />
          )}
          {tab === 'man-hours' && (
            <ManHoursTab onSelectEmployee={setSelectedEmp} />
          )}
          {tab === 'attendance' && (
            <AttendanceRecordList onSelectEmployee={setSelectedEmp} />
          )}
          {tab === 'payroll' && (
            <PayrollTab onSelectEmployee={setSelectedEmp} />
          )}
          {tab === 'geofence' && (
            <GeofenceTab onSelectEmployee={setSelectedEmp} />
          )}
        </div>
      </div>

      <EmployeePanel emp={selectedEmp} onClose={() => setSelectedEmp(null)} />
    </div>
  )
}
