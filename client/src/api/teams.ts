import type {
  Employee,
  JobAssignment,
  JobAssignmentScheduleResponse,
  JobWeeklySchedule,
  TimeEntry,
  AttendanceRecord,
  PayRaise,
  GpsClockOutLog,
  JobGeofence,
} from '@/types/global'
import { API_BASE } from '@/api/config'
import { getSessionAuthHeaders } from '@/api/authHeaders'
import { isPublicDemo, DEMO_EMPLOYEE_ID } from '@/lib/publicDemo'
import { DEMO_PROJECT_ID } from '@/data/mockProjectsData'

async function getAuthHeaders(): Promise<HeadersInit> {
  return getSessionAuthHeaders()
}

const demoNow = () => new Date().toISOString()

function demoEmployeesList(): Employee[] {
  const t = demoNow()
  return [
    {
      id: DEMO_EMPLOYEE_ID,
      name: 'Jamie K.',
      role: 'Site Super',
      email: 'demo.employee@example.com',
      phone: '(555) 000-1111',
      status: 'off',
      current_compensation: 32,
      created_at: t,
      updated_at: t,
    },
    {
      id: 'demo-emp-2',
      name: 'Marcus T.',
      role: 'Lead Framer',
      email: 'marcus@example.com',
      status: 'off',
      current_compensation: 28,
      created_at: t,
      updated_at: t,
    },
  ]
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface YtdPayResponse {
  year: number
  company_total: number
  by_employee: { employee_id: string; year: number; total_earnings: number; monthly_breakdown: { month: number; earnings: number }[] }[]
}

export const teamsApi = {
  employees: {
    async list(params?: { status?: string; job_id?: string }): Promise<Employee[]> {
      if (isPublicDemo()) {
        return Promise.resolve(demoEmployeesList())
      }
      const headers = await getAuthHeaders()
      const sp = new URLSearchParams()
      if (params?.status) sp.set('status', params.status)
      if (params?.job_id) sp.set('job_id', params.job_id)
      const q = sp.toString() ? `?${sp}` : ''
      const res = await fetch(`${API_BASE}/employees${q}`, { headers })
      return handleResponse<Employee[]>(res)
    },
    async get(id: string): Promise<Employee> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/employees/${id}`, { headers })
      return handleResponse<Employee>(res)
    },
    async create(body: Partial<Pick<Employee, 'name' | 'role' | 'email' | 'phone' | 'status' | 'current_compensation'>>): Promise<Employee> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<Employee>(res)
    },
    async update(id: string, body: Partial<Pick<Employee, 'name' | 'role' | 'email' | 'phone' | 'status' | 'current_compensation'>>): Promise<Employee> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/employees/${id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<Employee>(res)
    },
    async delete(id: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/employees/${id}`, { method: 'DELETE', headers })
      return handleResponse<void>(res)
    },
    async invite(id: string): Promise<{ ok: boolean; expires_at: string; invite_link?: string | null; invite_email_sent?: boolean }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/employees/${id}/invite`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      return handleResponse<{ ok: boolean; expires_at: string; invite_link?: string | null; invite_email_sent?: boolean }>(res)
    },
    /** List invite status for current user's employees (for Settings). */
    async listInvites(): Promise<{ id: string; employee_id: string; email: string; status: 'pending' | 'accepted' | 'expired'; invitedAt: string | null }[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/employees/invites`, { headers })
      return handleResponse(res)
    },
  },

  jobAssignments: {
    async list(params?: { employee_id?: string; job_id?: string; active_only?: boolean }): Promise<JobAssignment[]> {
      if (isPublicDemo()) {
        const t = demoNow()
        const jobId = params?.job_id ?? DEMO_PROJECT_ID
        if (params?.employee_id && params.employee_id !== DEMO_EMPLOYEE_ID) {
          return Promise.resolve([])
        }
        return Promise.resolve([
          {
            id: 'ja-demo-1',
            employee_id: DEMO_EMPLOYEE_ID,
            job_id: jobId,
            assigned_at: t,
            role_on_job: 'Site Super',
          },
        ])
      }
      const headers = await getAuthHeaders()
      const sp = new URLSearchParams()
      if (params?.employee_id) sp.set('employee_id', params.employee_id)
      if (params?.job_id) sp.set('job_id', params.job_id)
      if (params?.active_only) sp.set('active_only', 'true')
      const q = sp.toString() ? `?${sp}` : ''
      const res = await fetch(`${API_BASE}/job-assignments${q}`, { headers })
      return handleResponse<JobAssignment[]>(res)
    },
    async create(body: { employee_id: string; job_id: string; role_on_job?: string }): Promise<JobAssignment> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/job-assignments`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<JobAssignment>(res)
    },
    async update(id: string, body: Partial<Pick<JobAssignment, 'job_id' | 'role_on_job' | 'ended_at'>>): Promise<JobAssignment> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/job-assignments/${id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<JobAssignment>(res)
    },
    async delete(id: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/job-assignments/${id}`, { method: 'DELETE', headers })
      return handleResponse<void>(res)
    },
    async getSchedule(assignmentId: string): Promise<JobAssignmentScheduleResponse> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/job-assignments/${assignmentId}/schedule`, { headers })
      return handleResponse<JobAssignmentScheduleResponse>(res)
    },
    async saveSchedule(
      assignmentId: string,
      body: { weekly_schedule: JobWeeklySchedule; timezone?: string }
    ): Promise<JobAssignmentScheduleResponse> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/job-assignments/${assignmentId}/schedule`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<JobAssignmentScheduleResponse>(res)
    },
  },

  timeEntries: {
    async list(params?: { employee_id?: string; job_id?: string; from?: string; to?: string }): Promise<TimeEntry[]> {
      if (isPublicDemo()) {
        if (params?.employee_id && params.employee_id !== DEMO_EMPLOYEE_ID) return Promise.resolve([])
        const yesterday = new Date(Date.now() - 86400000).toISOString()
        const clockOut = new Date(Date.now() - 3600000).toISOString()
        return Promise.resolve([
          {
            id: 'te-demo-past',
            employee_id: DEMO_EMPLOYEE_ID,
            job_id: DEMO_PROJECT_ID,
            clock_in: yesterday,
            clock_out: clockOut,
            hours: 6,
            source: 'manual',
          },
        ])
      }
      const headers = await getAuthHeaders()
      const sp = new URLSearchParams()
      if (params?.employee_id) sp.set('employee_id', params.employee_id)
      if (params?.job_id) sp.set('job_id', params.job_id)
      if (params?.from) sp.set('from', params.from)
      if (params?.to) sp.set('to', params.to)
      const q = sp.toString() ? `?${sp}` : ''
      const res = await fetch(`${API_BASE}/time-entries${q}`, { headers })
      return handleResponse<TimeEntry[]>(res)
    },
    async create(body: {
      employee_id: string
      job_id: string
      clock_in?: string
      clock_out?: string
      source?: TimeEntry['source']
      project_work_type_id?: string
    }): Promise<TimeEntry> {
      if (isPublicDemo()) {
        return Promise.resolve({
          id: `te-${Date.now()}`,
          employee_id: body.employee_id,
          job_id: body.job_id,
          clock_in: body.clock_in ?? new Date().toISOString(),
          clock_out: body.clock_out,
          source: body.source ?? 'manual',
          project_work_type_id: body.project_work_type_id,
        })
      }
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/time-entries`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<TimeEntry>(res)
    },
    async clockOut(
      id: string,
      body?: { clock_out?: string; source?: TimeEntry['source']; gps_clock_out_log_id?: string }
    ): Promise<TimeEntry> {
      if (isPublicDemo()) {
        return Promise.resolve({
          id,
          employee_id: DEMO_EMPLOYEE_ID,
          job_id: DEMO_PROJECT_ID,
          clock_in: new Date(Date.now() - 7200000).toISOString(),
          clock_out: body?.clock_out ?? new Date().toISOString(),
          hours: 2,
          source: body?.source ?? 'manual',
        })
      }
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/time-entries/${id}/clock-out`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      return handleResponse<TimeEntry>(res)
    },
    /** Contractor portal: adjust clock in/out, reopen session (clock_out null), or close an open entry. */
    async update(
      id: string,
      body: {
        clock_in?: string
        clock_out?: string | null
        source?: TimeEntry['source']
        project_work_type_id?: string | null
      }
    ): Promise<TimeEntry> {
      if (isPublicDemo()) {
        return Promise.resolve({
          id,
          employee_id: DEMO_EMPLOYEE_ID,
          job_id: DEMO_PROJECT_ID,
          clock_in: body.clock_in ?? new Date().toISOString(),
          clock_out: body.clock_out ?? undefined,
          source: body.source ?? 'manual',
          project_work_type_id: body.project_work_type_id ?? undefined,
        })
      }
      const headers = await getAuthHeaders()
      // PUT matches PATCH on server; some deployments only had older routes without PATCH /:id
      const res = await fetch(`${API_BASE}/time-entries/${id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<TimeEntry>(res)
    },
  },

  attendance: {
    async list(params?: { employee_id?: string; from?: string; to?: string }): Promise<AttendanceRecord[]> {
      if (isPublicDemo()) return Promise.resolve([])
      const headers = await getAuthHeaders()
      const sp = new URLSearchParams()
      if (params?.employee_id) sp.set('employee_id', params.employee_id)
      if (params?.from) sp.set('from', params.from)
      if (params?.to) sp.set('to', params.to)
      const q = sp.toString() ? `?${sp}` : ''
      const res = await fetch(`${API_BASE}/attendance${q}`, { headers })
      return handleResponse<AttendanceRecord[]>(res)
    },
    async create(body: {
      employee_id: string
      date: string
      clock_in: string
      clock_out?: string
      late_arrival_minutes?: number
      early_departure_minutes?: number
      notes?: string
    }): Promise<AttendanceRecord> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<AttendanceRecord>(res)
    },
    async update(id: string, body: Partial<Pick<AttendanceRecord, 'date' | 'clock_in' | 'clock_out' | 'late_arrival_minutes' | 'early_departure_minutes' | 'notes'>>): Promise<AttendanceRecord> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/attendance/${id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<AttendanceRecord>(res)
    },
    async delete(id: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/attendance/${id}`, { method: 'DELETE', headers })
      return handleResponse<void>(res)
    },
  },

  payRaises: {
    async list(employee_id?: string): Promise<PayRaise[]> {
      const headers = await getAuthHeaders()
      const q = employee_id ? `?employee_id=${encodeURIComponent(employee_id)}` : ''
      const res = await fetch(`${API_BASE}/pay-raises${q}`, { headers })
      return handleResponse<PayRaise[]>(res)
    },
    async create(body: {
      employee_id: string
      effective_date: string
      amount_type: PayRaise['amount_type']
      amount: number
      previous_rate?: number
      new_rate?: number
      notes?: string
    }): Promise<PayRaise> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/pay-raises`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<PayRaise>(res)
    },
    async update(id: string, body: Partial<PayRaise>): Promise<PayRaise> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/pay-raises/${id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<PayRaise>(res)
    },
    async delete(id: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/pay-raises/${id}`, { method: 'DELETE', headers })
      return handleResponse<void>(res)
    },
  },

  geofences: {
    async list(job_id?: string): Promise<JobGeofence[]> {
      const headers = await getAuthHeaders()
      const q = job_id ? `?job_id=${encodeURIComponent(job_id)}` : ''
      const res = await fetch(`${API_BASE}/geofences${q}`, { headers })
      return handleResponse<JobGeofence[]>(res)
    },
    async getByJob(jobId: string): Promise<JobGeofence | null> {
      if (isPublicDemo()) {
        return Promise.resolve({
          id: 'gf-demo',
          job_id: jobId,
          center_lat: 40.7608,
          center_lng: -111.891,
          radius_value: 400,
          radius_unit: 'feet',
        })
      }
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/geofences/job/${jobId}`, { headers })
      return handleResponse<JobGeofence | null>(res)
    },
    async save(body: {
      job_id: string
      center_lat: number
      center_lng: number
      radius_value: number
      radius_unit: 'feet' | 'meters'
    }): Promise<JobGeofence> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/geofences`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<JobGeofence>(res)
    },
    async update(id: string, body: Partial<Pick<JobGeofence, 'center_lat' | 'center_lng' | 'radius_value' | 'radius_unit'>>): Promise<JobGeofence> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/geofences/${id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<JobGeofence>(res)
    },
    async delete(id: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/geofences/${id}`, { method: 'DELETE', headers })
      return handleResponse<void>(res)
    },
  },

  gpsClockOut: {
    async list(params?: { job_id?: string; employee_id?: string }): Promise<GpsClockOutLog[]> {
      const headers = await getAuthHeaders()
      const sp = new URLSearchParams()
      if (params?.job_id) sp.set('job_id', params.job_id)
      if (params?.employee_id) sp.set('employee_id', params.employee_id)
      const q = sp.toString() ? `?${sp}` : ''
      const res = await fetch(`${API_BASE}/gps-clock-out${q}`, { headers })
      return handleResponse<GpsClockOutLog[]>(res)
    },
    async create(body: {
      employee_id: string
      time_entry_id: string
      job_id: string
      exited_at?: string
      lat?: number
      lng?: number
      geofence_id?: string
    }): Promise<GpsClockOutLog> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/gps-clock-out`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleResponse<GpsClockOutLog>(res)
    },
  },

  payroll: {
    async getYtd(year?: number): Promise<YtdPayResponse> {
      if (isPublicDemo()) {
        const y = year ?? new Date().getFullYear()
        return Promise.resolve({
          year: y,
          company_total: 128400,
          by_employee: [
            {
              employee_id: DEMO_EMPLOYEE_ID,
              year: y,
              total_earnings: 42000,
              monthly_breakdown: [{ month: 1, earnings: 3500 }],
            },
          ],
        })
      }
      const headers = await getAuthHeaders()
      const q = year != null ? `?year=${year}` : ''
      const res = await fetch(`${API_BASE}/payroll/ytd${q}`, { headers })
      return handleResponse<YtdPayResponse>(res)
    },
    async getContact(): Promise<{ name: string; email: string; phone?: string } | null> {
      if (isPublicDemo()) {
        return Promise.resolve({ name: 'Demo Payroll Partner', email: 'payroll@example.com', phone: '(555) 010-0200' })
      }
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/payroll/contact`, { headers })
      return handleResponse<{ name: string; email: string; phone?: string } | null>(res)
    },
    async setContact(contact: { name: string; email: string; phone?: string }): Promise<{ name: string; email: string; phone?: string }> {
      if (isPublicDemo()) return Promise.resolve(contact)
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/payroll/contact`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(contact),
      })
      return handleResponse<{ name: string; email: string; phone?: string }>(res)
    },
    async recordRun(params: {
      period_from: string
      period_to: string
      recipient_email: string
      recipient_name?: string
      employee_count: number
      total_hours: number
      gross_pay: number
    }): Promise<{ id: string; sent_at: string }> {
      if (isPublicDemo()) {
        return Promise.resolve({ id: `pay-demo-${Date.now()}`, sent_at: new Date().toISOString() })
      }
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/payroll/runs`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      return handleResponse<{ id: string; sent_at: string }>(res)
    },
  },
}
