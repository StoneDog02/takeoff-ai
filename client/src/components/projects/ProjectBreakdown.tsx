import type { Project, Phase, Milestone } from '@/types/global'
import { formatDate, formatDateRange, todayISO } from '@/lib/date'

interface ProjectBreakdownProps {
  project: Project
  phases: Phase[]
  milestones: Milestone[]
}

function getPhaseStatus(phase: Phase): 'complete' | 'in_progress' | 'upcoming' {
  const today = todayISO()
  if (today > phase.end_date) return 'complete'
  if (today >= phase.start_date && today <= phase.end_date) return 'in_progress'
  return 'upcoming'
}

const cardClass = 'rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-4 shadow-card'

export function ProjectBreakdown({ project, phases, milestones }: ProjectBreakdownProps) {
  return (
    <div className="space-y-6">
      {/* Project breakdown card */}
      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-1">Project breakdown</h2>
        {project.scope && (
          <p className="text-sm text-muted dark:text-white-dim mb-4 whitespace-pre-wrap">{project.scope}</p>
        )}
        {phases.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-border-dark">
            {phases.map((p) => {
              const status = getPhaseStatus(p)
              return (
                <li key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="shrink-0 flex items-center justify-center w-5 h-5" aria-hidden>
                    {status === 'complete' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-primary dark:bg-primary" />
                    )}
                    {status === 'in_progress' && (
                      <span className="w-2.5 h-2.5 rounded-full border-2 border-primary dark:border-primary bg-transparent" />
                    )}
                    {status === 'upcoming' && (
                      <span className="w-2.5 h-2.5 rounded-full border-2 border-gray-300 dark:border-gray-500 bg-transparent" />
                    )}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-landing-white flex-1 min-w-0">
                    {p.name}
                  </span>
                  <span className="text-sm text-muted dark:text-white-dim shrink-0 tabular-nums">
                    {formatDateRange(p.start_date, p.end_date)}
                  </span>
                  <span
                    className={`text-sm font-medium shrink-0 ${
                      status === 'complete'
                        ? 'text-green-600 dark:text-green-400'
                        : status === 'in_progress'
                          ? 'text-primary dark:text-primary'
                          : 'text-gray-400 dark:text-white-faint'
                    }`}
                  >
                    {status === 'complete' ? 'Complete' : status === 'in_progress' ? 'In progress' : 'Upcoming'}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted dark:text-white-dim">No phases yet.</p>
        )}
      </div>

      {/* Key milestones card */}
      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-4">Key milestones</h2>
        {milestones.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-border-dark">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full ${
                    m.completed ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/30'
                  }`}
                  aria-hidden
                >
                  {m.completed ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
                      <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    </svg>
                  )}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-landing-white flex-1 min-w-0">
                  {m.title}
                </span>
                <span className="text-sm text-muted dark:text-white-dim shrink-0 tabular-nums">
                  {formatDate(m.due_date)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted dark:text-white-dim">No milestones yet.</p>
        )}
      </div>
    </div>
  )
}
