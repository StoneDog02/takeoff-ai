import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { api } from '@/api/client'
import { estimatesApi } from '@/api/estimates'
import { settingsApi } from '@/api/settings'
import type { CustomProduct, Job, PipelineMilestone, Project } from '@/types/global'
import type { EstimateLineItem } from '@/types/global'
import { USE_MOCK_ESTIMATES, MOCK_CUSTOM_PRODUCTS } from '@/data/mockEstimatesData'
import {
  EstimateClientFacingDocument,
  EstimatePortalStyleActionBar,
  type ClientFacingLineItem,
  type ClientSectionNote,
} from '@/components/estimates/EstimateClientFacingDocument'

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
  /** Category/section for grouping (e.g. trade name). */
  section?: string
  /** Distinguishes takeoff groups vs single-row sub bids for grouping. */
  source?: 'takeoff' | 'bid'
  subcontractor_note?: string
  subcontractor_name?: string
}

/** Single line item within a group (read-only for takeoff/bid; editable for custom). */
export type LineItemGroupItem = {
  id: number | string
  description: string
  qty: number
  unit: string
  unitCost: number
}

/** Grouped row: category/trade with items, markup, and client total. */
export type LineItemGroup = {
  id: string
  categoryName: string
  source: 'takeoff' | 'bid' | 'custom'
  items: LineItemGroupItem[]
  costSubtotal: number
  markupPct: number
  clientTotal: number
  /** GC note shown to client under this scope (takeoff/bid groups). */
  gcSectionNote?: string
  /** Subcontractor bid notes (e.g. from portal). */
  subNotes?: { subcontractor: string; text: string }[]
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
  /** Shown on client-facing estimate (preview & when sent). */
  estimateNotes: string
  estimateTerms: string
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

/** Single takeoff line for adding as a custom estimate line. */
export type TakeoffPickItem = {
  description: string
  qty: number
  unit: string
  price: number
  category?: string
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
  /** Takeoff materials for “From takeoff” add-line picker (when project has takeoff). */
  takeoffPickItems?: TakeoffPickItem[] | null
}

function defaultWizardData(prefill?: PrefillClientInfo | null): WizardData {
  if (prefill) {
    return {
      projectName: prefill.projectName ?? '',
      planType: prefill.planType ?? 'residential',
      clientName: prefill.clientName ?? '',
      clientEmail: prefill.clientEmail ?? '',
      clientPhone: prefill.clientPhone ?? '',
      projectAddress: prefill.projectAddress ?? '',
      estimateNotes: '',
      estimateTerms: '',
    }
  }
  return {
    projectName: '',
    planType: 'residential',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    projectAddress: '',
    estimateNotes: '',
    estimateTerms: '',
  }
}

/** Client-facing lines at contractor cost; markup shown separately as General fees. */
function lineItemGroupsToClientCostLineItems(groups: LineItemGroup[]): ClientFacingLineItem[] {
  let n = 0
  const out: ClientFacingLineItem[] = []
  for (const g of groups) {
    if (g.source === 'custom' && g.items[0]) {
      const i = g.items[0]
      const total = Math.round(i.qty * i.unitCost * 100) / 100
      out.push({
        id: `pv-${n++}`,
        description: i.description || '—',
        quantity: i.qty,
        unit: i.unit,
        unit_price: i.unitCost,
        total,
        section: null,
      })
    } else if (g.source === 'takeoff') {
      for (const i of g.items) {
        const t = Math.round(i.qty * i.unitCost * 100) / 100
        out.push({
          id: `pv-${n++}`,
          description: i.description || '—',
          quantity: i.qty,
          unit: i.unit,
          unit_price: i.unitCost,
          total: t,
          section: g.categoryName,
        })
      }
    } else if (g.source === 'bid') {
      const t = Math.round(g.costSubtotal * 100) / 100
      out.push({
        id: `pv-${n++}`,
        description: g.categoryName,
        quantity: 1,
        unit: 'job',
        unit_price: t,
        total: t,
        section: g.categoryName,
      })
    }
  }
  return out
}

function sectionNotesFromGroups(groups: LineItemGroup[]): ClientSectionNote[] {
  return groups
    .filter((g) => g.source === 'takeoff' || g.source === 'bid')
    .map((g) => ({
      section: g.categoryName,
      gc_note: g.gcSectionNote?.trim() || null,
      sub_notes: (g.subNotes || []).filter((x) => x.text?.trim()),
    }))
    .filter((s) => Boolean(s.gc_note) || (s.sub_notes && s.sub_notes.length > 0))
}

function sectionWorkTypesFromGroups(groups: LineItemGroup[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const g of groups) {
    if (g.source === 'custom') continue
    const k = g.categoryName?.trim()
    if (!k) continue
    if (g.source === 'bid') m[k] = 'subcontractor'
    else if (g.source === 'takeoff') {
      m[k] = /\(your\s*work\)\s*$/i.test(k) ? 'gc_self_perform' : 'scope_detail'
    }
  }
  return m
}

function parseGroupsFromMeta(raw: unknown): LineItemGroup[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  try {
    return raw.map((g: Record<string, unknown>, idx: number) => {
      const src = g.source
      const source =
        src === 'bid' || src === 'takeoff' || src === 'custom' ? src : ('custom' as const)
      const markupPct = Math.min(500, Math.max(0, Number(g.markupPct) || 0))
      const rawItems = Array.isArray(g.items) ? g.items : []
      const items: LineItemGroupItem[] = rawItems.map((it: Record<string, unknown>, j: number) => ({
        id: (it.id as string | number) ?? `l-${idx}-${j}`,
        description: String(it.description ?? ''),
        qty: Number(it.qty) || 0,
        unit: String(it.unit ?? 'ea'),
        unitCost: Number(it.unitCost) || 0,
      }))
      let costSubtotal = Number(g.costSubtotal) || 0
      if (source === 'takeoff' && items.length) {
        costSubtotal = items.reduce((s, i) => s + i.qty * i.unitCost, 0)
      } else if (source === 'bid' && items.length >= 1) {
        costSubtotal = items.reduce((s, i) => s + i.qty * i.unitCost, 0)
      } else if (source === 'custom' && items[0]) {
        costSubtotal = items[0].qty * items[0].unitCost
      }
      const clientTotal =
        source === 'custom' ? costSubtotal : Math.round(costSubtotal * (1 + markupPct / 100) * 100) / 100
      const subNotesRaw = Array.isArray(g.subNotes) ? g.subNotes : []
      const subNotes = subNotesRaw.map((n: Record<string, unknown>) => ({
        subcontractor: String(n.subcontractor ?? 'Subcontractor'),
        text: String(n.text ?? ''),
      }))
      return {
        id: String(g.id ?? `g-${idx}`),
        categoryName: String(g.categoryName ?? ''),
        source,
        items,
        costSubtotal,
        markupPct: source === 'custom' ? 0 : markupPct,
        clientTotal,
        gcSectionNote: g.gcSectionNote != null ? String(g.gcSectionNote) : '',
        subNotes,
      }
    })
  } catch {
    return null
  }
}

const DEFAULT_MARKUP_PCT = 15

/** Build lineItemGroups from prefill: group takeoff by section, one row per bid, no custom yet. */
function lineItemGroupsFromPrefill(
  prefill?: LineItem[] | null,
  markupPct: number = DEFAULT_MARKUP_PCT
): LineItemGroup[] {
  if (!prefill?.length) return []
  const m = Number.isFinite(markupPct) ? Math.min(500, Math.max(0, markupPct)) : DEFAULT_MARKUP_PCT
  const takeoffBySection = new Map<string, LineItemGroupItem[]>()
  const bidGroups: LineItemGroup[] = []
  let itemId = 0
  for (const item of prefill) {
    const source = item.source ?? (item.unit === 'job' && item.name.includes(' — ') ? 'bid' : 'takeoff')
    const section = item.section ?? 'Uncategorized'
    if (source === 'bid') {
      const cost = (Number(item.qty) || 0) * (Number(item.price) || 0)
      const subNote = item.subcontractor_note?.trim()
      bidGroups.push({
        id: `bid-${section}-${itemId++}`,
        categoryName: item.name,
        source: 'bid',
        items: [{ id: itemId++, description: item.name, qty: item.qty ?? 1, unit: item.unit ?? 'job', unitCost: item.price ?? 0 }],
        costSubtotal: cost,
        markupPct: m,
        clientTotal: cost * (1 + m / 100),
        gcSectionNote: '',
        subNotes: subNote
          ? [
              {
                subcontractor: item.subcontractor_name?.trim() || 'Subcontractor',
                text: subNote,
              },
            ]
          : [],
      })
      continue
    }
    const groupItem: LineItemGroupItem = {
      id: itemId++,
      description: item.name,
      qty: item.qty ?? 1,
      unit: item.unit ?? 'ea',
      unitCost: item.price ?? 0,
    }
    const list = takeoffBySection.get(section) ?? []
    list.push(groupItem)
    takeoffBySection.set(section, list)
  }
  const groups: LineItemGroup[] = []
  for (const [categoryName, items] of takeoffBySection) {
    const costSubtotal = items.reduce((s, i) => s + i.qty * i.unitCost, 0)
    groups.push({
      id: `takeoff-${categoryName}-${itemId++}`,
      categoryName,
      source: 'takeoff',
      items,
      costSubtotal,
      markupPct: m,
      clientTotal: costSubtotal * (1 + m / 100),
      gcSectionNote: '',
      subNotes: [],
    })
  }
  groups.push(...bidGroups)
  return groups
}

/** Convert loaded estimate line items to groups (one group per line for revise mode). */
function lineItemGroupsFromEstimate(lineItems: EstimateLineItem[]): LineItemGroup[] {
  if (!lineItems?.length) return []
  return lineItems.map((li, i) => {
    const qty = li.quantity ?? 1
    const unitCost = li.unit_price ?? 0
    const costSubtotal = qty * unitCost
    return {
      id: `loaded-${li.id}-${i}`,
      categoryName: li.description ?? 'Line item',
      source: 'custom' as const,
      items: [{ id: li.id, description: li.description ?? '', qty, unit: li.unit ?? 'ea', unitCost }],
      costSubtotal,
      markupPct: 0,
      clientTotal: costSubtotal,
      gcSectionNote: '',
      subNotes: [],
    }
  })
}

/** Flatten to stored line items: costs only (takeoff line-by-line; bid rollup); markup is total_amount − sum(lines). */
function flattenGroupsToCostLines(
  groups: LineItemGroup[]
): { name: string; qty: number; unit: string; price: number; section: string | null }[] {
  const lines: { name: string; qty: number; unit: string; price: number; section: string | null }[] = []
  for (const g of groups) {
    if (g.source === 'custom' && g.items.length === 1) {
      const i = g.items[0]
      lines.push({ name: i.description, qty: i.qty, unit: i.unit, price: i.unitCost, section: null })
    } else if (g.source === 'takeoff') {
      for (const i of g.items) {
        lines.push({
          name: i.description,
          qty: i.qty,
          unit: i.unit,
          price: i.unitCost,
          section: g.categoryName,
        })
      }
    } else if (g.source === 'bid') {
      lines.push({
        name: g.categoryName,
        qty: 1,
        unit: 'job',
        price: Math.round(g.costSubtotal * 100) / 100,
        section: g.categoryName,
      })
    }
  }
  return lines
}

function serializeGroupsMeta(groups: LineItemGroup[]): unknown[] {
  return groups.map((g) => ({
    id: g.id,
    categoryName: g.categoryName,
    source: g.source,
    items: g.items,
    costSubtotal: g.costSubtotal,
    markupPct: g.markupPct,
    clientTotal: g.clientTotal,
    gcSectionNote: g.gcSectionNote ?? '',
    subNotes: g.subNotes ?? [],
  }))
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
  takeoffPickItems,
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
  const [defaultMarkupBaseline, setDefaultMarkupBaseline] = useState(DEFAULT_MARKUP_PCT)
  const [lineItemGroups, setLineItemGroups] = useState<LineItemGroup[]>(() =>
    isReviseMode ? [] : lineItemGroupsFromPrefill(prefillLineItems, DEFAULT_MARKUP_PCT)
  )
  /** Revise mode: line item ids from loaded estimate (for delete-before-re-add on save). */
  const [loadedLineItemIds, setLoadedLineItemIds] = useState<string[]>([])
  const [reviseLoadDone, setReviseLoadDone] = useState(!isReviseMode)
  /** Resets step-2 catalog search state when the wizard is reset. */
  const [presetCatalogResetKey, setPresetCatalogResetKey] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [gcCompanyName, setGcCompanyName] = useState('')

  useEffect(() => {
    if (!isBuildMode) return
    settingsApi
      .getSettings()
      .then((r) => {
        const name = r.company?.name?.trim()
        if (name) setGcCompanyName(name)
        const m = r.company?.defaultEstimateMarkupPct
        if (m != null && Number.isFinite(Number(m))) {
          setDefaultMarkupBaseline(Math.min(500, Math.max(0, Number(m))))
        }
      })
      .catch(() => {})
  }, [isBuildMode])

  useEffect(() => {
    if (isReviseMode || defaultMarkupBaseline === DEFAULT_MARKUP_PCT) return
    setLineItemGroups((prev) => {
      const hasCat = prev.some((g) => g.source === 'takeoff' || g.source === 'bid')
      if (!hasCat) return prev
      if (!prev.every((g) => g.source === 'custom' || g.markupPct === DEFAULT_MARKUP_PCT)) return prev
      const t = defaultMarkupBaseline
      return prev.map((g) =>
        g.source === 'custom' ? g : { ...g, markupPct: t, clientTotal: g.costSubtotal * (1 + t / 100) }
      )
    })
  }, [defaultMarkupBaseline, isReviseMode])

  useEffect(() => {
    if (!isReviseMode || !estimateId) return
    setReviseLoadDone(false)
    estimatesApi
      .getEstimate(estimateId)
      .then((est) => {
        const metaGroups = parseGroupsFromMeta(est.estimate_groups_meta)
        setData((prev) => ({
          ...prev,
          projectName: est.title ?? prev.projectName,
          estimateNotes: est.client_notes?.trim() ? String(est.client_notes) : prev.estimateNotes,
          estimateTerms: est.client_terms?.trim() ? String(est.client_terms) : prev.estimateTerms,
        }))
        if (metaGroups && metaGroups.length > 0) {
          setLineItemGroups(metaGroups)
        } else {
          setLineItemGroups(lineItemGroupsFromEstimate(est.line_items ?? []))
        }
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

  const costLinesForApi = flattenGroupsToCostLines(lineItemGroups)
  const clientTotal = lineItemGroups.reduce((s, g) => s + g.clientTotal, 0)

  const persistEstimatePayload = () => ({
    total_amount: clientTotal,
    title: data.projectName?.trim() || undefined,
    client_notes: data.estimateNotes?.trim() || null,
    client_terms: data.estimateTerms?.trim() || null,
    estimate_groups_meta: serializeGroupsMeta(lineItemGroups),
  })

  const handleSaveEstimate = async () => {
    if (!projectId || lineItemGroups.length === 0) return
    setSaving(true)
    try {
      if (estimateId) {
        await estimatesApi.updateEstimate(estimateId, persistEstimatePayload())
        for (const lineId of loadedLineItemIds) {
          await estimatesApi.deleteLineItem(estimateId, lineId)
        }
        for (const line of costLinesForApi) {
          await estimatesApi.addLineItem(estimateId, {
            description: line.name,
            quantity: line.qty,
            unit: line.unit,
            unit_price: line.price,
            section: line.section,
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
        for (const line of costLinesForApi) {
          await estimatesApi.addLineItem(eid, {
            description: line.name,
            quantity: line.qty,
            unit: line.unit,
            unit_price: line.price,
            section: line.section,
          })
        }
        await estimatesApi.updateEstimate(eid, persistEstimatePayload())
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
    if (!projectId || lineItemGroups.length === 0 || !data.clientEmail?.trim()) return
    setSaving(true)
    try {
      const eid = estimateId ?? (await estimatesApi.createEstimate({
        job_id: projectId,
        title: data.projectName?.trim() || 'Estimate',
      })).id
      if (estimateId) {
        await estimatesApi.updateEstimate(estimateId, persistEstimatePayload())
        for (const lineId of loadedLineItemIds) {
          await estimatesApi.deleteLineItem(estimateId, lineId)
        }
        for (const line of costLinesForApi) {
          await estimatesApi.addLineItem(estimateId, {
            description: line.name,
            quantity: line.qty,
            unit: line.unit,
            unit_price: line.price,
            section: line.section,
          })
        }
      } else {
        for (const line of costLinesForApi) {
          await estimatesApi.addLineItem(eid, {
            description: line.name,
            quantity: line.qty,
            unit: line.unit,
            unit_price: line.price,
            section: line.section,
          })
        }
        await estimatesApi.updateEstimate(eid, persistEstimatePayload())
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
    setLineItemGroups(lineItemGroupsFromPrefill(prefillLineItems, defaultMarkupBaseline))
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
          <div className="estimate-wizard-topbar-right">
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
        </div>

        {/* Step bar + Preview (build mode, step 2+) */}
        <div className="estimate-wizard-stepbar-row">
          <div className="estimate-wizard-stepbar estimate-wizard-stepbar--tracks">
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
          {isBuildMode && step >= 2 && (
            <div className="estimate-wizard-stepbar-preview-slot">
              {lineItemGroups.length > 0 ? (
                <button
                  type="button"
                  className="estimate-wizard-stepbar-preview btn btn-ghost"
                  onClick={() => setPreviewOpen(true)}
                  title="See what your client will see."
                  aria-label="Preview client view"
                >
                  <svg
                    className="estimate-wizard-stepbar-preview-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Preview →
                </button>
              ) : (
                <span
                  className="estimate-wizard-stepbar-preview estimate-wizard-stepbar-preview--placeholder btn btn-ghost"
                  title="Add at least one line to preview."
                  role="status"
                  aria-live="polite"
                >
                  <svg
                    className="estimate-wizard-stepbar-preview-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Preview →
                </span>
              )}
            </div>
          )}
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
                lineItemGroups={lineItemGroups}
                setLineItemGroups={setLineItemGroups}
                hasPrefill={Boolean(prefillLineItems?.length)}
                resetKey={presetCatalogResetKey}
                defaultMarkupBaseline={defaultMarkupBaseline}
                takeoffPickItems={takeoffPickItems ?? undefined}
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
                  disabled={saving || lineItemGroups.length === 0}
                >
                  {saving ? 'Saving…' : 'Save Estimate'}
                </button>
                <button
                  type="button"
                  className="estimate-wizard-nav-next btn btn-primary"
                  onClick={handleSaveAndSendEstimate}
                  disabled={saving || lineItemGroups.length === 0 || !data.clientEmail?.trim()}
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

      {isBuildMode &&
        previewOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="estimate-wizard-preview-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="estimate-wizard-preview-title"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setPreviewOpen(false)
            }}
          >
            <div className="estimate-wizard-preview-banner" id="estimate-wizard-preview-title">
              <span>
                Preview only — this is what your client will see. Not yet sent.
              </span>
              <button
                type="button"
                className="estimate-wizard-preview-close btn btn-ghost"
                onClick={() => setPreviewOpen(false)}
              >
                Close
              </button>
            </div>
            <div
              className="estimate-wizard-preview-body"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="estimate-portal estimate-portal--page">
                <div className="estimate-portal__inner estimate-portal__inner--with-actions">
                  <EstimateClientFacingDocument
                    companyDisplayName={gcCompanyName?.trim() || 'Your Estimate'}
                    dateIssued={new Date().toISOString()}
                    clientName={data.clientName.trim() || '—'}
                    clientAddress={data.projectAddress.trim() || undefined}
                    projectName={data.projectName.trim() || '—'}
                    projectAddress={data.projectAddress.trim() || undefined}
                    lineItems={lineItemGroupsToClientCostLineItems(lineItemGroups)}
                    sectionNotes={sectionNotesFromGroups(lineItemGroups)}
                    sectionWorkTypes={sectionWorkTypesFromGroups(lineItemGroups)}
                    total={clientTotal}
                    milestones={null}
                    notes={data.estimateNotes.trim() || null}
                    terms={data.estimateTerms.trim() || null}
                  />
                  <EstimatePortalStyleActionBar previewMode />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
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
      {isBuildMode && (
        <>
          <div className="estimate-wizard-field estimate-wizard-field--full">
            <label className="estimate-wizard-label">Notes to client</label>
            <textarea
              value={data.estimateNotes}
              onChange={(e) => setData((d) => ({ ...d, estimateNotes: e.target.value }))}
              placeholder="Optional — shown on the estimate your client receives"
              className="estimate-wizard-input estimate-wizard-textarea"
              rows={3}
            />
          </div>
          <div className="estimate-wizard-field estimate-wizard-field--full">
            <label className="estimate-wizard-label">Terms &amp; conditions</label>
            <textarea
              value={data.estimateTerms}
              onChange={(e) => setData((d) => ({ ...d, estimateTerms: e.target.value }))}
              placeholder="Optional — payment terms, warranty, etc."
              className="estimate-wizard-input estimate-wizard-textarea"
              rows={4}
            />
          </div>
        </>
      )}
    </div>
  )
}

/** Click-to-edit markup % for a category row; updates client total on commit. */
function MarkupPctInline({
  groupId,
  value,
  onCommit,
}: {
  groupId: string
  value: number
  onCommit: (id: string, pct: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [value, editing])
  const commit = () => {
    const n = Math.min(500, Math.max(0, Number(String(draft).replace(/,/g, '')) || 0))
    onCommit(groupId, n)
    setEditing(false)
  }
  if (editing) {
    return (
      <span className="estimate-wizard-markup-edit-wrap">
        <input
          type="number"
          min={0}
          max={500}
          step={0.5}
          className="estimate-wizard-markup-input-inline estimate-wizard-group-markup-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setDraft(String(value))
              setEditing(false)
            }
          }}
          aria-label="Markup percent"
        />
        <span className="estimate-wizard-markup-pct-suffix">%</span>
      </span>
    )
  }
  const display = value % 1 === 0 ? String(value) : String(Math.round(value * 10) / 10).replace(/\.0$/, '')
  return (
    <button
      type="button"
      className="estimate-wizard-markup-pill"
      onClick={() => {
        setDraft(String(value))
        setEditing(true)
      }}
      aria-label={`Markup ${display} percent, click to edit`}
    >
      {display}%
    </button>
  )
}

// ─── Step 2: Line Items (build-estimate mode) ──────────────────────────────────
function Step2LineItems({
  lineItemGroups,
  setLineItemGroups,
  hasPrefill,
  resetKey,
  defaultMarkupBaseline,
  takeoffPickItems = [],
}: {
  lineItemGroups: LineItemGroup[]
  setLineItemGroups: React.Dispatch<React.SetStateAction<LineItemGroup[]>>
  hasPrefill: boolean
  resetKey: number
  defaultMarkupBaseline: number
  takeoffPickItems?: TakeoffPickItem[]
}) {
  const [prefillBannerDismissed, setPrefillBannerDismissed] = useState(false)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())
  const [products, setProducts] = useState<CustomProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [catalogQuery, setCatalogQuery] = useState('')
  const [takeoffQuery, setTakeoffQuery] = useState('')
  const [bulkMarkupStr, setBulkMarkupStr] = useState(String(defaultMarkupBaseline))
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [takeoffOpen, setTakeoffOpen] = useState(false)
  const addLineToolbarRef = useRef<HTMLDivElement>(null)
  const catalogPopoverRef = useRef<HTMLDivElement>(null)
  const takeoffPopoverRef = useRef<HTMLDivElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 360 })

  const closeAddPanels = useCallback(() => {
    setAddMenuOpen(false)
    setCatalogOpen(false)
    setTakeoffOpen(false)
  }, [])

  useEffect(() => {
    setCatalogQuery('')
    setTakeoffQuery('')
    setPrefillBannerDismissed(false)
    closeAddPanels()
  }, [resetKey, closeAddPanels])

  useEffect(() => {
    setBulkMarkupStr(String(defaultMarkupBaseline))
  }, [defaultMarkupBaseline])

  useEffect(() => {
    if (!addMenuOpen && !catalogOpen && !takeoffOpen) return
    const isInsideAddLineUi = (t: Node | null) => {
      if (!t) return false
      return (
        !!addLineToolbarRef.current?.contains(t) ||
        !!addMenuRef.current?.contains(t) ||
        !!catalogPopoverRef.current?.contains(t) ||
        !!takeoffPopoverRef.current?.contains(t)
      )
    }
    const onDocDown = (e: MouseEvent) => {
      if (isInsideAddLineUi(e.target as Node)) return
      closeAddPanels()
    }
    const onDocTouch = (e: TouchEvent) => {
      const t = e.targetTouches[0]?.target as Node | null
      if (isInsideAddLineUi(t)) return
      closeAddPanels()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAddPanels()
    }
    /* Capture phase so clicks inside the wizard still close the menu (wizard stops bubble to overlay). */
    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('touchstart', onDocTouch, { capture: true, passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown, true)
      document.removeEventListener('touchstart', onDocTouch, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [addMenuOpen, catalogOpen, takeoffOpen, closeAddPanels])

  const updatePopoverPosition = useCallback(() => {
    const el = addLineToolbarRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = Math.min(360, Math.max(280, window.innerWidth - 24))
    setPopoverPos({
      top: r.bottom + 8,
      left: Math.max(12, Math.min(r.left, window.innerWidth - w - 12)),
      width: w,
    })
  }, [])

  useLayoutEffect(() => {
    if (!addMenuOpen && !catalogOpen && !takeoffOpen) return
    updatePopoverPosition()
  }, [addMenuOpen, catalogOpen, takeoffOpen, updatePopoverPosition])

  useEffect(() => {
    if (!addMenuOpen && !catalogOpen && !takeoffOpen) return
    const onScrollOrResize = () => updatePopoverPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [addMenuOpen, catalogOpen, takeoffOpen, updatePopoverPosition])

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

  const toggleExpanded = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const updateGroupMarkup = (groupId: string, markupPct: number) => {
    const m = Math.min(500, Math.max(0, markupPct))
    setLineItemGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, markupPct: m, clientTotal: g.costSubtotal * (1 + m / 100) }
          : g
      )
    )
  }

  const updateGroupGcNote = (groupId: string, text: string) => {
    setLineItemGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, gcSectionNote: text } : g))
    )
  }

  const applyAllCategoryMarkups = () => {
    const pct = Math.min(500, Math.max(0, Number(String(bulkMarkupStr).replace(/,/g, '')) || 0))
    setLineItemGroups((prev) =>
      prev.map((g) =>
        g.source === 'takeoff' || g.source === 'bid'
          ? { ...g, markupPct: pct, clientTotal: g.costSubtotal * (1 + pct / 100) }
          : g
      )
    )
  }

  const updateCustomGroupItem = (groupId: string, updates: Partial<LineItemGroupItem>) => {
    setLineItemGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId || g.source !== 'custom' || g.items.length !== 1) return g
        const item = { ...g.items[0], ...updates }
        const costSubtotal = item.qty * item.unitCost
        const categoryName = 'description' in updates && updates.description !== undefined ? updates.description : g.categoryName
        return { ...g, categoryName, items: [item], costSubtotal, clientTotal: costSubtotal }
      })
    )
  }

  const removeGroup = (groupId: string) => {
    setLineItemGroups((prev) => prev.filter((g) => g.id !== groupId))
  }

  const addCustomLine = () => {
    const id = `custom-${Date.now()}`
    setLineItemGroups((prev) => [
      ...prev,
      {
        id,
        categoryName: '',
        source: 'custom',
        items: [{ id: Date.now(), description: '', qty: 1, unit: 'ea', unitCost: 0 }],
        costSubtotal: 0,
        markupPct: 0,
        clientTotal: 0,
      },
    ])
    setExpandedGroupIds((prev) => new Set(prev).add(id))
  }

  const addFromCatalog = (product: CustomProduct) => {
    const id = `custom-${Date.now()}`
    const unitCost = product.default_unit_price ?? 0
    setLineItemGroups((prev) => [
      ...prev,
      {
        id,
        categoryName: product.name,
        source: 'custom',
        items: [
          {
            id: Date.now(),
            description: product.name,
            qty: 1,
            unit: product.unit ?? 'ea',
            unitCost,
          },
        ],
        costSubtotal: unitCost,
        markupPct: 0,
        clientTotal: unitCost,
      },
    ])
    setCatalogQuery('')
    closeAddPanels()
  }

  const addFromTakeoff = (row: TakeoffPickItem) => {
    const id = `custom-${Date.now()}`
    const qty = Number(row.qty) || 1
    const unitCost = Number(row.price) || 0
    setLineItemGroups((prev) => [
      ...prev,
      {
        id,
        categoryName: row.description,
        source: 'custom',
        items: [
          {
            id: Date.now(),
            description: row.description,
            qty,
            unit: row.unit || 'ea',
            unitCost,
          },
        ],
        costSubtotal: qty * unitCost,
        markupPct: 0,
        clientTotal: qty * unitCost,
      },
    ])
    closeAddPanels()
  }

  const hasTakeoffPicker = takeoffPickItems.length > 0
  const filteredTakeoff = takeoffQuery.trim()
    ? takeoffPickItems.filter((row) => {
        const q = takeoffQuery.toLowerCase()
        return (
          row.description.toLowerCase().includes(q) ||
          (row.category ?? '').toLowerCase().includes(q)
        )
      })
    : takeoffPickItems

  const groupedRows = lineItemGroups.filter((g) => g.source !== 'custom')
  const customRows = lineItemGroups.filter((g) => g.source === 'custom')
  const costTotal = lineItemGroups.reduce((s, g) => s + g.costSubtotal, 0)
  const clientTotalSum = lineItemGroups.reduce((s, g) => s + g.clientTotal, 0)
  const totalMarkupSum = clientTotalSum - costTotal

  const fmt = (n: number) =>
    `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

        <div className="estimate-wizard-add-line-toolbar" ref={addLineToolbarRef}>
          <button
            type="button"
            className="estimate-wizard-add-line-trigger btn btn-ghost"
            aria-expanded={addMenuOpen}
            aria-haspopup="true"
            onClick={() => {
              setAddMenuOpen((o) => !o)
              setCatalogOpen(false)
              setTakeoffOpen(false)
            }}
          >
            + Add line
            <span className="estimate-wizard-add-line-chevron" aria-hidden>
              {addMenuOpen ? '▲' : '▼'}
            </span>
          </button>
        </div>
        {typeof document !== 'undefined' &&
          addMenuOpen &&
          createPortal(
            <div
              ref={addMenuRef}
              className="estimate-wizard-add-line-dropdown-panel"
              style={{
                position: 'fixed',
                top: popoverPos.top,
                left: popoverPos.left,
                zIndex: 100001,
                minWidth: 200,
              }}
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="estimate-wizard-add-line-menu-item"
                onClick={() => {
                  setAddMenuOpen(false)
                  setCatalogOpen(true)
                  setTakeoffOpen(false)
                }}
              >
                From catalog
              </button>
              {hasTakeoffPicker ? (
                <button
                  type="button"
                  role="menuitem"
                  className="estimate-wizard-add-line-menu-item"
                  onClick={() => {
                    setAddMenuOpen(false)
                    setTakeoffOpen(true)
                    setCatalogOpen(false)
                  }}
                >
                  From takeoff
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="estimate-wizard-add-line-menu-item"
                onClick={() => {
                  addCustomLine()
                  closeAddPanels()
                }}
              >
                Custom item
              </button>
            </div>,
            document.body
          )}
        {typeof document !== 'undefined' &&
          catalogOpen &&
          createPortal(
            <div
              ref={catalogPopoverRef}
              className="estimate-wizard-line-picker-popover estimate-wizard-catalog-popover estimate-wizard-catalog-popover--fixed"
              style={{
                position: 'fixed',
                top: popoverPos.top,
                left: popoverPos.left,
                width: popoverPos.width,
                zIndex: 100100,
              }}
              role="dialog"
              aria-label="Catalog"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="estimate-wizard-catalog-popover-head">
                <span className="estimate-wizard-catalog-popover-title">From catalog</span>
                <button
                  type="button"
                  className="estimate-wizard-catalog-popover-close"
                  onClick={closeAddPanels}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="estimate-wizard-catalog-popover-search">
                <span className="estimate-wizard-catalog-popover-search-icon" aria-hidden>
                  ⌕
                </span>
                <input
                  type="text"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="Search products & services…"
                  className="estimate-wizard-input"
                  autoFocus
                />
              </div>
              <div className="estimate-wizard-catalog-popover-list">
                {loadingProducts ? (
                  <div className="estimate-wizard-catalog-popover-empty">Loading…</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="estimate-wizard-catalog-popover-empty">
                    No matches. Add items in Products & Services.
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="estimate-wizard-catalog-popover-row"
                      onClick={() => addFromCatalog(product)}
                    >
                      <span className="estimate-wizard-catalog-popover-row-name">{product.name}</span>
                      <span className="estimate-wizard-catalog-popover-row-meta">
                        ${Number(product.default_unit_price || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        /{product.unit || 'ea'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body
          )}
        {typeof document !== 'undefined' &&
          takeoffOpen &&
          hasTakeoffPicker &&
          createPortal(
            <div
              ref={takeoffPopoverRef}
              className="estimate-wizard-line-picker-popover estimate-wizard-takeoff-popover estimate-wizard-catalog-popover--fixed"
              style={{
                position: 'fixed',
                top: popoverPos.top,
                left: popoverPos.left,
                width: popoverPos.width,
                zIndex: 100100,
              }}
              role="dialog"
              aria-label="Takeoff materials"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="estimate-wizard-catalog-popover-head">
                <span className="estimate-wizard-catalog-popover-title">From takeoff</span>
                <button
                  type="button"
                  className="estimate-wizard-catalog-popover-close"
                  onClick={closeAddPanels}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="estimate-wizard-catalog-popover-search">
                <span className="estimate-wizard-catalog-popover-search-icon" aria-hidden>
                  ⌕
                </span>
                <input
                  type="text"
                  value={takeoffQuery}
                  onChange={(e) => setTakeoffQuery(e.target.value)}
                  placeholder="Filter by description or category…"
                  className="estimate-wizard-input"
                  autoFocus
                />
              </div>
              <div className="estimate-wizard-catalog-popover-list">
                {filteredTakeoff.length === 0 ? (
                  <div className="estimate-wizard-catalog-popover-empty">No matching lines.</div>
                ) : (
                  filteredTakeoff.map((row, idx) => (
                    <button
                      key={`${row.description}-${row.category}-${idx}`}
                      type="button"
                      className="estimate-wizard-takeoff-popover-row"
                      onClick={() => addFromTakeoff(row)}
                    >
                      {row.category ? (
                        <span className="estimate-wizard-takeoff-popover-cat">{row.category}</span>
                      ) : null}
                      <span className="estimate-wizard-takeoff-popover-desc">{row.description}</span>
                      <span className="estimate-wizard-takeoff-popover-qty">
                        {row.qty} {row.unit}
                        {row.price != null && row.price > 0
                          ? ` · $${Number(row.price).toFixed(2)}`
                          : ''}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body
          )}

        {/* Grouped category / bid rows */}
        <div className="estimate-wizard-groups-table">
          {groupedRows.length > 0 && (
            <div className="estimate-wizard-set-all-markup">
              <span className="estimate-wizard-set-all-markup-label">Set all categories to</span>
              <input
                type="number"
                min={0}
                max={500}
                step={0.5}
                className="estimate-wizard-input estimate-wizard-set-all-markup-input"
                value={bulkMarkupStr}
                onChange={(e) => setBulkMarkupStr(e.target.value)}
                aria-label="Markup percent for all categories"
              />
              <span className="estimate-wizard-set-all-markup-pct">%</span>
              <button
                type="button"
                className="estimate-wizard-set-all-markup-btn"
                onClick={applyAllCategoryMarkups}
              >
                Apply
              </button>
            </div>
          )}
          <div className="estimate-wizard-groups-header">
            <span className="estimate-wizard-groups-header__chevron-gap" aria-hidden />
            <span className="estimate-wizard-label">Category</span>
            <span className="estimate-wizard-label">Items</span>
            <span className="estimate-wizard-label">Cost subtotal</span>
            <span className="estimate-wizard-label">Markup %</span>
            <span className="estimate-wizard-label">Client total</span>
            <span aria-hidden />
          </div>
          {groupedRows.map((group) => {
            const expanded = expandedGroupIds.has(group.id)
            const canExpand = group.items.length > 0
            return (
              <div key={group.id} className="estimate-wizard-group-row-wrap">
                <div className="estimate-wizard-group-row">
                  <button
                    type="button"
                    className="estimate-wizard-group-chevron"
                    onClick={() => canExpand && toggleExpanded(group.id)}
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                    disabled={!canExpand}
                  >
                    {canExpand ? (expanded ? '▼' : '▶') : ''}
                  </button>
                  <div className="estimate-wizard-group-name-col">
                    <span className="estimate-wizard-group-name">{group.categoryName}</span>
                    <span
                      className={`estimate-wizard-group-source-pill estimate-wizard-group-source-pill--${group.source === 'bid' ? 'bid' : 'takeoff'}`}
                    >
                      {group.source === 'bid' ? 'Bid' : 'Takeoff'}
                    </span>
                  </div>
                  <span className="estimate-wizard-group-count">{group.items.length}</span>
                  <span className="estimate-wizard-group-cost">{fmt(group.costSubtotal)}</span>
                  <span className="estimate-wizard-group-markup">
                    <MarkupPctInline
                      groupId={group.id}
                      value={group.markupPct}
                      onCommit={updateGroupMarkup}
                    />
                  </span>
                  <span className="estimate-wizard-group-client-total">{fmt(group.clientTotal)}</span>
                  <span aria-hidden />
                </div>
                {expanded && group.items.length > 0 && (
                  <div className="estimate-wizard-group-items">
                    <div className="estimate-wizard-group-items-header">
                      <span>Description</span>
                      <span>Qty</span>
                      <span>Unit</span>
                      <span>Unit cost</span>
                    </div>
                    {group.items.map((item) => (
                      <div key={item.id} className="estimate-wizard-group-item-row">
                        <span className="estimate-wizard-group-item-desc">{item.description}</span>
                        <span>{item.qty}</span>
                        <span>{item.unit}</span>
                        <span>{fmt(item.unitCost)}</span>
                      </div>
                    ))}
                    <div
                      className="estimate-wizard-group-scope-notes"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      role="presentation"
                    >
                      {group.subNotes && group.subNotes.length > 0 ? (
                        <div className="estimate-wizard-group-sub-notes-readonly">
                          {group.subNotes.map((n, idx) =>
                            n.text?.trim() ? (
                              <p key={idx} className="estimate-wizard-group-sub-note-line">
                                <span className="estimate-wizard-group-sub-note-from">
                                  From {n.subcontractor || 'Subcontractor'}:
                                </span>{' '}
                                {n.text}
                              </p>
                            ) : null
                          )}
                        </div>
                      ) : null}
                      <label className="estimate-wizard-label estimate-wizard-group-gc-note-label">
                        Your note to client (this section)
                      </label>
                      <textarea
                        className="estimate-wizard-textarea estimate-wizard-group-gc-note-input"
                        rows={2}
                        placeholder="Optional — appears under this section on the client’s estimate."
                        value={group.gcSectionNote ?? ''}
                        onChange={(e) => updateGroupGcNote(group.id, e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Custom line items at bottom — full editing */}
          {customRows.length > 0 && (
            <>
              <div className="estimate-wizard-custom-section-label">Custom line items</div>
              <div className="estimate-wizard-groups-header estimate-wizard-groups-header--custom">
                <span className="estimate-wizard-groups-header__chevron-gap" aria-hidden />
                <span className="estimate-wizard-label">Description</span>
                <span className="estimate-wizard-label">Qty</span>
                <span className="estimate-wizard-label">Unit</span>
                <span className="estimate-wizard-label">Unit price</span>
                <span className="estimate-wizard-label">Total</span>
                <span aria-hidden />
              </div>
            </>
          )}
          {customRows.map((group) => {
            const item = group.items[0]
            if (!item) return null
            return (
              <div key={group.id} className="estimate-wizard-group-row-wrap estimate-wizard-group-row-wrap--custom">
                <div className="estimate-wizard-group-row estimate-wizard-group-row--custom">
                  <span className="estimate-wizard-group-chevron" aria-hidden />
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateCustomGroupItem(group.id, { description: e.target.value })}
                    placeholder="Description"
                    className="estimate-wizard-input estimate-wizard-line-input-name"
                  />
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={item.qty}
                    onChange={(e) => updateCustomGroupItem(group.id, { qty: Number(e.target.value) || 0 })}
                    className="estimate-wizard-input estimate-wizard-line-input-num"
                  />
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => updateCustomGroupItem(group.id, { unit: e.target.value })}
                    placeholder="ea"
                    className="estimate-wizard-input estimate-wizard-line-input-unit"
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unitCost}
                    onChange={(e) => updateCustomGroupItem(group.id, { unitCost: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="estimate-wizard-input estimate-wizard-line-input-price"
                  />
                  <span className="estimate-wizard-group-client-total">{fmt(group.clientTotal)}</span>
                  <button
                    type="button"
                    className="estimate-wizard-line-remove"
                    onClick={() => removeGroup(group.id)}
                    aria-label="Remove line"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Running total */}
        <div className="estimate-wizard-totals-footer">
          <div className="estimate-wizard-totals-footer-cell">
            <span className="estimate-wizard-totals-footer-label">Cost total</span>
            <span className="estimate-wizard-totals-footer-value">{fmt(costTotal)}</span>
          </div>
          <div className="estimate-wizard-totals-footer-cell">
            <span className="estimate-wizard-totals-footer-label">Total markup</span>
            <span className="estimate-wizard-totals-footer-value">{fmt(totalMarkupSum)}</span>
          </div>
          <div className="estimate-wizard-totals-footer-cell">
            <span className="estimate-wizard-totals-footer-label">Client total</span>
            <span className="estimate-wizard-totals-footer-value estimate-wizard-totals-footer-value--client">
              {fmt(clientTotalSum)}
            </span>
          </div>
        </div>
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

