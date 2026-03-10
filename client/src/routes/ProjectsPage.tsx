import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { Project, Phase, Milestone, ProjectTask, JobWalkMedia, ProjectBuildPlan, Subcontractor, MaterialList, ProjectWorkType, ProjectActivityItem, JobAssignment, Employee } from '@/types/global'
import { teamsApi } from '@/api/teamsClient'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { HealthRing } from '@/components/projects/HealthRing'
import { JobWalkGallery } from '@/components/projects/JobWalkGallery'
import { BudgetTab } from '@/components/projects/BudgetTab'
import { LaunchTakeoffWidget, type TakeoffPlanType } from '@/components/projects/LaunchTakeoffWidget'
import { BulkSendModal } from '@/components/projects/BulkSendModal'
import { BidSheetFlow } from '@/components/projects/BidSheetFlow'
import { WorkTypesTab } from '@/components/projects/WorkTypesTab'
import { ProjectCrewTab } from '@/components/projects/ProjectCrewTab'
import { ImportScheduleModal } from '@/components/projects/ImportScheduleModal'
import { ConfirmDeleteProjectModal } from '@/components/projects/ConfirmDeleteProjectModal'
import { ScheduleBuilder, apiToBuilder, weekToDate } from '@/components/projects/ScheduleBuilder'
import type { BuilderPhase, BuilderMilestone } from '@/components/projects/ScheduleBuilder'
import { formatDate, dayjs } from '@/lib/date'
import { SetupWizard, SetupBanner, EMPTY_WIZARD_PROJECT, wizardStateFromProject } from '@/components/projects/NewProjectWizard'

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

const DETAIL_TAB_IDS = ['overview', 'worktypes', 'crew', 'budget', 'schedule', 'media', 'takeoff', 'bidsheet'] as const
type DetailTabId = (typeof DETAIL_TAB_IDS)[number]

export function ProjectsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [media, setMedia] = useState<JobWalkMedia[]>([])
  const [budget, setBudget] = useState<{ items: { id: string; project_id: string; label: string; predicted: number; actual: number; category: string }[]; summary: { predicted_total: number; actual_total: number; profitability: number } } | null>(null)
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
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'planning' | 'on_hold' | 'completed'>('all')
  const [search, setSearch] = useState('')
  const [listView, setListView] = useState<'grid' | 'table'>('grid')
  const [scheduleImportOpen, setScheduleImportOpen] = useState(false)
  const [setupWizardOpen, setSetupWizardOpen] = useState(false)
  const [detailRefreshTrigger, setDetailRefreshTrigger] = useState(0)
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
  const heroMenuRef = useRef<HTMLDivElement>(null)
  /** Work types from wizard onComplete; applied again when detail refetch finishes so banner never loses them. */
  const pendingWizardWorkTypes = useRef<ProjectWorkType[] | undefined>(undefined)
  const tabFromUrl = searchParams.get('tab')

  // Open New Project modal after the page has loaded and grid slide-in animation has finished (?new=1)
  useEffect(() => {
    if (!id && !loading && searchParams.get('new') === '1') {
      const delay = 550
      const t = setTimeout(() => {
        setNewProjectOpen(true)
        const next = new URLSearchParams(searchParams)
        next.delete('new')
        setSearchParams(next, { replace: true })
      }, delay)
      return () => clearTimeout(t)
    }
  }, [id, loading, searchParams, setSearchParams])

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
    api.projects
      .list()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    setOverviewSetupReady(false)
    setActivity([])
    setBuildPlans([])
    // Keep previous crew list until refetch completes so Crew tab doesn't flash "No employees" when adding/removing
    setJobAssignments((prev) => (id && project?.id && id !== project.id ? [] : prev))
    setRosterEmployees((prev) => (id && project?.id && id !== project.id ? [] : prev))

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

  const refreshMedia = () => {
    if (id) {
      api.projects.getMedia(id).then(setMedia)
      api.projects.getActivity(id).then(setActivity)
    }
  }
  const refreshSubcontractors = () => {
    if (id) api.projects.getSubcontractors(id).then(setSubcontractors)
  }

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

  if (id === undefined) {
    const filterMatch = (p: Project) => {
      if (filter === 'all') return true
      const s = (p.status ?? '').toLowerCase().replace(' ', '_')
      return s === filter
    }
    const searchLower = search.trim().toLowerCase()
    const searchMatch = (p: Project) =>
      !searchLower || p.name.toLowerCase().includes(searchLower)
    const displayedProjects = projects.filter(filterMatch).filter(searchMatch)
    const activeCount = displayedProjects.filter((p) => (p.status ?? 'active').toLowerCase() === 'active').length

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
              <button type="button" onClick={() => setNewProjectOpen(true)} className="projects-list-new-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New project
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="projects-list-filters">
            {(['all', 'active', 'planning', 'on_hold', 'completed'] as const).map((tab) => {
              const count = tab === 'all' ? displayedProjects.length : displayedProjects.filter((p) => (p.status ?? '').toLowerCase().replace(' ', '_') === tab).length
              const label = tab === 'all' ? 'All' : tab === 'on_hold' ? 'On Hold' : tab.charAt(0).toUpperCase() + tab.slice(1)
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
            <p className="text-muted dark:text-white-dim">Loading…</p>
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
                  <span>Project</span><span>Status</span><span>Phase</span><span>Budget</span><span>Days Left</span><span>PM</span><span></span>
                </div>
                {displayedProjects.map((p) => {
                  const budgetVal = Number(p.estimated_value) || 0
                  const statusStyle = (p.status ?? 'active') === 'active' ? { bg: 'var(--blue-bg)', text: 'var(--blue)', dot: '#3b82f6' } :
                    (p.status ?? '') === 'planning' ? { bg: '#fefce8', text: '#a16207', dot: '#eab308' } :
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
                          {p.address_line_1 || p.city || '—'} · <span className="font-mono text-[11px]">{p.id?.slice(0, 8) ?? '—'}</span>
                        </div>
                      </div>
                      <span className="projects-card-status-pill" style={{ background: statusStyle.bg, color: statusStyle.text, width: 'fit-content' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusStyle.dot }} />
                        {p.status === 'on_hold' ? 'On Hold' : (p.status ?? 'Active').charAt(0).toUpperCase() + (p.status ?? 'active').slice(1)}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-white-dim font-medium">—</span>
                      <div>
                        <div className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-landing-white">${budgetVal.toLocaleString()}</div>
                        <div className="text-[10px] text-muted dark:text-white-dim">—</div>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-landing-white">—</span>
                      <div className="projects-card-pm">
                        {p.assigned_to_name ? <span className="text-xs text-gray-600 dark:text-white-dim">{p.assigned_to_name}</span> : <span className="text-xs text-muted">—</span>}
                      </div>
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmProject(p)}
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
                <ProjectCard key={p.id} project={p} onDelete={(proj) => setDeleteConfirmProject(proj)} />
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
                onClick={() => setNewProjectOpen(true)}
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
          {newProjectOpen && (
            <SetupWizard
              project={EMPTY_WIZARD_PROJECT}
              onClose={() => setNewProjectOpen(false)}
              onComplete={(createdProject, extras) => {
                setNewProjectOpen(false)
                setProjects((prev) => [createdProject, ...prev])
                if (extras?.workTypes?.length) setWorkTypesByProject((prev) => ({ ...prev, [createdProject.id]: extras.workTypes! }))
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
        </div>
      </div>
    )
  }

  if (id && !project) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
        <p className="text-muted dark:text-white-dim">Loading project…</p>
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
      </div>
    )
  }

  const projectIdDisplay = project?.id?.slice(0, 8) ?? '—'
  const budgetSummary = budget?.summary ?? { predicted_total: 0, actual_total: 0, profitability: 0 }
  const isUnderBudget = (budgetSummary.actual_total <= budgetSummary.predicted_total)
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
  const timelinePct = totalDays != null && totalDays > 0 && daysLeft != null
    ? Math.round(((totalDays - daysLeft) / totalDays) * 100)
    : 0
  const budgetPct = budgetSummary.predicted_total > 0
    ? Math.round((budgetSummary.actual_total / budgetSummary.predicted_total) * 100)
    : 0
  const healthScore = Math.min(100, Math.max(0,
    (isUnderBudget ? 40 : 20) +
    (daysLeft == null || daysLeft > 7 ? 35 : daysLeft > 0 ? 20 : 0) +
    (timelinePct <= 90 ? 25 : 15)
  ))

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: 'grid' },
    { id: 'worktypes' as const, label: 'Work Types & Pay', icon: 'briefcase' },
    { id: 'crew' as const, label: 'Crew', icon: 'people' },
    { id: 'budget' as const, label: 'Budget', icon: 'dollar' },
    { id: 'schedule' as const, label: 'Schedule', icon: 'calendar' },
    { id: 'media' as const, label: 'Job Walk Media', icon: 'image' },
    { id: 'takeoff' as const, label: 'Takeoff', icon: 'document' },
    { id: 'bidsheet' as const, label: 'Bid Sheet', icon: 'checklist' },
  ]

  const statusKey = (project?.status ?? 'active').toLowerCase().replace(' ', '_')
  const statusPillStyle = statusKey === 'active' ? { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' } : statusKey === 'planning' ? { bg: '#fefce8', text: '#a16207', dot: '#eab308' } : statusKey === 'on_hold' ? { bg: '#f3f4f6', text: '#374151', dot: '#6b7280' } : statusKey === 'completed' ? { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' } : { bg: '#f8fafc', text: '#64748b', dot: '#94a3b8' }
  const addressDisplay = [project?.address_line_1, project?.city].filter(Boolean).join(', ') || '—'
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
                {project?.status === 'on_hold' ? 'On Hold' : (project?.status ?? 'Active').charAt(0).toUpperCase() + (project?.status ?? 'active').slice(1).replace('_', ' ')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">{projectIdDisplay}</span>
            </div>
            <h1 className="project-overview-title">
              {project?.name} <span className="project-overview-title-muted">– {addressDisplay}</span>
            </h1>
          </div>
          <div className="project-overview-hero-actions relative" ref={heroMenuRef}>
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
                <button type="button" className="project-overview-hero-menu-item" role="menuitem" onClick={() => { setHeroMenuOpen(false) }}>Share</button>
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
            <div className="text-[14px] font-bold font-mono" style={{ color: isUnderBudget ? 'var(--green,#16a34a)' : 'var(--red)' }}>
              ${budgetSummary.actual_total.toLocaleString()} <span className="text-xs font-normal font-sans text-[var(--text-primary)]">/ ${budgetSummary.predicted_total.toLocaleString()}</span>
            </div>
            <div className="mt-1.5">
              <div className="text-[11px] text-[var(--text-primary)] mb-0.5">{budgetPct}% used</div>
              <div className="h-1 rounded-sm overflow-hidden bg-[var(--bg-base)]">
                <div className="h-full rounded-sm transition-[width]" style={{ width: `${Math.min(100, budgetPct)}%`, background: budgetPct > 95 ? 'var(--red)' : budgetPct > 80 ? '#f59e0b' : 'var(--green,#16a34a)' }} />
              </div>
            </div>
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
        </div>

        {/* Tabs */}
        <nav className="project-overview-tabs" aria-label="Project sections">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`project-overview-tab ${activeTab === tab.id ? 'active' : ''}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && project && (
        <div className="project-overview-wrap">
          {overviewSetupReady && (
            <SetupBanner
              project={{
                assigned_to_name: project.assigned_to_name,
                phases,
                budget: budgetSummary.predicted_total,
                budgetItemsCount: budget?.items?.length ?? 0,
                team: subcontractors,
                workTypes,
                milestones,
              }}
              onOpenWizard={() => setSetupWizardOpen(true)}
            />
          )}
          <div className="project-overview-body">
          {/* Col 1 – Project Breakdown + Milestones */}
          <div className="flex flex-col gap-[18px]">
            <div className="project-overview-card">
              <div className="project-overview-card-title">Project Breakdown</div>
              {project.scope && <div className="project-overview-card-subtitle">{project.scope}</div>}
              <div className="flex flex-col gap-0">
                {phases.length > 0 ? phases.map((ph) => {
                  const today = dayjs().format('YYYY-MM-DD')
                  const status = today > ph.end_date ? 'complete' : today >= ph.start_date && today <= ph.end_date ? 'in-progress' : 'upcoming'
                  const cfg = { complete: { bg: '#f0fdf4', bar: '#16a34a', text: '#15803d', label: 'Complete' }, 'in-progress': { bg: '#eff6ff', bar: '#3b82f6', text: '#1d4ed8', label: 'In progress' }, upcoming: { bg: 'var(--bg-base)', bar: 'var(--border)', text: 'var(--text-muted)', label: 'Upcoming' } }[status]
                  const pct = status === 'complete' ? 100 : status === 'in-progress' ? 50 : 0
                  return (
                    <div key={ph.id} className="project-overview-phase-row">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.bar }} />
                          <span className="project-overview-phase-name">{ph.name}</span>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
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
                <span className="project-overview-card-action">Full breakdown →</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-[22px] font-bold font-mono" style={{ color: isUnderBudget ? 'var(--green,#16a34a)' : 'var(--red)' }}>
                    ${budgetSummary.actual_total.toLocaleString()}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">of ${budgetSummary.predicted_total.toLocaleString()} budget</div>
                </div>
              </div>
              {(budget?.items ?? []).map((item) => {
                const over = item.actual > item.predicted
                const color = BUDGET_ITEM_COLORS[item.label] ?? '#6366f1'
                const maxVal = Math.max(item.predicted, item.actual)
                const budgetWidth = maxVal > 0 ? (item.predicted / maxVal) * 100 : 0
                const actualWidth = maxVal > 0 ? Math.min(100, (item.actual / maxVal) * 100) : 0
                return (
                  <div key={item.id} className="mb-3.5 last:mb-0">
                    <div className="flex justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                        <span className="text-[13px] font-medium text-[var(--text-secondary)]">{item.label}</span>
                      </div>
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-[var(--text-muted)]">${item.predicted.toLocaleString()}</span>
                        <span className="text-[13px] font-semibold font-mono" style={{ color: over ? 'var(--red)' : 'var(--text-primary)' }}>${item.actual.toLocaleString()}</span>
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: over ? '#fef2f2' : '#f0fdf4', color: over ? 'var(--red)' : 'var(--green,#16a34a)' }}>{over ? '-' : '+'}${Math.abs(item.actual - item.predicted).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-md overflow-hidden bg-[var(--bg-base)] relative">
                      <div className="absolute left-0 top-0 h-full rounded-md bg-[var(--border)]" style={{ width: `${budgetWidth}%` }} />
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
                  const hasSubs = subcontractors.length > 0
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
                      {subcontractors.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: ['#6366f1', '#0ea5e9', '#f59e0b'][(rosterRows.length + i) % 3] }}>{s.name.slice(0, 2).toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{s.name}</div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{s.trade}</div>
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
                  const startW = taskList.length ? Math.min(...taskList.map((t) => t.sw)) : 1
                  const endW = taskList.length ? Math.max(...taskList.map((t) => t.sw + t.dur - 1)) : 1
                  const created = await api.projects.createPhase(id, {
                    name: p.name || 'Phase',
                    start_date: weekToDate(startD, startW),
                    end_date: dayjs(weekToDate(startD, endW)).add(6, 'day').format('YYYY-MM-DD'),
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

      {activeTab === 'budget' && (
        <section className="w-full min-w-0 px-8 py-6">
          <BudgetTab
            items={budget?.items ?? []}
            schedulePhases={builderPhases}
            onSave={async (items) => {
              const result = await api.projects.updateBudget(project!.id, items)
              setBudget(result)
            }}
          />
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
            onUpload={async (file, planType, tradeFilter) => {
              const result = await api.projects.launchTakeoff(project.id, file, planType, tradeFilter)
              const list = await api.projects.getTakeoffs(project.id)
              setTakeoffs(list)
              return { material_list: result.material_list as MaterialList }
            }}
            existingTakeoffs={takeoffs}
          />
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
    </div>
  )
}
