import type { Project } from '@/types/global'

interface ConfirmDeleteProjectModalProps {
  project: Project
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
  error?: string | null
}

export function ConfirmDeleteProjectModal({
  project,
  onClose,
  onConfirm,
  isDeleting,
  error,
}: ConfirmDeleteProjectModalProps) {
  const name = project.name || 'this project'
  const address = [project.address_line_1, project.city].filter(Boolean).join(', ') || ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-project-title"
    >
      <div
        className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-6 shadow-lg max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            aria-hidden
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="delete-project-title" className="text-lg font-semibold text-gray-900 dark:text-landing-white">
              Delete project?
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-white-dim">
              <span className="font-medium text-gray-900 dark:text-landing-white">{name}</span>
              {address && (
                <>
                  {' · '}
                  <span className="text-muted dark:text-white-faint">{address}</span>
                </>
              )}
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-white-dim">
              This will permanently delete the project and all related data (phases, milestones, budget, media, takeoffs, bid sheet). This cannot be undone.
            </p>
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-md border border-border dark:border-border-dark text-gray-700 dark:text-landing-white hover:bg-gray-50 dark:hover:bg-dark-4 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      </div>
    </div>
  )
}
