import type { DashboardProject } from '@/api/client'
import { formatDate } from '@/lib/date'

function formatAddress(p: DashboardProject): string {
  return [p.address_line_1, p.city, p.state, p.postal_code].filter(Boolean).join(', ') || '—'
}

function completionTimestamp(p: DashboardProject): string | null {
  const raw = p.completed_at || p.updated_at || p.created_at
  return raw || null
}

function sortKey(p: DashboardProject): number {
  const t = p.completed_at || p.updated_at || p.created_at
  if (!t) return 0
  return new Date(t).getTime()
}

interface CompletedProjectsModalProps {
  projects: DashboardProject[]
  onClose: () => void
  onSelectProject: (id: string) => void
}

/**
 * Full list of completed projects (e.g. older than the board’s 7-day window).
 */
export function CompletedProjectsModal({ projects, onClose, onSelectProject }: CompletedProjectsModalProps) {
  const sorted = [...projects].sort((a, b) => sortKey(b) - sortKey(a))

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="completed-archive-title"
    >
      <div
        className="rounded-xl border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 shadow-xl w-full max-w-lg max-h-[min(80vh,560px)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border dark:border-border-dark flex items-center justify-between gap-2 shrink-0">
          <h2 id="completed-archive-title" className="text-[15px] font-bold text-gray-900 dark:text-landing-white">
            Completed projects
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted hover:text-gray-900 dark:hover:text-landing-white hover:bg-black/[0.04] dark:hover:bg-white/10"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-2 py-2 min-h-0">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No completed projects.</p>
          ) : (
            <ul className="space-y-1">
              {sorted.map((p) => {
                const budget = p.budget_total ?? p.estimated_value ?? 0
                const completedOn = formatDate(completionTimestamp(p) ?? null)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProject(p.id)
                        onClose()
                      }}
                      className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent hover:border-border dark:hover:border-white/10 transition-colors"
                    >
                      <div className="text-[14px] font-semibold text-gray-900 dark:text-landing-white">{p.name}</div>
                      <div className="text-[12px] text-muted mt-0.5">{formatAddress(p)}</div>
                      <div className="text-[12px] text-muted mt-1">
                        Completed on{' '}
                        <span className="text-gray-700 dark:text-white-dim font-medium tabular-nums">{completedOn}</span>
                      </div>
                      {budget > 0 ? (
                        <div className="text-[12px] font-medium text-gray-600 dark:text-white-dim mt-1">
                          ${Number(budget).toLocaleString()}
                        </div>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
