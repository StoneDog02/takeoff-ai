import { supabase } from '@/lib/supabaseClient'
import type {
  Project,
  Phase,
  Milestone,
  ProjectTask,
  JobWalkMedia,
  BudgetLineItem,
  BudgetSummary,
  Subcontractor,
  Contractor,
  BidSheet,
  MaterialList as GlobalMaterialList,
  ScheduleItem,
} from '@/types/global'

const API_BASE = '/api'

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {}
  if (!supabase) return headers
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`
  }
  return headers
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<T>
}

export interface TakeoffItem {
  description: string
  quantity: number
  unit: string
  notes?: string
}

export interface TakeoffCategory {
  name: string
  items: TakeoffItem[]
}

export interface MaterialList {
  categories: TakeoffCategory[]
  summary?: string
}

export interface BuildListItem {
  id: string
  name: string
  created_at: string
  status?: string
}

export interface BuildListDetail extends BuildListItem {
  plan_file_name?: string
  plan_file_url?: string
  material_list: MaterialList
}

export interface TakeoffResponse {
  id: string
  name: string
  materialList: MaterialList
  createdAt?: string
}

export const api = {
  async runTakeoff(file: File, name?: string): Promise<TakeoffResponse> {
    const form = new FormData()
    form.append('file', file)
    if (name) form.append('name', name)
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/takeoff`, {
      method: 'POST',
      body: form,
      headers,
    })
    return handleResponse<TakeoffResponse>(res)
  },

  async getBuildLists(): Promise<BuildListItem[]> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/build-lists`, { headers })
    return handleResponse<BuildListItem[]>(res)
  },

  async getBuildList(id: string): Promise<BuildListDetail> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/build-lists/${id}`, { headers })
    return handleResponse<BuildListDetail>(res)
  },

  // --- Projects ---
  projects: {
    async list(): Promise<Project[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects`, { headers })
      return handleResponse<Project[]>(res)
    },
    async get(id: string): Promise<Project> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${id}`, { headers })
      return handleResponse<Project>(res)
    },
    async create(body: {
      name?: string
      status?: string
      scope?: string
      address_line_1?: string
      address_line_2?: string
      city?: string
      state?: string
      postal_code?: string
      expected_start_date?: string
      expected_end_date?: string
      estimated_value?: number
      assigned_to_name?: string
    }): Promise<Project> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Project>(res)
    },
    async update(id: string, body: Partial<Pick<Project, 'name' | 'status' | 'scope' | 'address_line_1' | 'address_line_2' | 'city' | 'state' | 'postal_code' | 'expected_start_date' | 'expected_end_date' | 'estimated_value' | 'assigned_to_name'>>): Promise<Project> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Project>(res)
    },
    async delete(id: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    async getPhases(projectId: string): Promise<Phase[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/phases`, { headers })
      return handleResponse<Phase[]>(res)
    },
    async createPhase(projectId: string, body: { name?: string; start_date?: string; end_date?: string; order?: number }): Promise<Phase> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/phases`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Phase>(res)
    },
    async updatePhase(projectId: string, phaseId: string, body: Partial<Phase>): Promise<Phase> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/phases/${phaseId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Phase>(res)
    },
    async deletePhase(projectId: string, phaseId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/phases/${phaseId}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    async getMilestones(projectId: string): Promise<Milestone[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/milestones`, { headers })
      return handleResponse<Milestone[]>(res)
    },
    async createMilestone(projectId: string, body: { phase_id?: string; title?: string; due_date?: string; completed?: boolean }): Promise<Milestone> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Milestone>(res)
    },
    async updateMilestone(projectId: string, milestoneId: string, body: Partial<Milestone>): Promise<Milestone> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/milestones/${milestoneId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Milestone>(res)
    },
    async deleteMilestone(projectId: string, milestoneId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/milestones/${milestoneId}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    async getTasks(projectId: string): Promise<ProjectTask[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, { headers })
      return handleResponse<ProjectTask[]>(res)
    },
    async createTask(projectId: string, body: { phase_id?: string; title?: string; responsible?: string; start_date?: string; end_date?: string; duration_weeks?: number; order?: number; completed?: boolean }): Promise<ProjectTask> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<ProjectTask>(res)
    },
    async updateTask(projectId: string, taskId: string, body: Partial<Pick<ProjectTask, 'phase_id' | 'title' | 'responsible' | 'start_date' | 'end_date' | 'duration_weeks' | 'order' | 'completed'>>): Promise<ProjectTask> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<ProjectTask>(res)
    },
    async deleteTask(projectId: string, taskId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    async getMedia(projectId: string): Promise<JobWalkMedia[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/media`, { headers })
      return handleResponse<JobWalkMedia[]>(res)
    },
    async uploadMedia(projectId: string, file: File, uploader_name?: string, caption?: string): Promise<JobWalkMedia> {
      const headers = await getAuthHeaders()
      const form = new FormData()
      form.append('file', file)
      if (uploader_name) form.append('uploader_name', uploader_name)
      if (caption) form.append('caption', caption)
      const res = await fetch(`${API_BASE}/projects/${projectId}/media`, {
        method: 'POST',
        body: form,
        headers,
      })
      return handleResponse<JobWalkMedia>(res)
    },
    async deleteMedia(projectId: string, mediaId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/media/${mediaId}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    async getBudget(projectId: string): Promise<{ items: BudgetLineItem[]; summary: BudgetSummary }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/budget`, { headers })
      return handleResponse<{ items: BudgetLineItem[]; summary: BudgetSummary }>(res)
    },
    async updateBudget(projectId: string, items: BudgetLineItem[]): Promise<{ items: BudgetLineItem[]; summary: BudgetSummary }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/budget`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ items }),
      })
      return handleResponse<{ items: BudgetLineItem[]; summary: BudgetSummary }>(res)
    },
    async launchTakeoff(projectId: string, file: File): Promise<{ id: string; material_list: GlobalMaterialList; created_at?: string }> {
      const headers = await getAuthHeaders()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_BASE}/projects/${projectId}/launch-takeoff`, {
        method: 'POST',
        body: form,
        headers,
      })
      return handleResponse<{ id: string; material_list: GlobalMaterialList; created_at?: string }>(res)
    },
    async getTakeoffs(projectId: string): Promise<{ id: string; material_list: GlobalMaterialList; created_at: string }[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/takeoffs`, { headers })
      return handleResponse<{ id: string; material_list: GlobalMaterialList; created_at: string }[]>(res)
    },
    async getSubcontractors(projectId: string): Promise<Subcontractor[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/subcontractors`, { headers })
      return handleResponse<Subcontractor[]>(res)
    },
    async createSubcontractor(projectId: string, body: { name: string; trade: string; email: string; phone?: string }): Promise<Subcontractor> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/subcontractors`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Subcontractor>(res)
    },
    async updateSubcontractor(projectId: string, subId: string, body: Partial<Subcontractor>): Promise<Subcontractor> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/subcontractors/${subId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Subcontractor>(res)
    },
    async deleteSubcontractor(projectId: string, subId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/subcontractors/${subId}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    async bulkSendSubcontractors(projectId: string, subIds: string[], subject: string, body: string): Promise<{ ok: boolean }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/subcontractors/bulk-send`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ sub_ids: subIds, subject, body }),
      })
      return handleResponse<{ ok: boolean }>(res)
    },
    async getBidSheet(projectId: string): Promise<BidSheet> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-sheet`, { headers })
      return handleResponse<BidSheet>(res)
    },
    async updateBidSheet(projectId: string, data: Partial<BidSheet>): Promise<BidSheet> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-sheet`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(data),
      })
      return handleResponse<BidSheet>(res)
    },
  },

  /** Schedule items (tasks + milestones) for a given date across all user projects. */
  async getSchedule(date: string): Promise<ScheduleItem[]> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/schedule?date=${encodeURIComponent(date)}`, { headers })
    return handleResponse<ScheduleItem[]>(res)
  },

  /** Global contractor contact list (Manage > Contractors). */
  contractors: {
    async list(): Promise<Contractor[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/contractors`, { headers })
      return handleResponse<Contractor[]>(res)
    },
    async create(body: { name: string; trade: string; email: string; phone?: string }): Promise<Contractor> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/contractors`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Contractor>(res)
    },
    async update(id: string, body: Partial<{ name: string; trade: string; email: string; phone: string }>): Promise<Contractor> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/contractors/${id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Contractor>(res)
    },
    async delete(id: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/contractors/${id}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
  },
}
