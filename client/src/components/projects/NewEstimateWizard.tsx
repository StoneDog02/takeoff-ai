import type { Project } from '@/types/global'

export interface NewEstimateWizardProps {
  onClose: () => void
  onComplete: (createdProject: Project) => void
}

/**
 * Wizard for creating a new estimate (estimating-column flow).
 * TODO: Implement full steps; for now a placeholder so the board flow compiles.
 */
export function NewEstimateWizard({ onClose, onComplete: _onComplete }: NewEstimateWizardProps) {
  return (
    <div className="new-estimate-wizard-placeholder" role="dialog" aria-modal="true">
      <p>New Estimate Wizard — placeholder</p>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  )
}
