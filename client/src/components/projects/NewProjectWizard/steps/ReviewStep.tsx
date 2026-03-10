import { pctDone } from '../constants'
import type { WizardProjectState } from '../types'
import { WorkTypeIcon } from '@/components/projects/WorkTypeIcon'

export function ReviewStep({ project }: { project: WizardProjectState }) {
  const total = project.budget ?? 0
  const pct = pctDone(project)

  const taskCount = project.tasks?.length ?? 0
  const rows = [
    { icon: '👤', label: 'Client', val: project.clientName ?? project.client ?? '', empty: 'Not set' },
    { icon: '📅', label: 'Timeline', val: project.startDate && project.endDate ? `${project.startDate} → ${project.endDate}` : '', empty: 'No dates set' },
    { icon: '📋', label: 'Phases', val: project.phases?.length ? `${project.phases.length} phase${project.phases.length !== 1 ? 's' : ''}` : null, empty: 'No phases added' },
    { icon: '✓', label: 'Tasks', val: taskCount > 0 ? `${taskCount} task${taskCount !== 1 ? 's' : ''}` : null, empty: 'No tasks' },
    { icon: '💰', label: 'Budget', val: total > 0 ? `$${total.toLocaleString()}` : null, empty: 'No budget set' },
    { icon: '👷', label: 'Team', val: project.team?.length ? `${project.team.length} member${project.team.length !== 1 ? 's' : ''}` : null, empty: 'No crew added' },
    { icon: '🔧', label: 'Work Types', val: project.workTypes?.length ? `${project.workTypes.length} type${project.workTypes.length !== 1 ? 's' : ''}` : null, empty: 'No work types' },
    { icon: '🏁', label: 'Milestones', val: project.milestones?.length ? `${project.milestones.length} milestone${project.milestones.length !== 1 ? 's' : ''}` : null, empty: 'No milestones' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          padding: '16px 18px',
          background: pct === 100 ? '#f0fdf4' : '#fffbeb',
          borderRadius: 12,
          border: `1.5px solid ${pct === 100 ? '#bbf7d0' : '#fde68a'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 28 }}>{pct === 100 ? '🎉' : '⚠️'}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
            {pct === 100 ? 'Project fully configured!' : 'Almost there — some sections are incomplete'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginTop: 2 }}>
            {pct === 100 ? 'Everything looks good. Hit Launch to go live.' : 'You can always finish setup later from the project overview.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {rows.map(({ icon, label, val, empty }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 14px',
              background: 'var(--bg-muted, #f8fafc)',
              borderRadius: 10,
              border: `1.5px solid ${val ? 'var(--border, #e2e8f0)' : '#fde68a'}`,
            }}
          >
            {label === 'Work Types' ? (
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><WorkTypeIcon typeKey="labor" size={16} /></span>
            ) : (
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
            )}
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted, #94a3b8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: val ? 600 : 400, color: val ? 'var(--text, #0f172a)' : '#94a3b8', marginTop: 1 }}>{val || empty}</div>
            </div>
            {val ? (
              <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
