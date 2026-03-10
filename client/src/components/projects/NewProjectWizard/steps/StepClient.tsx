import { useState, useEffect, useRef } from 'react'
import { api } from '@/api/client'
import type { ProjectBuildPlan } from '@/types/global'
import { Input } from '../primitives'
import { WIZARD_RED } from '../constants'
import type { WizardProjectState, WizardPlanType } from '../types'

type OnChange = (key: keyof WizardProjectState, value: unknown) => void

export interface StepClientProps {
  data: WizardProjectState
  onChange: OnChange
  /** When editing an existing project, pass its id so build plans can be listed/uploaded. */
  projectId?: string
  /** When creating a project, files added here are uploaded after the project is created. */
  pendingBuildPlanFiles?: File[]
  onPendingBuildPlansChange?: (files: File[]) => void
}

export function StepClient({ data, onChange, projectId, pendingBuildPlanFiles = [], onPendingBuildPlansChange }: StepClientProps) {
  const [buildPlans, setBuildPlans] = useState<ProjectBuildPlan[]>([])
  const [buildPlansLoading, setBuildPlansLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!projectId) return
    setBuildPlansLoading(true)
    api.projects
      .getBuildPlans(projectId)
      .then(setBuildPlans)
      .catch(() => setBuildPlans([]))
      .finally(() => setBuildPlansLoading(false))
  }, [projectId])

  const isValidProjectId = typeof projectId === 'string' && projectId.trim() !== '' && projectId.trim() !== 'undefined'

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (projectId) {
      if (!isValidProjectId) {
        setUploadError('Project is not loaded. Close this dialog and open the project again from the project page.')
        return
      }
      setUploadError(null)
      setUploading(true)
      api.projects
        .uploadBuildPlan(projectId.trim(), file)
        .then((plan) => setBuildPlans((prev) => [plan, ...prev]))
        .catch((err) => {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          const isNotFound = /not found|404/i.test(msg) || msg.includes('Project not found')
          setUploadError(isNotFound ? 'Upload failed — the project could not be found. Try closing this dialog, refreshing the page, and opening Edit again.' : msg)
        })
        .finally(() => setUploading(false))
    } else {
      onPendingBuildPlansChange?.([...pendingBuildPlanFiles, file])
    }
  }

  const handleRemove = (planId: string) => {
    if (!projectId) return
    api.projects.deleteBuildPlan(projectId, planId).then(() => {
      setBuildPlans((prev) => prev.filter((p) => p.id !== planId))
    })
  }

  const openPlan = async (plan: ProjectBuildPlan) => {
    if (projectId) {
      try {
        const { url } = await api.projects.getBuildPlanViewUrl(projectId, plan.id)
        window.open(url, '_blank')
      } catch {
        window.open(plan.url, '_blank')
      }
    } else {
      window.open(plan.url, '_blank')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Input
        label="Project name"
        value={data.name ?? ''}
        onChange={(v) => onChange('name', v)}
        placeholder="e.g. Kitchen Remodel – 123 Main St"
      />
      <div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--muted, #64748b)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            marginBottom: '5px',
          }}
        >
          Plan type
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginBottom: 6 }}>
          Used for takeoff: which reference rulebooks are applied (residential vs commercial vs civil).
        </p>
        <select
          value={data.planType ?? 'residential'}
          onChange={(e) => onChange('planType', e.target.value as WizardPlanType)}
          style={{
            width: '100%',
            padding: '9px 12px',
            border: '1.5px solid var(--border, #e2e8f0)',
            borderRadius: 9,
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
            color: 'var(--text, #0f172a)',
            background: 'var(--bg-input, #fff)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WIZARD_RED
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)'
          }}
        >
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
          <option value="civil">Civil</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Input
          label="Client Name"
          value={data.clientName ?? ''}
          onChange={(v) => onChange('clientName', v)}
          placeholder="e.g. John Smith"
          half
        />
        <Input
          label="Company (optional)"
          value={data.clientCompany ?? ''}
          onChange={(v) => onChange('clientCompany', v)}
          placeholder="e.g. Smith Properties"
          half
        />
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Input
          label="Client Email"
          value={data.clientEmail ?? ''}
          onChange={(v) => onChange('clientEmail', v)}
          placeholder="john@email.com"
          half
        />
        <Input
          label="Client Phone"
          value={data.clientPhone ?? ''}
          onChange={(v) => onChange('clientPhone', v)}
          placeholder="(801) 555-0100"
          half
        />
      </div>
      <Input
        label="Project Address"
        value={data.address ?? ''}
        onChange={(v) => onChange('address', v)}
        placeholder="123 Main St, Salt Lake City, UT"
      />
      <div style={{ display: 'flex', gap: '12px' }}>
        <Input
          label="Start Date"
          type="date"
          value={data.startDate ?? ''}
          onChange={(v) => onChange('startDate', v)}
          half
        />
        <Input
          label="End Date"
          type="date"
          value={data.endDate ?? ''}
          onChange={(v) => onChange('endDate', v)}
          half
        />
      </div>
      <div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--muted, #64748b)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            marginBottom: '5px',
          }}
        >
          Project Description (optional)
        </div>
        <textarea
          value={data.description ?? ''}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Brief scope of work…"
          rows={3}
          style={{
            width: '100%',
            padding: '9px 12px',
            border: '1.5px solid var(--border, #e2e8f0)',
            borderRadius: '9px',
            fontSize: '13px',
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            color: 'var(--text, #0f172a)',
            background: 'var(--bg-input, #fff)',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = WIZARD_RED
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border, #e2e8f0)'
          }}
        />
      </div>

      {/* Build plans */}
      <div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--muted, #64748b)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            marginBottom: '6px',
          }}
        >
          Build plans (optional)
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginBottom: 8 }}>
              Upload PDFs or images for quick reference. They’ll appear on the project overview.
        </p>
        <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              style={{ display: 'none' }}
              onChange={handleUpload}
        />
        <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 600,
                border: '1.5px dashed var(--border, #e2e8f0)',
                borderRadius: 8,
                background: 'var(--bg-input, #fff)',
                color: 'var(--muted, #64748b)',
                cursor: uploading ? 'wait' : 'pointer',
              }}
        >
          {uploading ? 'Uploading…' : '+ Upload build plan'}
        </button>
        {uploadError && (
          <p style={{ fontSize: 12, color: WIZARD_RED, marginTop: 8 }}>{uploadError}</p>
        )}
        {projectId ? (
          buildPlansLoading ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Loading…</p>
            ) : buildPlans.length > 0 ? (
              <ul style={{ marginTop: 10, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {buildPlans.map((plan) => (
                  <li
                    key={plan.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'var(--bg-base, #f8fafc)',
                      borderRadius: 8,
                      border: '1px solid var(--border, #e2e8f0)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openPlan(plan)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--text, #0f172a)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {plan.file_name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(plan.id)}
                      aria-label="Remove"
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        color: 'var(--muted)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null
        ) : pendingBuildPlanFiles.length > 0 ? (
          <ul style={{ marginTop: 10, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingBuildPlanFiles.map((file, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: 'var(--bg-base, #f8fafc)',
                  borderRadius: 8,
                  border: '1px solid var(--border, #e2e8f0)',
                }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text, #0f172a)' }}>
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => onPendingBuildPlansChange?.(pendingBuildPlanFiles.filter((_, j) => j !== i))}
                  aria-label="Remove"
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    color: 'var(--muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
