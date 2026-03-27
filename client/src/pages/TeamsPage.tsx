import { useState } from 'react'
import { EmployeeRoster } from '@/components/teams/EmployeeRoster'
import { ManHoursTab } from '@/components/teams/ManHoursTab'
import { AttendanceRecordList } from '@/components/teams/AttendanceRecordList'
import { PayrollTab } from '@/components/teams/PayrollTab'
import { EmployeePanel } from '@/components/teams/EmployeePanel'
import type { Employee } from '@/types/global'

type TeamsTab = 'roster' | 'man-hours' | 'attendance' | 'payroll'

const TABS: { id: TeamsTab; label: string }[] = [
  { id: 'roster', label: 'Roster' },
  { id: 'man-hours', label: 'Man Hours' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'payroll', label: 'Payroll' },
]

export function TeamsPage() {
  const [tab, setTab] = useState<TeamsTab>('roster')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0)

  return (
    <div className="dashboard-app teams-page">
      <div className="teams-page-inner">
        <div className="teams-page-header teams-page-header-new">
          <div>
            <div className="teams-page-header-label">Workforce</div>
            <h1 className="teams-page-title">Teams</h1>
          </div>
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
            <EmployeeRoster refreshTrigger={rosterRefreshKey} onSelectEmployee={setSelectedEmp} />
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
        </div>
      </div>

      <EmployeePanel
        emp={selectedEmp}
        onClose={() => setSelectedEmp(null)}
        onEmployeeUpdated={(updated) => {
          setSelectedEmp(updated)
          setRosterRefreshKey((k) => k + 1)
        }}
        onEmployeeDeleted={() => {
          setSelectedEmp(null)
          setRosterRefreshKey((k) => k + 1)
        }}
      />
    </div>
  )
}
