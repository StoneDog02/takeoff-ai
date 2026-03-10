import { Link } from 'react-router-dom'
import type { Project } from '@/types/global'
import type { ProjectCardData } from '@/data/mockProjectsData'

interface ProjectCardProps {
  project: Project
  cardData?: ProjectCardData | null
  isDemo?: boolean
  onDelete?: (project: Project) => void
}

const HEALTH_CONFIG: Record<string, { label: string; bar: string; bg: string; border: string }> = {
  'on-track': { label: 'On Track', bar: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  watch: { label: 'Watch', bar: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  hold: { label: 'On Hold', bar: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
  complete: { label: 'Complete', bar: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  planning: { bg: '#fefce8', text: '#a16207', dot: '#eab308' },
  on_hold: { bg: '#f3f4f6', text: '#374151', dot: '#6b7280' },
  completed: { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
}

const AVATAR_COLORS = ['#16a34a', '#0ea5e9', '#8b5cf6', '#eab308', '#dc2626']

function getAvatarColor(initials: string): string {
  const i = initials.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[i] ?? AVATAR_COLORS[0]
}

function getHealth(
  isComplete: boolean | undefined,
  phases: { completed: boolean }[],
  status: string | undefined
): keyof typeof HEALTH_CONFIG {
  if (isComplete) return 'complete'
  const key = (status ?? '').toLowerCase().replace(' ', '_')
  if (key === 'on_hold') return 'hold'
  if (phases.length === 0) return 'on-track'
  const completedCount = phases.filter((p) => p.completed).length
  const pct = (completedCount / phases.length) * 100
  if (pct >= 80) return 'watch'
  return 'on-track'
}

function fmt(n: number): string {
  return '$' + n.toLocaleString()
}

export function ProjectCard({ project, cardData, isDemo, onDelete }: ProjectCardProps) {
  const statusKey = (project.status ?? 'active').toLowerCase().replace(' ', '_')
  const statusStyle = STATUS_STYLES[statusKey] ?? STATUS_STYLES.active
  const phases = cardData?.phaseProgress ?? []
  const phaseIndex = phases.findIndex((p) => !p.completed)
  const currentIndex = phaseIndex < 0 ? phases.length - 1 : phaseIndex
  const currentPhase = phases[currentIndex]
  const phaseProgressPct =
    phases.length && currentIndex >= 0 && currentIndex < phases.length
      ? phaseIndex < 0
        ? 100
        : 50
      : 0
  const health = getHealth(cardData?.isComplete, phases, project.status)
  const healthStyle = HEALTH_CONFIG[health]
  const budget = cardData?.value ?? project.estimated_value ?? 0
  const completedCount = phases.filter((p) => p.completed).length
  const pct = phases.length ? Math.min(100, Math.round((completedCount / phases.length) * 100)) : 0
  const spent = phases.length ? Math.round((budget * completedCount) / phases.length) : 0
  const overBudget = budget > 0 && spent > budget
  const address = [project.address_line_1, project.city].filter(Boolean).join(', ') || '—'

  return (
    <Link to={`/projects/${project.id}`} className="projects-card block">
      <div className="projects-card-accent" style={{ background: healthStyle.bar }} />
      <div className="projects-card-body">
        {/* Top row */}
        <div className="projects-card-top">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="projects-card-id font-mono">
                {cardData?.projectId ?? project.id?.slice(0, 8) ?? '—'}
              </span>
              {isDemo && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  Demo
                </span>
              )}
            </div>
            <h3 className="projects-card-name">{project.name}</h3>
            <p className="projects-card-address">{address}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 ml-3 shrink-0">
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(project)
                }}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20"
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
            )}
            <span
              className="projects-card-status-pill"
              style={{ background: statusStyle.bg, color: statusStyle.text }}
            >
              <span
                style={{ width: 6, height: 6, borderRadius: '50%', background: statusStyle.dot }}
                className="inline-block"
              />
              {project.status === 'on_hold' ? 'On Hold' : (project.status ?? 'active').charAt(0).toUpperCase() + (project.status ?? 'active').slice(1).replace('_', ' ')}
            </span>
            <span
              className="projects-card-health-pill"
              style={{ background: healthStyle.bg, color: healthStyle.bar, borderColor: healthStyle.border }}
            >
              {healthStyle.label}
            </span>
          </div>
        </div>

        {/* Phase progress */}
        <div className="projects-card-phase-section">
          <div className="flex justify-between items-center mb-1.5">
            <span className="projects-card-phase-label">Phase</span>
            <span className="projects-card-phase-name">{currentPhase?.name ?? '—'}</span>
          </div>
          {phases.length > 0 && (
            <div className="projects-card-phase-steps">
              {phases.map((ph, i) => {
                const isPast = i < currentIndex
                const isCurrent = i === currentIndex
                const barBg = isPast ? 'var(--text-primary)' : 'var(--border)'
                return (
                  <div key={ph.name} className="projects-card-phase-step">
                    <div
                      className="projects-card-phase-bar"
                      style={{ background: barBg }}
                    >
                      {isCurrent && (
                        <div
                          className="absolute left-0 top-0 h-full rounded-[2px]"
                          style={{ width: `${phaseProgressPct}%`, background: healthStyle.bar }}
                        />
                      )}
                    </div>
                    <span
                      className="projects-card-phase-step-label"
                      style={{
                        color: i <= currentIndex ? 'var(--text-secondary)' : 'var(--text-muted)',
                        fontWeight: isCurrent ? 600 : 400,
                      }}
                    >
                      {ph.name}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Next step */}
        <div className="projects-card-next">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>{cardData?.nextStep ?? (cardData?.isComplete ? 'All phases complete – closed out' : '—')}</span>
        </div>

        {/* Bottom stats */}
        <div className="projects-card-stats">
          <div>
            <div className="projects-card-stat-label">Budget</div>
            <div
              className="projects-card-stat-value"
              style={{ color: overBudget ? 'var(--red)' : undefined }}
            >
              {fmt(spent)}
            </div>
            <div className="projects-card-stat-sub">
              {budget > 0 ? `${pct}% of ${fmt(budget)}` : '—'}
            </div>
            <div className="projects-card-budget-bar">
              <div
                className="projects-card-budget-fill"
                style={{
                  width: `${Math.min(100, budget > 0 ? (spent / budget) * 100 : 0)}%`,
                  background:
                    pct > 95 ? 'var(--red)' : pct > 80 ? '#f59e0b' : 'var(--green, #22c55e)',
                }}
              />
            </div>
          </div>
          <div>
            <div className="projects-card-stat-label">Days Left</div>
            <div className="projects-card-stat-value">–</div>
            <div className="projects-card-stat-sub">—</div>
          </div>
          <div>
            <div className="projects-card-stat-label mb-1">PM</div>
            <div className="projects-card-pm">
              {cardData?.assignedTo ? (
                <>
                  <div
                    className="projects-card-avatar"
                    style={{ background: getAvatarColor(cardData.assignedTo.initials) }}
                  >
                    {cardData.assignedTo.initials}
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)] leading-tight">
                    {cardData.assignedTo.name.split(' ')[0]}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">
                  {project.assigned_to_name ?? '—'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
