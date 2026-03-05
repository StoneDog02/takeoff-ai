import { useState } from 'react'
import { EmployeeRoster } from '@/components/teams/EmployeeRoster'
import { ManHoursTab } from '@/components/teams/ManHoursTab'
import { JobAssignments } from '@/components/teams/JobAssignments'
import { AttendanceRecordList } from '@/components/teams/AttendanceRecordList'
import { PayRaiseHistory } from '@/components/teams/PayRaiseHistory'
import { YtdPay } from '@/components/teams/YtdPay'
import { GeofenceTab } from '@/components/teams/GeofenceTab'

type TeamsTab =
  | 'roster'
  | 'man-hours'
  | 'assignments'
  | 'attendance'
  | 'pay-raises'
  | 'ytd-pay'
  | 'geofence'

const TABS: { id: TeamsTab; label: string }[] = [
  { id: 'roster', label: 'Roster' },
  { id: 'man-hours', label: 'Man hours' },
  { id: 'assignments', label: 'Job assignments' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'pay-raises', label: 'Pay raises' },
  { id: 'ytd-pay', label: 'YTD pay' },
  { id: 'geofence', label: 'GPS / Geofence' },
]

const TAB_DESCRIPTIONS: Record<TeamsTab, string> = {
  roster: 'View and manage your employee roster. Filter by status, switch between card and table views.',
  'man-hours': 'Review logged hours per employee. Select an employee to view their individual time entries.',
  assignments: "See who's assigned to which job. View by employee or by job site.",
  attendance: 'View clock-in/out records and flag late arrivals or early departures per employee.',
  'pay-raises': 'Review compensation history per employee. Select an employee to see their raise history.',
  'ytd-pay': 'Year-to-date earnings per employee and company total. Optionally show monthly breakdown.',
  geofence: 'View GPS-triggered clock-outs and manage geofence boundaries per job site.',
}

export function TeamsPage() {
  const [tab, setTab] = useState<TeamsTab>('roster')

  return (
    <div className="dashboard-app teams-page">
      <div className="teams-page-inner">
        <div className="dashboard-page-header teams-page-header">
          <h1 className="dashboard-title">Teams</h1>
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

        <div className="teams-tab-header">
          <h2 className="teams-tab-header-title">{TABS.find((t) => t.id === tab)?.label}</h2>
          <p className="teams-tab-header-desc">{TAB_DESCRIPTIONS[tab]}</p>
        </div>

        <div className="teams-page-content">
          {tab === 'roster' && <EmployeeRoster />}
          {tab === 'man-hours' && <ManHoursTab />}
          {tab === 'assignments' && <JobAssignments />}
          {tab === 'attendance' && <AttendanceRecordList />}
          {tab === 'pay-raises' && <PayRaiseHistory />}
          {tab === 'ytd-pay' && <YtdPay />}
          {tab === 'geofence' && <GeofenceTab />}
        </div>
      </div>
    </div>
  )
}
