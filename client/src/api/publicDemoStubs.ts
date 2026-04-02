/**
 * Public demo API responses — imported by client.ts when isPublicDemo().
 * Coverage: dashboard, schedule, projects CRUD-shaped no-ops, documents, contractors stub.
 */
import { isPublicDemo, DEMO_PM_USER_ID } from '@/lib/publicDemo'
import {
  getMockProjectDetail,
  isMockProjectId,
  MOCK_PROJECTS,
  DEMO_PROJECT_ID,
} from '@/data/mockProjectsData'
import {
  DEMO_KPIS,
  DEMO_ALERTS,
  DEMO_CLOCKED_IN,
  getDemoDashboardProjects,
  getDemoScheduleForDate,
  getDemoScheduleDays,
  DEMO_CONVERSATIONS,
} from '@/data/demo/dashboardFixtures'
import { getDemoDailyLogsForProject } from '@/data/demo/dailyLogFixtures'
import type {
  DashboardAlert,
  DashboardKpis,
  ClockedInEntry,
  DashboardProject,
  ConversationListItem,
  Message,
  DocumentViewerResponse,
} from '@/api/client'
import type {
  Project,
  Phase,
  Milestone,
  ProjectTask,
  JobWalkMedia,
  Subcontractor,
  BidSheet,
  ProjectBuildPlan,
  BidDocument,
  PaperTrailDocument,
  BudgetLineItem,
  BudgetSummary,
  ChangeOrder,
  ProjectActivityItem,
  ProjectWorkType,
  Contractor,
  ScheduleItem,
  Employee,
  JobAssignment,
  DailyLogRow,
  TradePackage,
  MaterialList,
} from '@/types/global'

export function demoActive(): boolean {
  return isPublicDemo()
}

function pid(id: string): string {
  return isMockProjectId(id) ? id : DEMO_PROJECT_ID
}

function demoTasks(projectId: string): ProjectTask[] {
  const { milestones } = getMockProjectDetail(pid(projectId))
  return milestones.slice(0, 6).map((m, i) => ({
    id: `task-${projectId}-${m.id}`,
    project_id: projectId,
    phase_id: m.phase_id,
    title: m.title,
    start_date: m.due_date,
    end_date: m.due_date,
    completed: m.completed,
    order: i,
  }))
}

const DEMO_PLAN_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'

const demoWorkTypes = (projectId: string): ProjectWorkType[] => [
  {
    id: 'wt-labor',
    project_id: projectId,
    name: 'General Labor',
    description: 'Site labor',
    rate: 45,
    unit: 'hr',
    type_key: 'labor',
  },
  {
    id: 'wt-framing',
    project_id: projectId,
    name: 'Framing',
    description: 'Rough carpentry',
    rate: 52,
    unit: 'hr',
    type_key: 'labor',
  },
]

export const publicDemoApi = {
  getSchedule(date: string): Promise<ScheduleItem[]> {
    return Promise.resolve(getDemoScheduleForDate(date))
  },
  getScheduleDays(month: string): Promise<{ dates: string[] }> {
    return Promise.resolve({ dates: getDemoScheduleDays(month) })
  },
  dashboard: {
    getAlerts(): Promise<DashboardAlert[]> {
      return Promise.resolve([...DEMO_ALERTS])
    },
    dismissAlert(_alert: DashboardAlert): Promise<void> {
      return Promise.resolve()
    },
    getDismissedAlerts(): Promise<import('@/api/client').DismissedAlert[]> {
      return Promise.resolve([])
    },
    getKpis(): Promise<DashboardKpis> {
      return Promise.resolve({ ...DEMO_KPIS })
    },
    getClockedIn(): Promise<ClockedInEntry[]> {
      return Promise.resolve([...DEMO_CLOCKED_IN])
    },
    getProjects(): Promise<DashboardProject[]> {
      return Promise.resolve(getDemoDashboardProjects())
    },
  },
  conversations: {
    list(): Promise<ConversationListItem[]> {
      return Promise.resolve([...DEMO_CONVERSATIONS])
    },
    findOrCreate(_otherUserId: string): Promise<{ id: string; created_at: string; updated_at: string }> {
      const t = new Date().toISOString()
      return Promise.resolve({ id: 'demo-conv-new', created_at: t, updated_at: t })
    },
    create(_participantIds: string[]): Promise<{ id: string; created_at: string; updated_at: string }> {
      const t = new Date().toISOString()
      return Promise.resolve({ id: 'demo-conv-grp', created_at: t, updated_at: t })
    },
    getOrCreateForJob(jobId: string): Promise<{
      id: string
      created_at: string
      updated_at: string
      job_id: string
      job_name: string
    }> {
      const t = new Date().toISOString()
      const p = MOCK_PROJECTS.find((x) => x.id === jobId)
      return Promise.resolve({
        id: `demo-job-chat-${jobId}`,
        created_at: t,
        updated_at: t,
        job_id: jobId,
        job_name: p?.name ?? 'Job',
      })
    },
    getMessages(
      _conversationId: string,
      _opts?: { limit?: number; before?: string }
    ): Promise<{ messages: Message[]; has_more: boolean }> {
      return Promise.resolve({
        messages: [
          {
            id: 'dm1',
            conversation_id: 'demo-conv-1',
            sender_id: DEMO_PM_USER_ID,
            body: 'Thanks — we will confirm delivery Thursday.',
            created_at: new Date().toISOString(),
          },
        ],
        has_more: false,
      })
    },
    sendMessage(conversationId: string, body: string): Promise<Message> {
      return Promise.resolve({
        id: `dm-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: DEMO_PM_USER_ID,
        body,
        created_at: new Date().toISOString(),
      })
    },
    markRead(): Promise<void> {
      return Promise.resolve()
    },
    getUnreadCount(): Promise<{ count: number }> {
      return Promise.resolve({ count: 1 })
    },
  },
  projects: {
    list(): Promise<DashboardProject[]> {
      return Promise.resolve(getDemoDashboardProjects())
    },
    async get(id: string): Promise<Project> {
      return getMockProjectDetail(pid(id)).project
    },
    create(body: Partial<Project>): Promise<Project> {
      const t = new Date().toISOString()
      return Promise.resolve({
        id: `demo-new-${Date.now()}`,
        name: body.name ?? 'New project',
        status: body.status ?? 'planning',
        scope: body.scope ?? '',
        created_at: t,
        updated_at: t,
      })
    },
    update(id: string, body: Partial<Project>): Promise<Project> {
      const base = getMockProjectDetail(pid(id)).project
      return Promise.resolve({ ...base, ...body, id: base.id })
    },
    seedBudgetFromEstimate(): Promise<{ ok: boolean }> {
      return Promise.resolve({ ok: true })
    },
    delete(): Promise<void> {
      return Promise.resolve()
    },
    getPhases(id: string): Promise<Phase[]> {
      return Promise.resolve(getMockProjectDetail(pid(id)).phases)
    },
    createPhase(projectId: string, body: Partial<Phase>): Promise<Phase> {
      return Promise.resolve({
        id: `ph-new-${Date.now()}`,
        project_id: projectId,
        name: body.name ?? 'Phase',
        start_date: body.start_date ?? new Date().toISOString().slice(0, 10),
        end_date: body.end_date ?? new Date().toISOString().slice(0, 10),
        order: body.order ?? 0,
      })
    },
    updatePhase(projectId: string, phaseId: string, body: Partial<Phase>): Promise<Phase> {
      const phases = getMockProjectDetail(pid(projectId)).phases
      const p = phases.find((x) => x.id === phaseId) ?? phases[0]
      return Promise.resolve({ ...p, ...body })
    },
    deletePhase(): Promise<void> {
      return Promise.resolve()
    },
    getMilestones(id: string): Promise<Milestone[]> {
      return Promise.resolve(getMockProjectDetail(pid(id)).milestones)
    },
    createMilestone(projectId: string, body: Partial<Milestone>): Promise<Milestone> {
      return Promise.resolve({
        id: `ms-new-${Date.now()}`,
        project_id: projectId,
        phase_id: body.phase_id,
        title: body.title ?? 'Milestone',
        due_date: body.due_date ?? new Date().toISOString().slice(0, 10),
        completed: body.completed ?? false,
      })
    },
    updateMilestone(projectId: string, milestoneId: string, body: Partial<Milestone>): Promise<Milestone> {
      const ms = getMockProjectDetail(pid(projectId)).milestones
      const m = ms.find((x) => x.id === milestoneId) ?? ms[0]
      return Promise.resolve({ ...m, ...body })
    },
    deleteMilestone(): Promise<void> {
      return Promise.resolve()
    },
    getTasks(id: string): Promise<ProjectTask[]> {
      return Promise.resolve(demoTasks(pid(id)))
    },
    createTask(projectId: string, body: Partial<ProjectTask>): Promise<ProjectTask> {
      return Promise.resolve({
        id: `task-new-${Date.now()}`,
        project_id: projectId,
        phase_id: body.phase_id,
        title: body.title ?? 'Task',
        responsible: body.responsible,
        start_date: body.start_date ?? new Date().toISOString().slice(0, 10),
        end_date: body.end_date ?? new Date().toISOString().slice(0, 10),
        duration_weeks: body.duration_weeks,
        order: body.order,
        completed: body.completed ?? false,
      })
    },
    updateTask(projectId: string, taskId: string, body: Partial<ProjectTask>): Promise<ProjectTask> {
      const tasks = demoTasks(pid(projectId))
      const t = tasks.find((x) => x.id === taskId) ?? tasks[0]
      return Promise.resolve({ ...t, ...body })
    },
    deleteTask(): Promise<void> {
      return Promise.resolve()
    },
    getMedia(id: string): Promise<JobWalkMedia[]> {
      return Promise.resolve(getMockProjectDetail(pid(id)).media)
    },
    uploadMedia(): Promise<JobWalkMedia> {
      throw new Error('Demo mode: upload is disabled.')
    },
    deleteMedia(): Promise<void> {
      return Promise.resolve()
    },
    getDailyLogFieldData(id: string): Promise<{ assignments: JobAssignment[]; employees: Employee[]; phases: Phase[] }> {
      const phases = getMockProjectDetail(pid(id)).phases
      return Promise.resolve({ assignments: [], employees: [], phases })
    },
    getDailyLogs(projectId: string): Promise<DailyLogRow[]> {
      return Promise.resolve(getDemoDailyLogsForProject(projectId))
    },
    createDailyLog(projectId: string, body: { log_date: string }): Promise<DailyLogRow> {
      const now = new Date().toISOString()
      return Promise.resolve({
        id: `dl-${Date.now()}`,
        project_id: projectId,
        log_date: body.log_date,
        weather: null,
        temperature: null,
        crew_count: 0,
        crew_present: [],
        work_summary: null,
        phase_id: null,
        materials: [],
        issues: [],
        visitor_log: [],
        notes: null,
        created_by: null,
        locked_at: null,
        created_at: now,
        updated_at: now,
      })
    },
    patchDailyLog(): Promise<DailyLogRow> {
      return publicDemoApi.projects.createDailyLog(DEMO_PROJECT_ID, { log_date: new Date().toISOString().slice(0, 10) })
    },
    deleteDailyLog(): Promise<void> {
      return Promise.resolve()
    },
    getBuildPlans(): Promise<ProjectBuildPlan[]> {
      return Promise.resolve([])
    },
    uploadBuildPlan(): Promise<ProjectBuildPlan> {
      throw new Error('Demo mode: upload is disabled.')
    },
    getBuildPlanViewUrl(_projectId: string, _planId: string): Promise<{ url: string }> {
      return Promise.resolve({ url: DEMO_PLAN_URL })
    },
    deleteBuildPlan(): Promise<void> {
      return Promise.resolve()
    },
    getBidDocuments(): Promise<BidDocument[]> {
      return Promise.resolve([])
    },
    uploadBidDocument(): Promise<BidDocument> {
      throw new Error('Demo mode: upload is disabled.')
    },
    getBidDocumentViewUrl(): Promise<{ url: string }> {
      return Promise.resolve({ url: DEMO_PLAN_URL })
    },
    deleteBidDocument(): Promise<void> {
      return Promise.resolve()
    },
    getDocuments(): Promise<PaperTrailDocument[]> {
      return Promise.resolve([])
    },
    getBudget(id: string): Promise<{
      items: BudgetLineItem[]
      summary: BudgetSummary
      labor_actual_from_time_entries?: number
      subs_actual_from_bid_sheet?: number
      approved_change_orders_total?: number
    }> {
      const b = getMockProjectDetail(pid(id)).budget
      return Promise.resolve({
        items: b.items as BudgetLineItem[],
        summary: b.summary as BudgetSummary,
        labor_actual_from_time_entries: 0,
        subs_actual_from_bid_sheet: 0,
        approved_change_orders_total: 0,
      })
    },
    updateBudget(projectId: string, items: BudgetLineItem[]): Promise<{ items: BudgetLineItem[]; summary: BudgetSummary }> {
      return publicDemoApi.projects.getBudget(projectId).then((r) => ({ items, summary: r.summary }))
    },
    getChangeOrders(): Promise<ChangeOrder[]> {
      return Promise.resolve([])
    },
    createChangeOrder(
      projectId: string,
      body: { description: string; amount: number; status: 'Approved' | 'Pending'; date: string; category: string }
    ): Promise<ChangeOrder> {
      return Promise.resolve({
        id: `co-${Date.now()}`,
        project_id: projectId,
        description: body.description,
        amount: body.amount,
        status: body.status,
        date: body.date,
        category: body.category,
        created_at: new Date().toISOString(),
      })
    },
    updateChangeOrder(
      projectId: string,
      _coId: string,
      body: Partial<{ description: string; amount: number; status: 'Approved' | 'Pending'; date: string; category: string }>
    ): Promise<ChangeOrder> {
      return publicDemoApi.projects.createChangeOrder(projectId, {
        description: body.description ?? 'Change order',
        amount: body.amount ?? 0,
        status: body.status ?? 'Pending',
        date: body.date ?? new Date().toISOString().slice(0, 10),
        category: body.category ?? 'Other',
      })
    },
    deleteChangeOrder(): Promise<void> {
      return Promise.resolve()
    },
    sendChangeOrderToClient(): Promise<{ estimate_id: string; portal_url: string; recipient_emails: string[] }> {
      return Promise.resolve({
        estimate_id: 'est-demo',
        portal_url: 'https://example.com/demo',
        recipient_emails: [],
      })
    },
    getTrades(): Promise<{ key: string; label: string; csiDivision: string }[]> {
      return Promise.resolve([
        { key: 'framing', label: 'Framing', csiDivision: '06' },
        { key: 'electrical', label: 'Electrical', csiDivision: '26' },
      ])
    },
    launchTakeoff(
      projectId: string,
      _file: File,
      _planType?: string,
      _tradeFilter?: null | string | string[]
    ): Promise<{ id: string; material_list: MaterialList; created_at?: string; truncated?: boolean }> {
      const t = getMockProjectDetail(pid(projectId)).takeoffs[0]
      return Promise.resolve({
        id: `toff-${Date.now()}`,
        material_list: t.material_list as MaterialList,
        created_at: new Date().toISOString(),
      })
    },
    getTakeoffs(id: string): Promise<{ id: string; material_list: MaterialList; created_at: string }[]> {
      return Promise.resolve(
        getMockProjectDetail(pid(id)).takeoffs.map((x) => ({
          id: x.id,
          material_list: x.material_list as MaterialList,
          created_at: x.created_at,
        }))
      )
    },
    getActivity(): Promise<ProjectActivityItem[]> {
      return Promise.resolve([])
    },
    getSubcontractors(id: string): Promise<Subcontractor[]> {
      return Promise.resolve(getMockProjectDetail(pid(id)).subcontractors)
    },
    createSubcontractor(projectId: string, body: Partial<Subcontractor>): Promise<Subcontractor> {
      return Promise.resolve({
        id: `sub-${Date.now()}`,
        project_id: projectId,
        name: body.name ?? 'Sub',
        trade: body.trade ?? 'General',
        email: body.email ?? 'sub@example.com',
        phone: body.phone,
      } as Subcontractor)
    },
    async createSubcontractorWithPortalInvite(
      projectId: string,
      body: { name: string; trade: string; email?: string; phone?: string }
    ): Promise<{
      subcontractor: Subcontractor
      portal_url: string
      sub_bid_id: string
      email_sent: boolean
    }> {
      const sub = await publicDemoApi.projects.createSubcontractor(projectId, body)
      return {
        subcontractor: sub,
        portal_url: 'https://example.com/bid/demo',
        sub_bid_id: `sb-${Date.now()}`,
        email_sent: false,
      }
    },
    updateSubcontractor(projectId: string, subId: string, body: Partial<Subcontractor>): Promise<Subcontractor> {
      const subs = getMockProjectDetail(pid(projectId)).subcontractors
      const s = subs.find((x) => x.id === subId) ?? subs[0]
      return Promise.resolve({ ...s, ...body })
    },
    deleteSubcontractor(): Promise<void> {
      return Promise.resolve()
    },
    getWorkTypes(id: string): Promise<ProjectWorkType[]> {
      return Promise.resolve(demoWorkTypes(pid(id)))
    },
    createWorkType(projectId: string, body: Partial<ProjectWorkType>): Promise<ProjectWorkType> {
      return Promise.resolve({
        id: `wt-${Date.now()}`,
        project_id: projectId,
        name: body.name ?? 'Work type',
        description: body.description,
        rate: body.rate ?? 40,
        unit: body.unit ?? 'hr',
        type_key: body.type_key,
        custom_color: body.custom_color,
      })
    },
    updateWorkType(projectId: string, wtId: string, body: Partial<ProjectWorkType>): Promise<ProjectWorkType> {
      const w = demoWorkTypes(projectId).find((x) => x.id === wtId) ?? demoWorkTypes(projectId)[0]
      return Promise.resolve({ ...w, ...body })
    },
    deleteWorkType(): Promise<void> {
      return Promise.resolve()
    },
    bulkSendSubcontractors(): Promise<{ ok: boolean }> {
      return Promise.resolve({ ok: true })
    },
    getBidSheet(id: string): Promise<BidSheet> {
      return Promise.resolve(getMockProjectDetail(pid(id)).bidSheet)
    },
    updateBidSheet(id: string, data: Partial<BidSheet>): Promise<BidSheet> {
      const b = getMockProjectDetail(pid(id)).bidSheet
      return Promise.resolve({ ...b, ...data })
    },
    dispatchBid(): Promise<{ token: string; portal_url: string }> {
      return Promise.resolve({ token: 'demo-bid-token', portal_url: 'https://example.com/bid/demo' })
    },
    resendBid(): Promise<{ ok: boolean; portal_url?: string }> {
      return Promise.resolve({ ok: true, portal_url: 'https://example.com/bid' })
    },
    setSubBidAwarded(): Promise<{ ok: boolean }> {
      return Promise.resolve({ ok: true })
    },
    deleteSubBid(): Promise<void> {
      return Promise.resolve()
    },
    setGcSelfPerform(
      projectId: string,
      _body: unknown
    ): Promise<{ trade_package: TradePackage }> {
      const b = getMockProjectDetail(pid(projectId)).bidSheet
      const tp = b.trade_packages[0]
      return Promise.resolve({ trade_package: tp as TradePackage })
    },
  },
  documents: {
    list(): Promise<{ documents: PaperTrailDocument[]; total_count: number; storage_bytes_estimate: number }> {
      return Promise.resolve({ documents: [], total_count: 0, storage_bytes_estimate: 0 })
    },
    update(id: string): Promise<PaperTrailDocument> {
      const now = new Date().toISOString()
      return Promise.resolve({
        id,
        organization_id: 'demo-org',
        project_id: DEMO_PROJECT_ID,
        document_type: 'estimate',
        title: 'Demo doc',
        status: 'sent',
        total_amount: null,
        client_name: null,
        client_email: null,
        token: null,
        source_id: null,
        file_url: null,
        sent_at: now,
        viewed_at: null,
        actioned_at: null,
        created_at: now,
        archived_at: null,
        metadata: null,
      })
    },
    getViewer(id: string): Promise<DocumentViewerResponse> {
      const now = new Date().toISOString()
      return Promise.resolve({
        document: {
          id,
          organization_id: 'demo-org',
          project_id: DEMO_PROJECT_ID,
          project_name: 'Riverside Commercial',
          document_type: 'estimate',
          title: 'Demo document',
          status: 'sent',
          total_amount: 15000,
          client_name: 'Summit Construction',
          client_email: 'client@example.com',
          token: 'demo',
          source_id: 'src-1',
          file_url: DEMO_PLAN_URL,
          sent_at: now,
          viewed_at: null,
          actioned_at: null,
          created_at: now,
          archived_at: null,
          metadata: null,
        },
        viewer: {
          type: 'generic',
          data: {
            title: 'Demo document',
            document_type: 'estimate',
            status: 'sent',
            total_amount: 15000,
            metadata: {},
          },
        },
      })
    },
    resend(): Promise<{ ok: boolean }> {
      return Promise.resolve({ ok: true })
    },
    backfill(): Promise<{
      estimates: number
      invoices: number
      bid_packages: number
      demo: number
      errors: string[]
    }> {
      return Promise.resolve({ estimates: 0, invoices: 0, bid_packages: 0, demo: 0, errors: [] })
    },
  },
  contractors: {
    list(): Promise<Contractor[]> {
      return Promise.resolve([
        { id: 'c1', name: 'ABC Electrical', trade: 'Electrical', email: 'bids@abcelectrical.com', phone: '(555) 111-2222' },
        { id: 'c2', name: 'Quality Plumbing', trade: 'Plumbing', email: 'est@qualityplumb.com' },
      ])
    },
    create(body: { name: string; trade: string; email: string; phone?: string }): Promise<Contractor> {
      return Promise.resolve({
        id: `c-${Date.now()}`,
        name: body.name,
        trade: body.trade,
        email: body.email,
        phone: body.phone,
      })
    },
    update(id: string, body: Partial<Contractor>): Promise<Contractor> {
      return Promise.resolve({ id, name: body.name ?? 'Contractor', trade: body.trade ?? 'General', email: body.email ?? '' })
    },
    delete(): Promise<void> {
      return Promise.resolve()
    },
  },
  support: {
    create(): Promise<{ id: string }> {
      return Promise.resolve({ id: `demo-support-${Date.now()}` })
    },
    list(): Promise<{ messages: import('@/api/client').SupportMessage[] }> {
      return Promise.resolve({ messages: [] })
    },
    update(): Promise<import('@/api/client').SupportMessage> {
      return Promise.resolve({} as import('@/api/client').SupportMessage)
    },
    getNewCount(): Promise<{ count: number }> {
      return Promise.resolve({ count: 0 })
    },
  },
}
