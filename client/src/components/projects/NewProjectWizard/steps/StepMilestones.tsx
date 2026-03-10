import { AddBtn } from '../primitives'
import { uid } from '../constants'
import type { WizardProjectState, WizardMilestone } from '../types'

type OnChange = (key: keyof WizardProjectState, value: unknown) => void

export function StepMilestones({ data, onChange }: { data: WizardProjectState; onChange: OnChange }) {
  const ms = data.milestones ?? []
  const phases = data.phases ?? []

  function addMs() {
    onChange('milestones', [...ms, { id: uid(), label: '', date: '', type: 'custom' }])
  }
  function updateMs(id: string, field: keyof WizardMilestone, val: string) {
    onChange('milestones', ms.map((m) => (m.id === id ? { ...m, [field]: val } : m)))
  }
  function removeMs(id: string) {
    onChange('milestones', ms.filter((m) => m.id !== id))
  }

  const suggestions = phases.filter((p) => p.name && p.end).map((p) => ({ label: p.name + ' complete', date: p.end, color: p.color, phaseId: p.id }))
  const addedLabels = ms.map((m) => m.label)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {suggestions.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Suggested from your phases</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {suggestions.map((s) => {
              const added = addedLabels.includes(s.label)
              return (
                <div
                  key={s.phaseId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 14px',
                    background: '#f8fafc',
                    borderRadius: 9,
                    border: '1.5px solid ' + (added ? s.color + '40' : '#e2e8f0'),
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>{s.label}</span>
                    {s.date && <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.date}</span>}
                  </div>
                  {added ? (
                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Added</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onChange('milestones', [...ms, { id: uid(), label: s.label, date: s.date, type: 'phase' }])}
                      style={{ padding: '4px 10px', background: s.color + '15', border: '1px solid ' + s.color + '30', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: s.color }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {ms.filter((m) => m.type === 'custom').map((m) => (
        <div
          key={m.id}
          style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 10, border: '1.5px solid #e2e8f0' }}
        >
          <span style={{ fontSize: 16 }}>🏁</span>
          <input
            value={m.label}
            onChange={(e) => updateMs(m.id, 'label', e.target.value)}
            placeholder="Milestone name"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, outline: 'none' }}
          />
          <input
            type="date"
            value={m.date}
            onChange={(e) => updateMs(m.id, 'date', e.target.value)}
            style={{ border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '5px 8px', fontSize: 12 }}
          />
          <button type="button" onClick={() => removeMs(m.id)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: '#cbd5e1' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
      <AddBtn label="Add Custom Milestone" onClick={addMs} />
    </div>
  )
}
