import { Link } from 'react-router-dom'
import type { Project } from '@/types/global'
import type { ProjectCardData } from '@/data/mockProjectsData'

interface ProjectCardProps {
  project: Project
  cardData?: ProjectCardData | null
  isDemo?: boolean
}

const STATUS_STYLES: Record<string, { dot: string; badge: string }> = {
  active: {
    dot: 'bg-sky-600 dark:bg-sky-500',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
  },
  planning: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  on_hold: {
    dot: 'bg-gray-400',
    badge: 'bg-gray-500 text-white dark:bg-gray-600 dark:text-gray-200',
  },
  completed: {
    dot: 'bg-green-600 dark:bg-green-500',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
  },
}

const AVATAR_COLORS = [
  'bg-accent text-white dark:bg-accent dark:text-white',
  'bg-primary text-white dark:bg-primary dark:text-white',
  'bg-green-500 text-white',
  'bg-amber-500 text-white',
  'bg-purple-500 text-white dark:bg-purple-600',
  'bg-teal-500 text-white dark:bg-teal-600',
]

function getAvatarColor(initials: string): string {
  const i = initials.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[i] ?? AVATAR_COLORS[0]
}

export function ProjectCard({ project, cardData, isDemo }: ProjectCardProps) {
  const statusKey = (project.status ?? 'active').toLowerCase().replace(' ', '_')
  const statusStyle = STATUS_STYLES[statusKey] ?? STATUS_STYLES.active
  const phases = cardData?.phaseProgress ?? []
  const hasProgress = phases.length > 0
  const value = cardData?.value ?? project.estimated_value ?? 0
  const assigneeDisplay = cardData?.assignedTo?.name ?? project.assigned_to_name

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-5 shadow-card hover:shadow-md hover:border-primary/30 dark:hover:border-primary/40 transition-all"
    >
      {/* Title row + badges */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-semibold text-gray-900 dark:text-landing-white text-[15px] leading-tight flex-1 min-w-0">
          {project.name}
        </h3>
        <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
          {isDemo && (
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-accent/15 text-accent dark:bg-accent/25 dark:text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Demo
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusStyle.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {(project.status ?? 'active').replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Project ID */}
      {(cardData?.projectId ?? project.id) && (
        <p className="text-xs text-muted dark:text-white-faint mb-3">
          {cardData?.projectId ?? project.id}
        </p>
      )}

      {/* Phase progress */}
      {hasProgress && (
        <div className="mb-3">
          <p className="text-xs text-muted dark:text-white-dim mb-2">Phase progress</p>
          <div className="flex rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-4 h-2">
            {phases.map((phase, i) => (
              <div
                key={i}
                className={`flex-1 min-w-0 transition-colors ${
                  phase.completed
                    ? 'bg-primary dark:bg-primary'
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}
                style={{ width: `${100 / phases.length}%` }}
                title={phase.name}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1.5 gap-1">
            {phases.map((phase, i) => (
              <span
                key={i}
                className={`text-[11px] truncate ${
                  phase.completed
                    ? 'text-primary dark:text-primary font-medium'
                    : 'text-muted dark:text-white-faint'
                }`}
                style={{ maxWidth: `${100 / phases.length}%` }}
              >
                {phase.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next step */}
      {(cardData?.nextStep ?? cardData?.isComplete) && (
        <div
          className={`rounded-lg px-3 py-2 flex items-center gap-2 text-sm mb-4 ${
            cardData?.isComplete
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-gray-100 dark:bg-dark-4 text-gray-700 dark:text-white-dim'
          }`}
        >
          {cardData?.isComplete ? (
            <span className="shrink-0 text-green-600 dark:text-green-400" aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          ) : (
            <span className="shrink-0 text-muted dark:text-white-faint" aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          )}
          <span className="truncate">{cardData?.nextStep ?? 'All phases complete – closed out'}</span>
        </div>
      )}

      {/* Footer: assignee + value */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border dark:border-border-dark">
        {assigneeDisplay ? (
          <div className="flex items-center gap-2 min-w-0">
            {cardData?.assignedTo?.initials ? (
              <span
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${getAvatarColor(cardData.assignedTo.initials)}`}
              >
                {cardData.assignedTo.initials}
              </span>
            ) : null}
            <span className="text-sm text-gray-700 dark:text-white-dim truncate">
              {assigneeDisplay}
            </span>
          </div>
        ) : (
          <div />
        )}
        {value > 0 && (
          <span className="font-semibold text-gray-900 dark:text-landing-white shrink-0">
            ${value.toLocaleString()}
          </span>
        )}
      </div>
    </Link>
  )
}
