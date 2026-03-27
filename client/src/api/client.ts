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
  PaperTrailDocument,
  Subcontractor,
  ProjectWorkType,
  ProjectActivityItem,
  Contractor,
  BidSheet,
  MaterialList as GlobalMaterialList,
  ScheduleItem,
  DailyLogRow,
  Employee,
  JobAssignment,
} from '@/types/global'
import { API_BASE } from '@/api/config'
import { getSessionAuthHeaders } from '@/api/authHeaders'

async function getAuthHeaders(): Promise<HeadersInit> {
  return getSessionAuthHeaders()
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
  client_email?: string | null
  client_phone?: string | null
  plan_type?: ProjectPlanType | null
  /** Paper-trail documents linked to this project (dashboard list). */
  document_count?: number
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

export interface SupportMessage {
  id: string
  organization_id: string | null
  user_id: string | null
  user_name: string | null
  user_email: string | null
  type: string
  subject: string | null
  message: string
  page_url: string | null
  page_title: string | null
  status: string
  priority: string
  admin_notes: string | null
  replied_at: string | null
  resolved_at: string | null
  created_at: string
  metadata: Record<string, unknown> | null
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
      client_email?: string
      client_phone?: string
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
    async update(
      id: string,
      body: Partial<
        Pick<
          Project,
          | 'name'
          | 'status'
          | 'scope'
          | 'address_line_1'
          | 'address_line_2'
          | 'city'
          | 'state'
          | 'postal_code'
          | 'expected_start_date'
          | 'expected_end_date'
          | 'estimated_value'
          | 'assigned_to_name'
          | 'client_email'
          | 'client_phone'
          | 'plan_type'
        >
      >
    ): Promise<Project> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Project>(res)
    },
    /**
     * Re-apply budget from accepted estimate (groups meta). Idempotent; optional estimate_id targets a specific accepted estimate.
     */
    async seedBudgetFromEstimate(
      projectId: string,
      options?: { estimateId?: string }
    ): Promise<{ ok: boolean; estimate_id?: string; skipped?: boolean; reason?: string }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/seed-budget-from-estimate`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(options?.estimateId ? { estimate_id: options.estimateId } : {}),
      })
      return handleResponse<{ ok: boolean; estimate_id?: string; skipped?: boolean; reason?: string }>(res)
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
    async uploadMedia(
      projectId: string,
      file: File,
      uploader_name?: string,
      caption?: string,
      opts?: { log_date?: string }
    ): Promise<JobWalkMedia> {
      const headers = await getAuthHeaders()
      const form = new FormData()
      form.append('file', file)
      if (uploader_name) form.append('uploader_name', uploader_name)
      if (caption) form.append('caption', caption)
      if (opts?.log_date) form.append('log_date', opts.log_date)
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
    async getDailyLogFieldData(projectId: string): Promise<{
      assignments: JobAssignment[]
      employees: Employee[]
      phases: Phase[]
    }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/daily-log-field-data`, { headers })
      return handleResponse<{ assignments: JobAssignment[]; employees: Employee[]; phases: Phase[] }>(res)
    },
    async getDailyLogs(projectId: string): Promise<DailyLogRow[]> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/daily-logs`, { headers })
      return handleResponse<DailyLogRow[]>(res)
    },
    async createDailyLog(projectId: string, body: { log_date: string }): Promise<DailyLogRow> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/daily-logs`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<DailyLogRow>(res)
    },
    async patchDailyLog(
      projectId: string,
      logId: string,
      body: Record<string, unknown>
    ): Promise<DailyLogRow> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/daily-logs/${logId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<DailyLogRow>(res)
    },
    async deleteDailyLog(projectId: string, logId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/daily-logs/${logId}`, {
        method: 'DELETE',
        headers,
      })
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
    async getDocuments(projectId: string, opts?: { show_archived?: boolean }): Promise<PaperTrailDocument[]> {
      const headers = await getAuthHeaders()
      const sp = new URLSearchParams()
      sp.set('_', String(Date.now()))
      if (opts?.show_archived) sp.set('show_archived', '1')
      const res = await fetch(`${API_BASE}/projects/${projectId}/documents?${sp.toString()}`, {
        headers,
        cache: 'no-store',
      })
      return handleResponse<PaperTrailDocument[]>(res)
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
    async sendChangeOrderToClient(
      projectId: string,
      coId: string,
      body?: {
        recipient_emails?: string[]
        client_name?: string
        gc_name?: string
      }
    ): Promise<{
      estimate_id: string
      portal_url: string
      recipient_emails: string[]
    }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/change-orders/${coId}/send`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body || {}),
      })
      return handleResponse<{
        estimate_id: string
        portal_url: string
        recipient_emails: string[]
      }>(res)
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
    async createSubcontractor(
      projectId: string,
      body: {
        name: string
        trade: string
        email?: string
        phone?: string
        dispatch_portal?: boolean
        response_deadline?: string | null
      }
    ): Promise<Subcontractor> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/subcontractors`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<Subcontractor>(res)
    },
    /** Create subcontractor + portal bid, token, and email (if email provided). */
    async createSubcontractorWithPortalInvite(
      projectId: string,
      body: { name: string; trade: string; email?: string; phone?: string }
    ): Promise<{
      subcontractor: Subcontractor
      portal_url: string
      sub_bid_id: string
      email_sent: boolean
    }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/subcontractors`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({
          ...body,
          email: body.email?.trim() ?? '',
          dispatch_portal: true,
        }),
      })
      return handleResponse(res)
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
    /** Dispatch a bid to a subcontractor: generates portal token, stores it, and returns the portal URL (email sent/logged server-side). */
    async dispatchBid(
      projectId: string,
      body: {
        trade_package_id: string
        subcontractor_id: string
        amount?: number
        notes?: string
        /** ISO date string; omit to leave unchanged on re-dispatch */
        response_deadline?: string | null
      }
    ): Promise<{ token: string; portal_url: string }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-sheet/dispatch`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<{ token: string; portal_url: string }>(res)
    },
    /** Resend portal link email for a sub bid. */
    async resendBid(projectId: string, subBidId: string): Promise<{ ok: boolean; portal_url?: string }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-sheet/resend`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ sub_bid_id: subBidId }),
      })
      return handleResponse<{ ok: boolean; portal_url?: string }>(res)
    },
    async setSubBidAwarded(projectId: string, subBidId: string, awarded: boolean): Promise<{ ok: boolean }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-sheet/sub-bids/${subBidId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ awarded }),
      })
      return handleResponse<{ ok: boolean }>(res)
    },
    async deleteSubBid(projectId: string, subBidId: string): Promise<void> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-sheet/sub-bids/${subBidId}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || res.statusText)
      }
    },
    /** GC self-performs a trade scope with estimate line items (creates trade package if needed). Pass gc_self_perform false to clear. */
    async setGcSelfPerform(
      projectId: string,
      body: {
        trade_tag: string
        gc_self_perform: boolean
        estimate_lines: { description: string; quantity: number; unit: string; unit_price: number }[]
      }
    ): Promise<{ trade_package: import('@/types/global').TradePackage }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/projects/${projectId}/bid-sheet/gc-self-perform`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse(res)
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

  /** Paper trail: all organization documents (filters, archive, re-link to project). */
  documents: {
    async list(params?: {
      q?: string
      document_type?: string
      status?: string
      date_from?: string
      date_to?: string
      project_id?: string
      show_archived?: boolean
    }): Promise<{ documents: PaperTrailDocument[]; total_count: number; storage_bytes_estimate: number }> {
      const headers = await getAuthHeaders()
      const sp = new URLSearchParams()
      if (params?.q?.trim()) sp.set('q', params.q.trim())
      if (params?.document_type && params.document_type !== 'all') sp.set('document_type', params.document_type)
      if (params?.status && params.status !== 'all') sp.set('status', params.status)
      if (params?.date_from?.trim()) sp.set('date_from', params.date_from.trim())
      if (params?.date_to?.trim()) sp.set('date_to', params.date_to.trim())
      if (params?.project_id && params.project_id !== 'all') sp.set('project_id', params.project_id)
      if (params?.show_archived) sp.set('show_archived', '1')
      const q = sp.toString()
      const res = await fetch(`${API_BASE}/documents${q ? `?${q}` : ''}`, { headers, cache: 'no-store' })
      return handleResponse<{ documents: PaperTrailDocument[]; total_count: number; storage_bytes_estimate: number }>(
        res
      )
    },
    async update(
      id: string,
      body: { archived?: boolean; project_id?: string | null }
    ): Promise<PaperTrailDocument> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<PaperTrailDocument>(res)
    },
    async getViewer(id: string): Promise<DocumentViewerResponse> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, { headers, cache: 'no-store' })
      return handleResponse<DocumentViewerResponse>(res)
    },
    async resend(id: string): Promise<{ ok: boolean; portal_url?: string; emailed?: boolean }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}/resend`, {
        method: 'POST',
        headers,
      })
      return handleResponse<{ ok: boolean; portal_url?: string; emailed?: boolean }>(res)
    },
    /** Insert missing paper-trail rows from sent estimates / invoices / dispatched bids; optional demo receipt when empty. */
    async backfill(options?: { demo?: boolean }): Promise<{
      estimates: number
      invoices: number
      bid_packages: number
      demo: number
      errors: string[]
    }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/documents/backfill`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ demo: options?.demo !== false }),
      })
      return handleResponse<{
        estimates: number
        invoices: number
        bid_packages: number
        demo: number
        errors: string[]
      }>(res)
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

  /** In-app support messages (authenticated). Admin list/update hit /api/admin/support. */
  support: {
    async create(data: {
      type: string
      message: string
      page_url: string
      page_title: string
      metadata?: Record<string, unknown>
    }): Promise<{ id: string }> {
      const headers = await getAuthHeaders()
      const body: Record<string, unknown> = {
        type: data.type,
        message: data.message,
        page_url: data.page_url,
        page_title: data.page_title,
      }
      if (data.metadata && Object.keys(data.metadata).length > 0) {
        body.metadata = data.metadata
      }
      const res = await fetch(`${API_BASE}/support`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(body),
      })
      return handleResponse<{ id: string }>(res)
    },

    async list(filters?: { status?: string; type?: string; q?: string }): Promise<{ messages: SupportMessage[] }> {
      const headers = await getAuthHeaders()
      const sp = new URLSearchParams()
      if (filters?.status && filters.status !== 'all') sp.set('status', filters.status)
      if (filters?.type && filters.type !== 'all') sp.set('type', filters.type)
      if (filters?.q?.trim()) sp.set('q', filters.q.trim())
      const q = sp.toString()
      const res = await fetch(`${API_BASE}/admin/support${q ? `?${q}` : ''}`, { headers })
      return handleResponse<{ messages: SupportMessage[] }>(res)
    },

    async update(
      id: string,
      data: { status?: string; priority?: string; admin_notes?: string }
    ): Promise<SupportMessage> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/admin/support/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify(data),
      })
      return handleResponse<SupportMessage>(res)
    },

    async getNewCount(): Promise<{ count: number }> {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/admin/support/new-count`, { headers })
      return handleResponse<{ count: number }>(res)
    },
  },

  /** Public bid portal (no auth) — token-gated. */
  bids: {
    async getPortal(token: string): Promise<BidPortalResponse> {
      const res = await fetch(`${API_BASE}/bids/portal/${encodeURIComponent(token)}`)
      if (res.status === 410) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || 'This project has been cancelled.')
      }
      return handleResponse<BidPortalResponse>(res)
    },
    async markViewed(token: string): Promise<void> {
      const res = await fetch(`${API_BASE}/bids/portal/${encodeURIComponent(token)}/viewed`, { method: 'PATCH' })
      if (!res.ok) throw new Error(res.status === 404 ? 'Invalid or expired link' : 'Request failed')
    },
    async submitBid(token: string, payload: { amount: number; notes?: string; availability?: string; quoteFile?: File }): Promise<void> {
      const form = new FormData()
      form.append('amount', String(payload.amount))
      if (payload.notes != null) form.append('notes', payload.notes)
      if (payload.availability != null) form.append('availability', payload.availability)
      if (payload.quoteFile) form.append('quoteFile', payload.quoteFile)
      const res = await fetch(`${API_BASE}/bids/portal/${encodeURIComponent(token)}/respond`, {
        method: 'POST',
        body: form,
      })
      return handleResponse(res)
    },
    async declineBid(token: string): Promise<void> {
      const res = await fetch(`${API_BASE}/bids/portal/${encodeURIComponent(token)}/decline`, { method: 'POST' })
      return handleResponse(res)
    },
  },

  /** Public estimate portal (no auth) — token-gated. */
  estimatePortal: {
    async get(token: string): Promise<EstimatePortalResponse> {
      const res = await fetch(`${API_BASE}/estimates/portal/${encodeURIComponent(token)}`)
      return handleResponse<EstimatePortalResponse>(res)
    },
    async markViewed(token: string): Promise<void> {
      const res = await fetch(`${API_BASE}/estimates/portal/${encodeURIComponent(token)}/viewed`, { method: 'PATCH' })
      if (!res.ok && res.status !== 204) throw new Error(res.status === 404 ? 'Invalid or expired link' : 'Request failed')
    },
    async approve(token: string): Promise<{ status: string }> {
      const res = await fetch(`${API_BASE}/estimates/portal/${encodeURIComponent(token)}/approve`, { method: 'POST' })
      return handleResponse<{ status: string }>(res)
    },
    async requestChanges(token: string, message: string): Promise<{ ok: boolean }> {
      const res = await fetch(`${API_BASE}/estimates/portal/${encodeURIComponent(token)}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      return handleResponse<{ ok: boolean }>(res)
    },
    async decline(token: string): Promise<{ status: string }> {
      const res = await fetch(`${API_BASE}/estimates/portal/${encodeURIComponent(token)}/decline`, { method: 'POST' })
      return handleResponse<{ status: string }>(res)
    },
  },

  /** Public invoice portal (no auth) — token-gated; milestone schedule for progress invoices. */
  invoicePortal: {
    async get(token: string): Promise<InvoicePortalResponse> {
      const res = await fetch(`${API_BASE}/invoices/portal/${encodeURIComponent(token)}`)
      return handleResponse<InvoicePortalResponse>(res)
    },
    async markViewed(token: string): Promise<void> {
      const res = await fetch(`${API_BASE}/invoices/portal/${encodeURIComponent(token)}/viewed`, { method: 'PATCH' })
      if (!res.ok && res.status !== 204) throw new Error(res.status === 404 ? 'Invalid or expired link' : 'Request failed')
    },
  },
}

export type InvoicePortalScheduleStatus = 'upcoming' | 'due_now' | 'paid'

export interface InvoicePortalScheduleRow {
  milestone_id: string
  label: string
  amount: number
  mode: 'specific_date' | 'on_completion'
  specific_date: string | null
  completion_terms: string | null
  due_display: string
  status: InvoicePortalScheduleStatus
}

export interface InvoicePortalResponse {
  invoice_id: string
  estimate_id?: string | null
  job_id?: string | null
  status: string
  total_amount: number
  /** Sum of milestone amounts currently due (Due Now). */
  amount_due_now?: number
  due_date: string | null
  paid_at: string | null
  sent_at: string | null
  projectName: string
  address: string
  clientName: string | null
  gcName: string
  company: string | null
  invoice_kind: 'progress_series' | 'single'
  schedule_rows: InvoicePortalScheduleRow[]
  line_items: {
    id: string
    description: string
    quantity: number
    unit: string
    unit_price: number
    total: number
    section?: string | null
  }[]
  notes: string | null
  terms: string | null
}

export interface EstimatePortalResponse {
  estimate_id?: string
  estimate_number?: string
  /** Present from portal API: change-order sends use change_order */
  portal_document_kind?: 'estimate' | 'change_order'
  date_issued?: string | null
  expiry_date?: string | null
  projectName: string
  address: string
  clientName: string | null
  clientAddress?: string
  gcName: string
  company: string | null
  line_items: { id: string; description: string; quantity: number; unit: string; unit_price: number; total: number; section?: string | null }[]
  total: number
  invoiced_amount: number
  milestones: { label: string; amount: number; percentage?: number }[]
  notes: string | null
  terms: string | null
  section_notes?: {
    section: string
    gc_note: string | null
    sub_notes: { subcontractor: string; text: string }[]
  }[]
  /** Maps section header key → subcontractor | gc_self_perform | scope_detail */
  section_work_types?: Record<string, string>
  status: string
  sent_at: string | null
  viewed_at: string | null
  actioned_at?: string | null
  /** In-app viewer only: linked CO row when estimate was sent from change-order flow */
  source_change_order_id?: string | null
  /** When present, client table rolls up takeoff to scope lines and bids to trade/sub + total. */
  estimate_groups_meta?: unknown[] | null
}

export interface ChangeOrderViewerPayload {
  co_number_suffix: string
  title: string
  total_amount: number | null
  category: string | null
  unit: string | null
  source: string | null
  predicted: number | null
  actual: number | null
  project_name: string | null
  reference_estimate_number: string | null
  status: string | null
  created_at: string | null
}

export interface ReceiptViewerPayload {
  file_url: string | null
  title: string
  vendor: string | null
  date: string | null
  description: string | null
  category: string | null
  total_amount: number | null
}

export interface GenericDocumentViewerPayload {
  title: string
  document_type: string
  status: string | null | undefined
  total_amount: number | null | undefined
  metadata: Record<string, unknown>
}

export type DocumentViewerEnvelope =
  | {
      type: 'estimate'
      data: EstimatePortalResponse
      change_order_reference?: { description: string | null; amount: number | null; status: string | null } | null
    }
  | { type: 'invoice'; data: InvoicePortalResponse; overdue_days?: number | null }
  | { type: 'bid_package'; data: BidPortalResponse }
  | { type: 'change_order'; data: ChangeOrderViewerPayload }
  | { type: 'receipt'; data: ReceiptViewerPayload }
  | { type: 'generic'; data: GenericDocumentViewerPayload }

export interface DocumentViewerResponse {
  document: PaperTrailDocument & { project_name?: string | null }
  viewer: DocumentViewerEnvelope
}

export interface BidPortalScopeItem {
  description: string
  quantity: number
  unit: string
}

export interface BidPortalResponse {
  /** Canonical portal fields (snake_case) */
  project_name: string
  project_address: string
  gc_name: string | null
  /** Company contact email for scope questions (mailto); null if not configured */
  gc_email?: string | null
  trade_name: string
  sub_name: string
  dispatched_at: string | null
  /** ISO date when the GC expects a response; omitted or null if not set */
  response_deadline?: string | null
  /** Takeoff lines for this trade; may be omitted on older API responses */
  scope_items?: BidPortalScopeItem[]
  /** Legacy camelCase (mirrors snake_case where applicable) */
  projectName: string
  address: string
  tradeName: string
  scope: { description?: string; quantity?: number; unit?: string; notes?: string }[]
  subName: string
  status: string
  bid_amount?: number | null
  amount?: number | null
  notes: string | null
  availability?: string | null
  attachment_url?: string | null
  responded_at?: string | null
  /** In-app viewer: project was cancelled (public portal would 410) */
  project_cancelled?: boolean
}
