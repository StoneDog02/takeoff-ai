import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { Project, Phase, Milestone, ProjectTask, JobWalkMedia, Subcontractor, MaterialList, ProjectWorkType } from '@/types/global'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { HealthRing } from '@/components/projects/HealthRing'
import { JobWalkGallery } from '@/components/projects/JobWalkGallery'
import { BudgetTab } from '@/components/projects/BudgetTab'
import { LaunchTakeoffWidget } from '@/components/projects/LaunchTakeoffWidget'
import { BulkSendModal } from '@/components/projects/BulkSendModal'
import { BidSheetFlow } from '@/components/projects/BidSheetFlow'
import { WorkTypesTab } from '@/components/projects/WorkTypesTab'
import { ProjectCrewTab } from '@/components/projects/ProjectCrewTab'
import { ImportScheduleModal } from '@/components/projects/ImportScheduleModal'
import { ScheduleBuilder, apiToBuilder, weekToDate, getMockScheduleData } from '@/components/projects/ScheduleBuilder'
import type { BuilderPhase, BuilderMilestone } from '@/components/projects/ScheduleBuilder'
import {
  MOCK_PROJECTS,
  DEMO_PROJECT_ID,
  isMockProjectId,
  getMockProjectDetail,
  MOCK_PROJECT_CARD_DATA,
} from '@/data/mockProjectsData'
import { formatDate, dayjs } from '@/lib/date'

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

interface NewProjectModalProps {
  onClose: () => void
  onSubmit: (data: NewProjectFormData) => Promise<void>
}

const inputClass =
  'w-full rounded-md px-3 py-2 border border-border dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white placeholder:text-muted dark:placeholder:text-white-faint focus:ring-2 focus:ring-accent/30 focus:border-accent'
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-white-dim mb-1'

function NewProjectModal({ onClose, onSubmit }: NewProjectModalProps) {
  const [name, setName] = useState('')
  const [scope, setScope] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [expectedStartDate, setExpectedStartDate] = useState('')
  const [expectedEndDate, setExpectedEndDate] = useState('')
  const [assignedToName, setAssignedToName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Project name is required')
      return
    }
    if (expectedStartDate && expectedEndDate && expectedEndDate < expectedStartDate) {
      setError('End date must be on or after start date')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        scope: scope.trim() || undefined,
        address_line_1: addressLine1.trim() || undefined,
        address_line_2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        expected_start_date: expectedStartDate || undefined,
        expected_end_date: expectedEndDate || undefined,
        assigned_to_name: assignedToName.trim() || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-6 shadow-lg max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-4">New project</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basics */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-landing-white mb-3">Basics</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="project-name" className={labelClass}>Project name</label>
                <input
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kitchen Remodel - 123 Main St"
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="project-scope" className={labelClass}>Scope (optional)</label>
                <textarea
                  id="project-scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  rows={3}
                  placeholder="Brief description of the project scope…"
                  className={`${inputClass} resize-y`}
                />
              </div>
            </div>
          </section>

          {/* Location */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-landing-white mb-3">Location</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="project-address1" className={labelClass}>Address line 1</label>
                <input
                  id="project-address1"
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Street address"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="project-address2" className={labelClass}>Address line 2 (optional)</label>
                <input
                  id="project-address2"
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Suite, unit, etc."
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="project-city" className={labelClass}>City</label>
                  <input
                    id="project-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="project-state" className={labelClass}>State</label>
                  <input
                    id="project-state"
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="project-postal" className={labelClass}>ZIP / Postal code</label>
                <input
                  id="project-postal"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="ZIP or postal code"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Schedule */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-landing-white mb-3">Schedule</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="project-start" className={labelClass}>Expected start date (optional)</label>
                <input
                  id="project-start"
                  type="date"
                  value={expectedStartDate}
                  onChange={(e) => setExpectedStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="project-end" className={labelClass}>Expected end date (optional)</label>
                <input
                  id="project-end"
                  type="date"
                  value={expectedEndDate}
                  onChange={(e) => setExpectedEndDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Assignment */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-landing-white mb-3">Assignment</h3>
            <div>
              <label htmlFor="project-assignee" className={labelClass}>Assigned to (optional)</label>
              <input
                id="project-assignee"
                type="text"
                value={assignedToName}
                onChange={(e) => setAssignedToName(e.target.value)}
                placeholder="e.g. Jordan Lee"
                className={inputClass}
              />
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-border dark:border-border-dark text-muted dark:text-white-dim hover:bg-surface dark:hover:bg-dark-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bulkSendOpen, setBulkSendOpen] = useState(false)
  const [bulkSendIds, setBulkSendIds] = useState<string[]>([])
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'planning' | 'on_hold' | 'completed'>('all')
  const [search, setSearch] = useState('')
  const [listView, setListView] = useState<'grid' | 'table'>('grid')
  const [scheduleImportOpen, setScheduleImportOpen] = useState(false)
  const [builderPhases, setBuilderPhases] = useState<BuilderPhase[]>([])
  const [builderMilestones, setBuilderMilestones] = useState<BuilderMilestone[]>([])
  const [builderMeta, setBuilderMeta] = useState({ projectName: '', startDate: '', gcOwner: '' })
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [workTypesByProject, setWorkTypesByProject] = useState<Record<string, ProjectWorkType[]>>({})
  const tabFromUrl = searchParams.get('tab')

  const workTypes = id ? (workTypesByProject[id] ?? []) : []
  const setWorkTypes = (list: ProjectWorkType[]) => {
    if (id) setWorkTypesByProject((prev) => ({ ...prev, [id]: list }))
  }
  const [activeTabState, setActiveTabState] = useState<DetailTabId>('overview')
  const activeTab: DetailTabId = (tabFromUrl && DETAIL_TAB_IDS.includes(tabFromUrl as DetailTabId)) ? (tabFromUrl as DetailTabId) : activeTabState
  const setActiveTab = (tab: DetailTabId) => {
    setActiveTabState(tab)
    setSearchParams({ tab }, { replace: true })
  }

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

    if (isMockProjectId(id)) {
      const detail = getMockProjectDetail(id)
      setProject(detail.project)
      setPhases(detail.phases)
      setMilestones(detail.milestones)
      setTasks([])
      setMedia(detail.media)
      setBudget(detail.budget)
      setTakeoffs(detail.takeoffs)
      setSubcontractors(detail.subcontractors)
      setWorkTypesByProject((prev) => {
        if (prev[id]?.length) return prev
        return {
          ...prev,
          [id]: [
            { id: 'wt-demo-1', project_id: id, name: 'General Labor', description: 'Employees clock in under this work type on the job site.', rate: 85, unit: 'hr', type_key: 'labor' },
            { id: 'wt-demo-2', project_id: id, name: 'Tile Install', description: 'Employees clock in under this work type on the job site.', rate: 18, unit: 'sf', type_key: 'tile' },
            { id: 'wt-demo-3', project_id: id, name: 'Plumbing - Rough-in', description: 'Employees clock in under this work type on the job site.', rate: 450, unit: 'ea', type_key: 'plumbing' },
          ],
        }
      })
      const built = apiToBuilder(
        detail.project,
        detail.phases,
        [],
        detail.milestones,
        dayjs().format('YYYY-MM-DD')
      )
      setBuilderMeta({ projectName: built.projectName, startDate: built.startDate, gcOwner: built.gcOwner })
      const mockSchedule = getMockScheduleData()
      setBuilderPhases(mockSchedule.phases)
      setBuilderMilestones(mockSchedule.milestones)
      setLoading(false)
      return
    }

    const template = getMockProjectDetail(DEMO_PROJECT_ID)
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
        const phasesData = ph.length ? ph : template.phases.map((p) => ({ ...p, project_id: id }))
        const milestonesData = mil.length ? mil : template.milestones.map((m) => ({ ...m, project_id: id }))
        const tasksData = taskList || []
        setPhases(phasesData)
        setMilestones(milestonesData)
        setTasks(tasksData)
        setMedia(med.length ? med : template.media.map((m) => ({ ...m, project_id: id })))
        setBudget(bud.items?.length ? bud : { ...template.budget, items: template.budget.items.map((b) => ({ ...b, project_id: id })) })
        setTakeoffs(toffs.length ? toffs : template.takeoffs)
        setSubcontractors(subs.length ? subs : template.subcontractors.map((s) => ({ ...s, project_id: id })))
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
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  const refreshMedia = () => {
    if (id) api.projects.getMedia(id).then(setMedia)
  }
  const refreshSubcontractors = () => {
    if (id) api.projects.getSubcontractors(id).then(setSubcontractors)
  }

  const takeoffCategories = takeoffs[0]?.material_list?.categories ?? []
  const isDemo = id === DEMO_PROJECT_ID

  if (id === undefined) {
    const filterMatch = (p: Project) => {
      if (filter === 'all') return true
      const s = (p.status ?? '').toLowerCase().replace(' ', '_')
      return s === filter
    }
    const searchLower = search.trim().toLowerCase()
    const searchMatch = (p: Project) =>
      !searchLower || p.name.toLowerCase().includes(searchLower)
    const mockFiltered = MOCK_PROJECTS.filter(filterMatch).filter(searchMatch)
    const realFiltered = projects.filter(filterMatch).filter(searchMatch)
    const displayedProjects = [...mockFiltered, ...realFiltered]
    const totalValue = displayedProjects.reduce(
      (sum, p) => sum + (MOCK_PROJECT_CARD_DATA[p.id]?.value ?? p.estimated_value ?? 0),
      0
    )

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
            mockFiltered.length === 0 && realFiltered.length === 0 ? (
              <p className="text-muted dark:text-white-dim py-8 text-center">
                {search.trim() || filter !== 'all'
                  ? 'No projects match the current filters.'
                  : 'Real projects you create will appear here.'}
              </p>
            ) : (
              <div className="projects-list-table">
                <div className="projects-list-table-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px' }}>
                  <span>Project</span><span>Status</span><span>Phase</span><span>Budget</span><span>Days Left</span><span>PM</span>
                </div>
                {displayedProjects.map((p, i) => {
                  const card = MOCK_PROJECT_CARD_DATA[p.id]
                  const phases = card?.phaseProgress ?? []
                  const currentPhase = phases.find((ph, idx) => !ph.completed) ?? phases[phases.length - 1]
                  const phaseName = currentPhase?.name ?? '—'
                  const completedCount = phases.filter((ph) => ph.completed).length
                  const budgetVal = card?.value ?? p.estimated_value ?? 0
                  const pct = phases.length ? Math.min(100, Math.round((completedCount / phases.length) * 100)) : 0
                  const healthBar = card?.isComplete ? '#3b82f6' : pct >= 70 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#6b7280'
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
                      style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px', borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: healthBar }}
                    >
                      <div>
                        <div className="font-semibold text-[14px] text-gray-900 dark:text-landing-white">{p.name}</div>
                        <div className="text-xs text-muted dark:text-white-dim">
                          {p.address_line_1 || p.city || '—'} · <span className="font-mono text-[11px]">{card?.projectId ?? p.id?.slice(0, 8) ?? '—'}</span>
                        </div>
                      </div>
                      <span className="projects-card-status-pill" style={{ background: statusStyle.bg, color: statusStyle.text, width: 'fit-content' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusStyle.dot }} />
                        {p.status === 'on_hold' ? 'On Hold' : (p.status ?? 'Active').charAt(0).toUpperCase() + (p.status ?? 'active').slice(1)}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-white-dim font-medium">{phaseName}</span>
                      <div>
                        <div className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-landing-white">${Number(budgetVal).toLocaleString()}</div>
                        <div className="text-[10px] text-muted dark:text-white-dim">{phases.length ? `${pct}%` : '—'}</div>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-landing-white">—</span>
                      <div className="projects-card-pm">
                        {card?.assignedTo && (
                          <>
                            <div className="projects-card-avatar" style={{ background: '#16a34a' }}>{card.assignedTo.initials}</div>
                            <span className="text-xs font-medium text-gray-700 dark:text-white-dim">{card.assignedTo.name.split(' ')[0]}</span>
                          </>
                        )}
                        {!card?.assignedTo && (p.assigned_to_name ? <span className="text-xs text-gray-600 dark:text-white-dim">{p.assigned_to_name}</span> : <span className="text-xs text-muted">—</span>)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            <div className="projects-list-grid">
              {mockFiltered.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  cardData={MOCK_PROJECT_CARD_DATA[p.id]}
                  isDemo={p.id === DEMO_PROJECT_ID}
                />
              ))}
              {realFiltered.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
              {mockFiltered.length === 0 && realFiltered.length === 0 && (
                <p className="text-muted dark:text-white-dim col-span-full py-8 text-center">
                  {search.trim() || filter !== 'all'
                    ? 'No projects match the current filters.'
                    : 'Real projects you create will appear here.'}
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
            <NewProjectModal
              onClose={() => setNewProjectOpen(false)}
              onSubmit={async (data) => {
                const p = await api.projects.create(data)
                setNewProjectOpen(false)
                setProjects((prev) => [p, ...prev])
                navigate(`/projects/${p.id}`)
              }}
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

  if ((error || !project) && id !== DEMO_PROJECT_ID) {
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

  const projectIdDisplay = (project?.id && (MOCK_PROJECT_CARD_DATA[project.id]?.projectId ?? project.id.slice(0, 8))) ?? '—'
  const budgetSummary = budget?.summary ?? { predicted_total: 0, actual_total: 0, profitability: 0 }
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
    (budgetSummary.profitability >= 0 ? 40 : 20) +
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
  const MOCK_ACTIVITY = [
    { user: 'MK', name: 'Mike T.', color: '#6366f1', action: 'Added job walk photo', time: '2h ago', tag: 'Media' },
    { user: 'SC', name: 'Sarah C.', color: '#16a34a', action: 'Logged 6.5hrs – Tile Install', time: '4h ago', tag: 'Time' },
    { user: 'JL', name: 'Jordan Lee', color: '#16a34a', action: 'Updated budget – Materials', time: 'Yesterday', tag: 'Budget' },
    { user: 'AB', name: 'ABC Electrical', color: '#6366f1', action: 'Bid awarded – $4,200', time: 'Mar 4', tag: 'Bid' },
    { user: 'QU', name: 'Quality Plumbing', color: '#0ea5e9', action: 'Inspection scheduled', time: 'Mar 3', tag: 'Schedule' },
  ]
  const TAG_COLORS: Record<string, { bg: string; text: string }> = { Media: { bg: '#eff6ff', text: '#1d4ed8' }, Time: { bg: '#f0fdf4', text: '#15803d' }, Budget: { bg: '#fefce8', text: '#a16207' }, Bid: { bg: '#fdf4ff', text: '#7e22ce' }, Schedule: { bg: '#fff7ed', text: '#c2410c' } }

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
          <div className="project-overview-hero-actions">
            <button type="button" className="project-overview-hero-btn">Edit</button>
            <button type="button" className="project-overview-hero-btn">Share</button>
            <button type="button" className="project-overview-hero-btn project-overview-hero-btn-primary">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              Add Update
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="project-overview-kpi-strip">
          <div className="project-overview-kpi-cell" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <HealthRing score={healthScore} />
            <div>
              <div className="project-overview-kpi-label">Project Health</div>
              <div className="text-xs text-[var(--text-secondary)]">Based on budget,<br />schedule & activity</div>
            </div>
          </div>
          <div className="project-overview-kpi-cell">
            <div className="project-overview-kpi-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              Client
            </div>
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">{project?.assigned_to_name || '—'}</div>
          </div>
          <div className="project-overview-kpi-cell">
            <div className="project-overview-kpi-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Timeline
            </div>
            <div className="text-[14px] font-semibold text-[var(--text-primary)]">{timelineLabel}</div>
            <div className="mt-1.5">
              <div className="flex justify-between mb-0.5 text-[11px]">
                <span className="text-[var(--text-muted)]">{timelinePct}% elapsed</span>
                <span className="font-semibold" style={{ color: daysLeft != null && daysLeft <= 7 ? 'var(--red)' : 'var(--text-muted)' }}>{daysLeft != null ? `${daysLeft}d left` : '—'}</span>
              </div>
              <div className="h-1 rounded-sm overflow-hidden bg-[var(--bg-base)]">
                <div className="h-full rounded-sm transition-[width]" style={{ width: `${timelinePct}%`, background: daysLeft != null && daysLeft <= 7 ? 'var(--red)' : 'var(--text-primary)' }} />
              </div>
            </div>
          </div>
          <div className="project-overview-kpi-cell">
            <div className="project-overview-kpi-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              Budget vs Actual
            </div>
            <div className="text-[14px] font-bold font-mono text-[var(--text-primary)]">${budgetSummary.actual_total.toLocaleString()} <span className="text-xs font-normal font-sans text-[var(--text-muted)]">/ ${budgetSummary.predicted_total.toLocaleString()}</span></div>
            <div className="mt-1.5">
              <div className="flex justify-between mb-0.5 text-[11px]">
                <span className="text-[var(--text-muted)]">{budgetPct}% used</span>
                <span className="font-semibold text-[var(--green,#16a34a)]">+${budgetSummary.profitability.toLocaleString()}</span>
              </div>
              <div className="h-1 rounded-sm overflow-hidden bg-[var(--bg-base)]">
                <div className="h-full rounded-sm transition-[width]" style={{ width: `${Math.min(100, budgetPct)}%`, background: budgetPct > 95 ? 'var(--red)' : budgetPct > 80 ? '#f59e0b' : 'var(--green,#16a34a)' }} />
              </div>
            </div>
          </div>
          <div className="project-overview-kpi-cell">
            <div className="project-overview-kpi-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
              Profitability
            </div>
            <div className="text-xl font-bold font-mono" style={{ color: budgetSummary.profitability >= 0 ? 'var(--green,#16a34a)' : 'var(--red)' }}>
              {budgetSummary.profitability >= 0 ? '+' : ''}${budgetSummary.profitability.toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">under budget</div>
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
        <div className="project-overview-body">
          {/* Col 1 – Project Breakdown + Milestones */}
          <div className="flex flex-col gap-[18px]">
            <div className="project-overview-card">
              <div className="project-overview-card-title">Project Breakdown</div>
              {project.scope && <div className="project-overview-card-subtitle">{project.scope}</div>}
              <div className="flex flex-col gap-0">
                {phases.length > 0 ? phases.map((ph, i) => {
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
                {milestones.length > 0 ? milestones.map((m, i) => (
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
                  <div className="text-[22px] font-bold font-mono text-[var(--text-primary)]">${budgetSummary.actual_total.toLocaleString()}</div>
                  <div className="text-xs text-[var(--text-muted)]">of ${budgetSummary.predicted_total.toLocaleString()} budget</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-[var(--green,#16a34a)]">+${budgetSummary.profitability.toLocaleString()}</div>
                  <div className="text-xs text-[var(--text-muted)]">under budget</div>
                </div>
              </div>
              {(budget?.items ?? []).map((item) => {
                const pct = item.predicted > 0 ? Math.round((item.actual / item.predicted) * 100) : 0
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
                {project.assigned_to_name && (
                  <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)]">
                    <div className="w-8 h-8 rounded-lg bg-[var(--green,#16a34a)] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{project.assigned_to_name.slice(0, 2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)]">{project.assigned_to_name}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Assigned</div>
                    </div>
                    <button type="button" className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-base)] border border-[var(--border)] px-2.5 py-1 rounded-md cursor-pointer">Message</button>
                  </div>
                )}
                {subcontractors.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: ['#6366f1', '#0ea5e9', '#f59e0b'][i % 3] }}>{s.name.slice(0, 2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)]">{s.name}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{s.trade}</div>
                    </div>
                    <button type="button" className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-base)] border border-[var(--border)] px-2.5 py-1 rounded-md cursor-pointer">Message</button>
                  </div>
                ))}
                {!project.assigned_to_name && subcontractors.length === 0 && <p className="text-sm text-[var(--text-muted)]">No team members yet.</p>}
              </div>
            </div>
          </div>

          {/* Col 3 – Activity + Quick Actions */}
          <div className="flex flex-col gap-[18px]">
            <div className="project-overview-card">
              <div className="project-overview-card-title">Live Activity</div>
              <div className="project-overview-card-subtitle">Recent updates across this project</div>
              <div className="flex flex-col gap-0 relative">
                <div className="project-overview-activity-line" />
                {MOCK_ACTIVITY.map((a, i) => {
                  const tc = TAG_COLORS[a.tag] ?? { bg: 'var(--bg-base)', text: 'var(--text-secondary)' }
                  return (
                    <div key={i} className="project-overview-activity-item">
                      <div className="project-overview-activity-avatar" style={{ background: a.color }}>{a.user}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-[var(--text-primary)]">{a.name} </span>
                            <span className="text-xs text-[var(--text-secondary)]">{a.action}</span>
                          </div>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: tc.bg, color: tc.text }}>{a.tag}</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{a.time}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <button type="button" className="project-overview-view-all">View all activity</button>
            </div>
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
            onSave={id && !isDemo ? async (metaOverride) => {
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
            onImportClick={!isDemo ? () => setScheduleImportOpen(true) : undefined}
            isDemo={isDemo}
            saving={scheduleSaving}
          />
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
              if (isDemo) return
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
              if (isDemo) return
              await api.projects.uploadMedia(project.id, file, uploaderName, caption)
            }}
            onDelete={async (mediaId) => {
              if (isDemo) return
              await api.projects.deleteMedia(project.id, mediaId)
            }}
            onRefresh={isDemo ? () => {} : refreshMedia}
          />
        </section>
      )}

      {activeTab === 'takeoff' && project && (
        <section className="w-full min-w-0 px-8 py-6">
          <LaunchTakeoffWidget
            projectId={project.id}
            onUpload={async (file) => {
              if (isDemo) return { material_list: { categories: [], summary: '' } }
              if (isMockProjectId(project.id)) {
                const result = await api.runTakeoff(file, project.name)
                const newTakeoff = {
                  id: result.id,
                  material_list: result.materialList as MaterialList,
                  created_at: result.createdAt ?? new Date().toISOString(),
                }
                setTakeoffs((prev) => [newTakeoff, ...prev])
                return { material_list: result.materialList as MaterialList }
              }
              const result = await api.projects.launchTakeoff(project.id, file)
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
            onAddSub={
              isDemo
                ? undefined
                : async (row) => {
                    await api.projects.createSubcontractor(project.id, row)
                    refreshSubcontractors()
                  }
            }
            onDeleteSub={
              isDemo
                ? undefined
                : async (subId) => {
                    await api.projects.deleteSubcontractor(project.id, subId)
                    refreshSubcontractors()
                  }
            }
            onBulkSend={(subIds) => {
              setBulkSendIds(subIds)
              setBulkSendOpen(true)
            }}
            initialBidSheet={isMockProjectId(id ?? '') ? getMockProjectDetail(id!).bidSheet : undefined}
          />
        </section>
      )}

      {bulkSendOpen && project && (
        <BulkSendModal
          subCount={bulkSendIds.length}
          onSend={async (subject, body) => {
            if (isDemo) return
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
