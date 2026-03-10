import { STEPS, WIZARD_RED, hasFilledWorkTypes } from './constants'

function pctFromProject(proj: {
  clientName?: string
  client?: string
  assigned_to_name?: string
  phases?: unknown[]
  budget?: number
  budgetItemsCount?: number
  team?: unknown[]
  workTypes?: unknown[]
  milestones?: unknown[]
}): number {
  const total = 6
  let filled = 0
  if (proj.clientName || proj.client || proj.assigned_to_name) filled++
  if (proj.phases?.length) filled++
  const hasBudget = (proj.budget && proj.budget > 0) || (proj.budgetItemsCount && proj.budgetItemsCount > 0)
  if (hasBudget) filled++
  if (proj.team?.length) filled++
  if (hasFilledWorkTypes(proj.workTypes as unknown[] | undefined)) filled++
  if (proj.milestones?.length) filled++
  return Math.round((filled / total) * 100)
}

export interface SetupBannerProps {
  /** Project-like shape: client, phases, budget, team, workTypes, milestones */
  project: {
    clientName?: string
    client?: string
    assigned_to_name?: string
    phases?: unknown[]
    budget?: number
    budgetItemsCount?: number
    team?: unknown[]
    workTypes?: unknown[]
    milestones?: unknown[]
  }
  onOpenWizard: () => void
}

export function SetupBanner({ project, onOpenWizard }: SetupBannerProps) {
  const pct = pctFromProject(project)
  const missing: string[] = []
  if (!project.clientName && !project.client && !project.assigned_to_name) missing.push('client')
  if (!project.phases?.length) missing.push('phases')
  const hasBudget = (project.budget && project.budget > 0) || (project.budgetItemsCount && project.budgetItemsCount > 0)
  if (!hasBudget) missing.push('budget')
  if (!project.team?.length) missing.push('crew')
  if (!hasFilledWorkTypes(project.workTypes as unknown[] | undefined)) missing.push('work types')
  if (!project.milestones?.length) missing.push('milestones')

  if (pct >= 100) return null

  const stepDone = (stepId: string) => {
    if (stepId === 'client') return !!(project.clientName || project.client || project.assigned_to_name)
    if (stepId === 'phases') return !!project.phases?.length
    if (stepId === 'budget') return hasBudget
    if (stepId === 'team') return !!project.team?.length
    if (stepId === 'worktypes') return hasFilledWorkTypes(project.workTypes as unknown[] | undefined)
    if (stepId === 'milestones') return !!project.milestones?.length
    return false
  }


  return (
    <div
      style={{
        background: 'var(--bg-surface, #fff)',
        borderRadius: 14,
        border: '1.5px solid ' + WIZARD_RED + '30',
        padding: '14px 22px',
        marginBottom: 20,
        boxShadow: '0 2px 12px ' + WIZARD_RED + '10',
      }}
    >
      {/* Single-row strip: icon + message + missing + progress + button */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: WIZARD_RED + '12',
              border: '1.5px solid ' + WIZARD_RED + '25',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            🛠️
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0f172a)' }}>Finish setting up this project</span>
            <span style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginLeft: 8 }}>
              Still missing: <span style={{ fontWeight: 600, color: '#475569' }}>{missing.join(', ')}</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{pct}%</span>
            <div style={{ width: 100, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct + '%', background: WIZARD_RED, borderRadius: 3, transition: 'width 0.4s ease' }} />
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenWizard}
            style={{
              padding: '8px 16px',
              background: WIZARD_RED,
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px ' + WIZARD_RED + '30',
            }}
          >
            Continue Setup →
          </button>
        </div>
      </div>
      {/* Step pills on second row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f8fafc', flexWrap: 'wrap' }}>
        {STEPS.map((s) => {
          const done = stepDone(s.id)
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={onOpenWizard}
              onKeyDown={(e) => e.key === 'Enter' && onOpenWizard()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 11px',
                borderRadius: 20,
                background: done ? '#f0fdf4' : '#f8fafc',
                border: '1px solid ' + (done ? '#bbf7d0' : '#e2e8f0'),
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: done ? '#16a34a' : '#cbd5e1', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: done ? '#16a34a' : '#94a3b8' }}>{s.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
