/**
 * Mock data for the Teams flow. Enable by setting VITE_USE_TEAMS_MOCK=true in .env.
 * Import teamsApi and getProjectsList from @/api/teamsClient to use mock when enabled.
 */
import type {
  Employee,
  JobAssignment,
  TimeEntry,
  AttendanceRecord,
  PayRaise,
  JobGeofence,
  GpsClockOutLog,
} from '@/types/global'
import type { Project } from '@/types/global'
import type { YtdPayResponse } from '@/api/teams'

const now = new Date().toISOString()
const today = now.slice(0, 10)
const weekStart = new Date()
weekStart.setDate(weekStart.getDate() - weekStart.getDay())
const weekStartStr = weekStart.toISOString().slice(0, 10)

// ─── IDs ─────────────────────────────────────────────────────────────────────
const E1 = 'emp-marcus-rivera'
const E2 = 'emp-jake-thompson'
const E3 = 'emp-sofia-delgado'
const E4 = 'emp-owen-park'
const J1 = 'job-kitchen-remodel'
const J2 = 'job-master-bath'
const J3 = 'job-deck-patio'

// ─── Employees ────────────────────────────────────────────────────────────────
export const mockEmployees: Employee[] = [
  { id: E1, name: 'Marcus Rivera', role: 'Lead Carpenter', email: 'm.rivera@email.com', phone: '801-555-0142', status: 'on_site', current_compensation: 32, created_at: now, updated_at: now },
  { id: E2, name: 'Jake Thompson', role: 'Electrician', email: 'j.thompson@email.com', phone: '801-555-0187', status: 'on_site', current_compensation: 38, created_at: now, updated_at: now },
  { id: E3, name: 'Sofia Delgado', role: 'Project Manager', email: 's.delgado@email.com', phone: '801-555-0231', status: 'on_site', current_compensation: 45, created_at: now, updated_at: now },
  { id: E4, name: 'Owen Park', role: 'Apprentice', email: 'o.park@email.com', phone: '801-555-0094', status: 'off', current_compensation: 22, created_at: now, updated_at: now },
]

// ─── Projects (jobs) ──────────────────────────────────────────────────────────
export const mockProjects: Project[] = [
  { id: J1, name: 'Kitchen Remodel – 123 Main St', status: 'active', created_at: now, updated_at: now },
  { id: J2, name: 'Master Bath – 442 Oak St', status: 'active', created_at: now, updated_at: now },
  { id: J3, name: 'Deck & Patio – 55 Maple Dr', status: 'active', created_at: now, updated_at: now },
]

// ─── Job assignments ─────────────────────────────────────────────────────────
export const mockJobAssignments: JobAssignment[] = [
  { id: 'ja-1', employee_id: E1, job_id: J1, assigned_at: '2026-02-01T00:00:00.000Z', role_on_job: 'Lead Carpenter' },
  { id: 'ja-2', employee_id: E2, job_id: J2, assigned_at: '2026-02-12T00:00:00.000Z', role_on_job: 'Electrician' },
  { id: 'ja-3', employee_id: E3, job_id: J3, assigned_at: '2026-02-20T00:00:00.000Z', role_on_job: 'Project Manager' },
]

// ─── Time entries (this week + this month for metrics) ─────────────────────────
export const mockTimeEntries: TimeEntry[] = [
  { id: 'te-1', employee_id: E1, job_id: J1, clock_in: `${today}T14:02:00.000Z`, clock_out: `${today}T22:45:00.000Z`, hours: 8.72, source: 'manual' },
  { id: 'te-2', employee_id: E1, job_id: J1, clock_in: `${today}T13:58:00.000Z`, clock_out: `${today}T23:10:00.000Z`, hours: 9.2, source: 'manual' },
  { id: 'te-3', employee_id: E1, job_id: J1, clock_in: `${today}T14:15:00.000Z`, clock_out: `${today}T22:30:00.000Z`, hours: 8.25, source: 'manual' },
  { id: 'te-4', employee_id: E2, job_id: J2, clock_in: `${today}T15:00:00.000Z`, clock_out: `${today}T23:30:00.000Z`, hours: 8.5, source: 'manual' },
  { id: 'te-5', employee_id: E2, job_id: J2, clock_in: `${today}T14:55:00.000Z`, clock_out: `${today}T23:25:00.000Z`, hours: 8.5, source: 'manual' },
  { id: 'te-6', employee_id: E2, job_id: J2, clock_in: `${today}T15:10:00.000Z`, clock_out: `${today}T00:00:00.000Z`, hours: 8.83, source: 'manual' },
  { id: 'te-7', employee_id: E3, job_id: J3, clock_in: `${today}T15:30:00.000Z`, clock_out: `${today}T23:00:00.000Z`, hours: 7.5, source: 'manual' },
  { id: 'te-8', employee_id: E3, job_id: J3, clock_in: `${today}T15:15:00.000Z`, clock_out: `${today}T22:45:00.000Z`, hours: 7.5, source: 'manual' },
  { id: 'te-9', employee_id: E3, job_id: J3, clock_in: `${today}T15:45:00.000Z`, clock_out: `${today}T23:30:00.000Z`, hours: 7.75, source: 'manual' },
]

// ─── Attendance records ──────────────────────────────────────────────────────
export const mockAttendanceRecords: AttendanceRecord[] = [
  { id: 'ar-1', employee_id: E1, date: today, clock_in: `${today}T14:15:00.000Z`, clock_out: `${today}T22:30:00.000Z`, late_arrival_minutes: 0, early_departure_minutes: 0 },
  { id: 'ar-2', employee_id: E2, date: today, clock_in: `${today}T15:10:00.000Z`, clock_out: `${today}T00:00:00.000Z`, late_arrival_minutes: 0, early_departure_minutes: 0 },
  { id: 'ar-3', employee_id: E3, date: today, clock_in: `${today}T16:02:00.000Z`, clock_out: `${today}T23:30:00.000Z`, late_arrival_minutes: 32, early_departure_minutes: 0 },
  { id: 'ar-4', employee_id: E1, date: weekStartStr, clock_in: `${weekStartStr}T13:58:00.000Z`, clock_out: `${weekStartStr}T21:50:00.000Z`, late_arrival_minutes: 0, early_departure_minutes: 40 },
  { id: 'ar-5', employee_id: E2, date: weekStartStr, clock_in: `${weekStartStr}T14:55:00.000Z`, clock_out: `${weekStartStr}T23:25:00.000Z`, late_arrival_minutes: 0, early_departure_minutes: 0 },
  { id: 'ar-6', employee_id: E3, date: weekStartStr, clock_in: `${weekStartStr}T15:15:00.000Z`, clock_out: `${weekStartStr}T22:45:00.000Z`, late_arrival_minutes: 0, early_departure_minutes: 0 },
]

// ─── Pay raises ───────────────────────────────────────────────────────────────
export const mockPayRaises: PayRaise[] = [
  { id: 'pr-1', employee_id: E1, effective_date: '2025-01-15', amount_type: 'percent', amount: 7, previous_rate: 28, new_rate: 30, notes: 'Annual review' },
  { id: 'pr-2', employee_id: E1, effective_date: '2025-07-01', amount_type: 'dollar', amount: 2, previous_rate: 30, new_rate: 32, notes: 'Promotion to Lead' },
  { id: 'pr-3', employee_id: E2, effective_date: '2024-03-01', amount_type: 'percent', amount: 8.5, previous_rate: 35, new_rate: 38, notes: 'Annual review' },
  { id: 'pr-4', employee_id: E3, effective_date: '2023-06-01', amount_type: 'percent', amount: 5, previous_rate: 40, new_rate: 42, notes: 'Annual review' },
  { id: 'pr-5', employee_id: E3, effective_date: '2024-06-01', amount_type: 'percent', amount: 7, previous_rate: 42, new_rate: 45, notes: 'Annual review' },
]

// ─── Geofences ───────────────────────────────────────────────────────────────
export const mockGeofences: JobGeofence[] = [
  { id: 'gf-1', job_id: J1, center_lat: 40.7607, center_lng: -111.8910, radius_value: 500, radius_unit: 'feet' },
  { id: 'gf-2', job_id: J2, center_lat: 40.7580, center_lng: -111.8890, radius_value: 300, radius_unit: 'meters' },
  { id: 'gf-3', job_id: J3, center_lat: 40.7620, center_lng: -111.8850, radius_value: 400, radius_unit: 'feet' },
]

// ─── GPS clock-out log ────────────────────────────────────────────────────────
export const mockGpsClockOutLogs: GpsClockOutLog[] = [
  { id: 'gps-1', employee_id: E3, time_entry_id: 'te-8', job_id: J3, exited_at: `${weekStartStr}T22:42:00.000Z`, lat: 40.7589, lng: -111.8883 },
  { id: 'gps-2', employee_id: E1, time_entry_id: 'te-2', job_id: J1, exited_at: `${weekStartStr}T12:05:00.000Z`, lat: 40.7612, lng: -111.8901 },
]

// ─── YTD payroll ──────────────────────────────────────────────────────────────
const currentYear = new Date().getFullYear()
export const mockYtdPayResponse: YtdPayResponse = {
  year: currentYear,
  company_total: 48603,
  by_employee: [
    { employee_id: E1, year: currentYear, total_earnings: 13184, monthly_breakdown: [{ month: 1, earnings: 3920 }, { month: 2, earnings: 4224 }, { month: 3, earnings: 5040 }] },
    { employee_id: E2, year: currentYear, total_earnings: 18544, monthly_breakdown: [{ month: 1, earnings: 4560 }, { month: 2, earnings: 4864 }, { month: 3, earnings: 5472 }] },
    { employee_id: E3, year: currentYear, total_earnings: 16875, monthly_breakdown: [{ month: 1, earnings: 5400 }, { month: 2, earnings: 5760 }, { month: 3, earnings: 5715 }] },
    { employee_id: E4, year: currentYear, total_earnings: 0, monthly_breakdown: [] },
  ],
}

// ─── Mock API (same shape as teamsApi, returns promises) ────────────────────────
function inRange(iso: string, from?: string, to?: string): boolean {
  if (!from && !to) return true
  const t = iso.slice(0, 10)
  if (from && t < from.slice(0, 10)) return false
  if (to && t > to.slice(0, 10)) return false
  return true
}

export const mockTeamsApi = {
  employees: {
    async list(params?: { status?: string; job_id?: string }): Promise<Employee[]> {
      let list = [...mockEmployees]
      if (params?.status) list = list.filter((e) => e.status === params.status)
      if (params?.job_id) {
        const empIds = new Set(mockJobAssignments.filter((a) => a.job_id === params.job_id && !a.ended_at).map((a) => a.employee_id))
        list = list.filter((e) => empIds.has(e.id))
      }
      return list
    },
    async get(id: string): Promise<Employee> {
      const e = mockEmployees.find((x) => x.id === id)
      if (!e) throw new Error('Not found')
      return e
    },
    async create(): Promise<Employee> {
      return mockEmployees[0]
    },
    async update(): Promise<Employee> {
      return mockEmployees[0]
    },
    async delete(): Promise<void> {},
    async invite(_id: string): Promise<{ ok: boolean; expires_at: string; invite_link?: string | null }> {
      return { ok: true, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), invite_link: null }
    },
  },

  jobAssignments: {
    async list(params?: { employee_id?: string; job_id?: string; active_only?: boolean }): Promise<JobAssignment[]> {
      let list = mockJobAssignments.filter((a) => !params?.active_only || !a.ended_at)
      if (params?.employee_id) list = list.filter((a) => a.employee_id === params.employee_id)
      if (params?.job_id) list = list.filter((a) => a.job_id === params.job_id)
      return list
    },
    async create(): Promise<JobAssignment> {
      return mockJobAssignments[0]
    },
    async update(): Promise<JobAssignment> {
      return mockJobAssignments[0]
    },
    async delete(): Promise<void> {},
  },

  timeEntries: {
    async list(params?: { employee_id?: string; job_id?: string; from?: string; to?: string }): Promise<TimeEntry[]> {
      let list = mockTimeEntries.filter((e) => {
        if (params?.from || params?.to) {
          const clockIn = e.clock_in.slice(0, 10)
          if (params.from && clockIn < params.from.slice(0, 10)) return false
          if (params.to && clockIn > params.to.slice(0, 10)) return false
        }
        if (params?.employee_id && e.employee_id !== params.employee_id) return false
        if (params?.job_id && e.job_id !== params.job_id) return false
        return true
      })
      return list
    },
    async create(): Promise<TimeEntry> {
      return mockTimeEntries[0]
    },
    async clockOut(): Promise<TimeEntry> {
      return { ...mockTimeEntries[0], clock_out: now }
    },
  },

  attendance: {
    async list(params?: { employee_id?: string; from?: string; to?: string }): Promise<AttendanceRecord[]> {
      let list = mockAttendanceRecords.filter((r) => {
        if (!inRange(r.date, params?.from, params?.to)) return false
        if (params?.employee_id && r.employee_id !== params.employee_id) return false
        return true
      })
      return list
    },
    async create(): Promise<AttendanceRecord> {
      return mockAttendanceRecords[0]
    },
    async update(): Promise<AttendanceRecord> {
      return mockAttendanceRecords[0]
    },
    async delete(): Promise<void> {},
  },

  payRaises: {
    async list(employee_id?: string): Promise<PayRaise[]> {
      if (!employee_id) return mockPayRaises
      return mockPayRaises.filter((r) => r.employee_id === employee_id).sort((a, b) => b.effective_date.localeCompare(a.effective_date))
    },
    async create(): Promise<PayRaise> {
      return mockPayRaises[0]
    },
    async update(): Promise<PayRaise> {
      return mockPayRaises[0]
    },
    async delete(): Promise<void> {},
  },

  geofences: {
    async list(): Promise<JobGeofence[]> {
      return [...mockGeofences]
    },
    async getByJob(jobId: string): Promise<JobGeofence | null> {
      return mockGeofences.find((g) => g.job_id === jobId) ?? null
    },
    async save(): Promise<JobGeofence> {
      return mockGeofences[0]
    },
    async update(): Promise<JobGeofence> {
      return mockGeofences[0]
    },
    async delete(): Promise<void> {},
  },

  gpsClockOut: {
    async list(params?: { job_id?: string; employee_id?: string }): Promise<GpsClockOutLog[]> {
      let list = [...mockGpsClockOutLogs]
      if (params?.job_id) list = list.filter((l) => l.job_id === params.job_id)
      if (params?.employee_id) list = list.filter((l) => l.employee_id === params.employee_id)
      return list
    },
    async create(): Promise<GpsClockOutLog> {
      return mockGpsClockOutLogs[0]
    },
  },

  payroll: {
    async getYtd(year?: number): Promise<YtdPayResponse> {
      const y = year ?? currentYear
      return { ...mockYtdPayResponse, year: y }
    },
  },
}
