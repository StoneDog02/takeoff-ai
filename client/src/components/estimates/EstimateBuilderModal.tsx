import { useState, useEffect } from 'react'
import { api } from '@/api/client'
import { estimatesApi } from '@/api/estimates'
import type { CustomProduct, Job, PipelineMilestone, Project } from '@/types/global'
import type { EstimateLineItem } from '@/types/global'
import { USE_MOCK_ESTIMATES, MOCK_CUSTOM_PRODUCTS } from '@/data/mockEstimatesData'

const PLAN_TYPES = ['residential', 'commercial', 'civil'] as const
type PlanType = (typeof PLAN_TYPES)[number]

/** Pre-fill for Step 1 when opening from a project's "Build Estimate" button. */
export type PrefillClientInfo = {
  projectName: string
  planType: PlanType
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  projectAddress?: string
}

/** Line item for pre-fill: takeoff materials (price can be 0) or awarded sub bids (price = amount). */
export type LineItem = {
  id?: string | number
  name: string
  qty: number
  unit: string
  price: number
}

const STEPS_CREATE = [
  { num: 1, label: 'Client Info', icon: '🏗' },
  { num: 2, label: 'Review & Create', icon: '✅' },
]

const STEPS_BUILD = [
  { num: 1, label: 'Client Info', icon: '🏗' },
  { num: 2, label: 'Line Items', icon: '📋' },
]

type WizardData = {
  projectName: string
  planType: PlanType
  clientName: string
  clientEmail: string
  clientPhone: string
  projectAddress: string
}

export type NewEstimatePayload = {
  id: string
  job_id: string
  jobName: string
  amount: number
  date: string
  title: string
  milestones: PipelineMilestone[]
}

interface EstimateBuilderModalProps {
  jobs: Job[]
  onClose: () => void
  onSave?: (estimateId: string, payload?: NewEstimatePayload) => void
  /** When provided, called after project is created (e.g. close modal and navigate to project). */
  onComplete?: (createdProject: Project) => void
  /** When provided, modal is in "build estimate" mode for this project (pre-filled client + line items). */
  projectId?: string
  /** When provided with projectId, modal is in "revise" mode: load this estimate and update on save. */
  estimateId?: string
  /** Pre-fill Step 1 Client Info (from project record). */
  prefillClientInfo?: PrefillClientInfo | null
  /** Pre-fill Step 2 Line Items (takeoff materials + awarded bids). */
  prefillLineItems?: LineItem[] | null
}

type WizardLine = { id: number; name: string; qty: number; unit: string; price: number }

function defaultWizardData(prefill?: PrefillClientInfo | null): WizardData {
  if (prefill) {
    return {
      projectName: prefill.projectName ?? '',
      planType: prefill.planType ?? 'residential',
      clientName: prefill.clientName ?? '',
      clientEmail: prefill.clientEmail ?? '',
      clientPhone: prefill.clientPhone ?? '',
      projectAddress: prefill.projectAddress ?? '',
    }
  }
  return {
    projectName: '',
    planType: 'residential',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    projectAddress: '',
  }
}

function linesFromPrefill(prefill?: LineItem[] | null): WizardLine[] {
  if (!prefill?.length) return []
  return prefill.map((item, i) => ({
    id: typeof item.id === 'number' ? item.id : Date.now() + i,
    name: item.name,
    qty: item.qty ?? 1,
    unit: item.unit ?? 'ea',
    price: item.price ?? 0,
  }))
}

function linesFromEstimate(lineItems: EstimateLineItem[]): WizardLine[] {
  if (!lineItems?.length) return []
  return lineItems.map((li, i) => ({
    id: Date.now() + i,
    name: li.description ?? '',
    qty: li.quantity ?? 1,
    unit: li.unit ?? 'ea',
    price: li.unit_price ?? 0,
  }))
}

function presetCategoryLabel(itemType?: string): string {
  const t = (itemType || 'service').toLowerCase()
  if (t === 'labor') return 'Labor'
  if (t === 'product') return 'Product'
  if (t === 'sub') return 'Sub'
  if (t === 'equipment') return 'Equipment'
  if (t === 'material') return 'Material'
  return 'Service'
}

function presetCategoryClass(itemType?: string): string {
  const t = (itemType || 'service').toLowerCase()
  if (t === 'labor') return 'labor'
  if (t === 'product') return 'product'
  if (t === 'sub') return 'sub'
  if (t === 'equipment') return 'equipment'
  if (t === 'material') return 'material'
  return 'service'
}

export function EstimateBuilderModal({
  jobs: _jobs,
  onClose,
  onSave,
  onComplete,
  projectId,
  estimateId,
  prefillClientInfo,
  prefillLineItems,
}: EstimateBuilderModalProps) {
  const isReviseMode = projectId != null && estimateId != null
  const isBuildMode = projectId != null && (prefillClientInfo != null || prefillLineItems != null || isReviseMode)
  const STEPS = isBuildMode ? STEPS_BUILD : STEPS_CREATE

  const [step, setStep] = useState(1)
  const [saved, setSaved] = useState(false)
  const [savedAndSent, setSavedAndSent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createdProjectName, setCreatedProjectName] = useState('')
  const [savedEstimateId, setSavedEstimateId] = useState<string | null>(null)
  const [data, setData] = useState<WizardData>(() => defaultWizardData(prefillClientInfo))
  const [lines, setLines] = useState<WizardLine[]>(() => (isReviseMode ? [] : linesFromPrefill(prefillLineItems)))
  /** Revise mode: line item ids from loaded estimate (for delete-before-re-add on save). */
  const [loadedLineItemIds, setLoadedLineItemIds] = useState<string[]>([])
  const [reviseLoadDone, setReviseLoadDone] = useState(!isReviseMode)
  /** Resets step-2 catalog search state when the wizard is reset. */
  const [presetCatalogResetKey, setPresetCatalogResetKey] = useState(0)

  useEffect(() => {
    if (!isReviseMode || !estimateId) return
    setReviseLoadDone(false)
    estimatesApi
      .getEstimate(estimateId)
      .then((est) => {
        setData((prev) => ({ ...prev, projectName: est.title ?? prev.projectName }))
        const wizardLines = linesFromEstimate(est.line_items ?? [])
        setLines(wizardLines)
        setLoadedLineItemIds((est.line_items ?? []).map((li) => li.id))
      })
      .catch(() => {})
      .finally(() => setReviseLoadDone(true))
  }, [estimateId, isReviseMode])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const canNext = () => step === 1 && !!data.projectName.trim()

  const handleCreateProject = async () => {
    setSaving(true)
    try {
      const createdProject = await api.projects.create({
        name: data.projectName.trim() || 'New Project',
        status: 'estimating',
        plan_type: data.planType,
        address_line_1: data.projectAddress?.trim() || undefined,
        assigned_to_name: data.clientName?.trim() || data.clientEmail?.trim() || undefined,
      })
      setCreatedProjectName(createdProject.name ?? data.projectName.trim())
      setSaved(true)
      onComplete?.(createdProject)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const totalFromLines = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0)

  const handleSaveEstimate = async () => {
    if (!projectId || lines.length === 0) return
    setSaving(true)
    try {
      if (estimateId) {
        await estimatesApi.updateEstimate(estimateId, {
          total_amount: totalFromLines,
          title: data.projectName?.trim() || undefined,
        })
        for (const lineId of loadedLineItemIds) {
          await estimatesApi.deleteLineItem(estimateId, lineId)
        }
        for (const line of lines) {
          await estimatesApi.addLineItem(estimateId, {
            description: line.name,
            quantity: line.qty,
            unit: line.unit,
            unit_price: line.price,
          })
        }
        setSavedEstimateId(estimateId)
        setSaved(true)
        onSave?.(estimateId)
      } else {
        const created = await estimatesApi.createEstimate({
          job_id: projectId,
          title: data.projectName?.trim() || 'Estimate',
        })
        const eid = created.id
        for (const line of lines) {
          await estimatesApi.addLineItem(eid, {
            description: line.name,
            quantity: line.qty,
            unit: line.unit,
            unit_price: line.price,
          })
        }
        await estimatesApi.updateEstimate(eid, { total_amount: totalFromLines })
        setSavedEstimateId(eid)
        setSaved(true)
        onSave?.(eid)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndSendEstimate = async () => {
    if (!projectId || lines.length === 0 || !data.clientEmail?.trim()) return
    setSaving(true)
    try {
      const eid = estimateId ?? (await estimatesApi.createEstimate({
        job_id: projectId,
        title: data.projectName?.trim() || 'Estimate',
      })).id
      if (estimateId) {
        await estimatesApi.updateEstimate(estimateId, {
          total_amount: totalFromLines,
          title: data.projectName?.trim() || undefined,
        })
        for (const lineId of loadedLineItemIds) {
          await estimatesApi.deleteLineItem(estimateId, lineId)
        }
        for (const line of lines) {
          await estimatesApi.addLineItem(estimateId, {
            description: line.name,
            quantity: line.qty,
            unit: line.unit,
            unit_price: line.price,
          })
        }
      } else {
        for (const line of lines) {
          await estimatesApi.addLineItem(eid, {
            description: line.name,
            quantity: line.qty,
            unit: line.unit,
            unit_price: line.price,
          })
        }
        await estimatesApi.updateEstimate(eid, { total_amount: totalFromLines })
      }
      await estimatesApi.sendEstimate(eid, {
        recipient_emails: [data.clientEmail.trim()],
        client_name: data.clientName?.trim() || undefined,
        project_name: data.projectName?.trim() || undefined,
      })
      setSavedEstimateId(eid)
      setSavedAndSent(true)
      setSaved(true)
      onSave?.(eid)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setData(defaultWizardData(prefillClientInfo))
    setLines(linesFromPrefill(prefillLineItems))
    setStep(1)
    setSaved(false)
    setSavedAndSent(false)
    setCreatedProjectName('')
    setSavedEstimateId(null)
    setPresetCatalogResetKey((k) => k + 1)
  }

  // ─── Success state ─────────────────────────────────────────────────────────
  if (saved) {
    const isEstimateSaved = isBuildMode && savedEstimateId != null
    return (
      <div
        className="estimate-builder-modal-overlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="estimate-builder-success-title"
      >
        <div
          className="estimate-builder-wizard estimate-builder-wizard--success"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="estimate-wizard-success-icon">✓</div>
          <h2 id="estimate-builder-success-title" className="estimate-wizard-success-title">
            {savedAndSent ? 'Estimate sent' : isEstimateSaved ? 'Estimate saved' : 'Project created'}
          </h2>
          <p className="estimate-wizard-success-job">
            {savedAndSent
              ? `We've sent the estimate to ${data.clientEmail || 'the client'} for review.`
              : isEstimateSaved
                ? data.projectName
                : (createdProjectName || data.projectName)}
          </p>
          <div className="estimate-wizard-success-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
            {!isEstimateSaved && (
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Start another
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Revise mode: loading estimate ───────────────────────────────────────
  if (isReviseMode && !reviseLoadDone) {
    return (
      <div
        className="estimate-builder-modal-overlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-busy="true"
      >
        <div className="estimate-builder-wizard" onClick={(e) => e.stopPropagation()}>
          <p className="estimate-wizard-loading">Loading estimate…</p>
        </div>
      </div>
    )
  }

  // ─── Wizard steps ──────────────────────────────────────────────────────────
  return (
    <div
      className="estimate-builder-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="estimate-builder-wizard-title"
    >
      <div
        className="estimate-builder-wizard"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="estimate-wizard-topbar">
          <div className="estimate-wizard-topbar-left">
            <button
              type="button"
              className="estimate-wizard-back"
              onClick={onClose}
              aria-label="Close"
            >
              ← Back
            </button>
            <span className="estimate-wizard-topbar-divider" aria-hidden />
            <h1 id="estimate-builder-wizard-title" className="estimate-wizard-topbar-title">
              {isReviseMode ? 'Revise Estimate' : 'New Estimate'}
            </h1>
          </div>
          <button
            type="button"
            className="estimate-wizard-reset"
            onClick={() => {
              reset()
              setStep(1)
            }}
          >
            Reset
          </button>
        </div>

        {/* Step bar */}
        <div className="estimate-wizard-stepbar">
          {STEPS.map((s, i) => {
            const done = s.num < step
            const active = s.num === step
            return (
              <div key={s.num} className="estimate-wizard-stepbar__segment">
                <div className="estimate-wizard-stepbar__step">
                  <div
                    className={`estimate-wizard-stepbar__circle ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                  >
                    {done ? '✓' : s.num}
                  </div>
                  <span
                    className={`estimate-wizard-stepbar__label ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`estimate-wizard-stepbar__connector ${done ? 'done' : ''}`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="estimate-wizard-content">
          <div className="estimate-wizard-card">
            {step === 1 && (
              <Step1ClientInfo
                data={data}
                setData={setData}
                isBuildMode={isBuildMode}
              />
            )}
            {step === 2 && isBuildMode && (
              <Step2LineItems
                lines={lines}
                setLines={setLines}
                hasPrefill={Boolean(prefillLineItems?.length)}
                resetKey={presetCatalogResetKey}
              />
            )}
            {step === 2 && !isBuildMode && <Step2ReviewCreate data={data} />}
          </div>

          {/* Nav */}
          <div className="estimate-wizard-nav">
            <button
              type="button"
              className="estimate-wizard-nav-back"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
            >
              ← Back
            </button>
            <div className="estimate-wizard-nav-dots">
              {STEPS.map((s) => (
                <div
                  key={s.num}
                  className={`estimate-wizard-nav-dot ${s.num === step ? 'active' : ''} ${s.num < step ? 'done' : ''}`}
                />
              ))}
            </div>
            {step === 1 ? (
              <button
                type="button"
                className="estimate-wizard-nav-next"
                onClick={() => canNext() && setStep(2)}
                disabled={!canNext()}
              >
                Continue →
              </button>
            ) : isBuildMode ? (
              <div className="estimate-wizard-nav-final">
                <button
                  type="button"
                  className="estimate-wizard-nav-next btn btn-ghost"
                  onClick={handleSaveEstimate}
                  disabled={saving || lines.length === 0}
                >
                  {saving ? 'Saving…' : 'Save Estimate'}
                </button>
                <button
                  type="button"
                  className="estimate-wizard-nav-next btn btn-primary"
                  onClick={handleSaveAndSendEstimate}
                  disabled={saving || lines.length === 0 || !data.clientEmail?.trim()}
                >
                  {saving ? 'Sending…' : 'Save & Send →'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="estimate-wizard-nav-next btn btn-primary"
                onClick={handleCreateProject}
                disabled={saving}
              >
                {saving ? 'Creating…' : 'Create Project →'}
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── Step 1: Client Info ───────────────────────────────────────────────────────
function Step1ClientInfo({
  data,
  setData,
  isBuildMode,
}: {
  data: WizardData
  setData: React.Dispatch<React.SetStateAction<WizardData>>
  isBuildMode?: boolean
}) {
  return (
    <div className="estimate-wizard-step estimate-wizard-step1">
      <div className="estimate-wizard-step-head">
        <h3 className="estimate-wizard-step-title">Start a new project</h3>
        <p className="estimate-wizard-step-sub">
          {isBuildMode
            ? 'Review or edit client and project details before building your estimate.'
            : "We'll set up the project so you can run takeoff and collect bids before building your estimate."}
        </p>
      </div>

      <div className="estimate-wizard-field estimate-wizard-field--full">
        <label className="estimate-wizard-label">Project Name</label>
        <input
          type="text"
          value={data.projectName}
          onChange={(e) => setData((d) => ({ ...d, projectName: e.target.value }))}
          placeholder="e.g. Kitchen Remodel – 123 Main St"
          className="estimate-wizard-input"
        />
      </div>

      <div className="estimate-wizard-field estimate-wizard-field--full">
        <label className="estimate-wizard-label">Plan Type</label>
        <select
          value={data.planType}
          onChange={(e) => setData((d) => ({ ...d, planType: e.target.value as PlanType }))}
          className="estimate-wizard-input"
        >
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
          <option value="civil">Civil</option>
        </select>
        <p className="estimate-wizard-helper">
          Used for takeoff — determines which rulebooks are applied.
        </p>
      </div>

      <div className="estimate-wizard-step1-grid">
        <div className="estimate-wizard-field">
          <label className="estimate-wizard-label">Client Name</label>
          <input
            type="text"
            value={data.clientName}
            onChange={(e) => setData((d) => ({ ...d, clientName: e.target.value }))}
            placeholder="Client name"
            className="estimate-wizard-input"
          />
        </div>
        <div className="estimate-wizard-field">
          <label className="estimate-wizard-label">Client Email</label>
          <input
            type="email"
            value={data.clientEmail}
            onChange={(e) => setData((d) => ({ ...d, clientEmail: e.target.value }))}
            placeholder="client@example.com"
            className="estimate-wizard-input"
          />
        </div>
        <div className="estimate-wizard-field">
          <label className="estimate-wizard-label">Client Phone</label>
          <input
            type="tel"
            value={data.clientPhone}
            onChange={(e) => setData((d) => ({ ...d, clientPhone: e.target.value }))}
            placeholder="(555) 123-4567"
            className="estimate-wizard-input"
          />
        </div>
        <div className="estimate-wizard-field">
          <label className="estimate-wizard-label">Project Address</label>
          <input
            type="text"
            value={data.projectAddress}
            onChange={(e) => setData((d) => ({ ...d, projectAddress: e.target.value }))}
            placeholder="Street, city, state"
            className="estimate-wizard-input"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Line Items (build-estimate mode) ──────────────────────────────────
function Step2LineItems({
  lines,
  setLines,
  hasPrefill,
  resetKey,
}: {
  lines: WizardLine[]
  setLines: React.Dispatch<React.SetStateAction<WizardLine[]>>
  hasPrefill: boolean
  resetKey: number
}) {
  const [prefillBannerDismissed, setPrefillBannerDismissed] = useState(false)
  const [products, setProducts] = useState<CustomProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [catalogQuery, setCatalogQuery] = useState('')

  useEffect(() => {
    setCatalogQuery('')
    setPrefillBannerDismissed(false)
  }, [resetKey])

  useEffect(() => {
    if (USE_MOCK_ESTIMATES) {
      setProducts(MOCK_CUSTOM_PRODUCTS)
      setLoadingProducts(false)
      return
    }
    setLoadingProducts(true)
    estimatesApi
      .getCustomProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false))
  }, [])

  const filteredProducts = catalogQuery.trim()
    ? products.filter((p) => {
        const q = catalogQuery.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q) ||
          (p.item_type ?? '').toLowerCase().includes(q)
        )
      })
    : products

  const updateLine = (idx: number, updates: Partial<WizardLine>) => {
    setLines((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...updates }
      return next
    })
  }

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: Date.now(), name: '', qty: 1, unit: 'ea', price: 0 },
    ])
  }

  const addPreset = (product: CustomProduct) => {
    setLines((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: product.name,
        qty: 1,
        unit: product.unit || 'ea',
        price: product.default_unit_price || 0,
      },
    ])
    setCatalogQuery('')
  }

  return (
    <div className="estimate-wizard-step estimate-wizard-step3">
      <div className="estimate-wizard-step-head">
        <h3 className="estimate-wizard-step-title">Line items</h3>
        <p className="estimate-wizard-step-sub">
          Review pricing, add markup, and add any additional lines before saving the estimate.
        </p>
      </div>

      <div className="estimate-wizard-lines-panel">
        {hasPrefill && !prefillBannerDismissed && (
          <div className="estimate-wizard-lines-prefill-banner">
            <span>
              Pre-loaded from your takeoff and awarded bids — review pricing and add markup before sending.
            </span>
            <button
              type="button"
              className="estimate-wizard-lines-prefill-banner-dismiss"
              onClick={() => setPrefillBannerDismissed(true)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <div className="estimate-wizard-presets-panel">
          <div className="estimate-wizard-presets-head">
            <div>
              <div className="estimate-wizard-presets-title">Quick select presets</div>
              <div className="estimate-wizard-presets-sub">
                Tap a service or product to add it as a line item, then adjust quantity or price.
              </div>
            </div>
            <div className="estimate-wizard-presets-head-actions">
              <div className="estimate-wizard-presets-search">
                <span className="estimate-wizard-presets-search-icon" aria-hidden>⌕</span>
                <input
                  type="text"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="Search services / products…"
                  className="estimate-wizard-input estimate-wizard-presets-search-input"
                />
              </div>
            </div>
          </div>

          {loadingProducts ? (
            <div className="estimate-wizard-presets-empty">Loading presets…</div>
          ) : filteredProducts.length === 0 ? (
            <div className="estimate-wizard-presets-empty">
              No presets found. Add more in Products & Services.
            </div>
          ) : (
            <div className="estimate-wizard-presets-grid">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="estimate-wizard-preset-card"
                  onClick={() => addPreset(product)}
                >
                  <div className="estimate-wizard-preset-card-top">
                    <span className={`estimate-wizard-preset-pill estimate-wizard-preset-pill--${presetCategoryClass(product.item_type)}`}>
                      {presetCategoryLabel(product.item_type)}
                    </span>
                    <span className="estimate-wizard-preset-price">
                      ${Number(product.default_unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      /{product.unit}
                    </span>
                  </div>
                  <div className="estimate-wizard-preset-name">{product.name}</div>
                  {product.description ? (
                    <div className="estimate-wizard-preset-desc">{product.description}</div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="estimate-wizard-lines-header">
          <span className="estimate-wizard-label">Item</span>
          <span className="estimate-wizard-label">Qty</span>
          <span className="estimate-wizard-label">Unit</span>
          <span className="estimate-wizard-label">Unit price</span>
          <span aria-hidden />
        </div>
        {lines.map((line, idx) => (
          <div key={line.id} className="estimate-wizard-line-row">
            <input
              type="text"
              value={line.name}
              onChange={(e) => updateLine(idx, { name: e.target.value })}
              placeholder="Description"
              className="estimate-wizard-input estimate-wizard-line-input-name"
            />
            <input
              type="number"
              min={0}
              step={1}
              value={line.qty}
              onChange={(e) => updateLine(idx, { qty: Number(e.target.value) || 0 })}
              className="estimate-wizard-input estimate-wizard-line-input-num"
            />
            <input
              type="text"
              value={line.unit}
              onChange={(e) => updateLine(idx, { unit: e.target.value })}
              placeholder="ea"
              className="estimate-wizard-input estimate-wizard-line-input-unit"
            />
            <input
              type="number"
              min={0}
              step={0.01}
              value={line.price}
              onChange={(e) => updateLine(idx, { price: Number(e.target.value) || 0 })}
              placeholder="0"
              className="estimate-wizard-input estimate-wizard-line-input-price"
            />
            <button
              type="button"
              className="estimate-wizard-line-remove"
              onClick={() => removeLine(idx)}
              aria-label="Remove line"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="estimate-wizard-add-line-btn"
          onClick={addLine}
        >
          + Add custom line item
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Review & Create ───────────────────────────────────────────────────
function Step2ReviewCreate({ data }: { data: WizardData }) {
  const planTypeLabel = data.planType === 'residential' ? 'Residential' : data.planType === 'commercial' ? 'Commercial' : 'Civil'
  return (
    <div className="estimate-wizard-step estimate-wizard-step3">
      <div className="estimate-wizard-step-head">
        <h3 className="estimate-wizard-step-title">Review & create</h3>
        <p className="estimate-wizard-step-sub">
          Confirm the details below, then create the project. You&apos;ll run takeoff and collect bids on the project page.
        </p>
      </div>
      <div className="estimate-wizard-summary">
        <div className="estimate-wizard-summary-grid">
          <div>
            <div className="estimate-wizard-label">Project name</div>
            <div className="estimate-wizard-summary-val">{data.projectName?.trim() || '—'}</div>
          </div>
          <div>
            <div className="estimate-wizard-label">Plan type</div>
            <div className="estimate-wizard-summary-val">{planTypeLabel}</div>
          </div>
          <div>
            <div className="estimate-wizard-label">Client name</div>
            <div className="estimate-wizard-summary-val">{data.clientName?.trim() || '—'}</div>
          </div>
          <div>
            <div className="estimate-wizard-label">Client email</div>
            <div className="estimate-wizard-summary-val">{data.clientEmail?.trim() || '—'}</div>
          </div>
          <div>
            <div className="estimate-wizard-label">Client phone</div>
            <div className="estimate-wizard-summary-val">{data.clientPhone?.trim() || '—'}</div>
          </div>
          <div>
            <div className="estimate-wizard-label">Project address</div>
            <div className="estimate-wizard-summary-val">{data.projectAddress?.trim() || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

