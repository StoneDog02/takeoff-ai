import type { ProposalLine } from '@/types/global'

interface ProposalViewStageProps {
  proposalLines: ProposalLine[]
  projectName?: string
  projectAddress?: string
  total?: number
}

export function ProposalViewStage({ proposalLines, projectName, projectAddress, total: totalProp }: ProposalViewStageProps) {
  const total = totalProp ?? proposalLines.reduce((s, l) => s + Number(l.amount || 0), 0)
  const subtitle = [projectAddress, 'Prepared March 2026'].filter(Boolean).join(' · ')

  if (proposalLines.length === 0 && !projectName) {
    return (
      <p className="text-sm text-muted">
        No proposal lines yet. Group trade items into proposal lines in the bid sheet data, or add them manually.
      </p>
    )
  }

  return (
    <div className="bidsheet-proposal-wrap">
      <div className="bidsheet-proposal-card">
        <div className="bidsheet-proposal-header">
          <div className="bidsheet-proposal-header-label">Project Proposal</div>
          <div className="bidsheet-proposal-header-title">{projectName || 'Project'}</div>
          <div className="bidsheet-proposal-header-sub">{subtitle}</div>
        </div>
        <div style={{ padding: '8px 0' }}>
          {proposalLines.length > 0 ? (
            proposalLines.map((line) => (
              <div key={line.id} className="bidsheet-proposal-line">
                <div>
                  <div className="bidsheet-proposal-line-label">{line.label}</div>
                  {line.description && <div className="bidsheet-proposal-line-note">{line.description}</div>}
                </div>
                <div className="bidsheet-proposal-line-amount" style={{ color: Number(line.amount) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {Number(line.amount) > 0 ? `$${Number(line.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'TBD'}
                </div>
              </div>
            ))
          ) : (
            <div className="bidsheet-proposal-line">
              <div className="bidsheet-proposal-line-label">No line items</div>
              <div className="bidsheet-proposal-line-amount text-muted">TBD</div>
            </div>
          )}
        </div>
        <div className="bidsheet-proposal-total">
          <span className="label">Total Project Investment</span>
          <span className="value">${Math.round(total).toLocaleString()}</span>
        </div>
        <div className="bidsheet-proposal-disclaimer">
          This proposal is valid for 30 days. Scope inclusions and exclusions available upon request. Prices based on current material costs and may be subject to change based on final selections.
        </div>
      </div>
    </div>
  )
}
