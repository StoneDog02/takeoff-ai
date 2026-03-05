import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { Project, Phase, Milestone, ProjectTask, JobWalkMedia, Subcontractor } from '@/types/global'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { ProjectBreakdown } from '@/components/projects/ProjectBreakdown'
import { JobWalkGallery } from '@/components/projects/JobWalkGallery'
import { BudgetChart } from '@/components/projects/BudgetChart'
import { BudgetTab } from '@/components/projects/BudgetTab'
import { LaunchTakeoffWidget } from '@/components/projects/LaunchTakeoffWidget'
import { BulkSendModal } from '@/components/projects/BulkSendModal'
import { BidSheetFlow } from '@/components/projects/BidSheetFlow'
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

const DETAIL_TAB_IDS = ['overview', 'schedule', 'budget', 'media', 'takeoff', 'bidsheet'] as const
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
  const tabFromUrl = searchParams.get('tab')
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

    const addNewProjectCard = (
      <button
        type="button"
        onClick={() => setNewProjectOpen(true)}
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-border-dark bg-transparent min-h-[140px] h-full w-full hover:border-primary/50 hover:bg-gray-100/50 dark:hover:bg-dark-4/30 transition-colors cursor-pointer group"
      >
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-dark-3 border border-gray-200 dark:border-border-dark shadow-sm group-hover:bg-accent group-hover:border-accent group-hover:shadow transition-all duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-white-dim group-hover:text-white transition-colors duration-200">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
        <span className="text-sm font-medium text-gray-600 dark:text-white-dim group-hover:text-gray-900 dark:group-hover:text-landing-white transition-colors">
          Start a new project
        </span>
      </button>
    )

    return (
      <div className="min-h-full">
        <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
          {/* Header */}
          <h1 className="dashboard-title mb-6">Projects</h1>

          {/* Filter tabs + Search + New project */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              {(['all', 'active', 'planning', 'on_hold', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`text-sm font-medium transition-colors ${
                    filter === tab
                      ? 'rounded-full px-4 py-2 bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 dark:text-white-dim hover:text-gray-900 dark:hover:text-landing-white'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'on_hold' ? 'On Hold' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-initial">
              <div className="relative flex-1 sm:w-64 sm:flex-none">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-white-faint pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 text-gray-900 dark:text-landing-white placeholder:text-muted dark:placeholder:text-white-faint focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => setListView(listView === 'grid' ? 'table' : 'grid')}
                className="shrink-0 p-2.5 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 text-gray-600 dark:text-white-dim hover:bg-gray-100 dark:hover:bg-dark-4 hover:text-gray-900 dark:hover:text-landing-white transition-colors"
                title={listView === 'grid' ? 'Switch to table view' : 'Switch to grid view'}
                aria-label={listView === 'grid' ? 'Switch to table view' : 'Switch to grid view'}
              >
                {listView === 'grid' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 6h13" />
                    <path d="M8 12h13" />
                    <path d="M8 18h13" />
                    <path d="M3 6h.01" />
                    <path d="M3 12h.01" />
                    <path d="M3 18h.01" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="7" height="7" x="3" y="3" rx="1" />
                    <rect width="7" height="7" x="14" y="3" rx="1" />
                    <rect width="7" height="7" x="14" y="14" rx="1" />
                    <rect width="7" height="7" x="3" y="14" rx="1" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setNewProjectOpen(true)}
                className="btn shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New project
              </button>
            </div>
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
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden bg-transparent border-b border-x border-border dark:border-border-dark">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border dark:border-border-dark bg-gray-100 dark:bg-dark-4">
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white-dim">Project</th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white-dim">ID</th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white-dim">Status</th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white-dim">Assignee</th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white-dim text-right">Value</th>
                        <th className="w-10 px-4 py-3.5" aria-hidden="true" />
                      </tr>
                    </thead>
                    <tbody>
                      {displayedProjects.map((p) => {
                      const card = MOCK_PROJECT_CARD_DATA[p.id]
                      return (
                        <tr
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/projects/${p.id}`)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/projects/${p.id}`) } }}
                          className="group border-b border-border dark:border-border-dark bg-white dark:bg-dark-3 hover:bg-gray-50 dark:hover:bg-dark-4/70 transition-colors cursor-pointer border-l-2 border-l-transparent hover:border-l-primary dark:hover:border-l-primary"
                        >
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-gray-900 dark:text-landing-white group-hover:text-primary dark:group-hover:text-primary">
                              {p.name}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-white-dim">{card?.projectId ?? p.id?.slice(0, 8) ?? '—'}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              p.status === 'active' ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200' :
                              p.status === 'planning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' :
                              p.status === 'on_hold' ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200' :
                              p.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
                              {p.status === 'on_hold' ? 'On Hold' : (p.status ?? '').charAt(0).toUpperCase() + (p.status ?? '').slice(1)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-white-dim">{card?.assignedTo?.name ?? p.assigned_to_name ?? '—'}</td>
                          <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-landing-white text-right tabular-nums">
                            {(card?.value ?? p.estimated_value) != null ? `$${Number(card?.value ?? p.estimated_value).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-gray-400 dark:text-white-faint group-hover:text-primary dark:group-hover:text-primary transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </td>
                        </tr>
                      )
                      })}
                      <tr className="bg-transparent border-t border-border dark:border-border-dark">
                        <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white-dim tabular-nums" colSpan={1}>
                          {displayedProjects.length} PROJECTS
                        </td>
                        <td className="px-5 py-3" colSpan={2} />
                        <td className="px-5 py-3" colSpan={1} />
                        <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-landing-white text-right tabular-nums">
                          {totalValue > 0 ? `$${totalValue.toLocaleString()}` : '—'}
                        </td>
                        <td className="w-10 px-4 py-3" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
              <div className="min-h-0 h-full">
                {addNewProjectCard}
              </div>
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
  // Timeline KPI: MM/DD/YYYY via central date lib (formatDateRange uses formatDate)
  const timelineLabel =
    timelineStart && timelineEnd
      ? `${formatDate(timelineStart)} – ${formatDate(timelineEnd)}`
      : timelineStart
        ? formatDate(timelineStart)
        : timelineEnd
          ? formatDate(timelineEnd)
          : '—'

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: 'grid' },
    { id: 'schedule' as const, label: 'Schedule', icon: 'calendar' },
    { id: 'budget' as const, label: 'Budget', icon: 'dollar' },
    { id: 'media' as const, label: 'Job Walk Media', icon: 'image' },
    { id: 'takeoff' as const, label: 'Takeoff', icon: 'document' },
    { id: 'bidsheet' as const, label: 'Bid Sheet', icon: 'checklist' },
  ]

  const statusKey = (project?.status ?? 'active').toLowerCase().replace(' ', '_')
  const statusPillClass =
    statusKey === 'active'
      ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200'
      : statusKey === 'planning'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : statusKey === 'on_hold'
          ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
          : statusKey === 'completed'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-200'

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/projects" className="text-muted dark:text-white-dim hover:text-gray-900 dark:hover:text-landing-white shrink-0">
            ← Projects
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-landing-white truncate">{project?.name}</h1>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPillClass}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          {project?.status === 'on_hold' ? 'On Hold' : (project?.status ?? 'Active').charAt(0).toUpperCase() + (project?.status ?? 'active').slice(1)}
        </span>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 dark:bg-dark-4 text-gray-600 dark:text-white-dim">
          {projectIdDisplay}
        </span>
        <button type="button" className="rounded-md px-2.5 py-1 text-sm text-muted dark:text-white-dim hover:bg-gray-100 dark:hover:bg-dark-4 border border-border dark:border-border-dark">
          Edit
        </button>
        <button type="button" className="rounded-md px-2.5 py-1 text-sm text-muted dark:text-white-dim hover:bg-gray-100 dark:hover:bg-dark-4 border border-border dark:border-border-dark">
          Share
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white-faint mb-0.5">Client</p>
          <p className="text-sm font-medium text-gray-900 dark:text-landing-white truncate">{project?.assigned_to_name || '—'}</p>
        </div>
        <div className="rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white-faint mb-0.5">Profitability</p>
          <p className={`text-sm font-medium ${budgetSummary.profitability >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {budgetSummary.profitability >= 0 ? '+' : ''}${budgetSummary.profitability.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white-faint mb-0.5">Timeline</p>
          <p className="text-sm font-medium text-gray-900 dark:text-landing-white truncate">{timelineLabel}</p>
        </div>
      </div>

      <nav className="border-b border-border dark:border-border-dark mb-6" aria-label="Project sections">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-accent text-accent dark:border-accent dark:text-accent'
                  : 'border-transparent text-muted dark:text-white-dim hover:text-gray-900 dark:hover:text-landing-white hover:border-gray-300 dark:hover:border-border-dark'
              }`}
            >
              {tab.icon === 'grid' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
              )}
              {tab.icon === 'calendar' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              )}
              {tab.icon === 'dollar' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              )}
              {tab.icon === 'image' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              )}
              {tab.icon === 'document' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" />
                </svg>
              )}
              {tab.icon === 'checklist' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === 'overview' && project && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <ProjectBreakdown project={project} phases={phases} milestones={milestones} />
          </div>
          <div className="space-y-6">
            <div className="rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-4 shadow-card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-3">Team</h2>
              {project.assigned_to_name && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-full bg-primary/20 dark:bg-primary/30 flex items-center justify-center text-sm font-medium text-primary">
                    {(project.assigned_to_name || ' ').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-white-dim">{project.assigned_to_name}</span>
                  <span className="text-xs text-muted dark:text-white-faint">Assigned</span>
                </div>
              )}
              {subcontractors.length > 0 ? (
                <ul className="space-y-2">
                  {subcontractors.slice(0, 6).map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="w-7 h-7 rounded-full bg-gray-200 dark:bg-dark-4 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-white-dim">
                        {s.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-gray-900 dark:text-landing-white">{s.name}</span>
                      <span className="text-muted dark:text-white-faint">· {s.trade}</span>
                    </li>
                  ))}
                  {subcontractors.length > 6 && (
                    <li className="text-xs text-muted dark:text-white-faint">+{subcontractors.length - 6} more</li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted dark:text-white-dim">No subcontractors yet.</p>
              )}
            </div>
            <BudgetChart summary={budgetSummary} />
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <section className="w-full min-w-0">
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
        <section className="w-full min-w-0">
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
        <section className="w-full min-w-0">
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
        <section>
          <LaunchTakeoffWidget
            projectId={project.id}
            onUpload={async (file) => {
              if (isDemo) return { material_list: { categories: [], summary: '' } }
              const result = await api.projects.launchTakeoff(project.id, file)
              return { material_list: result.material_list }
            }}
            existingTakeoffs={takeoffs}
          />
        </section>
      )}

      {activeTab === 'bidsheet' && project && (
        <section className="w-full min-w-0">
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
