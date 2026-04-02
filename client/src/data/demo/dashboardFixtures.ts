/**
 * Shared dashboard demo fixtures: landing hero, live DashboardPage, and API stubs.
 */
import { dayjs } from '@/lib/date'
import type {
  DashboardAlert,
  DashboardKpis,
  ClockedInEntry,
  DashboardProject,
  ConversationListItem,
} from '@/api/client'
import type { ScheduleItem } from '@/types/global'
import { MOCK_PROJECTS, MOCK_PROJECT_CARD_DATA, DEMO_PROJECT_ID } from '@/data/mockProjectsData'
import { DEMO_EMPLOYEE_USER_UUID } from '@/data/demo/demoIds'

export const DEMO_KPIS: DashboardKpis = {
  totalRevenue: 284500,
  totalExpense: 198200,
  outstanding: 47800,
  openInvoicesCount: 3,
  activeJobs: 8,
  totalProjects: 12,
  revenueTrend: [40, 55, 70, 50, 85, 90, 75, 88, 82, 95, 90, 100],
  expenseTrend: [60, 65, 58, 72, 68, 75, 70, 78, 74, 80, 76, 82],
}

export const DEMO_ALERTS: DashboardAlert[] = [
  {
    id: 'demo-alert-1',
    type: 'invoice',
    urgency: 'medium',
    label: 'Invoice #1042 pending',
    sub: 'Riverside Commercial — client view opened',
    action: 'Review',
    entityId: 'inv-demo-1',
    entityType: 'invoice',
    jobId: DEMO_PROJECT_ID,
  },
]

export const DEMO_CLOCKED_IN: ClockedInEntry[] = [
  {
    employeeId: 'emp-mt',
    employeeName: 'Marcus T.',
    initials: 'MT',
    jobName: 'Riverside Commercial — Phase 4',
    jobId: DEMO_PROJECT_ID,
    clockIn: dayjs().subtract(3, 'hour').subtract(22, 'minute').toISOString(),
    clockInFormatted: dayjs().subtract(3, 'hour').subtract(22, 'minute').format('h:mm A'),
    hoursSoFar: 3.37,
  },
  {
    employeeId: DEMO_EMPLOYEE_USER_UUID,
    employeeName: 'Jamie K.',
    initials: 'JK',
    jobName: 'Riverside Commercial — Phase 4',
    jobId: DEMO_PROJECT_ID,
    clockIn: dayjs().subtract(2, 'hour').subtract(45, 'minute').toISOString(),
    clockInFormatted: dayjs().subtract(2, 'hour').subtract(45, 'minute').format('h:mm A'),
    hoursSoFar: 2.75,
  },
  {
    employeeId: 'emp-sc',
    employeeName: 'Sarah C.',
    initials: 'SC',
    jobName: 'Harbor View · Unit 12',
    jobId: 'mock-bath',
    clockIn: dayjs().subtract(1, 'hour').subtract(15, 'minute').toISOString(),
    clockInFormatted: dayjs().subtract(1, 'hour').subtract(15, 'minute').format('h:mm A'),
    hoursSoFar: 1.25,
  },
  {
    employeeId: 'emp-dl',
    employeeName: 'Drew L.',
    initials: 'DL',
    jobName: 'Riverside Commercial — Phase 4',
    jobId: DEMO_PROJECT_ID,
    clockIn: dayjs().subtract(4, 'hour').toISOString(),
    clockInFormatted: dayjs().subtract(4, 'hour').format('h:mm A'),
    hoursSoFar: 4,
  },
]

function projectToDashboardProject(p: (typeof MOCK_PROJECTS)[number]): DashboardProject {
  const card = MOCK_PROJECT_CARD_DATA[p.id]
  const budget = card?.value ?? 165000
  const spent = Math.round(budget * 0.78)
  const start = dayjs().subtract(45, 'day')
  const end = dayjs().add(45, 'day')
  const totalDays = Math.max(1, end.diff(start, 'day'))
  const elapsed = Math.min(totalDays, dayjs().diff(start, 'day'))
  return {
    id: p.id,
    name: (p.id === DEMO_PROJECT_ID ? 'Riverside Commercial — Phase 4' : p.name) ?? 'Project',
    status: p.status ?? 'active',
    client: p.id === DEMO_PROJECT_ID ? 'Summit Construction' : undefined,
    initials: p.id === DEMO_PROJECT_ID ? 'RC' : undefined,
    budget_total: budget,
    spent_total: spent,
    timeline_start: start.format('MM/DD/YYYY'),
    timeline_end: end.format('MM/DD/YYYY'),
    timeline_pct: Math.min(100, Math.round((elapsed / totalDays) * 100)),
    phases: card?.phaseProgress,
    next_step: card?.nextStep,
    days_left: card?.isComplete ? 0 : Math.max(0, end.diff(dayjs(), 'day')),
    estimated_value: card?.value ?? null,
    assigned_to_name: card?.assignedTo?.name ?? null,
    document_count: p.id === DEMO_PROJECT_ID ? 2 : p.status === 'active' ? 1 : 0,
  }
}

export function getDemoDashboardProjects(): DashboardProject[] {
  return MOCK_PROJECTS.map(projectToDashboardProject)
}

/** Schedule rows for a given YYYY-MM-DD (subset always returned for demo). */
export function getDemoScheduleForDate(_date: string): ScheduleItem[] {
  const d = dayjs().format('YYYY-MM-DD')
  return [
    {
      id: 'demo-sch-1',
      projectId: DEMO_PROJECT_ID,
      projectName: 'Riverside Commercial · Floor 4 Framing',
      title: 'Crew Kickoff — Riverside Commercial',
      completed: false,
      type: 'task',
      endDate: `${d}T07:30:00`,
    },
    {
      id: 'demo-sch-2',
      projectId: 'mock-bath',
      projectName: 'Harbor View · Unit 12',
      title: 'Client Walkthrough',
      completed: false,
      type: 'milestone',
      endDate: `${d}T10:00:00`,
    },
    {
      id: 'demo-sch-3',
      projectId: DEMO_PROJECT_ID,
      projectName: 'Summit Construction',
      title: 'Material Delivery',
      completed: false,
      type: 'task',
      endDate: `${d}T13:00:00`,
    },
    {
      id: 'demo-sch-4',
      projectId: DEMO_PROJECT_ID,
      projectName: 'Riverside Commercial',
      title: 'Inspect Framing',
      completed: false,
      type: 'task',
      endDate: `${d}T15:30:00`,
    },
  ]
}

export function getDemoScheduleDays(month: string): string[] {
  const base = dayjs(`${month}-01`)
  if (!base.isValid()) return []
  return [3, 7, 11, 15, 18, 22, 25]
    .map((day) => base.date(day).format('YYYY-MM-DD'))
    .filter((s) => s.startsWith(month))
}

const nowIso = () => new Date().toISOString()

export const DEMO_CONVERSATIONS: ConversationListItem[] = [
  {
    id: 'demo-conv-1',
    updated_at: nowIso(),
    job_id: DEMO_PROJECT_ID,
    job_name: 'Riverside Commercial — Phase 4',
    last_message: {
      id: 'm1',
      sender_id: DEMO_PROJECT_ID,
      body: 'Can we confirm window delivery for Thursday?',
      created_at: dayjs().subtract(20, 'minute').toISOString(),
    },
    unread_count: 1,
    other_participant_ids: ['sub-summit'],
    other_participants: [{ id: 'sub-summit', name: 'Summit Construction' }],
  },
  {
    id: 'demo-conv-2',
    updated_at: dayjs().subtract(2, 'hour').toISOString(),
    last_message: {
      id: 'm2',
      sender_id: 'u-other',
      body: 'Photos from rough-in are uploaded.',
      created_at: dayjs().subtract(2, 'hour').toISOString(),
    },
    unread_count: 0,
    other_participant_ids: ['u-other'],
    other_participants: [{ id: 'u-other', name: 'Sarah Chen' }],
  },
]
