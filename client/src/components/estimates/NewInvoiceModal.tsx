import { useMemo, useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { estimatesApi, type EstimateWithLines } from '@/api/estimates'
import { api } from '@/api/client'
import type { CustomProduct, Estimate, Job, Phase } from '@/types/global'
import { USE_MOCK_ESTIMATES, MOCK_CUSTOM_PRODUCTS } from '@/data/mockEstimatesData'
import { getMockProjectDetail, isMockProjectId } from '@/data/mockProjectsData'
import { buildMilestonesFromInvoiced, formatCurrency } from '@/lib/pipeline'
import {
  extractProgressMilestonesOnly,
  splitMoneyEqually,
  buildMilestonesFromProjectPhases,
  applyMilestonesToEstimateMeta,
  type ProgressMilestone,
} from '@/lib/progressMilestones'

type PathType = 'progress' | 'manual'
type StepType = 'choose' | 'progress' | 'manual-info' | 'manual-lines' | 'review'

type InvoiceLine = {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  section: string
}

interface NewInvoiceModalProps {
  jobs: Job[]
  onClose: () => void
  onSaved?: () => void
}

type ProgressDueMode = 'specific_date' | 'on_completion'

/** Notes / terms on progress invoice review step */
const INVOICE_DETAIL_TEXT_MAX = 500

type CompletionTermsKey = 'on_phase_completion' | 'net_15' | 'net_30' | 'net_45' | 'net_60'

type MilestonePaymentScheduleRow = {
  mode: ProgressDueMode
  /** YYYY-MM-DD when mode === 'specific_date' */
  specificDate: string
  completionTerms: CompletionTermsKey
}

/** Labels for the payment schedule review step (match client-facing contract language). */
const COMPLETION_TERM_OPTIONS: { value: CompletionTermsKey; label: string }[] = [
  { value: 'on_phase_completion', label: 'On phase completion' },
  { value: 'net_15', label: '15 days after completion' },
  { value: 'net_30', label: '30 days after completion' },
  { value: 'net_45', label: '45 days after completion' },
  { value: 'net_60', label: '60 days after completion' },
]

function defaultPaymentScheduleRow(): MilestonePaymentScheduleRow {
  return {
    mode: 'on_completion',
    specificDate: '',
    completionTerms: 'net_30',
  }
}

/** Earliest specific due date among milestones (for single invoice due_date field). */
function deriveInvoiceDueDateFromSchedule(
  schedule: Record<string, MilestonePaymentScheduleRow>,
  selectedIds: string[]
): string | undefined {
  const dates: string[] = []
  for (const id of selectedIds) {
    const row = schedule[id]
    if (row?.mode === 'specific_date' && row.specificDate?.trim()) {
      dates.push(row.specificDate.trim())
    }
  }
  if (dates.length === 0) return undefined
  dates.sort()
  return dates[0]
}

function initialManualLine(): InvoiceLine {
  return {
    id: `line-${Date.now()}`,
    description: '',
    qty: 1,
    unit: 'ea',
    unitPrice: 0,
    section: 'General',
  }
}

/** Controlled amount field: syncs from resolved split when not dirty; preserves manual edits when siblings change. */
function MilestoneAmountInput({
  milestoneId,
  resolvedAmount,
  selected,
  onFixedChange,
}: {
  milestoneId: string
  resolvedAmount: number
  selected: boolean
  onFixedChange: (id: string, value: string | null) => void
}) {
  const [local, setLocal] = useState(() => resolvedAmount.toFixed(2))
  const [dirty, setDirty] = useState(false)
  const prevSelected = useRef(selected)

  useEffect(() => {
    if (prevSelected.current !== selected) {
      prevSelected.current = selected
      if (!selected) {
        setDirty(false)
        return
      }
      setDirty(false)
      setLocal(resolvedAmount.toFixed(2))
      return
    }
    if (selected && !dirty) {
      setLocal(resolvedAmount.toFixed(2))
    }
  }, [selected, resolvedAmount, dirty, milestoneId])

  if (!selected) return null

  return (
    <div className="new-invoice-milestone-pill new-invoice-milestone-pill--amt">
      <span className="new-invoice-milestone-pill__prefix" aria-hidden>
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        className="new-invoice-milestone-pill__input"
        aria-label="Amount for this milestone"
        value={local}
        onChange={(e) => {
          const v = e.target.value
          setLocal(v)
          setDirty(true)
          if (v.trim() === '') {
            onFixedChange(milestoneId, null)
            return
          }
          if (/^-?\d*\.?\d*$/.test(v)) {
            onFixedChange(milestoneId, v)
          }
        }}
        onBlur={() => {
          const n = parseFloat(local.replace(/,/g, ''))
          if (local.trim() === '') {
            onFixedChange(milestoneId, null)
            setDirty(false)
            return
          }
          if (Number.isFinite(n) && n >= 0) {
            const s = n.toFixed(2)
            setLocal(s)
            onFixedChange(milestoneId, s)
          }
        }}
      />
    </div>
  )
}

export function NewInvoiceModal({ jobs, onClose, onSaved }: NewInvoiceModalProps) {
  const [step, setStep] = useState<StepType>('choose')
  const [pathType, setPathType] = useState<PathType | null>(null)
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loadingEstimates, setLoadingEstimates] = useState(false)
  const [products, setProducts] = useState<CustomProduct[]>([])
  const [catalogQuery, setCatalogQuery] = useState('')
  const [activeJobId, setActiveJobId] = useState('')
  const [activeEstimateId, setActiveEstimateId] = useState('')
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([])
  /** Per-milestone amount override (dollars, string for inputs). Empty = equal split of remainder among selected. */
  const [milestoneAmountOverride, setMilestoneAmountOverride] = useState<Record<string, string>>({})
  const [progressEstimateDetail, setProgressEstimateDetail] = useState<EstimateWithLines | null>(null)
  const [loadingProgressMilestones, setLoadingProgressMilestones] = useState(false)
  const [projectPhases, setProjectPhases] = useState<Phase[]>([])
  const [loadingProjectPhases, setLoadingProjectPhases] = useState(false)
  const [manualLines, setManualLines] = useState<InvoiceLine[]>([initialManualLine()])
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [dueDate, setDueDate] = useState('')
  /** Per selected milestone: due type + value (progress invoice review step). */
  const [progressPaymentSchedule, setProgressPaymentSchedule] = useState<Record<string, MilestonePaymentScheduleRow>>({})
  const [terms, setTerms] = useState('')
  const [notes, setNotes] = useState('')
  /** Email last synced from the project record — used for “pre-filled from project” UI */
  const [projectClientEmailSnapshot, setProjectClientEmailSnapshot] = useState('')
  /** When false and email matches snapshot, show green prefilled state; “Change” sets true */
  const [recipientEmailUnlocked, setRecipientEmailUnlocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingEstimates(true)
    estimatesApi.getEstimates()
      .then((list) => setEstimates(list))
      .catch(() => setEstimates([]))
      .finally(() => setLoadingEstimates(false))
    if (USE_MOCK_ESTIMATES) {
      setProducts(MOCK_CUSTOM_PRODUCTS)
      return
    }
    estimatesApi.getCustomProducts().then(setProducts).catch(() => setProducts([]))
  }, [])

  const jobsById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
  const activeJob = activeJobId ? jobsById.get(activeJobId) : null

  /** Green “pre-filled from project” state for recipient email on progress review */
  const recipientEmailPrefilled = useMemo(() => {
    if (recipientEmailUnlocked) return false
    const snap = projectClientEmailSnapshot.trim()
    if (!snap) return false
    return clientEmail.trim() === snap
  }, [recipientEmailUnlocked, projectClientEmailSnapshot, clientEmail])

  /** Reset recipient “prefilled” lock when switching projects */
  useEffect(() => {
    setRecipientEmailUnlocked(false)
  }, [activeJobId])

  /** Load client name / email / phone from the project (job) record — canonical vs jobs list snapshot. */
  useEffect(() => {
    if (!activeJobId) return

    const applyFromJobList = () => {
      const j = jobsById.get(activeJobId)
      setClientName(String(j?.client_name ?? '').trim())
      const em = String(j?.client_email ?? '').trim()
      setClientEmail(em)
      setProjectClientEmailSnapshot(em)
      setClientPhone(String(j?.client_phone ?? '').trim())
    }

    if (USE_MOCK_ESTIMATES && isMockProjectId(activeJobId)) {
      try {
        const detail = getMockProjectDetail(activeJobId)
        const p = detail.project
        setClientName(String(p.assigned_to_name ?? '').trim())
        const em = String(p.client_email ?? '').trim()
        setClientEmail(em)
        setProjectClientEmailSnapshot(em)
        setClientPhone(String(p.client_phone ?? '').trim())
      } catch {
        applyFromJobList()
      }
      return
    }

    if (USE_MOCK_ESTIMATES) {
      applyFromJobList()
      return
    }

    let cancelled = false
    api.projects
      .get(activeJobId)
      .then((proj) => {
        if (cancelled) return
        setClientName(String(proj.assigned_to_name ?? '').trim())
        const em = String(proj.client_email ?? '').trim()
        setClientEmail(em)
        setProjectClientEmailSnapshot(em)
        setClientPhone(String(proj.client_phone ?? '').trim())
      })
      .catch(() => {
        if (cancelled) return
        applyFromJobList()
      })

    return () => {
      cancelled = true
    }
  }, [activeJobId, jobsById])

  const progressEligible = useMemo(() => {
    return estimates.filter((e) => e.status === 'accepted' && Number(e.total_amount) > Number(e.invoiced_amount || 0))
  }, [estimates])

  const progressJobs = useMemo(() => {
    const ids = new Set(progressEligible.map((e) => e.job_id))
    return jobs.filter((j) => ids.has(j.id))
  }, [jobs, progressEligible])

  const estimateForProgress = useMemo(
    () => progressEligible.find((e) => e.id === activeEstimateId) || null,
    [progressEligible, activeEstimateId]
  )

  const milestones = useMemo(() => {
    if (!estimateForProgress) return [] as ProgressMilestone[]
    const fromMeta = extractProgressMilestonesOnly(progressEstimateDetail?.estimate_groups_meta)
    // Primary: schedule phases from the project (Phase builder) — tied to this job
    if (projectPhases.length > 0) {
      return buildMilestonesFromProjectPhases(projectPhases, estimateForProgress, fromMeta)
    }
    // Legacy: milestones saved on the estimate only (explicit progress_milestones, etc.)
    if (fromMeta.length > 0) return fromMeta
    const total = Number(estimateForProgress.total_amount || 0)
    const invoiced = Number(estimateForProgress.invoiced_amount || 0)
    return buildMilestonesFromInvoiced(total, invoiced).map((m, i) => ({
      id: `fallback-${i}`,
      label: m.label,
      pct: Number(m.pct || 0),
      amount: Number(m.amount || 0),
      invoiced: m.status === 'invoiced',
    }))
  }, [estimateForProgress, progressEstimateDetail, projectPhases])

  useEffect(() => {
    if (!activeEstimateId) {
      setProgressEstimateDetail(null)
      setSelectedMilestones([])
      return
    }
    let cancelled = false
    setLoadingProgressMilestones(true)
    estimatesApi.getEstimate(activeEstimateId)
      .then((detail) => {
        if (cancelled) return
        setProgressEstimateDetail(detail)
        setSelectedMilestones([])
        setMilestoneAmountOverride({})
        setProgressPaymentSchedule({})
      })
      .catch(() => {
        if (cancelled) return
        setProgressEstimateDetail(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingProgressMilestones(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeEstimateId])

  useEffect(() => {
    setProjectPhases([])
    if (!activeJobId) return
    let cancelled = false
    setLoadingProjectPhases(true)
    if (USE_MOCK_ESTIMATES && isMockProjectId(activeJobId)) {
      try {
        const detail = getMockProjectDetail(activeJobId)
        if (!cancelled) setProjectPhases(detail.phases ?? [])
      } catch {
        if (!cancelled) setProjectPhases([])
      } finally {
        if (!cancelled) setLoadingProjectPhases(false)
      }
      return () => {
        cancelled = true
      }
    }
    if (USE_MOCK_ESTIMATES) {
      setLoadingProjectPhases(false)
      return
    }
    api.projects
      .getPhases(activeJobId)
      .then((list) => {
        if (!cancelled) setProjectPhases(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setProjectPhases([])
      })
      .finally(() => {
        if (!cancelled) setLoadingProjectPhases(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeJobId])

  const remainingBalance = useMemo(() => {
    if (!estimateForProgress) return 0
    return Math.max(
      0,
      Number(estimateForProgress.total_amount || 0) - Number(estimateForProgress.invoiced_amount || 0)
    )
  }, [estimateForProgress])

  const progressSplit = useMemo(
    () => computeProgressSplit(remainingBalance, selectedMilestones, milestones, milestoneAmountOverride),
    [remainingBalance, selectedMilestones, milestones, milestoneAmountOverride]
  )

  const handleMilestoneAmountFixed = useCallback((id: string, value: string | null) => {
    setMilestoneAmountOverride((prev) => {
      if (value === null) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: value }
    })
  }, [])

  const updateProgressPaymentRow = useCallback((milestoneId: string, patch: Partial<MilestonePaymentScheduleRow>) => {
    setProgressPaymentSchedule((prev) => {
      const cur = prev[milestoneId] ?? defaultPaymentScheduleRow()
      return {
        ...prev,
        [milestoneId]: {
          mode: patch.mode ?? cur.mode,
          specificDate: patch.specificDate !== undefined ? patch.specificDate : cur.specificDate,
          completionTerms: patch.completionTerms ?? cur.completionTerms,
        },
      }
    })
  }, [])

  const progressLines = useMemo(() => {
    return selectedMilestones
      .map((id) => milestones.find((m) => m.id === id))
      .filter((m): m is ProgressMilestone => !!m && !m.invoiced)
      .map((m) => {
        const amt = progressSplit.amounts.get(m.id) ?? 0
        return {
          id: `milestone-${m.id}`,
          description: m.label,
          qty: 1,
          unit: 'job',
          unitPrice: amt,
          section: 'Milestone',
        }
      })
  }, [selectedMilestones, milestones, progressSplit.amounts])

  const reviewLines = pathType === 'progress' ? progressLines : manualLines
  const lineSubtotal = reviewLines.reduce((s, l) => s + l.qty * l.unitPrice, 0)

  const progressPaymentReviewRows = useMemo(() => {
    if (pathType !== 'progress') return [] as { m: ProgressMilestone; amt: number; pctRem: number }[]
    return selectedMilestones
      .map((id) => milestones.find((x) => x.id === id))
      .filter((m): m is ProgressMilestone => !!m && !m.invoiced)
      .map((m) => {
        const amt = progressSplit.amounts.get(m.id) ?? 0
        const pctRem =
          remainingBalance > 0 ? Math.round((amt / remainingBalance) * 1000) / 10 : 0
        return { m, amt, pctRem }
      })
  }, [pathType, selectedMilestones, milestones, progressSplit.amounts, remainingBalance])

  /** Review step dark summary: title line (estimate/job + client) */
  const progressReviewSummaryTitle = useMemo(() => {
    const jobPart = (estimateForProgress?.title || activeJob?.name || '—').trim()
    const client = clientName.trim()
    return client ? `${jobPart} — ${client}` : jobPart
  }, [estimateForProgress?.title, activeJob?.name, clientName])
  const filteredProducts = catalogQuery.trim()
    ? products.filter((p) => `${p.name} ${p.description || ''}`.toLowerCase().includes(catalogQuery.toLowerCase()))
    : products

  const goProgress = () => {
    setPathType('progress')
    setStep('progress')
    setError(null)
    setProgressPaymentSchedule({})
  }
  const goManual = () => {
    setPathType('manual')
    setStep('manual-info')
    setError(null)
    setProgressPaymentSchedule({})
  }

  const setManualField = (id: string, patch: Partial<InvoiceLine>) => {
    setManualLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const addFromCatalog = (product: CustomProduct) => {
    setManualLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random()}`,
        description: product.name,
        qty: 1,
        unit: product.unit || 'ea',
        unitPrice: Number(product.default_unit_price || 0),
        section: product.item_type || 'Catalog',
      },
    ])
  }

  const canContinue = () => {
    if (step === 'choose') return false
    if (step === 'progress') {
      if (!activeJobId || !activeEstimateId) return false
      const selectedOpen = selectedMilestones.filter((id) => milestones.find((m) => m.id === id && !m.invoiced))
      if (selectedOpen.length === 0) return false
      if (progressSplit.error) return false
      if (progressSplit.total <= 0) return false
      return true
    }
    if (step === 'manual-info') return !!activeJobId && !!clientEmail.trim()
    if (step === 'manual-lines') return manualLines.some((l) => l.description.trim() && l.qty > 0)
    if (step === 'review') {
      if (lineSubtotal <= 0 || !clientEmail.trim()) return false
      if (pathType === 'progress') {
        for (const id of selectedMilestones) {
          const row = progressPaymentSchedule[id] ?? defaultPaymentScheduleRow()
          if (row.mode === 'specific_date' && !row.specificDate?.trim()) return false
        }
        return true
      }
      return true
    }
    return false
  }

  const continueFromStep = () => {
    if (step === 'progress') {
      setProgressPaymentSchedule((prev) => {
        const next = { ...prev }
        for (const id of selectedMilestones) {
          if (!next[id]) next[id] = defaultPaymentScheduleRow()
        }
        for (const k of Object.keys(next)) {
          if (!selectedMilestones.includes(k)) delete next[k]
        }
        return next
      })
      setStep('review')
    }
    if (step === 'manual-info') setStep('manual-lines')
    if (step === 'manual-lines') setStep('review')
  }

  const goBack = () => {
    if (step === 'review') {
      setStep(pathType === 'progress' ? 'progress' : 'manual-lines')
      return
    }
    if (step === 'manual-lines') {
      setStep('manual-info')
      return
    }
    if (step === 'progress' || step === 'manual-info') {
      setStep('choose')
      setPathType(null)
      return
    }
    onClose()
  }

  const handleCreateAndSend = async () => {
    setSaving(true)
    setError(null)
    try {
      if (pathType === 'progress') {
        if (!estimateForProgress) throw new Error('Select an approved estimate.')
        const amount = progressLines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
        const progressDue = deriveInvoiceDueDateFromSchedule(progressPaymentSchedule, selectedMilestones)
        const scheduleRows = progressPaymentReviewRows.map(({ m, amt }) => {
          const row = progressPaymentSchedule[m.id] ?? defaultPaymentScheduleRow()
          if (row.mode === 'specific_date') {
            return {
              milestone_id: m.id,
              label: m.label,
              amount: amt,
              mode: 'specific_date' as const,
              specificDate: row.specificDate,
            }
          }
          return {
            milestone_id: m.id,
            label: m.label,
            amount: amt,
            mode: 'on_completion' as const,
            completionTerms: row.completionTerms,
          }
        })
        const schedule_snapshot = { rows: scheduleRows }
        await estimatesApi.updateEstimate(estimateForProgress.id, {
          client_notes: notes.trim() || null,
          client_terms: terms.trim() || null,
        })
        const result = await estimatesApi.convertToInvoice(estimateForProgress.id, {
          due_date: progressDue,
          amount,
          schedule_snapshot,
        })
        await estimatesApi.updateInvoice(result.invoice.id, {
          recipient_emails: [clientEmail.trim()],
          due_date: progressDue,
        })
        const updatedMilestones = milestones.map((m) => {
          if (!selectedMilestones.includes(m.id)) return m
          const amt = progressSplit.amounts.get(m.id) ?? m.amount
          const totalEst = Number(estimateForProgress.total_amount || 0)
          const pct = totalEst > 0 ? Math.round((amt / totalEst) * 1000) / 10 : 0
          return { ...m, invoiced: true, amount: amt, pct }
        })
        let baseMeta: unknown = progressEstimateDetail?.estimate_groups_meta ?? null
        if (baseMeta == null) {
          try {
            const fresh = await estimatesApi.getEstimate(estimateForProgress.id)
            baseMeta = fresh.estimate_groups_meta ?? null
          } catch {
            baseMeta = null
          }
        }
        const nextMeta = applyMilestonesToEstimateMeta(baseMeta, updatedMilestones)
        await estimatesApi.updateEstimate(estimateForProgress.id, {
          estimate_groups_meta: nextMeta,
        })
        await estimatesApi.sendInvoice(result.invoice.id, [clientEmail.trim()])
      } else {
        const created = await estimatesApi.createInvoice({
          job_id: activeJobId,
          total_amount: lineSubtotal,
          recipient_emails: [clientEmail.trim()],
          due_date: dueDate || undefined,
          status: 'draft',
        })
        await estimatesApi.sendInvoice(created.id, [clientEmail.trim()])
      }
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="estimate-builder-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="estimate-builder-wizard new-invoice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="estimate-wizard-topbar">
          <div className="estimate-wizard-topbar-left">
            <button type="button" className="estimate-wizard-back" onClick={goBack}>← Back</button>
            <span className="estimate-wizard-topbar-divider" aria-hidden />
            <h1 className="estimate-wizard-topbar-title">New Invoice</h1>
          </div>
        </div>

        <div className="estimate-wizard-content">
          {step === 'choose' && (
            <div className="new-invoice-choice-grid">
              <button type="button" className="new-invoice-choice-card" onClick={goProgress}>
                <div className="new-invoice-choice-title">Progress Invoice</div>
                <div className="new-invoice-choice-sub">Bill against an approved estimate milestone.</div>
                <div className="new-invoice-choice-note">
                  {loadingEstimates ? 'Loading eligible jobs…' : `${progressJobs.length} active job(s) with approved progress estimates`}
                </div>
              </button>
              <button type="button" className="new-invoice-choice-card" onClick={goManual}>
                <div className="new-invoice-choice-title">Manual Invoice</div>
                <div className="new-invoice-choice-sub">Create a custom invoice for any job.</div>
                <div className="new-invoice-choice-note">For change orders, additional work, or jobs without an estimate.</div>
              </button>
            </div>
          )}

          {step === 'progress' && (
            <div className="new-invoice-step-grid">
              <div className="estimate-wizard-field estimate-wizard-field--full">
                <label className="estimate-wizard-label">Job</label>
                <select className="estimate-wizard-input" value={activeJobId} onChange={(e) => {
                  const nextJob = e.target.value
                  setActiveJobId(nextJob)
                  setActiveEstimateId('')
                  setSelectedMilestones([])
                  setMilestoneAmountOverride({})
                  const j = jobsById.get(nextJob)
                  setClientName(j?.client_name || '')
                  const em = String(j?.client_email ?? '').trim()
                  setClientEmail(em)
                  setProjectClientEmailSnapshot(em)
                  setClientPhone(j?.client_phone || '')
                }}>
                  <option value="">Select a job</option>
                  {progressJobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
              <div className="estimate-wizard-field estimate-wizard-field--full">
                <label className="estimate-wizard-label">Approved estimate</label>
                <select className="estimate-wizard-input" value={activeEstimateId} onChange={(e) => {
                  setActiveEstimateId(e.target.value)
                  setSelectedMilestones([])
                  setMilestoneAmountOverride({})
                }}>
                  <option value="">Select estimate</option>
                  {progressEligible.filter((e) => e.job_id === activeJobId).map((e) => (
                    <option key={e.id} value={e.id}>{e.title} ({formatCurrency(Number(e.total_amount || 0))})</option>
                  ))}
                </select>
              </div>
              <div className="estimate-wizard-field estimate-wizard-field--full">
                <label className="estimate-wizard-label">Milestones to invoice</label>
                <p className="estimate-wizard-helper" style={{ marginTop: 0 }}>
                  {projectPhases.length > 0
                    ? 'Check the phases to bill on this invoice. The remaining approved balance is split equally across the ones you select (e.g. 1 = 100%, 2 = 50% each). You can override any row in $ or % of remaining.'
                    : 'Add phases on the project Schedule tab to drive progress billing, or use saved estimate milestones when present.'}
                </p>
                {estimateForProgress && (
                  <div className="new-invoice-milestone-summary-strip" aria-live="polite">
                    <div className="new-invoice-milestone-summary-strip__stat">
                      <span className="new-invoice-milestone-summary-strip__label">Remaining to bill</span>
                      <span className="new-invoice-milestone-summary-strip__value">{formatCurrency(remainingBalance)}</span>
                    </div>
                    <div className="new-invoice-milestone-summary-strip__divider" aria-hidden />
                    <div className="new-invoice-milestone-summary-strip__stat">
                      <span className="new-invoice-milestone-summary-strip__label">This invoice</span>
                      <span className="new-invoice-milestone-summary-strip__value new-invoice-milestone-summary-strip__value--accent">
                        {formatCurrency(progressSplit.total)}
                      </span>
                    </div>
                  </div>
                )}
                {progressSplit.error && (
                  <div className="new-invoice-error new-invoice-error--inline" role="alert">
                    {progressSplit.error}
                  </div>
                )}
                <div className="new-invoice-milestone-list">
                  {(loadingProgressMilestones || loadingProjectPhases) && (
                    <div className="new-invoice-muted">Loading schedule…</div>
                  )}
                  {!loadingProgressMilestones &&
                    !loadingProjectPhases &&
                    milestones.length === 0 && (
                      <div className="new-invoice-muted">No milestone schedule found.</div>
                    )}
                  {!loadingProgressMilestones && !loadingProjectPhases && milestones.map((m) => {
                    const selected = selectedMilestones.includes(m.id)
                    const amtForRow = progressSplit.amounts.get(m.id)
                    const pctOfRem =
                      remainingBalance > 0 && amtForRow !== undefined
                        ? Math.round((amtForRow / remainingBalance) * 1000) / 10
                        : 0
                    const resolvedAmt = amtForRow ?? 0
                    const cardClass = [
                      'new-invoice-milestone-card',
                      m.invoiced
                        ? 'new-invoice-milestone-card--invoiced'
                        : selected
                          ? 'new-invoice-milestone-card--selected'
                          : 'new-invoice-milestone-card--unselected',
                    ].join(' ')
                    const toggleMilestone = () => {
                      if (m.invoiced) return
                      if (selected) {
                        setSelectedMilestones((prev) => prev.filter((x) => x !== m.id))
                        setMilestoneAmountOverride((prev) => {
                          const next = { ...prev }
                          delete next[m.id]
                          return next
                        })
                      } else {
                        setSelectedMilestones((prev) => [...prev, m.id])
                      }
                    }
                    return (
                      <div key={m.id} className={cardClass}>
                        <div className="new-invoice-milestone-card__inner">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={selected}
                            disabled={m.invoiced}
                            className="new-invoice-milestone-check"
                            onClick={toggleMilestone}
                            aria-label={`Include ${m.label}`}
                          >
                            <span className="new-invoice-milestone-check__box" aria-hidden>
                              {selected && (
                                <svg className="new-invoice-milestone-check__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </span>
                          </button>
                          <div className="new-invoice-milestone-card__body">
                            <div className="new-invoice-milestone-card__header">
                              <div className="new-invoice-milestone-card__name" title={m.label}>
                                {m.label}
                              </div>
                              {m.invoiced ? (
                                <span className="new-invoice-milestone-badge new-invoice-milestone-badge--invoiced">
                                  <span className="new-invoice-milestone-badge__dot new-invoice-milestone-badge__dot--amber" aria-hidden />
                                  Invoiced
                                </span>
                              ) : (
                                <span className="new-invoice-milestone-badge new-invoice-milestone-badge--ready">
                                  <span className="new-invoice-milestone-badge__dot" aria-hidden />
                                  Ready
                                </span>
                              )}
                            </div>
                            <div className="new-invoice-milestone-card__inputs">
                              {m.invoiced ? (
                                <>
                                  <span className="new-invoice-milestone-card__readonly">{m.pct}%</span>
                                  <span className="new-invoice-milestone-card__readonly">{formatCurrency(m.amount)}</span>
                                </>
                              ) : !selected ? (
                                <>
                                  <span className="new-invoice-milestone-card__placeholder">—</span>
                                  <span className="new-invoice-milestone-card__placeholder">—</span>
                                </>
                              ) : (
                                <>
                                  <div className="new-invoice-milestone-pill new-invoice-milestone-pill--pct">
                                    <label className="new-invoice-sr-only" htmlFor={`inv-pct-${m.id}`}>
                                      Percent of remaining balance for {m.label}
                                    </label>
                                    <input
                                      id={`inv-pct-${m.id}`}
                                      type="number"
                                      className="new-invoice-milestone-pill__input"
                                      min={0}
                                      max={100}
                                      step={0.1}
                                      defaultValue={pctOfRem}
                                      key={`pct-${m.id}-${pctOfRem}`}
                                      title="% of remaining balance (blur to apply)"
                                      onBlur={(e) => {
                                        const p = parseFloat(e.target.value)
                                        if (!Number.isFinite(p) || remainingBalance <= 0) return
                                        const capped = Math.min(100, Math.max(0, p))
                                        const amt =
                                          Math.round(remainingBalance * (capped / 100) * 100) / 100
                                        setMilestoneAmountOverride((prev) => ({ ...prev, [m.id]: amt.toFixed(2) }))
                                      }}
                                    />
                                    <span className="new-invoice-milestone-pill__suffix" aria-hidden>%</span>
                                  </div>
                                  <MilestoneAmountInput
                                    key={`${m.id}-${selected}`}
                                    milestoneId={m.id}
                                    resolvedAmount={resolvedAmt}
                                    selected={selected}
                                    onFixedChange={handleMilestoneAmountFixed}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 'manual-info' && (
            <div className="new-invoice-step-grid">
              <div className="estimate-wizard-field estimate-wizard-field--full">
                <label className="estimate-wizard-label">Job</label>
                <select className="estimate-wizard-input" value={activeJobId} onChange={(e) => {
                  const nextJob = e.target.value
                  setActiveJobId(nextJob)
                  const j = jobsById.get(nextJob)
                  setClientName(j?.client_name || '')
                  const em = String(j?.client_email ?? '').trim()
                  setClientEmail(em)
                  setProjectClientEmailSnapshot(em)
                  setClientPhone(j?.client_phone || '')
                }}>
                  <option value="">Select a job</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
              <div className="estimate-wizard-step1-grid">
                <div className="estimate-wizard-field">
                  <label className="estimate-wizard-label">Client Name</label>
                  <input className="estimate-wizard-input" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
                <div className="estimate-wizard-field">
                  <label className="estimate-wizard-label">Client Email</label>
                  <input className="estimate-wizard-input" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                </div>
                <div className="estimate-wizard-field">
                  <label className="estimate-wizard-label">Client Phone</label>
                  <input className="estimate-wizard-input" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 'manual-lines' && (
            <div className="new-invoice-step-grid">
              <div className="estimate-wizard-field estimate-wizard-field--full">
                <label className="estimate-wizard-label">Add from catalog</label>
                <input
                  className="estimate-wizard-input"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="Search products & services"
                />
                <div className="new-invoice-catalog-list">
                  {filteredProducts.slice(0, 8).map((p) => (
                    <button key={p.id} type="button" className="new-invoice-catalog-row" onClick={() => addFromCatalog(p)}>
                      <span>{p.name}</span>
                      <span>{formatCurrency(Number(p.default_unit_price || 0))}/{p.unit || 'ea'}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="new-invoice-lines">
                {manualLines.map((line) => (
                  <div key={line.id} className="new-invoice-line-row">
                    <input className="estimate-wizard-input" placeholder="Description" value={line.description} onChange={(e) => setManualField(line.id, { description: e.target.value })} />
                    <input className="estimate-wizard-input" type="number" min={0} value={line.qty} onChange={(e) => setManualField(line.id, { qty: Number(e.target.value) || 0 })} />
                    <input className="estimate-wizard-input" value={line.unit} onChange={(e) => setManualField(line.id, { unit: e.target.value })} />
                    <input className="estimate-wizard-input" type="number" min={0} step={0.01} value={line.unitPrice} onChange={(e) => setManualField(line.id, { unitPrice: Number(e.target.value) || 0 })} />
                    <div className="new-invoice-line-total">{formatCurrency(line.qty * line.unitPrice)}</div>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost" onClick={() => setManualLines((p) => [...p, initialManualLine()])}>
                  + Add line item
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="new-invoice-step-grid">
              {pathType === 'progress' ? (
                <>
                  <div className="estimate-wizard-field estimate-wizard-field--full new-invoice-payment-schedule">
                    <label className="estimate-wizard-label">Payment schedule</label>
                    <p className="estimate-wizard-helper" style={{ marginTop: 0 }}>
                      Set when each portion is due: a calendar date, or terms tied to phase completion.
                    </p>
                    <div className="new-invoice-payment-schedule-list" role="list">
                      {progressPaymentReviewRows.map(({ m, amt, pctRem }) => {
                        const row = progressPaymentSchedule[m.id] ?? defaultPaymentScheduleRow()
                        const mode = row.mode
                        return (
                          <div key={m.id} className="new-invoice-payment-schedule-card" role="listitem">
                            <div className="new-invoice-payment-schedule-card__inner">
                              <div className="new-invoice-payment-schedule-card__top">
                                <div className="new-invoice-payment-schedule-card__name">{m.label}</div>
                                <div className="new-invoice-payment-schedule-card__amounts" aria-label="Share and amount">
                                  <span className="new-invoice-payment-schedule-card__pct">{pctRem}% of remaining</span>
                                  <span className="new-invoice-payment-schedule-card__dollars">{formatCurrency(amt)}</span>
                                </div>
                              </div>
                              <div className="new-invoice-payment-schedule-card__due">
                                <div className="new-invoice-payment-due-toggle" role="tablist" aria-label={`Due type for ${m.label}`}>
                                  <button
                                    type="button"
                                    role="tab"
                                    aria-selected={mode === 'specific_date'}
                                    className={`new-invoice-payment-due-toggle__btn ${mode === 'specific_date' ? 'new-invoice-payment-due-toggle__btn--active' : ''}`}
                                    onClick={() => updateProgressPaymentRow(m.id, { mode: 'specific_date' })}
                                  >
                                    Specific date
                                  </button>
                                  <button
                                    type="button"
                                    role="tab"
                                    aria-selected={mode === 'on_completion'}
                                    className={`new-invoice-payment-due-toggle__btn ${mode === 'on_completion' ? 'new-invoice-payment-due-toggle__btn--active' : ''}`}
                                    onClick={() => updateProgressPaymentRow(m.id, { mode: 'on_completion' })}
                                  >
                                    On completion
                                  </button>
                                </div>
                                <div className="new-invoice-payment-schedule-card__control">
                                  {mode === 'specific_date' ? (
                                    <input
                                      className="new-invoice-payment-schedule-field"
                                      type="date"
                                      value={row.specificDate}
                                      onChange={(e) => updateProgressPaymentRow(m.id, { specificDate: e.target.value })}
                                      aria-label={`Due date for ${m.label}`}
                                    />
                                  ) : (
                                    <div className="new-invoice-payment-schedule-select-wrap">
                                      <select
                                        className="new-invoice-payment-schedule-select"
                                        value={row.completionTerms}
                                        onChange={(e) =>
                                          updateProgressPaymentRow(m.id, {
                                            completionTerms: e.target.value as CompletionTermsKey,
                                          })
                                        }
                                        aria-label={`Completion terms for ${m.label}`}
                                      >
                                        {COMPLETION_TERM_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                      <span className="new-invoice-payment-schedule-select-chevron" aria-hidden>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M6 9l6 6 6-6" />
                                        </svg>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="new-invoice-section-divider" role="separator" aria-label="Invoice details">
                    <span className="new-invoice-section-divider__line" aria-hidden />
                    <span className="new-invoice-section-divider__label">Invoice details</span>
                    <span className="new-invoice-section-divider__line" aria-hidden />
                  </div>

                  <div className="new-invoice-invoice-details">
                    <div className="estimate-wizard-field estimate-wizard-field--full new-invoice-series-global">
                      <label className="estimate-wizard-label" htmlFor="new-invoice-recipient-email">
                        Recipient email
                      </label>
                      <p className="estimate-wizard-helper" style={{ marginTop: 0 }}>
                        Applies to this invoice and the whole progress series for this estimate.
                      </p>
                      {recipientEmailPrefilled ? (
                        <div className="new-invoice-recipient-email-inner new-invoice-recipient-email-inner--prefilled">
                          <input
                            id="new-invoice-recipient-email"
                            className="estimate-wizard-input new-invoice-recipient-email-input"
                            type="text"
                            inputMode="email"
                            name="invoice-recipient-email"
                            value={clientEmail}
                            readOnly
                            autoComplete="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-bwignore="true"
                            data-form-type="other"
                            aria-label="Recipient email, pre-filled from project"
                            title="Pre-filled from project."
                          />
                          <div className="new-invoice-recipient-email-suffix">
                            <svg
                              className="new-invoice-recipient-email-check"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden
                            >
                              <path
                                d="M20 6L9 17l-5-5"
                                stroke="rgb(22, 163, 74)"
                                strokeWidth="2.25"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <button
                              type="button"
                              className="new-invoice-recipient-email-change"
                              onClick={() => setRecipientEmailUnlocked(true)}
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      ) : (
                        <input
                          id="new-invoice-recipient-email"
                          className="estimate-wizard-input"
                          type="email"
                          name="invoice-recipient-email"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          autoComplete="email"
                          placeholder="client@example.com"
                        />
                      )}
                    </div>

                    <div className="estimate-wizard-field estimate-wizard-field--full new-invoice-series-global">
                      <label className="estimate-wizard-label" htmlFor="new-invoice-notes">
                        Notes
                      </label>
                      <p className="estimate-wizard-helper" style={{ marginTop: 0 }}>
                        Visible to client on all invoices in this series
                      </p>
                      <div className="new-invoice-detail-textarea-wrap">
                        <textarea
                          id="new-invoice-notes"
                          className="estimate-wizard-input estimate-wizard-textarea new-invoice-detail-textarea"
                          value={notes}
                          maxLength={INVOICE_DETAIL_TEXT_MAX}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                        <span className="new-invoice-detail-textarea-counter" aria-live="polite">
                          {notes.length} / {INVOICE_DETAIL_TEXT_MAX}
                        </span>
                      </div>
                    </div>

                    <div className="estimate-wizard-field estimate-wizard-field--full new-invoice-series-global">
                      <label className="estimate-wizard-label" htmlFor="new-invoice-terms">
                        Terms
                      </label>
                      <p className="estimate-wizard-helper" style={{ marginTop: 0 }}>
                        Payment terms, late fees, warranty info
                      </p>
                      <div className="new-invoice-detail-textarea-wrap">
                        <textarea
                          id="new-invoice-terms"
                          className="estimate-wizard-input estimate-wizard-textarea new-invoice-detail-textarea"
                          value={terms}
                          maxLength={INVOICE_DETAIL_TEXT_MAX}
                          onChange={(e) => setTerms(e.target.value)}
                        />
                        <span className="new-invoice-detail-textarea-counter" aria-live="polite">
                          {terms.length} / {INVOICE_DETAIL_TEXT_MAX}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="new-invoice-review-summary-anchor" aria-label="Invoice summary">
                    <div className="new-invoice-review-summary-anchor__left">
                      <div className="new-invoice-review-summary-anchor__eyebrow">{progressReviewSummaryTitle}</div>
                      <div className="new-invoice-review-summary-anchor__sub">
                        {progressPaymentReviewRows.length === 0
                          ? '—'
                          : `${progressPaymentReviewRows.length} milestone payment${progressPaymentReviewRows.length === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <div className="new-invoice-review-summary-anchor__right">
                      {progressPaymentReviewRows.length > 0 && (
                        <div className="new-invoice-review-summary-anchor__chips" role="group" aria-label="Payment amounts">
                          {progressPaymentReviewRows.map(({ m, amt }, i) => (
                            <Fragment key={m.id}>
                              {i > 0 && <span className="new-invoice-review-summary-anchor__chip-divider" aria-hidden />}
                              <span className="new-invoice-review-summary-anchor__chip">{formatCurrency(amt)}</span>
                            </Fragment>
                          ))}
                        </div>
                      )}
                      <div className="new-invoice-review-summary-anchor__total">
                        Total {formatCurrency(lineSubtotal)}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="estimate-wizard-step1-grid">
                    <div className="estimate-wizard-field">
                      <label className="estimate-wizard-label">Due date</label>
                      <input className="estimate-wizard-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <div className="estimate-wizard-field">
                      <label className="estimate-wizard-label">Recipient email</label>
                      <input className="estimate-wizard-input" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="estimate-wizard-field estimate-wizard-field--full">
                    <label className="estimate-wizard-label">Notes</label>
                    <textarea className="estimate-wizard-input estimate-wizard-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <div className="estimate-wizard-field estimate-wizard-field--full">
                    <label className="estimate-wizard-label">Terms</label>
                    <textarea className="estimate-wizard-input estimate-wizard-textarea" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
                  </div>
                  <div className="new-invoice-review-card">
                    <div className="new-invoice-review-row"><span>Job</span><span>{activeJob?.name || '—'}</span></div>
                    <div className="new-invoice-review-row"><span>Lines</span><span>{reviewLines.length}</span></div>
                    <div className="new-invoice-review-row strong"><span>Total</span><span>{formatCurrency(lineSubtotal)}</span></div>
                  </div>
                </>
              )}
              {error && <div className="new-invoice-error">{error}</div>}
            </div>
          )}

          {step !== 'choose' && (
            <div className="estimate-wizard-nav">
              <button type="button" className="estimate-wizard-nav-back" onClick={goBack}>← Back</button>
              <div className="estimate-wizard-nav-dots" />
              {step !== 'review' ? (
                <button type="button" className="estimate-wizard-nav-next" disabled={!canContinue()} onClick={continueFromStep}>
                  Continue →
                </button>
              ) : (
                <button type="button" className="estimate-wizard-nav-next btn btn-primary" disabled={!canContinue() || saving} onClick={handleCreateAndSend}>
                  {saving ? 'Sending…' : 'Create & Send'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Split remaining approved balance across selected milestones: equal by default, optional $ overrides.
 * Rows with an override string (parsed as dollars) are fixed; the rest share the leftover equally.
 */
function computeProgressSplit(
  remaining: number,
  selectedIds: string[],
  milestones: ProgressMilestone[],
  overrides: Record<string, string>
): {
  amounts: Map<string, number>
  pctsOfRemaining: Map<string, number>
  error: string | null
  total: number
} {
  const eligible = selectedIds.filter((id) => {
    const row = milestones.find((x) => x.id === id)
    return row && !row.invoiced
  })

  if (eligible.length === 0) {
    return { amounts: new Map(), pctsOfRemaining: new Map(), error: null, total: 0 }
  }

  const rem = round2(Math.max(0, remaining))
  if (rem <= 0) {
    return {
      amounts: new Map(),
      pctsOfRemaining: new Map(),
      error: 'No remaining balance to invoice.',
      total: 0,
    }
  }

  const fixed: { id: string; amt: number }[] = []
  let fixedSum = 0
  const autoIds: string[] = []

  for (const id of eligible) {
    const raw = overrides[id]?.trim()
    if (raw !== undefined && raw !== '') {
      const v = parseFloat(raw.replace(/,/g, ''))
      if (!Number.isFinite(v) || v < 0) {
        return {
          amounts: new Map(),
          pctsOfRemaining: new Map(),
          error: 'Enter a valid dollar amount, or clear the field to use the equal split.',
          total: 0,
        }
      }
      const a = round2(v)
      fixed.push({ id, amt: a })
      fixedSum += a
    } else {
      autoIds.push(id)
    }
  }

  if (fixedSum > rem + 0.01) {
    return {
      amounts: new Map(),
      pctsOfRemaining: new Map(),
      error: 'Fixed amounts exceed the remaining balance.',
      total: 0,
    }
  }

  const autoTotal = round2(rem - fixedSum)

  if (autoIds.length === 0) {
    const amounts = new Map<string, number>()
    const pcts = new Map<string, number>()
    let total = 0
    for (const { id, amt } of fixed) {
      amounts.set(id, amt)
      total += amt
      pcts.set(id, rem > 0 ? round1((amt / rem) * 100) : 0)
    }
    if (total > rem + 0.02) {
      return {
        amounts: new Map(),
        pctsOfRemaining: new Map(),
        error: 'Invoice total exceeds remaining balance.',
        total: 0,
      }
    }
    return { amounts, pctsOfRemaining: pcts, error: null, total: round2(total) }
  }

  if (autoTotal < -0.01) {
    return {
      amounts: new Map(),
      pctsOfRemaining: new Map(),
      error: 'Fixed amounts exceed the remaining balance.',
      total: 0,
    }
  }

  const autoParts = splitMoneyEqually(autoTotal, autoIds.length)
  const amounts = new Map<string, number>()
  let i = 0
  for (const id of autoIds) {
    amounts.set(id, autoParts[i++] ?? 0)
  }
  for (const { id, amt } of fixed) {
    amounts.set(id, amt)
  }

  let total = 0
  const pcts = new Map<string, number>()
  for (const id of eligible) {
    const a = amounts.get(id) ?? 0
    total += a
    pcts.set(id, rem > 0 ? round1((a / rem) * 100) : 0)
  }

  if (total > rem + 0.02) {
    return {
      amounts: new Map(),
      pctsOfRemaining: new Map(),
      error: 'Invoice total exceeds remaining balance.',
      total: 0,
    }
  }

  return { amounts, pctsOfRemaining: pcts, error: null, total: round2(total) }
}
