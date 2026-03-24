import { useState } from 'react'
import { api } from '@/api/client'
import { teamsApi } from '@/api/teamsClient'
import type { Project, ProjectWorkType } from '@/types/global'
import { STEPS, WIZARD_RED, getFirstIncompleteStepIndex, hasFilledWorkTypes } from './constants'
import { StepClient, StepPhases, StepBudget, StepTeam, StepWorkTypes, StepMilestones, ReviewStep } from './steps'
import type { WizardProjectState, WizardTeamMember } from './types'

function isRoster(m: WizardTeamMember): m is { type: 'roster'; id: string; employee_id: string; role_on_job?: string; color: string } {
  return m.type === 'roster'
}
function isExternal(m: WizardTeamMember): m is { type: 'external'; id: string; name: string; role: string; email: string; color: string } {
  return m.type === 'external'
}

/** Map wizard budget category name (e.g. "Labor", "Materials") to budget_line_item category key so Budget tab shows correct category. */
function wizardCategoryNameToKey(name: string): string {
  const n = (name || '').trim().toLowerCase()
  if (n === 'labor') return 'labor'
  if (n === 'materials') return 'materials'
  if (n === 'subcontractors') return 'subs'
  if (n === 'equipment') return 'equipment'
  if (n === 'permits' || n === 'permits & fees') return 'permits'
  if (n === 'overhead') return 'overhead'
  if (n === 'other') return 'other'
  return 'other'
}

export interface SetupWizardProps {
  project: WizardProjectState
  onClose: () => void
  onComplete: (createdOrUpdatedProject: Project, extras?: { workTypes?: ProjectWorkType[] }) => void
  /** When set, wizard updates this project instead of creating a new one. */
  existingProjectId?: string
}

function isStepComplete(data: WizardProjectState, stepIndex: number): boolean {
  if (stepIndex === 0) return !!(data.clientName || data.client)
  if (stepIndex === 1) return !!data.phases?.length
  if (stepIndex === 2) return (data.budget && data.budget > 0) || (data.budgetCategories?.length ?? 0) > 0
  if (stepIndex === 3) return !!data.team?.length
  if (stepIndex === 4) return hasFilledWorkTypes(data.workTypes)
  if (stepIndex === 5) return !!data.milestones?.length
  return false
}

export function SetupWizard({ project, onClose, onComplete, existingProjectId }: SetupWizardProps) {
  const isEdit = !!existingProjectId
  const initialStep = isEdit ? getFirstIncompleteStepIndex(project) : 0
  const [step, setStep] = useState(initialStep)
  const [data, setData] = useState<WizardProjectState>({ ...project })
  const [pendingBuildPlanFiles, setPendingBuildPlanFiles] = useState<File[]>([])
  const [launched, setLaunched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const openedToIncompleteStep = isEdit && initialStep < STEPS.length
  const currentStepNowComplete = openedToIncompleteStep && step === initialStep && isStepComplete(data, step)
  const currentStepStillIncomplete = openedToIncompleteStep && step === initialStep && !isStepComplete(data, step)

  function setField(key: keyof WizardProjectState, val: unknown) {
    setData((prev) => ({ ...prev, [key]: val }))
  }

  const isReview = step === STEPS.length
  const currentStep = STEPS[step]

  async function handleLaunch() {
    const name = (data.name || '').trim() || 'New Project'
    setSaveError(null)
    setSaving(true)
    try {
      const projectId = existingProjectId
      if (projectId) {
        if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
          setSaveError('Project ID is missing. Close and reopen the project, then try again.')
          return
        }
        await api.projects.update(projectId, {
          name,
          status: (data.status || 'active').toLowerCase(),
          scope: data.description?.trim() || undefined,
          address_line_1: data.address?.trim() || undefined,
          expected_start_date: data.startDate || undefined,
          expected_end_date: data.endDate || undefined,
          estimated_value: data.budget > 0 ? data.budget : undefined,
          assigned_to_name: (data.clientName || data.client || '').trim() || undefined,
          client_email: (data.clientEmail ?? '').trim() || undefined,
          client_phone: (data.clientPhone ?? '').trim() || undefined,
          plan_type: data.planType ?? 'residential',
        })
        const existingTasks = await api.projects.getTasks(projectId)
        for (const t of existingTasks) {
          await api.projects.deleteTask(projectId, t.id)
        }
        const existingPhases = await api.projects.getPhases(projectId)
        for (const ph of existingPhases) {
          await api.projects.deletePhase(projectId, ph.id)
        }
        const phaseIdMapEdit = new Map<string, string>()
        for (let i = 0; i < (data.phases || []).length; i++) {
          const p = data.phases![i]
          const created = await api.projects.createPhase(projectId, {
            name: p.name || 'Phase ' + (i + 1),
            start_date: p.start || undefined,
            end_date: p.end || undefined,
            order: i,
          })
          phaseIdMapEdit.set(p.id, created.id)
        }
        for (const t of data.tasks || []) {
          const apiPhaseId = phaseIdMapEdit.get(t.phaseId)
          if (!apiPhaseId || !t.title?.trim()) continue
          await api.projects.createTask(projectId, {
            phase_id: apiPhaseId,
            title: t.title.trim(),
            start_date: t.start_date || undefined,
            end_date: t.end_date || undefined,
            responsible: t.responsible?.trim() || undefined,
            completed: false,
          })
        }
        const existingBudget = await api.projects.getBudget(projectId)
        const existingById = new Map((existingBudget.items || []).map((i) => [i.id, i]))
        const budgetItems = (data.budgetCategories || []).map((c) => {
          const existing = existingById.get(c.id)
          return {
            id: c.id,
            project_id: projectId,
            label: c.name || 'Unnamed',
            predicted: parseFloat(c.amount) || 0,
            actual: existing?.actual ?? 0,
            category: wizardCategoryNameToKey(c.name),
          }
        })
        await api.projects.updateBudget(projectId, budgetItems.length > 0 ? budgetItems : [])
        const existingMilestones = await api.projects.getMilestones(projectId)
        for (const mil of existingMilestones) {
          await api.projects.deleteMilestone(projectId, mil.id)
        }
        for (const m of data.milestones || []) {
          if (!m.label && !m.date) continue
          await api.projects.createMilestone(projectId, {
            title: m.label || 'Milestone',
            due_date: m.date || undefined,
            completed: false,
          })
        }
        const rosterTeam = (data.team || []).filter(isRoster)
        const externalTeam = (data.team || []).filter(isExternal)
        const existingAssignments = await teamsApi.jobAssignments.list({ job_id: projectId, active_only: true }).catch(() => [])
        const wantedRosterIds = new Set(rosterTeam.map((m) => m.employee_id))
        for (const a of existingAssignments) {
          if (!wantedRosterIds.has(a.employee_id)) await teamsApi.jobAssignments.delete(a.id).catch(() => {})
        }
        const existingAssignedIds = new Set(existingAssignments.map((a) => a.employee_id))
        for (const m of rosterTeam) {
          if (!existingAssignedIds.has(m.employee_id)) {
            await teamsApi.jobAssignments.create({ employee_id: m.employee_id, job_id: projectId, role_on_job: m.role_on_job?.trim() || undefined }).catch(() => {})
          }
        }
        const existingSubs = await api.projects.getSubcontractors(projectId)
        for (const s of existingSubs) {
          await api.projects.deleteSubcontractor(projectId, s.id)
        }
        for (const m of externalTeam) {
          if (!m.name?.trim()) continue
          await api.projects.createSubcontractor(projectId, {
            name: m.name.trim(),
            trade: (m.role || 'Crew').trim(),
            email: (m.email || '').trim() || '',
            phone: '',
          })
          await api.contractors.create({ name: m.name.trim(), trade: (m.role || 'Crew').trim(), email: (m.email || '').trim() || '', phone: '' }).catch(() => {})
        }
        const existingWTs = await api.projects.getWorkTypes(projectId)
        for (const w of existingWTs) await api.projects.deleteWorkType(projectId, w.id)
        const workTypesForProject: ProjectWorkType[] = []
        for (const w of (data.workTypes ?? []).filter((x) => x.name?.trim())) {
          const created = await api.projects.createWorkType(projectId, {
            name: w.name!.trim(),
            description: w.description?.trim() || undefined,
            rate: Number(w.rate) || 0,
            unit: w.unit || 'hr',
            type_key: w.type_key,
            custom_color: w.type_key === 'custom' ? w.custom_color : undefined,
          })
          workTypesForProject.push(created)
        }
        const updated = await api.projects.get(projectId)
        onComplete(updated, { workTypes: workTypesForProject })
      } else {
        const created = await api.projects.create({
          name,
          status: (data.status || 'active').toLowerCase(),
          scope: data.description?.trim() || undefined,
          address_line_1: data.address?.trim() || undefined,
          expected_start_date: data.startDate || undefined,
          expected_end_date: data.endDate || undefined,
          estimated_value: data.budget > 0 ? data.budget : undefined,
          assigned_to_name: (data.clientName || data.client || '').trim() || undefined,
          client_email: (data.clientEmail ?? '').trim() || undefined,
          client_phone: (data.clientPhone ?? '').trim() || undefined,
          plan_type: data.planType ?? 'residential',
        })
        const newId = created?.id
        if (!newId) {
          setSaveError('Project was created but the server did not return an ID. Please refresh and try again.')
          return
        }
        const phaseIdMap = new Map<string, string>()
        for (let i = 0; i < (data.phases || []).length; i++) {
          const p = data.phases![i]
          const createdPhase = await api.projects.createPhase(newId, {
            name: p.name || 'Phase ' + (i + 1),
            start_date: p.start || undefined,
            end_date: p.end || undefined,
            order: i,
          })
          phaseIdMap.set(p.id, createdPhase.id)
        }
        for (const t of data.tasks || []) {
          const apiPhaseId = phaseIdMap.get(t.phaseId)
          if (!apiPhaseId || !t.title?.trim()) continue
          await api.projects.createTask(newId, {
            phase_id: apiPhaseId,
            title: t.title.trim(),
            start_date: t.start_date || undefined,
            end_date: t.end_date || undefined,
            responsible: t.responsible?.trim() || undefined,
            completed: false,
          })
        }
        const rosterTeamNew = (data.team || []).filter(isRoster)
        const externalTeamNew = (data.team || []).filter(isExternal)
        for (const m of rosterTeamNew) {
          await teamsApi.jobAssignments.create({ employee_id: m.employee_id, job_id: newId, role_on_job: m.role_on_job?.trim() || undefined }).catch(() => {})
        }
        for (const m of externalTeamNew) {
          if (!m.name?.trim()) continue
          await api.projects.createSubcontractor(newId, {
            name: m.name.trim(),
            trade: (m.role || 'Crew').trim(),
            email: (m.email || '').trim() || '',
            phone: '',
          })
          await api.contractors.create({ name: m.name.trim(), trade: (m.role || 'Crew').trim(), email: (m.email || '').trim() || '', phone: '' }).catch(() => {})
        }
        const budgetItems = (data.budgetCategories || []).map((c) => ({
          id: 'wizard-' + c.id,
          project_id: newId,
          label: c.name || 'Unnamed',
          predicted: parseFloat(c.amount) || 0,
          actual: 0,
          category: wizardCategoryNameToKey(c.name),
        }))
        if (budgetItems.length > 0) {
          await api.projects.updateBudget(newId, budgetItems)
        }
        for (const m of data.milestones || []) {
          if (!m.label && !m.date) continue
          await api.projects.createMilestone(newId, {
            title: m.label || 'Milestone',
            due_date: m.date || undefined,
            completed: false,
          })
        }
        for (const file of pendingBuildPlanFiles) {
          await api.projects.uploadBuildPlan(newId, file).catch(() => {})
        }
        setPendingBuildPlanFiles([])
        const seeded = await api.projects.getWorkTypes(newId)
        const workTypesForProject: ProjectWorkType[] = [...seeded]
        const hasGeneralLabor = (list: ProjectWorkType[]) =>
          list.some((x) => (x.type_key || '') === 'labor' && (x.name || '').trim().toLowerCase() === 'general labor')
        for (const w of (data.workTypes ?? []).filter((x) => x.name?.trim())) {
          const isGeneralLabor =
            w.type_key === 'labor' && w.name!.trim().toLowerCase() === 'general labor'
          if (isGeneralLabor && hasGeneralLabor(workTypesForProject)) continue
          const created = await api.projects.createWorkType(newId, {
            name: w.name!.trim(),
            description: w.description?.trim() || undefined,
            rate: Number(w.rate) || 0,
            unit: w.unit || 'hr',
            type_key: w.type_key,
            custom_color: w.type_key === 'custom' ? w.custom_color : undefined,
          })
          workTypesForProject.push(created)
        }
        setLaunched(true)
        setTimeout(() => onComplete(created, { workTypes: workTypesForProject }), 800)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  if (launched) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🚀</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>Project is live!</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>Redirecting…</div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface, #fff)',
          borderRadius: 18,
          width: '100%',
          maxWidth: 660,
          boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 26px 16px', borderBottom: '1px solid var(--border, #f1f5f9)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: WIZARD_RED }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Project Setup</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                {isReview ? 'Review & Launch' : "Let's set up your project"}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>
                {data.name || 'New project'} · {data.address || 'No address'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: 9, width: 32, height: 32, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {saveError && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 9, fontSize: 13 }}>{saveError}</div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {STEPS.map((s, i) => {
              const done = i < step || (isEdit && isStepComplete(data, i))
              const active = i === step && !isReview
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(i)}
                  style={{
                    flex: 1,
                    padding: '7px 6px',
                    borderRadius: 9,
                    border: '1.5px solid ' + (active ? WIZARD_RED : done ? '#16a34a30' : '#f1f5f9'),
                    background: active ? WIZARD_RED + '0d' : done ? '#f0fdf4' : '#f8fafc',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{done ? '✓' : s.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? WIZARD_RED : done ? '#16a34a' : '#94a3b8', textTransform: 'uppercase' }}>{s.label}</span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setStep(STEPS.length)}
              style={{
                flex: 1,
                padding: '7px 6px',
                borderRadius: 9,
                border: '1.5px solid ' + (isReview ? WIZARD_RED : '#f1f5f9'),
                background: isReview ? WIZARD_RED + '0d' : '#f8fafc',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span style={{ fontSize: 13 }}>📝</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: isReview ? WIZARD_RED : '#94a3b8', textTransform: 'uppercase' }}>Review</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
          {!isReview && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #0f172a)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{currentStep.icon}</span>
                {currentStep.label}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>{currentStep.desc}</div>
              {currentStepStillIncomplete && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: WIZARD_RED + '12',
                    border: '1px solid ' + WIZARD_RED + '30',
                    fontSize: 12,
                    fontWeight: 600,
                    color: WIZARD_RED,
                  }}
                >
                  Complete this step to advance setup.
                </div>
              )}
              {currentStepNowComplete && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>✓</span>
                  <span>Step complete — you can continue to the next step or go to Review.</span>
                </div>
              )}
            </div>
          )}
          {step === 0 && (
            <StepClient
              data={data}
              onChange={setField}
              projectId={existingProjectId}
              pendingBuildPlanFiles={pendingBuildPlanFiles}
              onPendingBuildPlansChange={setPendingBuildPlanFiles}
            />
          )}
          {step === 1 && <StepPhases data={data} onChange={setField} />}
          {step === 2 && <StepBudget data={data} onChange={setField} />}
          {step === 3 && <StepTeam data={data} onChange={setField} />}
          {step === 4 && <StepWorkTypes data={data} onChange={setField} />}
          {step === 5 && <StepMilestones data={data} onChange={setField} />}
          {isReview && <ReviewStep project={data} />}
        </div>

        <div style={{ padding: '14px 26px', borderTop: '1px solid var(--border, #f1f5f9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fafafa' }}>
          <div>
            {!isReview && (
              <button type="button" onClick={() => setStep(STEPS.length)} style={{ padding: '7px 14px', background: 'transparent', border: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}>
                Skip to Review →
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                style={{ padding: '9px 18px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#475569' }}
              >
                ← Back
              </button>
            )}
            {!isReview ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                style={{ padding: '9px 22px', background: WIZARD_RED, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}
              >
                {step === STEPS.length - 1 ? 'Review →' : 'Next →'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLaunch}
                disabled={saving}
                style={{ padding: '9px 24px', background: '#16a34a', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', color: '#fff' }}
              >
                {saving ? (isEdit ? 'Updating…' : 'Creating…') : isEdit ? 'Update Project' : '🚀 Launch Project'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
