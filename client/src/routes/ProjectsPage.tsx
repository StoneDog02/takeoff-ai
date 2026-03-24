import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { DashboardProject } from '@/api/client'
import type { ProjectCardData } from '@/data/mockProjectsData'
import type {
  Project,
  Job,
  Phase,
  Milestone,
  ProjectTask,
  JobWalkMedia,
  ProjectBuildPlan,
  Subcontractor,
  MaterialList,
  ProjectWorkType,
  ProjectActivityItem,
  JobAssignment,
  Employee,
  BidSheet,
  Estimate,
  EstimateLineItem,
} from '@/types/global'
import { teamsApi } from '@/api/teamsClient'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { ProjectDocumentCountBadge } from '@/components/projects/ProjectDocumentCountBadge'
import { HealthRing } from '@/components/projects/HealthRing'
import { JobWalkGallery } from '@/components/projects/JobWalkGallery'
import { BudgetTab } from '@/components/projects/BudgetTab'
import { LaunchTakeoffWidget, type TakeoffPlanType } from '@/components/projects/LaunchTakeoffWidget'
import { TakeoffProgressPopup } from '@/components/projects/TakeoffProgressPopup'
import { BulkSendModal } from '@/components/projects/BulkSendModal'
import { BidSheetFlow } from '@/components/projects/BidSheetFlow'
import { ProjectDocumentsTab } from '@/components/projects/ProjectDocumentsTab'
import { EstimatingWorkspace } from '@/components/projects/EstimatingWorkspace'
import { WorkTypesTab } from '@/components/projects/WorkTypesTab'
import { ProjectCrewTab } from '@/components/projects/ProjectCrewTab'
import { GeofenceTab } from '@/components/teams/GeofenceTab'
import { ImportScheduleModal } from '@/components/projects/ImportScheduleModal'
import { ConfirmDeleteProjectModal } from '@/components/projects/ConfirmDeleteProjectModal'
import { ScheduleBuilder, apiToBuilder, weekToDate } from '@/components/projects/ScheduleBuilder'
import type { BuilderPhase, BuilderMilestone } from '@/components/projects/ScheduleBuilder'
import { formatDate, dayjs, formatRelative } from '@/lib/date'
import { SetupWizard, SetupBanner, wizardStateFromProject } from '@/components/projects/NewProjectWizard'
import {
  EstimateBuilderModal,
  type PrefillClientInfo,
  type LineItem,
  type TakeoffPickItem,
} from '@/components/estimates/EstimateBuilderModal'
import { CustomProductLibrary } from '@/components/estimates/CustomProductLibrary'
import { type InitialEstimateLine } from '@/components/estimates/EstimateBuilder'
import { estimatesApi, type EstimateWithLines } from '@/api/estimates'
import { allTradesReadyForEstimate } from '@/lib/estimatingTrades'
import { budgetCategoryKeyFromEstimateSection } from '@/lib/budgetCategoryFromEstimateSection'
import {
  getUninvoicedPaymentForPhase,
  sendProgressPaymentForPhase,
  dismissPhasePaymentPrompt,
  isPhasePaymentPromptDismissed,
  formatPhasePaymentUsd,
} from '@/lib/phasePaymentRequest'

const OVERVIEW_ESTIMATE_KEY_TO_LABEL: Record<string, string> = {
  labor: 'Labor',
  materials: 'Materials',
  subs: 'Subcontractors',
  equipment: 'Equipment',
  permits: 'Permits & Fees',
  overhead: 'Overhead',
  other: 'Other',
}

const OVERVIEW_BUDGET_CATEGORY_ORDER = [
  'Labor',
  'Materials',
  'Subcontractors',
  'Equipment',
  'Permits & Fees',
  'Overhead',
  'Other',
] as const

export type OverviewBudgetRow = {
  id: string
  project_id: string
  label: string
  predicted: number
  actual: number
  category: string
}

function buildOverviewBudgetFromEstimateLines(
  projectId: string,
  lines: EstimateLineItem[],
  totalAmount: number
): { total: number; items: OverviewBudgetRow[] } {
  const sumLines = lines.reduce((s, li) => {
    const t = Number(li.total)
    if (Number.isFinite(t) && t !== 0) return s + t
    return s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0)
  }, 0)
  const total = Math.max(0, Number(totalAmount) || sumLines)
  const buckets = new Map<string, number>()
  for (const li of lines) {
    const key = budgetCategoryKeyFromEstimateSection(li.section)
    const label = OVERVIEW_ESTIMATE_KEY_TO_LABEL[key] ?? 'Other'
    const lineTotal =
      (Number.isFinite(Number(li.total)) ? Number(li.total) : 0) ||
      (Number(li.quantity) || 0) * (Number(li.unit_price) || 0)
    buckets.set(label, (buckets.get(label) ?? 0) + lineTotal)
  }
  let items: OverviewBudgetRow[] = [...buckets.entries()]
    .filter(([, p]) => p > 0)
    .sort((a, b) => OVERVIEW_BUDGET_CATEGORY_ORDER.indexOf(a[0] as (typeof OVERVIEW_BUDGET_CATEGORY_ORDER)[number]) - OVERVIEW_BUDGET_CATEGORY_ORDER.indexOf(b[0] as (typeof OVERVIEW_BUDGET_CATEGORY_ORDER)[number]))
    .map(([label, predicted], i) => ({
      id: `est-prev-${projectId}-${i}-${label.replace(/\s+/g, '-')}`,
      project_id: projectId,
      label,
      predicted,
      actual: 0,
      category: label,
    }))
  if (items.length === 0 && total > 0) {
    items = [
      {
        id: `est-prev-${projectId}-rollup`,
        project_id: projectId,
        label: 'Estimate total',
        predicted: total,
        actual: 0,
        category: 'other',
      },
    ]
  }
  return { total, items }
}

export interface NewProjectFormData {
  name: string
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
}

const DETAIL_TAB_IDS = ['overview', 'worktypes', 'crew', 'geofence', 'budget', 'schedule', 'media', 'takeoff', 'bidsheet', 'documents'] as const
type DetailTabId = (typeof DETAIL_TAB_IDS)[number]

const PIPELINE_COLUMNS = [
  { key: 'estimating', label: 'Estimating', dotColor: '#6b7280', barColor: '#6b7280' },
  { key: 'awaiting_approval', label: 'Awaiting Approval', dotColor: '#f59e0b', barColor: '#f59e0b' },
  { key: 'backlog', label: 'Backlog', dotColor: '#3b82f6', barColor: '#3b82f6' },
  { key: 'active', label: 'Active', dotColor: '#16a34a', barColor: '#16a34a' },
  { key: 'on_hold', label: 'On Hold', dotColor: '#6b7280', barColor: '#6b7280' },
  { key: 'completed', label: 'Completed', dotColor: '#22c55e', barColor: '#22c55e' },
] as const

/** Main kanban pipeline (Backlog is rendered separately below). */
const PIPELINE_COLUMNS_MAIN = PIPELINE_COLUMNS.filter((c) => c.key !== 'backlog')

const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  estimating: 'Estimating',
  awaiting_approval: 'Awaiting Approval',
  backlog: 'Backlog',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
}

function normStatus(s: string): string {
  return s.toLowerCase().replace(/[\s-]+/g, '_')
}

function colMatchesStatus(colKey: string, status: string): boolean {
  const normalized = normStatus(status)
  /** Estimate approved — legacy awaiting_job_creation had no column; same as backlog */
  if (colKey === 'backlog' && (normalized === 'planning' || normalized === 'awaiting_job_creation')) return true
  return colKey === normalized
}

/** Human-readable status for list/cards (backlog + legacy approved state). */
function displayProjectStatusLabel(status: string | undefined): string {
  const n = normStatus(status ?? '')
  if (n === 'awaiting_job_creation' || n === 'backlog') return 'Backlog'
  if (n === 'on_hold') return 'On Hold'
  if (n === 'awaiting_approval') return 'Awaiting Approval'
  if (n === 'estimating') return 'Estimating'
  if (n === 'planning') return 'Planning'
  if (n === 'active') return 'Active'
  if (n === 'completed') return 'Completed'
  const s = status ?? 'active'
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

/** Each bid dispatch can create a duplicate subcontractors row; show one row per person in Team. */
function groupSubcontractorsForTeamDisplay(
  subs: Subcontractor[]
): { dedupeKey: string; name: string; tradeLine: string }[] {
  const map = new Map<string, { name: string; trades: Set<string> }>()
  for (const s of subs) {
    const email = (s.email || '').trim().toLowerCase()
    const dedupeKey = email ? `email:${email}` : `name:${(s.name || '').trim().toLowerCase()}`
    const trade = (s.trade || '').trim() || 'Subcontractor'
    if (!map.has(dedupeKey)) {
      map.set(dedupeKey, { name: s.name || '—', trades: new Set([trade]) })
    } else {
      map.get(dedupeKey)!.trades.add(trade)
    }
  }
  return [...map.entries()].map(([dedupeKey, v]) => {
    const trades = [...v.trades].sort((a, b) => a.localeCompare(b))
    return {
      dedupeKey,
      name: v.name,
      tradeLine: trades.length === 1 ? trades[0] : trades.join(' · '),
    }
  })
}

/** When reopening Build Estimate, load this job’s saved document (draft first, else most recently updated). */
function pickPrimaryEstimateIdForBuild(rows: Estimate[]): string | null {
  const list = rows ?? []
  if (list.length === 0) return null
  const draft = list.find((e) => (e.status ?? '').toLowerCase() === 'draft')
  if (draft) return draft.id
  const sorted = [...list].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime()
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime()
    return tb - ta
  })
  return sorted[0]?.id ?? null
}

if (typeof window !== 'undefined') {
  console.log('[ProjectsPage] module loaded')
}

export function ProjectsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [media, setMedia] = useState<JobWalkMedia[]>([])
  const [budget, setBudget] = useState<{ items: { id: string; project_id: string; label: string; predicted: number; actual: number; category: string }[]; summary: { predicted_total: number; actual_total: number; profitability: number }; labor_actual_from_time_entries?: number; subs_actual_from_bid_sheet?: number; approved_change_orders_total?: number } | null>(null)
  /** Awaiting approval: latest open estimate rolled up for overview (greyed “provisional” budget). */
  const [awaitingApprovalEstimatePreview, setAwaitingApprovalEstimatePreview] = useState<{
    total: number
    items: OverviewBudgetRow[]
    lineItems: EstimateLineItem[]
  } | null>(null)
  const [takeoffs, setTakeoffs] = useState<{ id: string; material_list: { categories: { name: string; items: { description: string; quantity: number; unit: string; trade_tag?: string; cost_estimate?: number | null }[] }[] }; created_at: string }[]>([])
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [jobAssignments, setJobAssignments] = useState<JobAssignment[]>([])
  const [rosterEmployees, setRosterEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  /** Prevents SetupBanner from flashing: only show after work types for this project have loaded (or failed). */
  const [overviewSetupReady, setOverviewSetupReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bulkSendOpen, setBulkSendOpen] = useState(false)
  const [bulkSendIds, setBulkSendIds] = useState<string[]>([])
  const [newEstimateOpen, setNewEstimateOpen] = useState(false)
  const [estimateModalJobs, setEstimateModalJobs] = useState<Job[]>([])
  const [filter, setFilter] = useState<'all' | 'estimating' | 'awaiting_approval' | 'backlog' | 'active' | 'on_hold' | 'completed'>('all')
  const [search, setSearch] = useState('')
  const [listView, setListView] = useState<'board' | 'grid' | 'table'>('board')
  const [scheduleImportOpen, setScheduleImportOpen] = useState(false)
  const [setupWizardOpen, setSetupWizardOpen] = useState(false)
  const [detailRefreshTrigger, setDetailRefreshTrigger] = useState(0)
  /** Accepted estimate for this job (progress invoicing / phase payment prompt). */
  const [acceptedEstimate, setAcceptedEstimate] = useState<Estimate | null>(null)
  const [acceptedEstimateDetail, setAcceptedEstimateDetail] = useState<EstimateWithLines | null>(null)
  const [paymentPrompt, setPaymentPrompt] = useState<{
    phaseId: string
    phaseName: string
    amount: number
    clientEmail: string
  } | null>(null)
  const [paymentSending, setPaymentSending] = useState(false)
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [builderPhases, setBuilderPhases] = useState<BuilderPhase[]>([])
  const [builderMilestones, setBuilderMilestones] = useState<BuilderMilestone[]>([])
  const [builderMeta, setBuilderMeta] = useState({ projectName: '', startDate: '', gcOwner: '' })
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [workTypesByProject, setWorkTypesByProject] = useState<Record<string, ProjectWorkType[]>>({})
  const [activity, setActivity] = useState<ProjectActivityItem[]>([])
  const [buildPlans, setBuildPlans] = useState<ProjectBuildPlan[]>([])
  const [heroMenuOpen, setHeroMenuOpen] = useState(false)
  const [activateModalOpen, setActivateModalOpen] = useState(false)
  /** When set, activation modal targets this project (board); detail flow clears this. */
  const [pendingActivateProjectId, setPendingActivateProjectId] = useState<string | null>(null)
  const [activateStartDate, setActivateStartDate] = useState('')
  const [activateEndDate, setActivateEndDate] = useState('')
  const [activateSubmitting, setActivateSubmitting] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [activateSuccessToast, setActivateSuccessToast] = useState<string | null>(null)
  const heroMenuRef = useRef<HTMLDivElement>(null)
  const [buildEstimateOpen, setBuildEstimateOpen] = useState(false)
  const [buildEstimateBlankMode, setBuildEstimateBlankMode] = useState(false)
  const [buildEstimateBidSheet, setBuildEstimateBidSheet] = useState<BidSheet | null | undefined>(undefined)
  const [buildEstimateBidSheetFetched, setBuildEstimateBidSheetFetched] = useState(false)
  /** When set, Build Estimate opens in revise mode so saved lines load from the API (not bid-sheet prefill only). */
  const [buildEstimateLinkedEstimateId, setBuildEstimateLinkedEstimateId] = useState<string | null>(null)
  const [showProductLibrary, setShowProductLibrary] = useState(false)
  /** Bid sheet for EstimatingWorkspace when project status is estimating (overview). */
  const [workspaceBidSheet, setWorkspaceBidSheet] = useState<BidSheet | null | undefined>(undefined)
  /** Timestamp (ms) of last bid sheet fetch for Stage 2 "Last updated X seconds ago". */
  const [lastBidSheetUpdated, setLastBidSheetUpdated] = useState<number | null>(null)
  /** Estimating overview: GC chose to bypass takeoff (unlocks bid sheet + build estimate). */
  const [estimatingTakeoffBypassed, setEstimatingTakeoffBypassed] = useState(false)
  /** Estimating overview: GC chose to skip bid collection (unlocks build estimate). */
  const [estimatingBidSheetSkipped, setEstimatingBidSheetSkipped] = useState(false)
  /** True if this job has any saved estimate row — keeps Stage 3 available after first Build Estimate session. */
  const [hasPersistedJobEstimate, setHasPersistedJobEstimate] = useState(false)
  /** Primary estimate total/status for Estimating banner (draft first, else latest). */
  const [persistedEstimatePreview, setPersistedEstimatePreview] = useState<{
    total: number
    status: string
  } | null>(null)
  /** Takeoff in progress (lives in parent so progress continues when user leaves Takeoff tab). */
  const [takeoffInProgress, setTakeoffInProgress] = useState(false)
  const [takeoffProgress, setTakeoffProgress] = useState(0)
  const [takeoffMessage, setTakeoffMessage] = useState('')
  const [takeoffStartTime, setTakeoffStartTime] = useState(0)
  const [takeoffResult, setTakeoffResult] = useState<{
    material_list: MaterialList
    id?: string
    created_at?: string
    truncated?: boolean
  } | null>(null)
  const [takeoffError, setTakeoffError] = useState<string | null>(null)
  const takeoffIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const takeoffMessageIndexRef = useRef(0)
  /** Work types from wizard onComplete; applied again when detail refetch finishes so banner never loses them. */
  const pendingWizardWorkTypes = useRef<ProjectWorkType[] | undefined>(undefined)
  /** Only reset detail state when navigating to a different project — not on soft refresh (e.g. after saving an estimate). */
  const detailLoadIdRef = useRef<string | undefined>(undefined)
  const tabFromUrl = searchParams.get('tab')
  /** Budget tab: show skeleton until refetch completes so variance/actual don't flash. */
  const [budgetTabLoading, setBudgetTabLoading] = useState(false)
  /** List view: estimates for awaiting_approval column (project id → estimate). */
  const [estimatesByProjectId, setEstimatesByProjectId] = useState<Record<string, Estimate>>({})
  /** List view: convert-to-job confirmation (project id, name, estimate total). */
  const [convertConfirmProject, setConvertConfirmProject] = useState<{
    id: string
    name: string
    estimateTotal: number
    estimateId: string
  } | null>(null)
  /** List view: open EstimateBuilderModal in revise mode (project id + estimate id). */
  const [reviseEstimate, setReviseEstimate] = useState<{ projectId: string; estimateId: string } | null>(null)
  /** List view: converting project to job (disable confirm button). */
  const [convertInProgress, setConvertInProgress] = useState(false)
  const TAKEOFF_PROGRESS_MESSAGES = [
    'Uploading plan…',
    'Analyzing drawings…',
    'Extracting dimensions…',
    'Identifying materials…',
    'Building material list…',
  ]
  const TAKEOFF_PROGRESS_CAP = 90
  const TAKEOFF_PROGRESS_INTERVAL_MS = 800
  const TAKEOFF_PROGRESS_STEP = 4

  // Open New Estimate flow after the page has loaded and grid slide-in animation has finished (?new=1)
  useEffect(() => {
    if (!id && !loading && searchParams.get('new') === '1') {
      const delay = 550
      const t = setTimeout(() => {
        setNewEstimateOpen(true)
        const next = new URLSearchParams(searchParams)
        next.delete('new')
        setSearchParams(next, { replace: true })
      }, delay)
      return () => clearTimeout(t)
    }
  }, [id, loading, searchParams, setSearchParams])

  // Load jobs when opening the New Estimate modal (for EstimateBuilderModal)
  useEffect(() => {
    if (!newEstimateOpen) return
    estimatesApi.getJobs().then(setEstimateModalJobs).catch(() => setEstimateModalJobs([]))
  }, [newEstimateOpen])

  const workTypes = id ? (workTypesByProject[id] ?? []) : []
  const setWorkTypes = (list: ProjectWorkType[]) => {
    if (!id) return
    setWorkTypesByProject((prev) => ({ ...prev, [id]: list }))
    ;(async () => {
      try {
        const existing = await api.projects.getWorkTypes(id)
        for (const w of existing) await api.projects.deleteWorkType(id, w.id)
        const synced: ProjectWorkType[] = []
        for (const w of list) {
          const created = await api.projects.createWorkType(id, {
            name: w.name,
            description: w.description,
            rate: w.rate,
            unit: w.unit,
            type_key: w.type_key,
            custom_color: w.type_key === 'custom' ? w.custom_color : undefined,
          })
          synced.push(created)
        }
        setWorkTypesByProject((prev) => ({ ...prev, [id]: synced }))
      } catch (e) {
        console.error('Failed to save work types', e)
      }
    })()
  }
  const [activeTabState, setActiveTabState] = useState<DetailTabId>('overview')
  const activeTab: DetailTabId = (tabFromUrl && DETAIL_TAB_IDS.includes(tabFromUrl as DetailTabId)) ? (tabFromUrl as DetailTabId) : activeTabState
  const setActiveTab = (tab: DetailTabId) => {
    setActiveTabState(tab)
    setSearchParams({ tab }, { replace: true })
  }

  useEffect(() => {
    if (!heroMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (heroMenuRef.current && !heroMenuRef.current.contains(e.target as Node)) setHeroMenuOpen(false)
    }
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  }, [heroMenuOpen])

  useEffect(() => {
    if (id && pendingActivateProjectId && id !== pendingActivateProjectId) {
      setPendingActivateProjectId(null)
      setActivateModalOpen(false)
    }
  }, [id, pendingActivateProjectId])

  useEffect(() => {
    if (!activateModalOpen) return
    setActivateError(null)
    if (pendingActivateProjectId && id === pendingActivateProjectId && project?.id === pendingActivateProjectId && project.status === 'backlog') {
      setActivateStartDate((project.expected_start_date || '').slice(0, 10))
      setActivateEndDate((project.expected_end_date || '').slice(0, 10))
      return
    }
    if (pendingActivateProjectId) {
      const row = projects.find(
        (p) => p.id === pendingActivateProjectId && colMatchesStatus('backlog', p.status ?? '')
      )
      if (row) {
        setActivateStartDate((row.expected_start_date || '').slice(0, 10))
        setActivateEndDate((row.expected_end_date || '').slice(0, 10))
      }
    } else if (project && normStatus(project.status ?? '') === 'backlog') {
      setActivateStartDate((project.expected_start_date || '').slice(0, 10))
      setActivateEndDate((project.expected_end_date || '').slice(0, 10))
    }
  }, [
    activateModalOpen,
    pendingActivateProjectId,
    id,
    projects,
    project?.id,
    project?.status,
    project?.expected_start_date,
    project?.expected_end_date,
  ])

  useEffect(() => {
    if (!activateSuccessToast) return
    const t = window.setTimeout(() => setActivateSuccessToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [activateSuccessToast])

  // When navigating to a project (by id), always open on overview unless URL has an explicit tab
  useEffect(() => {
    if (!id) return
    const tabParam = searchParams.get('tab')
    if (!tabParam || !DETAIL_TAB_IDS.includes(tabParam as DetailTabId)) {
      setActiveTabState('overview')
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true })
    }
  }, [id])

  useEffect(() => {
    if (id !== undefined) return
    setLoading(true)
    api.dashboard
      .getProjects()
      .then((list) => {
        setProjects(list)
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setEstimatingTakeoffBypassed(false)
    setEstimatingBidSheetSkipped(false)
    setShowProductLibrary(false)
  }, [id])

  useEffect(() => {
    console.log('[ProjectsPage] product library state', { id, showProductLibrary })
  }, [id, showProductLibrary])

  const refetchEstimatesForList = useCallback(() => {
    if (projects.length === 0) return
    estimatesApi
      .getEstimates()
      .then((list) => {
        const projectIds = new Set(projects.map((p) => p.id))
        const statuses = new Set(['sent', 'viewed', 'changes_requested', 'accepted'])
        const map: Record<string, Estimate> = {}
        for (const est of list) {
          if (!est.job_id || !projectIds.has(est.job_id) || !statuses.has(est.status)) continue
          const existing = map[est.job_id]
          const estSent = est.sent_at ? new Date(est.sent_at).getTime() : 0
          const existingSent = existing?.sent_at ? new Date(existing.sent_at).getTime() : 0
          if (!existing || estSent >= existingSent) map[est.job_id] = est
        }
        setEstimatesByProjectId(map)
      })
      .catch(() => setEstimatesByProjectId({}))
  }, [projects])

  const openProductLibrary = useCallback(() => {
    console.log('[ProjectsPage] open product library click', { id, showProductLibrary })
    setShowProductLibrary(true)
  }, [id, showProductLibrary])

  // List view: fetch estimates for awaiting_approval column (project id → linked estimate)
  useEffect(() => {
    if (id !== undefined || projects.length === 0) return
    refetchEstimatesForList()
  }, [id, projects, refetchEstimatesForList])

  // Accepted estimate + line-level meta for progress milestones (phase payment prompt).
  useEffect(() => {
    if (!id) {
      setAcceptedEstimate(null)
      setAcceptedEstimateDetail(null)
      return
    }
    let cancelled = false
    estimatesApi
      .getEstimates(id)
      .then(async (list) => {
        if (cancelled) return
        const accepted = (list ?? []).find((e) => (e.status ?? '').toLowerCase() === 'accepted')
        if (!accepted) {
          setAcceptedEstimate(null)
          setAcceptedEstimateDetail(null)
          return
        }
        setAcceptedEstimate(accepted)
        try {
          const full = await estimatesApi.getEstimate(accepted.id)
          if (!cancelled) setAcceptedEstimateDetail(full)
        } catch {
          if (!cancelled) setAcceptedEstimateDetail(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAcceptedEstimate(null)
          setAcceptedEstimateDetail(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [id, detailRefreshTrigger])

  useEffect(() => {
    if (!id || !project?.id) {
      setAwaitingApprovalEstimatePreview(null)
      return
    }
    const sk = (project.status ?? 'active').toLowerCase().replace(/[\s-]+/g, '_')
    if (sk !== 'awaiting_approval') {
      setAwaitingApprovalEstimatePreview(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const list = await estimatesApi.getEstimates(id)
        if (cancelled) return
        const open: Estimate['status'][] = ['draft', 'sent', 'viewed', 'changes_requested']
        const candidates = (list ?? []).filter((e) => e.job_id === id && open.includes(e.status))
        if (candidates.length === 0) {
          setAwaitingApprovalEstimatePreview(null)
          return
        }
        const est = [...candidates].sort((a, b) => {
          const ta = (a.sent_at ? new Date(a.sent_at) : new Date(a.updated_at)).getTime()
          const tb = (b.sent_at ? new Date(b.sent_at) : new Date(b.updated_at)).getTime()
          return tb - ta
        })[0]
        const full = await estimatesApi.getEstimate(est.id)
        if (cancelled) return
        const { total, items } = buildOverviewBudgetFromEstimateLines(id, full.line_items ?? [], full.total_amount)
        const rawLines = full.line_items ?? []
        const lineItems: EstimateLineItem[] =
          rawLines.length > 0
            ? rawLines
            : total > 0
              ? [
                  {
                    id: `est-rollup-${est.id}`,
                    estimate_id: est.id,
                    product_id: null,
                    description: 'Estimate total',
                    quantity: 1,
                    unit: 'ls',
                    unit_price: total,
                    total,
                    section: null,
                  },
                ]
              : []
        setAwaitingApprovalEstimatePreview(
          items.length > 0 || total > 0 ? { total, items, lineItems } : null
        )
      } catch {
        if (!cancelled) setAwaitingApprovalEstimatePreview(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, project?.id, project?.status])

  useEffect(() => {
    if (!id) {
      detailLoadIdRef.current = undefined
      return
    }
    const idChanged = detailLoadIdRef.current !== id
    detailLoadIdRef.current = id

    if (idChanged) {
      setLoading(true)
      setError(null)
      setProject(null)
      setBudget(null)
      setPhases([])
      setMilestones([])
      setTasks([])
      setMedia([])
      setTakeoffs([])
      setSubcontractors([])
      setOverviewSetupReady(false)
      setActivity([])
      setBuildPlans([])
      setTakeoffResult(null)
      setTakeoffError(null)
      setJobAssignments([])
      setRosterEmployees([])
      setBuilderPhases([])
      setBuilderMilestones([])
      setBuilderMeta({ projectName: '', startDate: '', gcOwner: '' })
    }

    const emptyBudget = { items: [] as { id: string; project_id: string; label: string; predicted: number; actual: number; category: string }[], summary: { predicted_total: 0, actual_total: 0, profitability: 0 } }
    Promise.all([
      api.projects.get(id),
      api.projects.getPhases(id),
      api.projects.getMilestones(id),
      api.projects.getTasks(id),
      api.projects.getMedia(id),
      api.projects.getBudget(id),
      api.projects.getTakeoffs(id),
      api.projects.getSubcontractors(id),
    ])
      .then(([proj, ph, mil, taskList, med, bud, toffs, subs]) => {
        setProject(proj)
        const phasesData = ph ?? []
        const milestonesData = mil ?? []
        const tasksData = taskList ?? []
        setPhases(phasesData)
        setMilestones(milestonesData)
        setTasks(tasksData)
        setMedia(med?.length ? med : [])
        setBudget(bud?.items?.length ? bud : { items: [], summary: bud?.summary ?? emptyBudget.summary })
        setTakeoffs(toffs?.length ? toffs : [])
        setSubcontractors(subs?.length ? subs : [])
        if (id) {
          if (pendingWizardWorkTypes.current !== undefined) {
            setWorkTypesByProject((prev) => ({ ...prev, [id]: pendingWizardWorkTypes.current! }))
            pendingWizardWorkTypes.current = undefined
            setOverviewSetupReady(true)
          } else {
            api.projects
              .getWorkTypes(id)
              .then((wt) => {
                const next = wt ?? []
                setWorkTypesByProject((prev) => {
                  const current = prev[id] ?? []
                  if (next.length === 0 && current.length > 0) return prev
                  return { ...prev, [id]: next }
                })
              })
              .catch(() => {
                setWorkTypesByProject((prev) => {
                  const current = prev[id] ?? []
                  if (current.length > 0) return prev
                  return { ...prev, [id]: [] }
                })
              })
              .finally(() => setOverviewSetupReady(true))
          }
          Promise.all([
            teamsApi.jobAssignments.list({ job_id: id, active_only: true }).catch(() => []),
            teamsApi.employees.list().catch(() => []),
          ]).then(([assignments, employees]) => {
            setJobAssignments(assignments ?? [])
            setRosterEmployees(employees ?? [])
          })
        }
        const built = apiToBuilder(
          proj,
          phasesData,
          tasksData,
          milestonesData,
          dayjs().format('YYYY-MM-DD')
        )
        setBuilderMeta({ projectName: built.projectName, startDate: built.startDate, gcOwner: built.gcOwner })
        setBuilderPhases(built.phases)
        setBuilderMilestones(built.milestones)
        api.projects.getActivity(id).then(setActivity).catch(() => setActivity([]))
        api.projects.getBuildPlans(id).then(setBuildPlans).catch(() => setBuildPlans([]))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, detailRefreshTrigger])

  // Refetch budget when opening Budget tab so variance/actual don't show stale data; show skeleton until done
  useEffect(() => {
    if (activeTab !== 'budget' || !id) return
    setBudgetTabLoading(true)
    api.projects
      .getBudget(id)
      .then((bud) => {
        const emptySummary = { predicted_total: 0, actual_total: 0, profitability: 0 }
        setBudget(bud?.items?.length ? bud : { items: [], summary: bud?.summary ?? emptySummary })
      })
      .catch(() => {})
      .finally(() => setBudgetTabLoading(false))
  }, [activeTab, id])

  // Overview "Budget vs Actual" used stale budget if estimate was accepted after first load; refetch on overview + tab focus
  useEffect(() => {
    if (!id || activeTab !== 'overview') return
    const emptySummary = { predicted_total: 0, actual_total: 0, profitability: 0 }
    const apply = () => {
      api.projects
        .getBudget(id)
        .then((bud) => {
          setBudget(bud?.items?.length ? bud : { items: [], summary: bud?.summary ?? emptySummary })
        })
        .catch(() => {})
    }
    apply()
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        api.projects.get(id).then(setProject).catch(() => {})
        apply()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [activeTab, id])

  const refreshBudgetFromServer = useCallback(async () => {
    if (!id) return
    const emptySummary = { predicted_total: 0, actual_total: 0, profitability: 0 }
    try {
      const bud = await api.projects.getBudget(id)
      setBudget(bud?.items?.length ? bud : { items: [], summary: bud.summary ?? emptySummary })
    } catch {
      /* ignore */
    }
  }, [id])

  const refreshMedia = () => {
    if (id) {
      api.projects.getMedia(id).then(setMedia)
      api.projects.getActivity(id).then(setActivity)
    }
  }
  const refreshSubcontractors = () => {
    if (id) api.projects.getSubcontractors(id).then(setSubcontractors)
  }

  // Fetch project + bid sheet + budget when opening Build Estimate (always, including blank mode)
  // so client_email / client_phone prefill and budget seed match the DB before the modal mounts.
  useEffect(() => {
    if (!buildEstimateOpen || !id) {
      if (!buildEstimateOpen) {
        setBuildEstimateBidSheet(undefined)
        setBuildEstimateBidSheetFetched(false)
      }
      return
    }
    setBuildEstimateBidSheetFetched(false)
    setBuildEstimateLinkedEstimateId(null)
    const emptySummary = { predicted_total: 0, actual_total: 0, profitability: 0 }
    let cancelled = false
    ;(async () => {
      try {
        const results = await Promise.allSettled([
          api.projects.get(id),
          api.projects.getBidSheet(id),
          api.projects.getBudget(id),
          estimatesApi.getEstimates(id),
        ])
        if (cancelled) return
        const projRes = results[0]
        const sheetRes = results[1]
        const budRes = results[2]
        const estRes = results[3]
        if (projRes.status === 'fulfilled' && projRes.value) {
          setProject(projRes.value)
        }
        setBuildEstimateBidSheet(sheetRes.status === 'fulfilled' ? sheetRes.value : null)
        if (budRes.status === 'fulfilled' && budRes.value) {
          const bud = budRes.value
          setBudget(bud.items?.length ? bud : { items: [], summary: bud.summary ?? emptySummary })
        }
        if (estRes.status === 'fulfilled' && Array.isArray(estRes.value)) {
          setBuildEstimateLinkedEstimateId(pickPrimaryEstimateIdForBuild(estRes.value))
        }
      } finally {
        if (!cancelled) setBuildEstimateBidSheetFetched(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [buildEstimateOpen, id])

  // Fetch bid sheet when project is estimating (for EstimatingWorkspace and hero KPIs)
  useEffect(() => {
    if (!id || project?.status !== 'estimating') return
    api.projects
      .getBidSheet(id)
      .then((sheet) => {
        setWorkspaceBidSheet(sheet)
        setLastBidSheetUpdated(Date.now())
      })
      .catch(() => {
        /* keep prior workspaceBidSheet — clearing loses Stage 2/3 gating until next success */
      })
  }, [id, project?.status, detailRefreshTrigger])

  const refreshWorkspaceBidSheet = useCallback(() => {
    if (!id) return
    api.projects
      .getBidSheet(id)
      .then((sheet) => {
        setWorkspaceBidSheet(sheet)
        setLastBidSheetUpdated(Date.now())
      })
      .catch(() => {
        /* keep prior bid sheet on transient errors */
      })
  }, [id])

  // Once a GC has saved an estimate for this job, keep Estimating Stage 3 unlocked regardless of bid-sheet gating.
  useEffect(() => {
    if (!id || project?.status !== 'estimating') {
      setHasPersistedJobEstimate(false)
      setPersistedEstimatePreview(null)
      return
    }
    let cancelled = false
    estimatesApi
      .getEstimates(id)
      .then((list) => {
        if (cancelled) return
        const rows = list ?? []
        setHasPersistedJobEstimate(rows.length > 0)
        if (rows.length === 0) {
          setPersistedEstimatePreview(null)
          return
        }
        const eid = pickPrimaryEstimateIdForBuild(rows)
        const row = eid ? rows.find((e) => e.id === eid) : null
        setPersistedEstimatePreview(
          row
            ? { total: Number(row.total_amount ?? 0), status: String(row.status ?? 'draft') }
            : null
        )
      })
      .catch(() => {
        /* keep prior flag on fetch error so Stage 3 doesn't flicker locked */
      })
    return () => {
      cancelled = true
    }
  }, [id, project?.status, detailRefreshTrigger])

  const buildEstimateInitialLines = useMemo((): InitialEstimateLine[] => {
    if (!buildEstimateBidSheetFetched) return []
    const lines: InitialEstimateLine[] = []
    const categories = takeoffs[0]?.material_list?.categories ?? []
    const bidSheet = buildEstimateBidSheet
    const packages = bidSheet?.trade_packages ?? []
    const packagesById = new Map(packages.map((p) => [p.id, p]))
    const packagesByTag = new Map(packages.map((p) => [p.trade_tag, p]))
    const subsById = new Map(subcontractors.map((s) => [s.id, s]))
    const awardedBidByTag = new Map<string, import('@/types/global').SubBid>()
    for (const b of bidSheet?.sub_bids ?? []) {
      if (!b.awarded) continue
      const pkg = packagesById.get(b.trade_package_id)
      if (pkg && !awardedBidByTag.has(pkg.trade_tag)) awardedBidByTag.set(pkg.trade_tag, b)
    }

    const selfPerformOk = (pkg: (typeof packages)[0]) =>
      !!pkg.gc_self_perform &&
      Array.isArray(pkg.gc_estimate_lines) &&
      pkg.gc_estimate_lines.length > 0 &&
      pkg.gc_estimate_lines.some((l) => {
        const q = Number(l.quantity) || 0
        const p = Number(l.unit_price) || 0
        return q * p > 0 || p > 0
      })

    for (const cat of categories) {
      const tag = cat.name
      const awarded = awardedBidByTag.get(tag)
      const pkg = packagesByTag.get(tag)
      if (awarded && subcontractors.length > 0) {
        const sub = subsById.get(awarded.subcontractor_id)
        lines.push({
          description: `${tag} — ${sub?.name ?? 'Subcontractor'}`,
          quantity: 1,
          unit: 'job',
          unit_price: Number(awarded.amount) || 0,
          section: tag,
          subcontractor_note: awarded.notes?.trim() || undefined,
          subcontractor_name: sub?.name,
        })
        continue
      }
      if (pkg && selfPerformOk(pkg)) {
        for (const el of pkg.gc_estimate_lines ?? []) {
          lines.push({
            description: el.description || 'Line item',
            quantity: Number(el.quantity) || 1,
            unit: el.unit || 'ea',
            unit_price: Number(el.unit_price) || 0,
            section: `${tag} (your work)`,
          })
        }
        continue
      }
      for (const item of cat.items ?? []) {
        const qty = item.quantity ?? 1
        const unitPrice = item.cost_estimate ?? 0
        lines.push({
          description: item.description ?? '',
          quantity: qty,
          unit: item.unit ?? 'ea',
          unit_price: unitPrice,
          section: tag,
        })
      }
    }

    const coveredTags = new Set(categories.map((c) => c.name))
    for (const b of bidSheet?.sub_bids ?? []) {
      if (!b.awarded) continue
      const pkg = packagesById.get(b.trade_package_id)
      if (!pkg || coveredTags.has(pkg.trade_tag)) continue
      coveredTags.add(pkg.trade_tag)
      const sub = subsById.get(b.subcontractor_id)
      lines.push({
        description: `${pkg.trade_tag} — ${sub?.name ?? 'Subcontractor'}`,
        quantity: 1,
        unit: 'job',
        unit_price: Number(b.amount) || 0,
        section: pkg.trade_tag,
        subcontractor_note: b.notes?.trim() || undefined,
        subcontractor_name: sub?.name,
      })
    }
    for (const pkg of packages) {
      if (coveredTags.has(pkg.trade_tag) || !selfPerformOk(pkg)) continue
      coveredTags.add(pkg.trade_tag)
      for (const el of pkg.gc_estimate_lines ?? []) {
        lines.push({
          description: el.description || 'Line item',
          quantity: Number(el.quantity) || 1,
          unit: el.unit || 'ea',
          unit_price: Number(el.unit_price) || 0,
          section: `${pkg.trade_tag} (your work)`,
        })
      }
    }
    return lines
  }, [buildEstimateBidSheetFetched, takeoffs, buildEstimateBidSheet, subcontractors])

  const estimateStageReady = useMemo(
    () =>
      hasPersistedJobEstimate ||
      estimatingBidSheetSkipped ||
      estimatingTakeoffBypassed ||
      allTradesReadyForEstimate(workspaceBidSheet ?? null, takeoffs),
    [hasPersistedJobEstimate, estimatingBidSheetSkipped, estimatingTakeoffBypassed, workspaceBidSheet, takeoffs]
  )

  const buildEstimatePrefillClientInfo: PrefillClientInfo | undefined = useMemo(() => {
    if (!project) return undefined
    return {
      projectName: project.name ?? '',
      planType: (project.plan_type as PrefillClientInfo['planType']) ?? 'residential',
      clientName: project.assigned_to_name ?? '',
      clientEmail: project.client_email?.trim() ?? '',
      clientPhone: project.client_phone?.trim() ?? '',
      projectAddress: project.address_line_1 ?? '',
    }
  }, [project])

  const buildEstimatePrefillLineItems: LineItem[] = useMemo(() => {
    return buildEstimateInitialLines.map((l) => {
      const isBid = l.unit === 'job' && l.description.includes(' — ')
      return {
        name: l.description,
        qty: l.quantity,
        unit: l.unit,
        price: l.unit_price,
        section: l.section,
        source: isBid ? ('bid' as const) : ('takeoff' as const),
        subcontractor_note: l.subcontractor_note,
        subcontractor_name: l.subcontractor_name,
      }
    })
  }, [buildEstimateInitialLines])

  const buildEstimateTakeoffPickItems: TakeoffPickItem[] = useMemo(() => {
    const cats = takeoffs[0]?.material_list?.categories ?? []
    const out: TakeoffPickItem[] = []
    for (const cat of cats) {
      for (const item of cat.items ?? []) {
        const d = (item.description ?? '').trim()
        if (!d) continue
        out.push({
          description: d,
          qty: Number(item.quantity) || 1,
          unit: item.unit ?? 'ea',
          price: item.cost_estimate ?? 0,
          category: cat.name,
        })
      }
    }
    return out
  }, [takeoffs])

  const handleDeleteProject = async () => {
    if (!deleteConfirmProject) return
    setDeleteError(null)
    setIsDeletingProject(true)
    try {
      await api.projects.delete(deleteConfirmProject.id)
      setProjects((prev) => prev.filter((p) => p.id !== deleteConfirmProject.id))
      const wasViewingDeleted = id === deleteConfirmProject.id
      setDeleteConfirmProject(null)
      if (wasViewingDeleted) navigate('/projects')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete project')
    } finally {
      setIsDeletingProject(false)
    }
  }

  const takeoffCategories = takeoffs[0]?.material_list?.categories ?? []

  /** Start takeoff in the background (fire-and-forget). Keeps running when user leaves Takeoff tab; popup shows progress. */
  const startTakeoff = useCallback(
    (file: File, planType: TakeoffPlanType, tradeFilter: null | string | string[] | undefined) => {
      const projectId = project?.id
      if (!projectId) return
      setTakeoffError(null)
      setTakeoffResult(null)
      setTakeoffInProgress(true)
      setTakeoffStartTime(Date.now())
      setTakeoffProgress(0)
      setTakeoffMessage(TAKEOFF_PROGRESS_MESSAGES[0])
      takeoffMessageIndexRef.current = 0
      takeoffIntervalRef.current = setInterval(() => {
        setTakeoffProgress((p) => {
          const next = Math.min(p + TAKEOFF_PROGRESS_STEP, TAKEOFF_PROGRESS_CAP)
          const idx = Math.min(
            Math.floor(next / 20),
            TAKEOFF_PROGRESS_MESSAGES.length - 1
          )
          if (idx !== takeoffMessageIndexRef.current) {
            takeoffMessageIndexRef.current = idx
            setTakeoffMessage(TAKEOFF_PROGRESS_MESSAGES[idx])
          }
          return next
        })
      }, TAKEOFF_PROGRESS_INTERVAL_MS)
      ;(async () => {
        try {
          const result = await api.projects.launchTakeoff(
            projectId,
            file,
            planType,
            tradeFilter ?? undefined
          )
          const list = await api.projects.getTakeoffs(projectId)
          setTakeoffs(list)
          const saved = list[0]
          setTakeoffResult({
            material_list: result.material_list as MaterialList,
            id: saved?.id,
            created_at: saved?.created_at,
            truncated: result.truncated,
          })
        } catch (err) {
          setTakeoffError(err instanceof Error ? err.message : 'Takeoff failed')
        } finally {
          if (takeoffIntervalRef.current) {
            clearInterval(takeoffIntervalRef.current)
            takeoffIntervalRef.current = null
          }
          setTakeoffProgress(100)
          setTakeoffMessage('Complete')
          setTakeoffInProgress(false)
        }
      })()
    },
    [project?.id]
  )

  /** Build Project shape from dashboard item (for delete modal and ProjectCard). */
  function toProject(d: DashboardProject): Project {
    return {
      id: d.id,
      name: d.name,
      status: d.status,
      address_line_1: d.address_line_1 ?? undefined,
      address_line_2: d.address_line_2 ?? undefined,
      city: d.city ?? undefined,
      state: d.state ?? undefined,
      postal_code: d.postal_code ?? undefined,
      assigned_to_name: d.client || undefined,
      estimated_value: d.budget_total,
    }
  }

  /** Build card data from list item (enriched or plain) so ProjectCard always shows phase, budget, days left, PM. */
  function toCardData(d: DashboardProject): ProjectCardData {
    const phases = d.phases ?? []
    const allComplete = phases.length > 0 && phases.every((p) => p.completed)
    const budgetTotal = d.budget_total ?? d.estimated_value ?? 0
    const spentTotal = d.spent_total ?? 0
    let daysLeft = d.days_left
    if (daysLeft == null) {
      const endDate = d.timeline_end ?? d.expected_end_date
      if (endDate) {
        const endTime = new Date(endDate).getTime()
        const now = Date.now()
        daysLeft = Math.max(0, Math.ceil((endTime - now) / (24 * 60 * 60 * 1000)))
      }
    }
    const clientName = d.client ?? d.assigned_to_name ?? '—'
    const initials = d.initials ?? (clientName !== '—' ? clientName.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) : '—')
    return {
      projectId: d.id,
      phaseProgress: phases,
      nextStep: d.next_step ?? (phases.length === 0 ? 'Add schedule in Schedule tab' : '—'),
      isComplete: allComplete,
      assignedTo: { initials, name: clientName },
      value: budgetTotal,
      valueUsed: spentTotal,
      daysLeft: daysLeft ?? undefined,
      documentCount: d.document_count,
    }
  }

  const activateBoardRow = pendingActivateProjectId
    ? projects.find(
        (p) => p.id === pendingActivateProjectId && colMatchesStatus('backlog', p.status ?? '')
      ) ?? null
    : null
  const activateDetailTarget =
    !pendingActivateProjectId && id && project?.status === 'backlog'
      ? project
      : pendingActivateProjectId &&
          id === pendingActivateProjectId &&
          project?.status === 'backlog'
        ? project
        : null
  const showActivateProjectModal =
    activateModalOpen && (activateBoardRow != null || activateDetailTarget != null)
  const activateContextId = activateBoardRow?.id ?? activateDetailTarget?.id ?? ''
  const activateContextClient =
    activateBoardRow != null
      ? (activateBoardRow.assigned_to_name || activateBoardRow.client || '—').trim() || '—'
      : (activateDetailTarget?.assigned_to_name?.trim() || '—')
  const activateContextApproved =
    activateBoardRow != null
      ? (activateBoardRow.budget_total ?? activateBoardRow.estimated_value ?? 0)
      : (budget?.summary?.predicted_total ?? 0)

  const activateProjectModalEl =
    showActivateProjectModal && activateContextId ? (
      <div
        className="projects-convert-modal-overlay projects-activate-modal-overlay"
        role="presentation"
        tabIndex={-1}
        onClick={() => {
          if (!activateSubmitting) {
            setActivateModalOpen(false)
            setPendingActivateProjectId(null)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !activateSubmitting) {
            setActivateModalOpen(false)
            setPendingActivateProjectId(null)
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="activate-project-dialog-title"
          className="activate-project-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="activate-project-dialog-title">
            Activate this project?
          </h2>
          <div className="activate-project-summary-card">
            <div className="activate-project-summary-badge-row">
              <span className="activate-project-approved-badge">Approved</span>
            </div>
            <div className="activate-project-summary-row">
              <span>Client</span>
              <span>{activateContextClient}</span>
            </div>
            {activateContextApproved > 0 ? (
              <div className="activate-project-summary-row total">
                <span>Approved estimate</span>
                <span>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  }).format(activateContextApproved)}
                </span>
              </div>
            ) : null}
          </div>
          <div className="projects-activate-dates">
            <div className="projects-activate-date-field">
              <label className="projects-activate-date-label" htmlFor="activate-start-date">
                Start date <span className="text-[var(--red)]">*</span>
              </label>
              <div className="projects-activate-date-input-wrap">
                <input
                  id="activate-start-date"
                  type="date"
                  className="d-date-in projects-activate-d-date"
                  value={activateStartDate}
                  onChange={(e) => setActivateStartDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="projects-activate-date-field">
              <label className="projects-activate-date-label" htmlFor="activate-end-date">
                End date <span className="projects-activate-date-optional">(optional)</span>
              </label>
              <div className="projects-activate-date-input-wrap">
                <input
                  id="activate-end-date"
                  type="date"
                  className="d-date-in projects-activate-d-date"
                  value={activateEndDate}
                  onChange={(e) => setActivateEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <p className="activate-project-info-line">
            Moving to Active will unlock scheduling, crew assignment, and progress invoicing.
          </p>
          {activateError && (
            <p className="projects-activate-error" role="alert">
              {activateError}
            </p>
          )}
          <div className="activate-project-modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={activateSubmitting}
              onClick={() => {
                if (!activateSubmitting) {
                  setActivateModalOpen(false)
                  setPendingActivateProjectId(null)
                }
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="activate-project-confirm-btn"
              disabled={activateSubmitting || !activateStartDate.trim()}
              onClick={async () => {
                if (!activateContextId || !activateStartDate.trim()) return
                setActivateSubmitting(true)
                setActivateError(null)
                try {
                  await api.projects.update(activateContextId, {
                    status: 'active',
                    expected_start_date: activateStartDate.trim(),
                    expected_end_date: activateEndDate.trim() || undefined,
                  })
                  setActivateModalOpen(false)
                  setPendingActivateProjectId(null)
                  setDetailRefreshTrigger((t) => t + 1)
                  api.dashboard.getProjects().then(setProjects).catch(() => {})
                  setActivateSuccessToast('Project activated.')
                } catch (err) {
                  setActivateError(err instanceof Error ? err.message : 'Activation failed')
                } finally {
                  setActivateSubmitting(false)
                }
              }}
            >
              {activateSubmitting ? 'Activating…' : 'Activate Project →'}
            </button>
          </div>
        </div>
      </div>
    ) : null

  const activateSuccessToastEl = activateSuccessToast ? (
    <div className="projects-activate-success-toast" role="status">
      {activateSuccessToast}
    </div>
  ) : null

  /** Must run on every render (before any early return) — detail UI depends on these. */
  const phaseIdsWithPaymentMilestone = useMemo(() => {
    const s = new Set<string>()
    if (!id || !acceptedEstimate || !acceptedEstimateDetail || phases.length === 0) return s
    for (const ph of phases) {
      const row = getUninvoicedPaymentForPhase(phases, ph.id, acceptedEstimate, acceptedEstimateDetail)
      if (row) s.add(ph.id)
    }
    return s
  }, [id, phases, acceptedEstimate, acceptedEstimateDetail])

  const maybeOfferPaymentPrompt = useCallback(
    (phaseId: string) => {
      if (!id || !project || !acceptedEstimate || !acceptedEstimateDetail) return
      if (isPhasePaymentPromptDismissed(id, phaseId)) return
      const payment = getUninvoicedPaymentForPhase(phases, phaseId, acceptedEstimate, acceptedEstimateDetail)
      if (!payment) return
      const email = (project.client_email || '').trim()
      if (!email) {
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('Add a client email on this project to send a payment request.')
        }
        return
      }
      const phaseName = phases.find((p) => p.id === phaseId)?.name?.trim() || payment.label
      setPaymentPrompt({
        phaseId,
        phaseName,
        amount: payment.amount,
        clientEmail: email,
      })
    },
    [id, project, acceptedEstimate, acceptedEstimateDetail, phases]
  )

  const handlePhaseMarkComplete = useCallback(
    async (phaseId: string) => {
      if (!id || !project) return
      const phaseTasks = tasks.filter((t) => t.phase_id === phaseId)
      try {
        if (phaseTasks.length > 0) {
          await Promise.all(phaseTasks.map((t) => api.projects.updateTask(id, t.id, { completed: true })))
        }
        const taskList = await api.projects.getTasks(id)
        setTasks(taskList)
        const startFallback =
          project.expected_start_date || builderMeta.startDate || dayjs().format('YYYY-MM-DD')
        const built = apiToBuilder(project, phases, taskList, milestones, startFallback)
        setBuilderPhases(built.phases)
        setBuilderMilestones(built.milestones)
        setBuilderMeta({ projectName: built.projectName, startDate: built.startDate, gcOwner: built.gcOwner })
        maybeOfferPaymentPrompt(phaseId)
      } catch (e) {
        console.error('[ProjectsPage] mark phase complete', e)
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(e instanceof Error ? e.message : 'Could not update tasks')
        }
      }
    },
    [id, project, tasks, phases, milestones, builderMeta.startDate, maybeOfferPaymentPrompt]
  )

  const handleSendPaymentPrompt = useCallback(async () => {
    if (!paymentPrompt || !id || !acceptedEstimate) return
    setPaymentSending(true)
    try {
      await sendProgressPaymentForPhase({
        phases,
        estimateId: acceptedEstimate.id,
        phaseId: paymentPrompt.phaseId,
        phaseName: paymentPrompt.phaseName,
        clientEmail: paymentPrompt.clientEmail,
      })
      setPaymentPrompt(null)
      setDetailRefreshTrigger((t) => t + 1)
      setActivateSuccessToast('Payment request sent.')
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(e instanceof Error ? e.message : 'Failed to send payment request')
      }
    } finally {
      setPaymentSending(false)
    }
  }, [paymentPrompt, id, acceptedEstimate, phases])

  const handleDismissPaymentPrompt = useCallback(() => {
    if (!paymentPrompt || !id) return
    dismissPhasePaymentPrompt(id, paymentPrompt.phaseId)
    setPaymentPrompt(null)
  }, [paymentPrompt, id])

  if (id === undefined) {
    const searchLower = search.trim().toLowerCase()
    const searchMatch = (p: DashboardProject) =>
      !searchLower || p.name.toLowerCase().includes(searchLower)
    /** Search only — status tab counts must not use status-filtered rows or every badge goes wrong when filter !== 'all'. */
    const searchFilteredProjects = projects.filter(searchMatch)
    const filterMatch = (p: DashboardProject) => {
      if (filter === 'all') return true
      return colMatchesStatus(filter, p.status ?? '')
    }
    const displayedProjects = searchFilteredProjects.filter(filterMatch)
    const activeCount = displayedProjects.filter((p) => (p.status ?? 'active').toLowerCase() === 'active').length

    const renderBoardCard = (p: DashboardProject, col: (typeof PIPELINE_COLUMNS)[number]) => {
      const budgetTotal = p.budget_total ?? p.estimated_value ?? 0
      const currentPhase = p.phases?.find((ph) => !ph.completed)?.name ?? (p.phases?.length ? p.phases[p.phases.length - 1]?.name : null)
      const address = [p.address_line_1, p.city, p.state, p.postal_code].filter(Boolean).join(', ') || null
      return (
        <div
          key={p.id}
          role="button"
          tabIndex={0}
          className="projects-board-card"
          style={{ borderLeftColor: col.barColor }}
          onClick={() => navigate(`/projects/${p.id}`)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/projects/${p.id}`) } }}
        >
          <div className="projects-board-card-name">{p.name}</div>
          {address ? <div className="projects-board-card-address">{address}</div> : null}
          {budgetTotal > 0 ? <div className="projects-board-card-budget">${budgetTotal.toLocaleString()}</div> : null}
          {currentPhase ? <div className="projects-board-card-phase">{currentPhase}</div> : null}
          {col.key === 'awaiting_approval' ? (() => {
            const estimate = estimatesByProjectId[p.id]
            const sentNotViewed = estimate?.status === 'sent' && !estimate?.viewed_at
            const viewed = estimate?.status === 'viewed' || (estimate?.status === 'sent' && estimate?.viewed_at)
            const changesRequested = estimate?.status === 'changes_requested'
            const accepted = estimate?.status === 'accepted'
            return (
              <div className="projects-board-card-estimate-status">
                {!estimate ? null : sentNotViewed ? (
                  <span className="projects-board-card-estimate-status-gray">Not opened yet</span>
                ) : viewed ? (
                  <span className="projects-board-card-estimate-status-blue">Opened {formatRelative(estimate.viewed_at)}</span>
                ) : changesRequested ? (
                  <>
                    <span className="projects-board-card-estimate-status-amber">Changes requested</span>
                    <button
                      type="button"
                      className="projects-board-card-revise"
                      onClick={(e) => { e.stopPropagation(); setReviseEstimate({ projectId: p.id, estimateId: estimate.id }) }}
                    >
                      Revise →
                    </button>
                  </>
                ) : null}
                {accepted ? (
                  <button
                    type="button"
                    className="projects-board-card-convert"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConvertConfirmProject({
                        id: p.id,
                        name: p.name,
                        estimateTotal: estimate.total_amount,
                        estimateId: estimate.id,
                      })
                    }}
                  >
                    Convert to Job →
                  </button>
                ) : null}
              </div>
            )
          })() : null}
          {col.key === 'backlog' ? (
            <button
              type="button"
              className="projects-board-card-activate"
              onClick={(e) => {
                e.stopPropagation()
                setPendingActivateProjectId(p.id)
                setActivateModalOpen(true)
              }}
            >
              Activate →
            </button>
          ) : null}
          <ProjectDocumentCountBadge count={p.document_count ?? 0} variant="board" />
          <button
            type="button"
            className="projects-board-card-delete"
            title="Delete project"
            aria-label="Delete project"
            onClick={(e) => { e.stopPropagation(); setDeleteConfirmProject(toProject(p)) }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
      )
    }

    return (
      <div className="min-h-full">
        <div className="w-full max-w-[1600px] mx-auto projects-list-page">
          {/* Header */}
          <div className="projects-list-header">
            <div>
              <h1 className="projects-list-title">Projects</h1>
              <p className="projects-list-sub">
                {displayedProjects.length} project{displayedProjects.length !== 1 ? 's' : ''} · {activeCount} active
              </p>
            </div>
            <div className="projects-list-actions">
              <div className="projects-list-search-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="projects-list-search"
                />
              </div>
              <div className="projects-list-view-toggle">
                <button
                  type="button"
                  onClick={() => setListView('board')}
                  className={`projects-list-view-btn ${listView === 'board' ? 'active' : ''}`}
                  aria-label="Board view"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="5" height="18" /><rect x="9.5" y="3" width="5" height="18" /><rect x="16" y="3" width="5" height="18" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setListView('grid')}
                  className={`projects-list-view-btn ${listView === 'grid' ? 'active' : ''}`}
                  aria-label="Grid view"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setListView('table')}
                  className={`projects-list-view-btn ${listView === 'table' ? 'active' : ''}`}
                  aria-label="List view"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openProductLibrary() }}
                className="project-overview-hero-btn project-overview-hero-build-estimate-secondary"
              >
                Products & Services
              </button>
              <button type="button" onClick={() => setNewEstimateOpen(true)} className="projects-list-new-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New project
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="projects-list-filters">
            {(['all', 'estimating', 'awaiting_approval', 'backlog', 'active', 'on_hold', 'completed'] as const).map((tab) => {
              const count =
                tab === 'all'
                  ? searchFilteredProjects.length
                  : searchFilteredProjects.filter((p) => colMatchesStatus(tab, p.status ?? '')).length
              const label = FILTER_LABELS[tab] ?? tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`projects-list-filter-btn ${filter === tab ? 'active' : ''}`}
                >
                  {label}
                  <span className="projects-list-filter-count">{count}</span>
                </button>
              )
            })}
          </div>

          {loading ? (
            <div className="page-loading" style={{ minHeight: '40vh' }}>
              <div className="page-loading-skeleton">
                <div className="skeleton" />
                <div className="skeleton" />
                <div className="skeleton" />
              </div>
            </div>
            ) : listView === 'board' ? (
            <div className="projects-board-wrapper">
              <div className="projects-board">
                {PIPELINE_COLUMNS_MAIN.map((col) => {
                  const columnProjects = displayedProjects.filter((p) => colMatchesStatus(col.key, p.status ?? ''))
                  return (
                    <div key={col.key} className="projects-board-column" style={{ borderTopColor: col.barColor }}>
                      <div className="projects-board-column-header">
                        <span className="projects-board-column-dot" style={{ backgroundColor: col.dotColor }} />
                        <span className="projects-board-column-label">{col.label}</span>
                        <span className="projects-board-column-count">{columnProjects.length}</span>
                      </div>
                      <div className="projects-board-column-cards">
                        {columnProjects.length === 0 ? (
                          <div className="projects-board-empty">Empty</div>
                        ) : (
                          columnProjects.map((p) => renderBoardCard(p, col))
                        )}
                      </div>
                      {col.key === 'estimating' ? (
                        <button type="button" className="projects-board-add" onClick={() => setNewEstimateOpen(true)}>
                          + New Estimate
                        </button>
                      ) : col.key === 'active' ? (
                        <button type="button" className="projects-board-add" onClick={() => setNewEstimateOpen(true)}>
                          + New Project
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              {(() => {
                const backlogCol = PIPELINE_COLUMNS.find((c) => c.key === 'backlog')!
                const backlogProjects = displayedProjects.filter((p) => colMatchesStatus('backlog', p.status ?? ''))
                return (
                  <div className="projects-board-backlog">
                    <div className="projects-board-backlog-header" style={{ borderTopColor: backlogCol.barColor }}>
                      <span className="projects-board-column-dot" style={{ backgroundColor: backlogCol.dotColor }} />
                      <span className="projects-board-backlog-title">{backlogCol.label}</span>
                      <span className="projects-board-column-count">{backlogProjects.length}</span>
                    </div>
                    <div className="projects-board-backlog-cards">
                      {backlogProjects.length === 0 ? (
                        <div className="projects-board-empty">Empty</div>
                      ) : (
                        backlogProjects.map((p) => renderBoardCard(p, backlogCol))
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
            ) : listView === 'table' ? (
            displayedProjects.length === 0 ? (
              <p className="text-muted dark:text-white-dim py-8 text-center">
                {search.trim() || filter !== 'all'
                  ? 'No projects match the current filters.'
                  : 'Real projects you create will appear here.'}
              </p>
            ) : (
              <div className="projects-list-table">
                <div className="projects-list-table-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px 44px' }}>
                  <span>Project</span><span>Status</span><span>Phase</span><span>Budget (Actual)</span><span>Days Left</span><span>PM</span><span></span>
                </div>
                {displayedProjects.map((p) => {
                  const budgetTotal = p.budget_total ?? 0
                  const spentTotal = p.spent_total ?? 0
                  const budgetPct = budgetTotal > 0 ? Math.round((spentTotal / budgetTotal) * 100) : 0
                  const currentPhase = p.phases?.find((ph) => !ph.completed)?.name ?? (p.phases?.length ? p.phases[p.phases.length - 1]?.name : null)
                  const sn = normStatus(p.status ?? '')
                  const isBacklogLike = sn === 'backlog' || sn === 'awaiting_job_creation' || sn === 'planning'
                  const statusStyle = (p.status ?? 'active') === 'active' ? { bg: 'var(--blue-bg)', text: 'var(--blue)', dot: '#3b82f6' } :
                    isBacklogLike ? { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' } :
                    (p.status ?? '') === 'on_hold' ? { bg: 'var(--bg-base)', text: 'var(--text-muted)', dot: '#6b7280' } :
                    (p.status ?? '') === 'completed' ? { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' } :
                    { bg: 'var(--bg-base)', text: 'var(--text-muted)', dot: '#6b7280' }
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/projects/${p.id}`) } }}
                      className="projects-list-table-row"
                      style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px 44px', borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#6b7280' }}
                    >
                      <div>
                        <div className="font-semibold text-[14px] text-gray-900 dark:text-landing-white">{p.name}</div>
                        <div className="text-xs text-muted dark:text-white-dim">
                          {p.address_line_1 || p.city || '—'}
                        </div>
                      </div>
                      <span className="projects-card-status-pill" style={{ background: statusStyle.bg, color: statusStyle.text, width: 'fit-content' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusStyle.dot }} />
                        {displayProjectStatusLabel(p.status)}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-white-dim font-medium">{currentPhase ?? '—'}</span>
                      <div>
                        <div className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-landing-white">${spentTotal.toLocaleString()}</div>
                        <div className="text-[10px] text-muted dark:text-white-dim">{budgetTotal > 0 ? `${budgetPct}% of $${budgetTotal.toLocaleString()} budget` : '—'}</div>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-landing-white">{p.days_left != null ? String(p.days_left) : '—'}</span>
                      <div className="projects-card-pm">
                        {p.client ? <span className="text-xs text-gray-600 dark:text-white-dim">{p.client}</span> : <span className="text-xs text-muted">—</span>}
                      </div>
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmProject(toProject(p))}
                          className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                          title="Delete project"
                          aria-label="Delete project"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            <div className="projects-list-grid">
              {displayedProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={toProject(p)}
                  cardData={toCardData(p)}
                  onDelete={(proj) => setDeleteConfirmProject(proj)}
                />
              ))}
              {displayedProjects.length === 0 && (
                <p className="text-muted dark:text-white-dim col-span-full py-8 text-center">
                  {search.trim() || filter !== 'all'
                    ? 'No projects match the current filters.'
                    : 'Create a project to get started.'}
                </p>
              )}
              <button
                type="button"
                onClick={() => setNewEstimateOpen(true)}
                className="projects-new-card"
              >
                <div className="projects-new-card-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <span className="projects-new-card-text">Start a new project</span>
              </button>
            </div>
          )}
          {newEstimateOpen && (
            <EstimateBuilderModal
              jobs={estimateModalJobs}
              onClose={() => setNewEstimateOpen(false)}
              onSave={(_estimateId, _payload) => setNewEstimateOpen(false)}
              onComplete={(createdProject) => {
                setNewEstimateOpen(false)
                navigate(`/projects/${createdProject.id}`)
              }}
            />
          )}
          {deleteConfirmProject && (
            <ConfirmDeleteProjectModal
              project={deleteConfirmProject}
              onClose={() => { setDeleteConfirmProject(null); setDeleteError(null) }}
              onConfirm={handleDeleteProject}
              isDeleting={isDeletingProject}
              error={deleteError}
            />
          )}
          {convertConfirmProject && (
            <div
              className="projects-convert-modal-overlay"
              onClick={() => { if (!convertInProgress) setConvertConfirmProject(null) }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="convert-modal-title"
            >
              <div className="projects-convert-modal" onClick={(e) => e.stopPropagation()}>
                <h2 id="convert-modal-title" className="projects-convert-modal-title">Convert to Job</h2>
                <p className="projects-convert-modal-text">
                  This will create an active job from this estimate. The estimate total of ${convertConfirmProject.estimateTotal.toLocaleString()} will be set as the project budget.
                </p>
                <div className="projects-convert-modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { if (!convertInProgress) setConvertConfirmProject(null) }}
                    disabled={convertInProgress}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={convertInProgress}
                    onClick={async () => {
                      const pid = convertConfirmProject.id
                      const eid = convertConfirmProject.estimateId
                      setConvertInProgress(true)
                      try {
                        await api.projects.update(pid, {
                          status: 'backlog',
                          estimated_value: convertConfirmProject.estimateTotal,
                        })
                        try {
                          await api.projects.seedBudgetFromEstimate(pid, { estimateId: eid })
                        } catch (seedErr) {
                          console.error('[Convert to Job] seed budget from estimate', seedErr)
                        }
                        setConvertConfirmProject(null)
                        navigate(`/projects/${pid}`)
                      } catch (err) {
                        console.error(err)
                      } finally {
                        setConvertInProgress(false)
                      }
                    }}
                  >
                    {convertInProgress ? 'Converting…' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {reviseEstimate && (() => {
            const revProj = projects.find((pr) => pr.id === reviseEstimate.projectId)
            const prefillFromProject: PrefillClientInfo | undefined = revProj
              ? {
                  projectName: revProj.name ?? '',
                  planType: (revProj.plan_type as PrefillClientInfo['planType']) ?? 'residential',
                  clientName: revProj.assigned_to_name ?? revProj.client ?? '',
                  clientEmail: revProj.client_email?.trim() ?? '',
                  clientPhone: revProj.client_phone?.trim() ?? '',
                  projectAddress: [revProj.address_line_1, revProj.city, revProj.state, revProj.postal_code].filter(Boolean).join(', ') || undefined,
                }
              : undefined
            return (
              <EstimateBuilderModal
                jobs={[]}
                projectId={reviseEstimate.projectId}
                estimateId={reviseEstimate.estimateId}
                prefillClientInfo={prefillFromProject}
                prefillLineItems={undefined}
                onClose={() => { setReviseEstimate(null); refetchEstimatesForList() }}
                onSave={() => { setReviseEstimate(null); refetchEstimatesForList() }}
              />
            )
          })()}
          {takeoffInProgress && (
            <TakeoffProgressPopup
              progress={takeoffProgress}
              message={takeoffMessage}
              startTime={takeoffStartTime}
            />
          )}
          {activateProjectModalEl}
          {activateSuccessToastEl}
        </div>
      </div>
    )
  }

  if (id && !project) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
        <div className="page-loading">
          <div className="page-loading-skeleton">
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </div>
        {takeoffInProgress && (
          <TakeoffProgressPopup
            progress={takeoffProgress}
            message={takeoffMessage}
            startTime={takeoffStartTime}
          />
        )}
        {activateProjectModalEl}
        {activateSuccessToastEl}
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4">
          {error || 'Project not found'}
        </div>
        <Link to="/projects" className="mt-2 inline-block text-accent hover:underline">
          Back to projects
        </Link>
        {takeoffInProgress && (
          <TakeoffProgressPopup
            progress={takeoffProgress}
            message={takeoffMessage}
            startTime={takeoffStartTime}
          />
        )}
      </div>
    )
  }

  const budgetSummary = budget?.summary ?? { predicted_total: 0, actual_total: 0, profitability: 0 }
  const approvedCOTotal = budget?.approved_change_orders_total ?? 0
  const linePredictedPlusCo = budgetSummary.predicted_total + approvedCOTotal
  const estVal = Number(project?.estimated_value) || 0
  const revisedBudget =
    linePredictedPlusCo > 0 ? linePredictedPlusCo : estVal > 0 ? estVal + approvedCOTotal : linePredictedPlusCo
  const isUnderBudget = revisedBudget > 0 && budgetSummary.actual_total <= revisedBudget
  const timelineStart = phases.length
    ? phases.reduce((min, p) => (p.start_date < min ? p.start_date : min), phases[0].start_date)
    : project?.expected_start_date
  const timelineEnd = phases.length
    ? phases.reduce((max, p) => (p.end_date > max ? p.end_date : max), phases[0].end_date)
    : project?.expected_end_date
  const timelineLabel =
    timelineStart && timelineEnd
      ? `${formatDate(timelineStart)} – ${formatDate(timelineEnd)}`
      : timelineStart
        ? formatDate(timelineStart)
        : timelineEnd
          ? formatDate(timelineEnd)
          : '—'

  const totalDays = timelineStart && timelineEnd ? dayjs(timelineEnd).diff(dayjs(timelineStart), 'day') + 1 : null
  const daysLeft = totalDays != null && timelineEnd ? Math.max(0, dayjs(timelineEnd).diff(dayjs(), 'day')) : null
  /** Elapsed % along [start, end]: 0% before start, 100% on/after end — not derived from "days left" (which breaks when today is before start). */
  let timelinePct = 0
  if (totalDays != null && totalDays > 0 && timelineStart && timelineEnd) {
    const start = dayjs(timelineStart).startOf('day')
    const now = dayjs().startOf('day')
    const elapsedDays = Math.min(totalDays, Math.max(0, now.diff(start, 'day') + 1))
    timelinePct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)))
  }
  const budgetPct = revisedBudget > 0
    ? Math.round((budgetSummary.actual_total / revisedBudget) * 100)
    : 0

  const statusKey = (project?.status ?? 'active').toLowerCase().replace(/[\s-]+/g, '_')
  const budgetShowsAwaitingApproval = statusKey === 'awaiting_approval'
  const hasEstimateBudgetPreview =
    budgetShowsAwaitingApproval &&
    awaitingApprovalEstimatePreview != null &&
    (awaitingApprovalEstimatePreview.total > 0 || awaitingApprovalEstimatePreview.items.length > 0)
  const overviewDisplayBudget = hasEstimateBudgetPreview
    ? awaitingApprovalEstimatePreview!.total
    : revisedBudget
  const overviewBudgetLineItems = hasEstimateBudgetPreview
    ? awaitingApprovalEstimatePreview!.items
    : (budget?.items ?? [])
  const overviewBudgetDisplayItems = hasEstimateBudgetPreview
    ? overviewBudgetLineItems.map((row) => {
        const match = (budget?.items ?? []).find(
          (it) => it.label.toLowerCase() === row.label.toLowerCase()
        )
        return { ...row, actual: match?.actual ?? 0 }
      })
    : overviewBudgetLineItems
  const overviewBudgetPct =
    overviewDisplayBudget > 0
      ? Math.round((budgetSummary.actual_total / overviewDisplayBudget) * 100)
      : 0
  const isUnderBudgetOverview =
    overviewDisplayBudget > 0 && budgetSummary.actual_total <= overviewDisplayBudget
  const healthBudgetForScore = hasEstimateBudgetPreview ? isUnderBudgetOverview : isUnderBudget

  const healthScore = Math.min(100, Math.max(0,
    (healthBudgetForScore ? 40 : 20) +
    (daysLeft == null || daysLeft > 7 ? 35 : daysLeft > 0 ? 20 : 0) +
    (timelinePct <= 90 ? 25 : 15)
  ))

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: 'grid' },
    { id: 'worktypes' as const, label: 'Work Types & Pay', icon: 'briefcase' },
    { id: 'crew' as const, label: 'Crew', icon: 'people' },
    { id: 'geofence' as const, label: 'GPS / Geofence', icon: 'map' },
    { id: 'budget' as const, label: 'Change Orders', icon: 'dollar' },
    { id: 'schedule' as const, label: 'Schedule', icon: 'calendar' },
    { id: 'media' as const, label: 'Job Walk Media', icon: 'image' },
    { id: 'takeoff' as const, label: 'Takeoff', icon: 'document' },
    { id: 'bidsheet' as const, label: 'Bid Sheet', icon: 'checklist' },
    { id: 'documents' as const, label: 'Documents', icon: 'document' },
  ]

  const statusPillStyle =
    statusKey === 'active'
      ? { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' }
      : statusKey === 'planning'
        ? { bg: '#fefce8', text: '#a16207', dot: '#eab308' }
        : statusKey === 'backlog' || statusKey === 'awaiting_job_creation'
          ? { bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' }
          : statusKey === 'on_hold'
            ? { bg: '#f3f4f6', text: '#374151', dot: '#6b7280' }
            : statusKey === 'completed'
              ? { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' }
              : { bg: '#f8fafc', text: '#64748b', dot: '#94a3b8' }
  const addressDisplay = [project?.address_line_1, project?.city].filter(Boolean).join(', ') || '—'
  const projectGeofenceAddressLine = project
    ? [project.address_line_1, project.address_line_2, [project.city, project.state, project.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : ''
  const BUDGET_ITEM_COLORS: Record<string, string> = { Labor: '#6366f1', Materials: '#0ea5e9', Subcontractors: '#8b5cf6' }
  const TAG_COLORS: Record<string, { bg: string; text: string }> = { Media: { bg: '#eff6ff', text: '#1d4ed8' }, Time: { bg: '#f0fdf4', text: '#15803d' }, Budget: { bg: '#fefce8', text: '#a16207' }, Bid: { bg: '#fdf4ff', text: '#7e22ce' }, Schedule: { bg: '#fff7ed', text: '#c2410c' }, Takeoff: { bg: '#eff6ff', text: '#1d4ed8' } }

  function formatActivityTime(at: string): string {
    if (!at) return '—'
    const d = dayjs(at)
    const now = dayjs()
    const diffMins = now.diff(d, 'minute')
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = now.diff(d, 'hour')
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffHours < 48 && now.date() !== d.date()) return 'Yesterday'
    if (diffHours < 24 * 7) return d.format('ddd')
    return d.format('MMM D')
  }

  function getInitials(name: string): string {
    if (!name?.trim()) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2)
    return name.slice(0, 2).toUpperCase()
  }

  const ACTIVITY_AVATAR_COLORS = ['#6366f1', '#16a34a', '#0ea5e9', '#8b5cf6', '#c2410c']
  function avatarColorFor(who: string, index: number): string {
    if (!who) return ACTIVITY_AVATAR_COLORS[index % ACTIVITY_AVATAR_COLORS.length]
    let h = 0
    for (let i = 0; i < who.length; i++) h = (h << 5) - h + who.charCodeAt(i)
    return ACTIVITY_AVATAR_COLORS[Math.abs(h) % ACTIVITY_AVATAR_COLORS.length]
  }

  return (
    <div className="project-overview-page w-full max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="project-overview-hero">
        <div className="project-overview-breadcrumb-wrap">
          <Link to="/projects" className="project-overview-breadcrumb">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Projects
          </Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">{project?.name} – {addressDisplay}</span>
        </div>
        <div className="project-overview-title-row">
          <div>
            <div className="project-overview-badges">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5" style={{ background: statusPillStyle.bg, color: statusPillStyle.text }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusPillStyle.dot }} />
                {displayProjectStatusLabel(project?.status)}
              </span>
            </div>
            <h1 className="project-overview-title">
              {project?.name} <span className="project-overview-title-muted">– {addressDisplay}</span>
            </h1>
          </div>
          <div className="project-overview-hero-actions relative" ref={heroMenuRef}>
            {project?.status === 'estimating' && (
              <>
                <button
                  type="button"
                  className="project-overview-hero-btn project-overview-hero-btn-primary project-overview-hero-build-estimate"
                  onClick={() => { setBuildEstimateBlankMode(false); setBuildEstimateOpen(true) }}
                >
                  {hasPersistedJobEstimate ? 'Edit Estimate →' : 'Build Estimate →'}
                </button>
                <button
                  type="button"
                  className="project-overview-hero-btn project-overview-hero-build-estimate-secondary"
                  onClick={(e) => { e.stopPropagation(); openProductLibrary() }}
                >
                  Products & Services
                </button>
              </>
            )}
            {project?.status === 'backlog' && (
              <button
                type="button"
                className="project-overview-hero-btn project-overview-hero-btn-primary project-overview-hero-btn-activate"
                onClick={() => { setPendingActivateProjectId(null); setActivateModalOpen(true) }}
              >
                Activate Project →
              </button>
            )}
            <button
              type="button"
              className="project-overview-hero-menu-trigger"
              onClick={(e) => { e.stopPropagation(); setHeroMenuOpen((v) => !v) }}
              aria-expanded={heroMenuOpen}
              aria-haspopup="true"
              title="Project actions"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
            </button>
            {heroMenuOpen && (
              <div className="project-overview-hero-menu" role="menu">
                <button type="button" className="project-overview-hero-menu-item" role="menuitem" onClick={() => { setHeroMenuOpen(false); setSetupWizardOpen(true) }}>Edit</button>
                {project?.status !== 'estimating' && (
                  <button type="button" className="project-overview-hero-menu-item" role="menuitem" onClick={() => { setHeroMenuOpen(false) }}>Share</button>
                )}
                <button type="button" className="project-overview-hero-menu-item project-overview-hero-menu-item-danger" role="menuitem" onClick={() => { setHeroMenuOpen(false); project && setDeleteConfirmProject(project) }} title="Delete project">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KPI strip */}
        <div className="project-overview-kpi-strip">
          {project?.status === 'estimating' ? (
            <>
              <div className="project-overview-kpi-cell">
                <div className="project-overview-kpi-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  Client
                </div>
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">{project?.assigned_to_name || '—'}</div>
                {project?.client_email?.trim() ? (
                  <div className="text-[12px] text-[var(--text-muted)] mt-0.5">{project.client_email.trim()}</div>
                ) : null}
              </div>
              <div className="project-overview-kpi-cell">
                <div className="project-overview-kpi-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                  Plan type
                </div>
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {(project?.plan_type === 'commercial' && 'Commercial') || (project?.plan_type === 'civil' && 'Civil') || (project?.plan_type === 'auto' && 'Auto') || 'Residential'}
                </div>
              </div>
              <div className="project-overview-kpi-cell">
                <div className="project-overview-kpi-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  Created
                </div>
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">{project?.created_at ? formatDate(project.created_at) : '—'}</div>
              </div>
              <div className="project-overview-kpi-cell">
                <div className="project-overview-kpi-label">Takeoff</div>
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {takeoffs.length === 0 ? 'Not run' : `Complete — ${takeoffCategories.reduce((sum, cat) => sum + (cat.items?.length ?? 0), 0)} items`}
                </div>
              </div>
              <div className="project-overview-kpi-cell">
                <div className="project-overview-kpi-label">Bids</div>
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {(() => {
                    const tradeCount = workspaceBidSheet?.trade_packages?.length ?? 0
                    const awarded = workspaceBidSheet?.sub_bids?.filter((b) => b.awarded) ?? []
                    const tradesAwardedCount = new Set(awarded.map((b) => b.trade_package_id)).size
                    const totalAwarded = awarded.reduce((s, b) => s + (Number(b.amount) || 0), 0)
                    if (tradeCount === 0) return '0 trades'
                    if (tradesAwardedCount === 0) return `0 of ${tradeCount} trades awarded`
                    return `${tradesAwardedCount} of ${tradeCount} awarded · $${totalAwarded.toLocaleString()} total`
                  })()}
                </div>
              </div>
            </>
          ) : (
            <>
          <div className="project-overview-kpi-cell" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <HealthRing score={healthScore} />
            <div>
              <div className="project-overview-kpi-label">Project Health</div>
              <div className="text-xs text-[var(--text-primary)]">Based on budget,<br />schedule & activity</div>
            </div>
          </div>
          <div className="project-overview-kpi-cell">
            <div className="project-overview-kpi-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              Client
            </div>
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">{project?.assigned_to_name || '—'}</div>
          </div>
          <div className="project-overview-kpi-cell">
            <div className="project-overview-kpi-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              Plan type
            </div>
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">
              {(project?.plan_type === 'commercial' && 'Commercial') || (project?.plan_type === 'civil' && 'Civil') || (project?.plan_type === 'auto' && 'Auto') || 'Residential'}
            </div>
          </div>
          <div className="project-overview-kpi-cell">
            <div className="project-overview-kpi-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Timeline
            </div>
            <div className="text-[14px] font-semibold text-[var(--text-primary)]">{timelineLabel}</div>
            <div className="mt-1.5">
              <div className="flex justify-between mb-0.5 text-[11px] text-[var(--text-primary)]">
                <span>{timelinePct}% elapsed</span>
                <span className="font-semibold" style={{ color: daysLeft != null && daysLeft <= 7 ? 'var(--red)' : 'var(--text-primary)' }}>{daysLeft != null ? `${daysLeft}d left` : '—'}</span>
              </div>
              <div className="h-1 rounded-sm overflow-hidden bg-[var(--bg-base)]">
                <div className="h-full rounded-sm transition-[width]" style={{ width: `${timelinePct}%`, background: daysLeft != null && daysLeft <= 7 ? 'var(--red)' : 'var(--text-primary)' }} />
              </div>
            </div>
          </div>
          <div className="project-overview-kpi-cell">
            <div className="project-overview-kpi-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              Budget vs Actual
            </div>
            {budgetShowsAwaitingApproval && !hasEstimateBudgetPreview ? (
              <>
                <div className="text-[14px] font-semibold" style={{ color: 'var(--est-amber, #b86e1a)' }}>
                  Awaiting Approval
                </div>
                <div className="mt-1.5">
                  <div className="text-[11px] text-[var(--text-muted)] mb-0.5">Budget after estimate is approved</div>
                  <div className="h-1 rounded-sm overflow-hidden bg-[var(--bg-base)]">
                    <div className="h-full rounded-sm" style={{ width: 0, background: 'var(--border)' }} />
                  </div>
                </div>
              </>
            ) : budgetShowsAwaitingApproval && hasEstimateBudgetPreview ? (
              <>
                <div className="text-[14px] font-bold font-mono" style={{ color: isUnderBudgetOverview ? 'var(--green,#16a34a)' : 'var(--red)' }}>
                  ${budgetSummary.actual_total.toLocaleString()}{' '}
                  <span className="text-xs font-normal font-sans text-[var(--text-muted)] opacity-75">
                    / ${overviewDisplayBudget.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5">
                  <div className="text-[11px] text-[var(--text-muted)] mb-0.5">
                    {overviewBudgetPct}% of estimate · pending approval
                  </div>
                  <div className="h-1 rounded-sm overflow-hidden bg-[var(--bg-base)]">
                    <div
                      className="h-full rounded-sm transition-[width]"
                      style={{
                        width: `${Math.min(100, overviewBudgetPct)}%`,
                        background: overviewBudgetPct > 95 ? 'var(--red)' : overviewBudgetPct > 80 ? '#f59e0b' : 'var(--green,#16a34a)',
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-[14px] font-bold font-mono" style={{ color: isUnderBudget ? 'var(--green,#16a34a)' : 'var(--red)' }}>
                  ${budgetSummary.actual_total.toLocaleString()}{' '}
                  <span className="text-xs font-normal font-sans text-[var(--text-primary)]">
                    / ${revisedBudget.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5">
                  <div className="text-[11px] text-[var(--text-primary)] mb-0.5">{budgetPct}% used</div>
                  <div className="h-1 rounded-sm overflow-hidden bg-[var(--bg-base)]">
                    <div
                      className="h-full rounded-sm transition-[width]"
                      style={{
                        width: `${Math.min(100, budgetPct)}%`,
                        background: budgetPct > 95 ? 'var(--red)' : budgetPct > 80 ? '#f59e0b' : 'var(--green,#16a34a)',
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="project-overview-kpi-cell">
            <div className="project-overview-kpi-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              Build plans
            </div>
            {buildPlans.length > 0 ? (
              <div className="flex flex-col gap-1 mt-1 min-w-0">
                {buildPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={async () => {
                      if (!id) return
                      try {
                        const { url } = await api.projects.getBuildPlanViewUrl(id, plan.id)
                        window.open(url, '_blank')
                      } catch {
                        window.open(plan.url, '_blank')
                      }
                    }}
                    className="text-[12px] font-medium text-left text-[var(--accent)] hover:underline truncate cursor-pointer bg-transparent border-none p-0"
                    title={plan.file_name}
                  >
                    {plan.file_name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-[12px] text-[var(--text-muted)] mt-1">No plans. Use Edit to add.</div>
            )}
          </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <nav className="project-overview-tabs" aria-label="Project sections">
          {tabs.map((tab) => {
            const isEstimating = project?.status === 'estimating'
            const tabDisabledWhenEstimating = isEstimating && ['worktypes', 'crew', 'budget', 'schedule'].includes(tab.id)
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { if (!tabDisabledWhenEstimating) setActiveTab(tab.id) }}
                className={`project-overview-tab ${activeTab === tab.id ? 'active' : ''} ${tabDisabledWhenEstimating ? 'project-overview-tab--disabled' : ''}`}
                title={tabDisabledWhenEstimating ? 'Available after job is created' : undefined}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {paymentPrompt && id && (activeTab === 'overview' || activeTab === 'schedule') && (
        <div
          className="w-full min-w-0 px-8 py-3 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3"
          style={{ background: 'linear-gradient(90deg, #fffbeb 0%, #fff7ed 100%)' }}
          role="alert"
        >
          <p className="text-sm text-[var(--text-primary)] m-0 flex-1 min-w-[220px]">
            This phase has a payment milestone of <strong>{formatPhasePaymentUsd(paymentPrompt.amount)}</strong>. Send payment request to{' '}
            <strong>{paymentPrompt.clientEmail}</strong>?
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white hover:bg-[var(--bg-base)] dark:bg-dark-3 dark:hover:bg-dark-2"
              onClick={handleDismissPaymentPrompt}
              disabled={paymentSending}
            >
              Later
            </button>
            <button
              type="button"
              className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50"
              onClick={() => void handleSendPaymentPrompt()}
              disabled={paymentSending}
            >
              {paymentSending ? 'Sending…' : 'Send Now →'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'overview' && project && (
        <div className="project-overview-wrap">
          {project.status === 'estimating' ? (
            <section className="w-full min-w-0 px-8 py-6">
              <EstimatingWorkspace
                project={project}
                takeoffs={takeoffs.map((t) => ({ id: t.id, material_list: t.material_list, created_at: t.created_at }))}
                subcontractors={subcontractors}
                onRefreshTakeoffs={() => id && api.projects.getTakeoffs(id).then((toffs) => setTakeoffs(toffs?.length ? toffs : []))}
                onRefreshSubcontractors={refreshSubcontractors}
                onBuildEstimate={() => { setBuildEstimateBlankMode(false); setBuildEstimateOpen(true) }}
                estimateStageReady={estimateStageReady}
                hasSavedJobEstimate={hasPersistedJobEstimate}
                savedEstimateSummary={persistedEstimatePreview}
                takeoffBypassed={estimatingTakeoffBypassed}
                onBypassTakeoff={() => setEstimatingTakeoffBypassed(true)}
                bidSheetSkipped={estimatingBidSheetSkipped}
                onSkipBidSheet={() => setEstimatingBidSheetSkipped(true)}
                onViewFullTakeoff={() => setActiveTab('takeoff')}
                onViewBidSheet={() => setActiveTab('bidsheet')}
                onRefreshBidSheet={refreshWorkspaceBidSheet}
                lastBidSheetUpdated={lastBidSheetUpdated}
                onResendBid={id ? (subBidId) => api.projects.resendBid(id, subBidId).then(() => { refreshWorkspaceBidSheet() }) : undefined}
                onSetAwarded={
                  id
                    ? async (subBidId, awarded) => {
                        await api.projects.setSubBidAwarded(id, subBidId, awarded)
                        refreshWorkspaceBidSheet()
                      }
                    : undefined
                }
                onRemoveSubBid={
                  id
                    ? async (subBidId) => {
                        await api.projects.deleteSubBid(id, subBidId)
                        refreshWorkspaceBidSheet()
                      }
                    : undefined
                }
                onStartTakeoff={startTakeoff}
                takeoffResult={takeoffResult}
                takeoffError={takeoffError}
                takeoffInProgress={takeoffInProgress}
                takeoffProgress={takeoffProgress}
                takeoffMessage={takeoffMessage}
                takeoffStartTime={takeoffStartTime}
                bidSheet={workspaceBidSheet ?? null}
                onBuildBlankEstimate={() => { setBuildEstimateBlankMode(true); setBuildEstimateOpen(true) }}
              />
            </section>
          ) : (
          <>
          {overviewSetupReady && (
            <SetupBanner
              project={{
                assigned_to_name: project.assigned_to_name,
                phases,
                budget: hasEstimateBudgetPreview ? overviewDisplayBudget : revisedBudget,
                budgetItemsCount: hasEstimateBudgetPreview
                  ? overviewBudgetDisplayItems.length
                  : (budget?.items?.length ?? 0),
                team: subcontractors,
                workTypes,
                milestones,
              }}
              onOpenWizard={() => setSetupWizardOpen(true)}
            />
          )}
          {project.status === 'backlog' && (
            <div className="project-backlog-banner">
              <p className="project-backlog-banner-text">
                This project is approved and ready to start. Set a start date and activate when you&apos;re ready to begin.
              </p>
              <div className="project-backlog-banner-actions">
                <button
                  type="button"
                  className="project-overview-hero-btn project-overview-hero-btn-primary project-overview-hero-btn-activate shrink-0"
                  onClick={() => { setPendingActivateProjectId(null); setActivateModalOpen(true) }}
                >
                  Activate Project →
                </button>
              </div>
            </div>
          )}
          <div className="project-overview-body">
          {/* Col 1 – Project Breakdown + Milestones */}
          <div className="flex flex-col gap-[18px]">
            <div className="project-overview-card">
              <div className="project-overview-card-title">Project Breakdown</div>
              {project.scope && <div className="project-overview-card-subtitle">{project.scope}</div>}
              {acceptedEstimate && acceptedEstimateDetail && phases.length > 0 && phaseIdsWithPaymentMilestone.size > 0 && (
                <p className="text-[11px] text-[var(--text-muted)] mt-1 mb-2 leading-snug">
                  When a phase is done, use <strong className="text-[var(--text-primary)]">Mark complete</strong> to send its milestone invoice.
                </p>
              )}
              {acceptedEstimate && acceptedEstimateDetail && phases.length > 0 && phaseIdsWithPaymentMilestone.size === 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400/95 mt-1 mb-2 leading-snug">
                  No billable milestones match these phases yet. Align schedule phases with your accepted estimate’s progress milestones to enable invoicing.
                </p>
              )}
              <div className="flex flex-col gap-0">
                {phases.length > 0 ? phases.map((ph) => {
                  const today = dayjs().format('YYYY-MM-DD')
                  const status = today > ph.end_date ? 'complete' : today >= ph.start_date && today <= ph.end_date ? 'in-progress' : 'upcoming'
                  const cfg = { complete: { bg: '#f0fdf4', bar: '#16a34a', text: '#15803d', label: 'Complete' }, 'in-progress': { bg: '#eff6ff', bar: '#3b82f6', text: '#1d4ed8', label: 'In progress' }, upcoming: { bg: 'var(--bg-base)', bar: 'var(--border)', text: 'var(--text-muted)', label: 'Upcoming' } }[status]
                  const pct = status === 'complete' ? 100 : status === 'in-progress' ? 50 : 0
                  return (
                    <div key={ph.id} className="project-overview-phase-row">
                      <div className="flex justify-between items-center mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.bar }} />
                          <span className="project-overview-phase-name truncate">{ph.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {phaseIdsWithPaymentMilestone.has(ph.id) && acceptedEstimate && acceptedEstimateDetail && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--accent)]/35 bg-[var(--accent)]/[0.08] px-2 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/[0.14] whitespace-nowrap shrink-0"
                              onClick={() => void handlePhaseMarkComplete(ph.id)}
                            >
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              Mark complete
                            </button>
                          )}
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <div className="project-overview-phase-bar-wrap">
                          <div className="h-full rounded-sm transition-[width] duration-300" style={{ width: `${pct}%`, background: cfg.bar }} />
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono whitespace-nowrap">{dayjs(ph.start_date).format('MM/DD')} – {dayjs(ph.end_date).format('MM/DD')}</span>
                      </div>
                    </div>
                  )
                }) : <p className="text-sm text-[var(--text-muted)]">No phases yet.</p>}
              </div>
            </div>
            <div className="project-overview-card">
              <div className="project-overview-card-title">Key Milestones</div>
              <div className="flex flex-col gap-0">
                {milestones.length > 0 ? milestones.map((m) => (
                  <div key={m.id} className="project-overview-milestone-row">
                    <div className="project-overview-milestone-icon" style={{ background: m.completed ? '#f0fdf4' : '#fff7ed' }}>
                      {m.completed ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[var(--text-primary)]">{m.title}</div>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono">{formatDate(m.due_date)}</div>
                  </div>
                )) : <p className="text-sm text-[var(--text-muted)]">No milestones yet.</p>}
              </div>
            </div>
          </div>

          {/* Col 2 – Budget + Team */}
          <div className="flex flex-col gap-[18px]">
            <div className="project-overview-card">
              <div className="flex justify-between items-start mb-0">
                <div className="project-overview-card-title">Budget vs Actual</div>
                <button
                  type="button"
                  className="project-overview-card-action shrink-0 disabled:opacity-45 disabled:cursor-not-allowed"
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit' }}
                  disabled={project.status === 'estimating'}
                  title={project.status === 'estimating' ? 'Available after job is created' : 'Open Change Orders'}
                  onClick={() => { if (project.status !== 'estimating') setActiveTab('budget') }}
                >
                  Full breakdown →
                </button>
              </div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  {budgetShowsAwaitingApproval && !hasEstimateBudgetPreview ? (
                    <>
                      <div
                        className="text-[20px] font-semibold leading-snug max-w-[220px]"
                        style={{ color: 'var(--est-amber, #b86e1a)' }}
                      >
                        Awaiting Approval
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        Budget and actuals apply once the estimate is approved
                      </div>
                    </>
                  ) : budgetShowsAwaitingApproval && hasEstimateBudgetPreview ? (
                    <>
                      <div className="text-[22px] font-bold font-mono" style={{ color: isUnderBudgetOverview ? 'var(--green,#16a34a)' : 'var(--red)' }}>
                        ${budgetSummary.actual_total.toLocaleString()}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] opacity-80">
                        of ${overviewDisplayBudget.toLocaleString()}{' '}
                        <span className="italic">estimated</span> budget
                      </div>
                      <div className="text-[11px] mt-1 font-medium" style={{ color: 'var(--est-amber, #b86e1a)' }}>
                        Pending client approval — totals may change
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-[22px] font-bold font-mono" style={{ color: isUnderBudget ? 'var(--green,#16a34a)' : 'var(--red)' }}>
                        ${budgetSummary.actual_total.toLocaleString()}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">of ${revisedBudget.toLocaleString()} budget</div>
                    </>
                  )}
                </div>
              </div>
              {overviewBudgetDisplayItems.map((item) => {
                const provisionalBudget = hasEstimateBudgetPreview
                const categoryKeyForDisplay = budgetCategoryKeyFromEstimateSection(
                  item.category || item.label
                )
                const displayLabel = OVERVIEW_ESTIMATE_KEY_TO_LABEL[categoryKeyForDisplay] ?? item.label
                const over = item.actual > item.predicted
                const color = BUDGET_ITEM_COLORS[displayLabel] ?? '#6366f1'
                const maxVal = Math.max(item.predicted, item.actual)
                const budgetWidth = maxVal > 0 ? (item.predicted / maxVal) * 100 : 0
                const actualWidth = maxVal > 0 ? Math.min(100, (item.actual / maxVal) * 100) : 0
                const mutedBar = provisionalBudget ? 'opacity-45' : ''
                return (
                  <div
                    key={item.id}
                    className={`mb-3.5 last:mb-0 ${provisionalBudget ? 'opacity-[0.92]' : ''}`}
                  >
                    <div className="flex justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: provisionalBudget ? 0.55 : 1 }} />
                        <span className={`text-[13px] font-medium ${provisionalBudget ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>{displayLabel}</span>
                      </div>
                      <div className="flex gap-3 items-center">
                        <span className={`text-xs ${provisionalBudget ? 'text-[var(--text-muted)] opacity-70 italic' : 'text-[var(--text-muted)]'}`}>
                          ${item.predicted.toLocaleString()}
                          {provisionalBudget ? <span className="not-italic text-[10px] ml-1 opacity-80">(est.)</span> : null}
                        </span>
                        <span className="text-[13px] font-semibold font-mono" style={{ color: over ? 'var(--red)' : 'var(--text-primary)' }}>${item.actual.toLocaleString()}</span>
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: over ? '#fef2f2' : '#f0fdf4', color: over ? 'var(--red)' : 'var(--green,#16a34a)' }}>{over ? '-' : '+'}${Math.abs(item.actual - item.predicted).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-md overflow-hidden bg-[var(--bg-base)] relative">
                      <div className={`absolute left-0 top-0 h-full rounded-md bg-[var(--border)] ${mutedBar}`} style={{ width: `${budgetWidth}%` }} />
                      <div className="absolute left-0 top-0 h-full rounded-md opacity-90" style={{ width: `${actualWidth}%`, background: over ? 'var(--red)' : color }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="project-overview-card">
              <div className="project-overview-card-title">Team</div>
              <div className="flex flex-col gap-0">
                {(() => {
                  const empMap = new Map(rosterEmployees.map((e) => [e.id, e]))
                  const rosterRows = jobAssignments
                    .filter((a) => !a.ended_at)
                    .map((a) => {
                      const emp = empMap.get(a.employee_id)
                      return { assignment: a, name: emp?.name ?? a.employee_id, role: a.role_on_job || emp?.role || '—' }
                    })
                  const hasRoster = rosterRows.length > 0
                  const subTeamRows = groupSubcontractorsForTeamDisplay(subcontractors)
                  const hasSubs = subTeamRows.length > 0
                  if (!hasRoster && !hasSubs) return <p className="text-sm text-[var(--text-muted)]">No team members yet.</p>
                  return (
                    <>
                      {rosterRows.map(({ assignment, name, role }, i) => (
                        <div key={assignment.id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)]">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: ['#6366f1', '#0ea5e9', '#f59e0b'][i % 3] }}>{name.slice(0, 2).toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{name}</div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{role}</div>
                          </div>
                          <button type="button" className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-base)] border border-[var(--border)] px-2.5 py-1 rounded-md cursor-pointer">Message</button>
                        </div>
                      ))}
                      {subTeamRows.map((row, i) => (
                        <div key={row.dedupeKey} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: ['#6366f1', '#0ea5e9', '#f59e0b'][(rosterRows.length + i) % 3] }}>{row.name.slice(0, 2).toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{row.name}</div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{row.tradeLine}</div>
                          </div>
                          <button type="button" className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-base)] border border-[var(--border)] px-2.5 py-1 rounded-md cursor-pointer">Message</button>
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* Col 3 – Quick Actions + Live Activity */}
          <div className="flex flex-col gap-[18px]">
            <div className="project-overview-card">
              <div className="project-overview-card-title">Quick Actions</div>
              <div className="project-overview-quick-actions">
                {[
                  { label: 'Log Time', icon: '⏱', color: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
                  { label: 'Add Photo', icon: '📷', color: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
                  { label: 'Flag Issue', icon: '🚩', color: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
                  { label: 'Add Note', icon: '📝', color: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
                ].map((action) => (
                  <button key={action.label} type="button" className="project-overview-quick-btn" style={{ background: action.color, borderColor: action.border }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}>
                    <div className="text-lg mb-1">{action.icon}</div>
                    <div className="text-xs font-semibold" style={{ color: action.text }}>{action.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="project-overview-card">
              <div className="project-overview-card-title">Live Activity</div>
              <div className="project-overview-card-subtitle">Recent updates across this project</div>
              <div className="flex flex-col gap-0 relative">
                <div className="project-overview-activity-line" />
                {activity.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-4 pl-10">No recent activity yet.</p>
                ) : (
                  activity.map((a, i) => {
                    const tc = TAG_COLORS[a.tag] ?? { bg: 'var(--bg-base)', text: 'var(--text-secondary)' }
                    const displayAction = a.detail ? `${a.action}: ${a.detail}` : a.action
                    return (
                      <div key={`${a.at}-${i}`} className="project-overview-activity-item">
                        <div className="project-overview-activity-avatar" style={{ background: avatarColorFor(a.who, i) }}>
                          {getInitials(a.who || '')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {a.who && <span className="text-xs font-semibold text-[var(--text-primary)]">{a.who} </span>}
                              <span className="text-xs text-[var(--text-secondary)]">{displayAction}</span>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: tc.bg, color: tc.text }}>{a.tag}</span>
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{formatActivityTime(a.at)}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <button type="button" className="project-overview-view-all">View all activity</button>
            </div>
          </div>
          </div>
          </>
          )}
        </div>
      )}

      {activeTab === 'worktypes' && project && (
        <section className="w-full min-w-0 px-8 py-6">
          <WorkTypesTab
            projectId={project.id}
            projectName={project.name}
            workTypes={workTypes}
            onWorkTypesChange={setWorkTypes}
            readOnly={false}
          />
        </section>
      )}

      {activeTab === 'crew' && project && (
        <section className="w-full min-w-0 px-8 py-6">
          <ProjectCrewTab
            projectId={project.id}
            projectName={project.name}
            readOnly={false}
            subcontractors={subcontractors}
            jobAssignments={jobAssignments}
            rosterEmployees={rosterEmployees}
            onSubcontractorAdded={refreshSubcontractors}
            onCrewChange={() => setDetailRefreshTrigger((t) => t + 1)}
            onOpenSetupWizard={() => setSetupWizardOpen(true)}
          />
        </section>
      )}

      {activeTab === 'geofence' && project && (
        <section className="w-full min-w-0 px-8 py-6">
          <GeofenceTab
            projectId={project.id}
            projectName={project.name}
            projectAddress={projectGeofenceAddressLine}
          />
        </section>
      )}

      {activeTab === 'schedule' && (
        <section className="w-full min-w-0 px-8 py-6">
          <ScheduleBuilder
            projectName={builderMeta.projectName}
            startDate={builderMeta.startDate}
            gcOwner={builderMeta.gcOwner}
            phases={builderPhases}
            milestones={builderMilestones}
            onPhasesChange={setBuilderPhases}
            onMilestonesChange={setBuilderMilestones}
            onMetaChange={setBuilderMeta}
            onPhaseMarkComplete={acceptedEstimate && acceptedEstimateDetail ? handlePhaseMarkComplete : undefined}
            phaseIdsWithPaymentMilestone={phaseIdsWithPaymentMilestone}
            onSave={id ? async (metaOverride) => {
              setScheduleSaving(true)
              try {
                const m = metaOverride ?? builderMeta
                const startD = m.startDate || dayjs().format('YYYY-MM-DD')
                const proj = project
                await api.projects.update(id, {
                  name: m.projectName || proj?.name,
                  expected_start_date: m.startDate || undefined,
                  assigned_to_name: m.gcOwner || undefined,
                })
                setProject((p) => (p ? { ...p, name: m.projectName || p.name, expected_start_date: m.startDate || p.expected_start_date, assigned_to_name: m.gcOwner ?? p.assigned_to_name } : p))
                for (const t of tasks) { await api.projects.deleteTask(id, t.id) }
                for (const p of phases) { await api.projects.deletePhase(id, p.id) }
                for (const m of milestones) { await api.projects.deleteMilestone(id, m.id) }
                const newPhaseIds: string[] = []
                for (const p of builderPhases) {
                  const taskList = p.tasks.filter((t) => t.name.trim())
                  let phaseStart: string
                  let phaseEnd: string
                  if (taskList.length) {
                    const startW = Math.min(...taskList.map((t) => t.sw))
                    const endW = Math.max(...taskList.map((t) => t.sw + t.dur - 1))
                    phaseStart = weekToDate(startD, startW)
                    phaseEnd = dayjs(weekToDate(startD, endW)).add(6, 'day').format('YYYY-MM-DD')
                  } else {
                    const ps = p.phase_start_date?.trim()
                    const pe = p.phase_end_date?.trim()
                    if (ps && pe) {
                      phaseStart = ps
                      phaseEnd = pe
                    } else if (ps) {
                      phaseStart = ps
                      phaseEnd = dayjs(ps).add(6, 'day').format('YYYY-MM-DD')
                    } else {
                      phaseStart = weekToDate(startD, 1)
                      phaseEnd = dayjs(weekToDate(startD, 1)).add(6, 'day').format('YYYY-MM-DD')
                    }
                  }
                  const created = await api.projects.createPhase(id, {
                    name: p.name || 'Phase',
                    start_date: phaseStart,
                    end_date: phaseEnd,
                    order: newPhaseIds.length,
                  })
                  newPhaseIds.push(created.id)
                }
                let taskOrder = 0
                for (let pi = 0; pi < builderPhases.length; pi++) {
                  const phaseId = newPhaseIds[pi]
                  for (const t of builderPhases[pi].tasks.filter((t) => t.name.trim())) {
                    const start = weekToDate(startD, t.sw)
                    const end = dayjs(weekToDate(startD, t.sw)).add(t.dur * 7 - 1, 'day').format('YYYY-MM-DD')
                    await api.projects.createTask(id, {
                      phase_id: phaseId,
                      title: t.name,
                      responsible: t.resp || undefined,
                      start_date: start,
                      end_date: end,
                      duration_weeks: t.dur,
                      order: taskOrder++,
                      completed: t.status === 'complete',
                    })
                  }
                }
                for (const m of builderMilestones.filter((ms) => ms.name.trim())) {
                  await api.projects.createMilestone(id, {
                    title: m.name,
                    due_date: weekToDate(startD, m.wk),
                    completed: false,
                  })
                }
                const [ph, taskList, mil] = await Promise.all([
                  api.projects.getPhases(id),
                  api.projects.getTasks(id),
                  api.projects.getMilestones(id),
                ])
                setPhases(ph)
                setTasks(taskList)
                setMilestones(mil)
                const startFallback = m.startDate || proj?.expected_start_date || dayjs().format('YYYY-MM-DD')
                const builtAfterSave = apiToBuilder(
                  {
                    name: m.projectName || proj?.name,
                    expected_start_date: m.startDate || proj?.expected_start_date,
                    assigned_to_name: m.gcOwner ?? proj?.assigned_to_name,
                  },
                  ph,
                  taskList,
                  mil,
                  startFallback
                )
                setBuilderMeta({
                  projectName: builtAfterSave.projectName,
                  startDate: builtAfterSave.startDate,
                  gcOwner: builtAfterSave.gcOwner,
                })
                setBuilderPhases(builtAfterSave.phases)
                setBuilderMilestones(builtAfterSave.milestones)
              } finally {
                setScheduleSaving(false)
              }
            } : undefined}
            onImportClick={() => setScheduleImportOpen(true)}
            saving={scheduleSaving}
          />
          {deleteConfirmProject && (
            <ConfirmDeleteProjectModal
              project={deleteConfirmProject}
              onClose={() => { setDeleteConfirmProject(null); setDeleteError(null) }}
              onConfirm={handleDeleteProject}
              isDeleting={isDeletingProject}
              error={deleteError}
            />
          )}
          {scheduleImportOpen && id && project && (
            <ImportScheduleModal
              projectId={id}
              projectStartDate={(project.expected_start_date ?? builderMeta.startDate) || undefined}
              onClose={() => setScheduleImportOpen(false)}
              onImported={async () => {
                const [ph, taskList] = await Promise.all([
                  api.projects.getPhases(id),
                  api.projects.getTasks(id),
                ])
                setPhases(ph)
                setTasks(taskList)
                const built = apiToBuilder(project!, ph, taskList, milestones, dayjs().format('YYYY-MM-DD'))
                setBuilderMeta({ projectName: built.projectName, startDate: built.startDate, gcOwner: built.gcOwner })
                setBuilderPhases(built.phases)
                setBuilderMilestones(built.milestones)
              }}
            />
          )}
        </section>
      )}

      {activeTab === 'budget' && project && (
        <section className="w-full min-w-0 px-8 py-6">
          {budgetTabLoading ? (
            <div className="budget-tab-skeleton">
              <div className="budget-tab-skeleton-kpis">
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" />)}
              </div>
              <div className="budget-tab-skeleton-table">
                {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton" />)}
              </div>
            </div>
          ) : (
            <BudgetTab
              projectId={project.id}
              items={budget?.items ?? []}
              schedulePhases={builderPhases}
              clientEmail={project.client_email ?? null}
              clientName={project.assigned_to_name ?? null}
              laborActualFromTimeEntries={budget?.labor_actual_from_time_entries}
              subsActualFromBidSheet={budget?.subs_actual_from_bid_sheet}
              approvedChangeOrdersTotal={budget?.approved_change_orders_total}
              estimateApprovedAt={project.estimate_approved_at ?? null}
              provisionalEstimateLineItems={
                hasEstimateBudgetPreview ? (awaitingApprovalEstimatePreview?.lineItems ?? null) : null
              }
              budgetAwaitingEstimateApproval={hasEstimateBudgetPreview}
              onRemoteBudgetRefresh={refreshBudgetFromServer}
              onSave={async (items) => {
              await api.projects.updateBudget(project.id, items)
              // Refetch so we get merged actuals (awarded bids, time entries) instead of raw DB rows
              const fresh = await api.projects.getBudget(project.id)
              const emptySummary = { predicted_total: 0, actual_total: 0, profitability: 0 }
              setBudget(fresh?.items?.length ? fresh : { items: [], summary: fresh?.summary ?? emptySummary })
            }}
            />
          )}
        </section>
      )}

      {activeTab === 'media' && project && (
        <section className="w-full min-w-0 px-8 py-6">
          <JobWalkGallery
            projectId={project.id}
            projectName={project.name}
            media={media}
            onUpload={async (file, uploaderName, caption) => {
              await api.projects.uploadMedia(project.id, file, uploaderName, caption)
            }}
            onDelete={async (mediaId) => {
              await api.projects.deleteMedia(project.id, mediaId)
            }}
            onRefresh={refreshMedia}
          />
        </section>
      )}

      {activeTab === 'takeoff' && project && (
        <section className="w-full min-w-0 px-8 py-6">
          <LaunchTakeoffWidget
            projectId={project.id}
            planType={(project.plan_type as TakeoffPlanType) ?? 'residential'}
            onStartTakeoff={startTakeoff}
            existingTakeoffs={takeoffs}
            takeoffResult={takeoffResult}
            takeoffError={takeoffError}
            takeoffInProgress={takeoffInProgress}
            takeoffProgress={takeoffProgress}
            takeoffMessage={takeoffMessage}
            takeoffStartTime={takeoffStartTime}
          />
        </section>
      )}

      {id && takeoffInProgress && (
        <TakeoffProgressPopup
          progress={takeoffProgress}
          message={takeoffMessage}
          startTime={takeoffStartTime}
        />
      )}

      {activeTab === 'documents' && project && (
        <section className="w-full min-w-0 px-8 py-6">
          <ProjectDocumentsTab projectId={project.id} projectName={project.name} refreshTrigger={detailRefreshTrigger} />
        </section>
      )}

      {activeTab === 'bidsheet' && project && (
        <section className="w-full min-w-0 px-8 py-6">
          <BidSheetFlow
            projectId={project.id}
            project={{
              name: project.name,
              address_line_1: project.address_line_1,
              city: project.city,
              state: project.state,
              postal_code: project.postal_code,
            }}
            takeoffCategories={takeoffCategories}
            subcontractors={subcontractors}
            onAddSub={async (row) => {
              await api.projects.createSubcontractor(project.id, row)
              await api.contractors.create({ name: row.name, trade: row.trade, email: row.email, phone: row.phone || '' }).catch(() => {})
              refreshSubcontractors()
            }}
            onDeleteSub={async (subId) => {
              await api.projects.deleteSubcontractor(project.id, subId)
              refreshSubcontractors()
            }}
            onBulkSend={(subIds) => {
              setBulkSendIds(subIds)
              setBulkSendOpen(true)
            }}
            onAwardedChange={() => {
              if (project.id) {
                const emptySummary = { predicted_total: 0, actual_total: 0, profitability: 0 }
                api.projects.getBudget(project.id).then((bud) => {
                  setBudget(bud?.items?.length ? bud : { items: [], summary: bud?.summary ?? emptySummary })
                }).catch(() => {})
              }
            }}
          />
        </section>
      )}

      {setupWizardOpen && project && (
        <SetupWizard
          project={wizardStateFromProject(project, phases, budget?.items ?? [], milestones, tasks, subcontractors, workTypes, jobAssignments, rosterEmployees)}
          existingProjectId={project.id}
          onClose={() => { setSetupWizardOpen(false); if (project?.id) setDetailRefreshTrigger((t) => t + 1) }}
          onComplete={(_, extras) => {
            setSetupWizardOpen(false)
            const projectId = project?.id
            if (extras && id && projectId) {
              const list = extras.workTypes ?? []
              pendingWizardWorkTypes.current = list
              setWorkTypesByProject((prev) => ({ ...prev, [id]: list }))
            }
            setDetailRefreshTrigger((t) => t + 1)
            if (projectId) api.projects.getBuildPlans(projectId).then(setBuildPlans).catch(() => setBuildPlans([]))
          }}
        />
      )}

      {activateProjectModalEl}
      {activateSuccessToastEl}

      {bulkSendOpen && project && (
        <BulkSendModal
          subCount={bulkSendIds.length}
          onSend={async (subject, body) => {
            await api.projects.bulkSendSubcontractors(project.id, bulkSendIds, subject, body)
          }}
          onClose={() => {
            setBulkSendOpen(false)
            setBulkSendIds([])
          }}
        />
      )}

      {buildEstimateOpen && project && !buildEstimateBidSheetFetched && (
        <div
          className="estimate-builder-modal-overlay"
          onClick={() => setBuildEstimateOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={hasPersistedJobEstimate ? 'Edit estimate' : 'Build estimate'}
        >
          <div className="estimate-builder-wizard" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center p-12">
              <span className="text-[var(--text-muted)]">Loading…</span>
            </div>
          </div>
        </div>
      )}
      {buildEstimateOpen && project && buildEstimateBidSheetFetched && (
        <EstimateBuilderModal
          jobs={[]}
          projectId={project.id}
          prefillClientInfo={buildEstimatePrefillClientInfo ?? undefined}
          initialBudgetLineItems={
            buildEstimateBlankMode || !(budget?.items && budget.items.length > 0)
              ? undefined
              : budget.items
          }
          takeoffPickItems={buildEstimateTakeoffPickItems.length > 0 ? buildEstimateTakeoffPickItems : undefined}
          onClose={() => {
            setBuildEstimateOpen(false)
            setBuildEstimateBlankMode(false)
            setBuildEstimateBidSheet(undefined)
            setBuildEstimateBidSheetFetched(false)
            setBuildEstimateLinkedEstimateId(null)
          }}
          onSave={(_estimateId) => {
            setBuildEstimateOpen(false)
            setBuildEstimateBlankMode(false)
            setBuildEstimateBidSheet(undefined)
            setBuildEstimateBidSheetFetched(false)
            setBuildEstimateLinkedEstimateId(null)
            setDetailRefreshTrigger((t) => t + 1)
          }}
          estimateId={
            buildEstimateBlankMode ? undefined : buildEstimateLinkedEstimateId ?? undefined
          }
          prefillLineItems={
            buildEstimateBlankMode
              ? undefined
              : buildEstimateLinkedEstimateId
                ? undefined
                : buildEstimatePrefillLineItems.length > 0
                  ? buildEstimatePrefillLineItems
                  : undefined
          }
        />
      )}
      {showProductLibrary && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="estimates-detail-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Products & Services library"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowProductLibrary(false)
              }}
            >
              <div
                className="estimates-detail-panel__inner estimates-detail-panel__inner--products-drawer"
                onClick={(e) => e.stopPropagation()}
              >
                <CustomProductLibrary onClose={() => setShowProductLibrary(false)} />
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
