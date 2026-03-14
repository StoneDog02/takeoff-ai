import { supabase } from '@/lib/supabaseClient'
import type {
  Project,
  ProjectPlanType,
  Phase,
  Milestone,
  ProjectTask,
  JobWalkMedia,
  ProjectBuildPlan,
  BidDocument,
  BudgetLineItem,
  BudgetSummary,
  ChangeOrder,
  Subcontractor,
  ProjectWorkType,
  ProjectActivityItem,
  Contractor,
  BidSheet,
  MaterialList as GlobalMaterialList,
  ScheduleItem,
} from '@/types/global'
import { API_BASE } from '@/api/config'

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
    const serverError = (data as { error?: string }).error
    const msg =
      serverError ||
      (res.status === 404 ? 'Project not found. Try refreshing the page and opening the project again.' : null) ||
      res.statusText ||
      'Request failed'
    throw new Error(msg)
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

export interface DashboardAlert {
  id: string
  type: 'invoice' | 'estimate' | 'budget_overrun'
  urgency: 'high' | 'medium' | 'low'
  label: string
  sub: string
  action: string
  entityId: string
  entityType: 'invoice' | 'estimate' | 'project'
  jobId: string
}

export interface DismissedAlert {
  id: string
  alertId: string
  dismissedAt: string
  label: string
  sub: string
  type: 'invoice' | 'estimate' | 'budget_overrun'
  action: string
  entityId: string
  entityType: string
  jobId: string
  urgency: 'high' | 'medium' | 'low'
}

export interface DashboardKpis {
  totalRevenue: number
  totalExpense: number
  outstanding: number
  openInvoicesCount: number
  activeJobs: number
  totalProjects: number
  revenueTrend?: number[]
  expenseTrend?: number[]
}

export interface ClockedInEntry {
  employeeId: string
  employeeName: string
  initials: string
  jobName: string
  jobId: string
  clockIn: string
  clockInFormatted: string
  hoursSoFar: number
}

export interface DashboardProject {
  id: string
  name: string
  status: string
  client?: string
  initials?: string
  budget_total?: number
  spent_total?: number
  timeline_start?: string | null
  timeline_end?: string | null
  timeline_pct?: number | null
  /** Phase list for project cards (from setup/overview). */
  phases?: { name: string; completed: boolean }[]
  next_step?: string
  days_left?: number | null
  address_line_1?: string | null
  address_line_2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  /** From projects table when list returns raw project shape. */
  expected_start_date?: string | null
  expected_end_date?: string | null
  estimated_value?: number | null
  assigned_to_name?: string | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export interface ConversationListItem {
  id: string
  updated_at: string
  /** When set, this conversation is the group chat for this job (project). */
  job_id?: string | null
  job_name?: string | null
  last_message: {
    id: string
    sender_id: string
    body: string
    created_at: string
  } | null
  unread_count: number
  other_participant_ids: string[]
  /** Resolved display names for other participants (from API). */
  other_participants?: { id: string; name: string }[]
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
    /** List projects with summary for cards (phases, budget actual, days left). Used by Teams and other flows. */
    async list(): Promise<DashboardProject[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects?_=${Date.now()}`, { headers, cache: 'no-store' })
      return handleResponse<DashboardProject[]>(res)
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
      plan_type?: ProjectPlanType
    }): Promise<Project> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Project>(res)
    },
    async update(id: string, body: Partial<Pick<Project, 'name' | 'status' | 'scope' | 'address_line_1' | 'address_line_2' | 'city' | 'state' | 'postal_code' | 'expected_start_date' | 'expected_end_date' | 'estimated_value' | 'assigned_to_name' | 'plan_type'>>): Promise<Project> {
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
    async getBuildPlans(projectId: string): Promise<ProjectBuildPlan[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/build-plans`, { headers })
      return handleResponse<ProjectBuildPlan[]>(res)
    },
    async uploadBuildPlan(projectId: string, file: File, uploader_name?: string): Promise<ProjectBuildPlan> {
      const allHeaders = await getAuthHeaders()
      const form = new FormData()
      form.append('file', file)
      if (uploader_name) form.append('uploader_name', uploader_name)
      // Use only Authorization so browser can set Content-Type for FormData (with boundary)
      const headers: Record<string, string> = {}
      const auth = (allHeaders as Record<string, string> | undefined)?.Authorization
      if (auth) headers['Authorization'] = auth
      const res = await fetch(`${API_BASE}/projects/${projectId}/build-plans`, {
        method: 'POST',
        body: form,
        headers,
      })
      return handleResponse<ProjectBuildPlan>(res)
    },
    async getBuildPlanViewUrl(projectId: string, planId: string): Promise<{ url: string }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/build-plans/${planId}/view`, { headers })
      return handleResponse<{ url: string }>(res)
    },
    async deleteBuildPlan(projectId: string, planId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/build-plans/${planId}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    async getBidDocuments(projectId: string): Promise<BidDocument[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-documents`, { headers })
      return handleResponse<BidDocument[]>(res)
    },
    async uploadBidDocument(projectId: string, file: File, uploader_name?: string): Promise<BidDocument> {
      const allHeaders = await getAuthHeaders()
      const form = new FormData()
      form.append('file', file)
      if (uploader_name) form.append('uploader_name', uploader_name)
      const headers: Record<string, string> = {}
      const auth = (allHeaders as Record<string, string> | undefined)?.Authorization
      if (auth) headers['Authorization'] = auth
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-documents`, {
        method: 'POST',
        body: form,
        headers,
      })
      return handleResponse<BidDocument>(res)
    },
    async getBidDocumentViewUrl(projectId: string, docId: string): Promise<{ url: string }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-documents/${docId}/view`, { headers })
      return handleResponse<{ url: string }>(res)
    },
    async deleteBidDocument(projectId: string, docId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-documents/${docId}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    async getBudget(projectId: string): Promise<{
      items: BudgetLineItem[]
      summary: BudgetSummary
      labor_actual_from_time_entries?: number
      subs_actual_from_bid_sheet?: number
      approved_change_orders_total?: number
    }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/budget?_=${Date.now()}`, { headers, cache: 'no-store' })
      return handleResponse<{
        items: BudgetLineItem[]
        summary: BudgetSummary
        labor_actual_from_time_entries?: number
        subs_actual_from_bid_sheet?: number
        approved_change_orders_total?: number
      }>(res)
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
    async getChangeOrders(projectId: string): Promise<ChangeOrder[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/change-orders?_=${Date.now()}`, { headers, cache: 'no-store' })
      return handleResponse<ChangeOrder[]>(res)
    },
    async createChangeOrder(projectId: string, body: { description: string; amount: number; status: 'Approved' | 'Pending'; date: string; category: string }): Promise<ChangeOrder> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/change-orders`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<ChangeOrder>(res)
    },
    async updateChangeOrder(projectId: string, coId: string, body: Partial<{ description: string; amount: number; status: 'Approved' | 'Pending'; date: string; category: string }>): Promise<ChangeOrder> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/change-orders/${coId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<ChangeOrder>(res)
    },
    async deleteChangeOrder(projectId: string, coId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/change-orders/${coId}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    async getTrades(): Promise<{ key: string; label: string; csiDivision: string }[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/trades`, { headers })
      return handleResponse<{ key: string; label: string; csiDivision: string }[]>(res)
    },
    async launchTakeoff(
      projectId: string,
      file: File,
      planType?: string,
      tradeFilter?: null | string | string[]
    ): Promise<{ id: string; material_list: GlobalMaterialList; created_at?: string; truncated?: boolean }> {
      const headers = await getAuthHeaders()
      const form = new FormData()
      form.append('file', file)
      if (planType) form.append('planType', planType)
      if (tradeFilter != null && (Array.isArray(tradeFilter) ? tradeFilter.length > 0 : tradeFilter !== '')) {
        form.append('tradeFilter', Array.isArray(tradeFilter) ? JSON.stringify(tradeFilter) : tradeFilter)
      }
      const res = await fetch(`${API_BASE}/projects/${projectId}/launch-takeoff`, {
        method: 'POST',
        body: form,
        headers,
      })
      return handleResponse<{ id: string; material_list: GlobalMaterialList; created_at?: string; truncated?: boolean }>(res)
    },
    async getTakeoffs(projectId: string): Promise<{ id: string; material_list: GlobalMaterialList; created_at: string }[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/takeoffs`, { headers })
      return handleResponse<{ id: string; material_list: GlobalMaterialList; created_at: string }[]>(res)
    },
    async getActivity(projectId: string): Promise<ProjectActivityItem[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/activity`, { headers })
      return handleResponse<ProjectActivityItem[]>(res)
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
    async getWorkTypes(projectId: string): Promise<ProjectWorkType[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/work-types`, { headers })
      return handleResponse<ProjectWorkType[]>(res)
    },
    async createWorkType(projectId: string, body: { name: string; description?: string; rate: number; unit: string; type_key?: string; custom_color?: string }): Promise<ProjectWorkType> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/work-types`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<ProjectWorkType>(res)
    },
    async updateWorkType(projectId: string, wtId: string, body: Partial<{ name: string; description: string; rate: number; unit: string; type_key: string; custom_color: string }>): Promise<ProjectWorkType> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/work-types/${wtId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<ProjectWorkType>(res)
    },
    async deleteWorkType(projectId: string, wtId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/work-types/${wtId}`, { method: 'DELETE', headers })
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

  /** Dates in a month that have at least one schedule item (task or milestone). */
  async getScheduleDays(month: string): Promise<{ dates: string[] }> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/schedule/days?month=${encodeURIComponent(month)}`, { headers })
    return handleResponse<{ dates: string[] }>(res)
  },

  /** Dashboard aggregates (alerts, KPIs, clocked-in, projects). */
  dashboard: {
    async getAlerts(): Promise<DashboardAlert[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/dashboard/alerts`, { headers })
      return handleResponse<DashboardAlert[]>(res)
    },
    async dismissAlert(alert: DashboardAlert): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/dashboard/alerts/dismiss`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ alert }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    async getDismissedAlerts(): Promise<DismissedAlert[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/dashboard/alerts/dismissed`, { headers })
      return handleResponse<DismissedAlert[]>(res)
    },
    async getKpis(): Promise<DashboardKpis> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/dashboard/kpis`, { headers })
      return handleResponse<DashboardKpis>(res)
    },
    async getClockedIn(): Promise<ClockedInEntry[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/dashboard/clocked-in`, { headers })
      return handleResponse<ClockedInEntry[]>(res)
    },
    async getProjects(): Promise<DashboardProject[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/dashboard/projects?_=${Date.now()}`, {
        headers,
        cache: 'no-store',
      })
      return handleResponse<DashboardProject[]>(res)
    },
  },

  /** Messaging: conversations and messages */
  conversations: {
    async list(): Promise<ConversationListItem[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/conversations`, { headers })
      return handleResponse<ConversationListItem[]>(res)
    },
    async findOrCreate(otherUserId: string): Promise<{ id: string; created_at: string; updated_at: string }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/conversations/find-or-create?other_user_id=${encodeURIComponent(otherUserId)}`, { headers })
      return handleResponse<{ id: string; created_at: string; updated_at: string }>(res)
    },
    /** Create a group conversation (e.g. team chat) with given participant user IDs. Current user is always included. */
    async create(participantIds: string[]): Promise<{ id: string; created_at: string; updated_at: string }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ participant_ids: participantIds }),
      })
      return handleResponse<{ id: string; created_at: string; updated_at: string }>(res)
    },
    /** Get or create the group conversation for a job. Returns conversation + job_name. */
    async getOrCreateForJob(jobId: string): Promise<{ id: string; created_at: string; updated_at: string; job_id: string; job_name: string }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/conversations/for-job`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ job_id: jobId }),
      })
      return handleResponse<{ id: string; created_at: string; updated_at: string; job_id: string; job_name: string }>(res)
    },
    async getMessages(conversationId: string, opts?: { limit?: number; before?: string }): Promise<{ messages: Message[]; has_more: boolean }> {
      const headers = await getAuthHeaders()
      const params = new URLSearchParams()
      if (opts?.limit) params.set('limit', String(opts.limit))
      if (opts?.before) params.set('before', opts.before)
      const q = params.toString() ? `?${params}` : ''
      const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages${q}`, { headers })
      return handleResponse<{ messages: Message[]; has_more: boolean }>(res)
    },
    async sendMessage(conversationId: string, body: string): Promise<Message> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ body }),
      })
      return handleResponse<Message>(res)
    },
    async markRead(conversationId: string): Promise<void> {
      const headers = await getAuthHeaders()
      await fetch(`${API_BASE}/conversations/${conversationId}/read`, { method: 'POST', headers })
    },
    async getUnreadCount(): Promise<{ count: number }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/conversations/unread-count`, { headers })
      return handleResponse<{ count: number }>(res)
    },
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
