import { AddBtn } from '../primitives'
import { uid, PHASE_COLORS, PHASE_TEMPLATES } from '../constants'
import type { WizardProjectState, WizardPhase, WizardTask } from '../types'

type OnChange = (key: keyof WizardProjectState, value: unknown) => void

export function StepPhases({ data, onChange }: { data: WizardProjectState; onChange: OnChange }) {
  const phases = data.phases ?? []
  const tasks = data.tasks ?? []

  function addPhase() {
    const color = PHASE_COLORS[phases.length % PHASE_COLORS.length]
    onChange('phases', [...phases, { id: uid(), name: '', start: '', end: '', color }])
  }
  function updatePhase(id: string, field: keyof WizardPhase, val: string) {
    onChange('phases', phases.map((p) => (p.id === id ? { ...p, [field]: val } : p)))
  }
  function removePhase(id: string) {
    onChange('phases', phases.filter((p) => p.id !== id))
    onChange('tasks', tasks.filter((t) => t.phaseId !== id))
  }
  function addTemplate(t: { name: string; color: string }) {
    if (phases.some((p) => p.name === t.name)) return
    onChange('phases', [...phases, { id: uid(), name: t.name, start: '', end: '', color: t.color }])
  }
  function removeTemplateByName(name: string) {
    onChange('phases', phases.filter((p) => p.name !== name))
  }
  function toggleTemplate(t: { name: string; color: string }) {
    if (phases.some((p) => p.name === t.name)) removeTemplateByName(t.name)
    else addTemplate(t)
  }

  function addTask(phaseId: string) {
    const phase = phases.find((p) => p.id === phaseId)
    onChange('tasks', [...tasks, { id: uid(), phaseId, title: '', start_date: phase?.start ?? '', end_date: phase?.end ?? '' }])
  }
  function updateTask(taskId: string, field: keyof WizardTask, val: string) {
    onChange('tasks', tasks.map((t) => (t.id === taskId ? { ...t, [field]: val } : t)))
  }
  function removeTask(taskId: string) {
    onChange('tasks', tasks.filter((t) => t.id !== taskId))
  }
  function getTasksForPhase(phaseId: string) {
    return tasks.filter((t) => t.phaseId === phaseId)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
          Quick-add common phases
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PHASE_TEMPLATES.map((t) => {
            const added = phases.some((p) => p.name === t.name)
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => toggleTemplate(t)}
                style={{
                  padding: '5px 11px',
                  borderRadius: 20,
                  border: '1.5px solid ' + (added ? t.color + '40' : '#e2e8f0'),
                  background: added ? t.color + '12' : '#f8fafc',
                  color: added ? t.color : '#64748b',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title={added ? 'Click to remove this phase' : 'Click to add'}
              >
                {added && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {t.name}
              </button>
            )
          })}
        </div>
      </div>
      {phases.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Phases & tasks
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '12px 1fr 130px 130px 32px', gap: 8, padding: '0 4px' }}>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}></span>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Phase Name</span>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Start</span>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>End</span>
            <span></span>
          </div>
          {phases.map((p, i) => {
            const phaseTasks = getTasksForPhase(p.id)
            return (
              <div
                key={p.id}
                style={{
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '12px 1fr 130px 130px 32px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                  <input
                    value={p.name}
                    onChange={(e) => updatePhase(p.id, 'name', e.target.value)}
                    placeholder={'Phase ' + (i + 1)}
                    style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, outline: 'none', width: '100%' }}
                  />
                  <input
                    type="date"
                    value={p.start}
                    onChange={(e) => updatePhase(p.id, 'start', e.target.value)}
                    style={{ border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '5px 8px', fontSize: 12 }}
                  />
                  <input
                    type="date"
                    value={p.end}
                    onChange={(e) => updatePhase(p.id, 'end', e.target.value)}
                    style={{ border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '5px 8px', fontSize: 12 }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhase(p.id)}
                    style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: '#cbd5e1' }}
                    title="Remove phase"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div style={{ padding: '0 12px 12px 28px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Tasks</span>
                    {phaseTasks.length > 0 && (
                      <span style={{ fontSize: 11, color: '#64748b' }}>{phaseTasks.length} task{phaseTasks.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {phaseTasks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      {phaseTasks.map((t) => (
                        <div
                          key={t.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 100px 100px 100px 28px',
                            gap: 6,
                            alignItems: 'center',
                            padding: '6px 10px',
                            background: '#fafafa',
                            borderRadius: 8,
                            border: '1px solid #f1f5f9',
                          }}
                        >
                          <input
                            value={t.title}
                            onChange={(e) => updateTask(t.id, 'title', e.target.value)}
                            placeholder="Task name"
                            style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none' }}
                          />
                          <input
                            type="date"
                            value={t.start_date}
                            onChange={(e) => updateTask(t.id, 'start_date', e.target.value)}
                            style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}
                          />
                          <input
                            type="date"
                            value={t.end_date}
                            onChange={(e) => updateTask(t.id, 'end_date', e.target.value)}
                            style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}
                          />
                          <input
                            value={t.responsible ?? ''}
                            onChange={(e) => updateTask(t.id, 'responsible', e.target.value)}
                            placeholder="Who"
                            style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', fontSize: 11, outline: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeTask(t.id)}
                            style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#cbd5e1', padding: 0 }}
                            title="Remove task"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => addTask(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1.5px dashed #cbd5e1',
                      background: '#f8fafc',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#64748b',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      width: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add task to this phase
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <AddBtn label="Add Custom Phase" onClick={addPhase} />
    </div>
  )
}
