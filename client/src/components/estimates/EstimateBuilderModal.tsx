import { useState, useEffect } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Job, CustomProduct, PipelineMilestone } from '@/types/global'
import { formatCurrency } from '@/lib/pipeline'
import { USE_MOCK_ESTIMATES, MOCK_CUSTOM_PRODUCTS } from '@/data/mockEstimatesData'

const STEPS = [
  { num: 1, label: 'Job & Client', icon: '🏗' },
  { num: 2, label: 'Line Items', icon: '📋' },
  { num: 3, label: 'Terms & Review', icon: '✅' },
]

const UNIT_OPTIONS = ['hr', 'sf', 'lf', 'ea', 'day', 'gal', 'sheet']

type WizardLine = {
  id: number
  productId: string | null
  name: string
  qty: number
  unit: string
  price: number
  notes: string
}

type WizardData = {
  jobId: string
  client: string
  title: string
  date: string
  lines: WizardLine[]
  notes: string
  useProgress: boolean
  milestones: { label: string; pct: number }[]
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
  onSave: (estimateId: string, payload?: NewEstimatePayload) => void
}

function getProductCategory(p: CustomProduct): string {
  const t = (p.item_type ?? '').toLowerCase()
  if (t === 'labor') return 'Labor'
  if (t === 'service') return 'Services'
  return 'Materials'
}

export function EstimateBuilderModal({
  jobs,
  onClose,
  onSave,
}: EstimateBuilderModalProps) {
  const dateStr = new Date().toLocaleDateString('en-US')
  const [step, setStep] = useState(1)
  const [saved, setSaved] = useState(false)
  const [products, setProducts] = useState<CustomProduct[]>([])
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<WizardData>({
    jobId: jobs[0]?.id ?? '',
    client: '',
    title: 'Estimate',
    date: dateStr,
    lines: [],
    notes: '',
    useProgress: false,
    milestones: [
      { label: 'Deposit', pct: 30 },
      { label: 'Rough-in', pct: 40 },
      { label: 'Completion', pct: 30 },
    ],
  })

  useEffect(() => {
    if (USE_MOCK_ESTIMATES) {
      setProducts(MOCK_CUSTOM_PRODUCTS)
      return
    }
    estimatesApi.getCustomProducts().then(setProducts).catch(() => setProducts([]))
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const total = data.lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0
  )
  const jobName = jobs.find((j) => j.id === data.jobId)?.name ?? data.jobId

  const canNext = () => {
    if (step === 1) return !!data.jobId
    if (step === 2) return data.lines.length > 0
    return true
  }

  const handleSave = async (asDraft: boolean) => {
    const payload: NewEstimatePayload = {
      id: `est-${Date.now()}`,
      job_id: data.jobId,
      jobName,
      amount: total,
      date: data.date,
      title: data.title,
      milestones:
        data.useProgress && data.milestones.length > 0
          ? data.milestones.map((m) => ({
              label: m.label,
              pct: m.pct,
              amount: Math.round((total * m.pct) / 100),
              status: 'pending' as const,
            }))
          : [],
    }
    if (USE_MOCK_ESTIMATES) {
      onSave(payload.id, payload)
      setSaved(true)
      return
    }
    setSaving(true)
    try {
      const created = await estimatesApi.createEstimate({
        job_id: data.jobId || undefined,
        title: data.title,
      })
      const eid = created.id
      for (const line of data.lines) {
        await estimatesApi.addLineItem(eid, {
          description: line.name || 'Custom item',
          quantity: line.qty,
          unit: line.unit,
          unit_price: line.price,
        })
      }
      await estimatesApi.updateEstimate(eid, { total_amount: total })
      onSave(eid)
      setSaved(true)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setData({
      jobId: jobs[0]?.id ?? '',
      client: '',
      title: 'Estimate',
      date: new Date().toLocaleDateString('en-US'),
      lines: [],
      notes: '',
      useProgress: false,
      milestones: [
        { label: 'Deposit', pct: 30 },
        { label: 'Rough-in', pct: 40 },
        { label: 'Completion', pct: 30 },
      ],
    })
    setStep(1)
    setSaved(false)
  }

  // ─── Success state ─────────────────────────────────────────────────────────
  if (saved) {
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
            Estimate saved
          </h2>
          <p className="estimate-wizard-success-job">{jobName?.split('–')[0]?.trim() ?? jobName}</p>
          <p className="estimate-wizard-success-total">{formatCurrency(total)}</p>
          <div className="estimate-wizard-success-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              New Estimate
            </button>
          </div>
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
              New Estimate
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
              <Step1JobClient
                jobs={jobs}
                data={data}
                setData={setData}
              />
            )}
            {step === 2 && (
              <Step2LineItems
                products={products}
                data={data}
                setData={setData}
              />
            )}
            {step === 3 && (
              <Step3TermsReview
                jobs={jobs}
                data={data}
                setData={setData}
              />
            )}
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
            {step < 3 ? (
              <button
                type="button"
                className="estimate-wizard-nav-next"
                onClick={() => canNext() && setStep((s) => s + 1)}
                disabled={!canNext()}
              >
                Continue →
              </button>
            ) : (
              <div className="estimate-wizard-nav-final">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                >
                  Save as draft
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleSave(false)}
                  disabled={
                    saving ||
                    (data.useProgress &&
                      data.milestones.reduce((s, m) => s + (Number(m.pct) || 0), 0) !== 100)
                  }
                >
                  {saving ? 'Saving…' : 'Save & Send →'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 1: Job & Client ────────────────────────────────────────────────────
function Step1JobClient({
  jobs,
  data,
  setData,
}: {
  jobs: Job[]
  data: WizardData
  setData: React.Dispatch<React.SetStateAction<WizardData>>
}) {
  return (
    <div className="estimate-wizard-step estimate-wizard-step1">
      <div className="estimate-wizard-step-head">
        <h3 className="estimate-wizard-step-title">Which job is this for?</h3>
        <p className="estimate-wizard-step-sub">Select an existing job.</p>
      </div>

      <div className="estimate-wizard-field">
        <label className="estimate-wizard-label">Job</label>
        <div className="estimate-wizard-job-grid">
          {jobs.map((j) => {
            const selected = data.jobId === j.id
            const namePart = j.name.split('–')[0]?.trim() ?? j.name
            const addrPart = j.name.includes('–') ? j.name.split('–')[1]?.trim() : null
            return (
              <button
                key={j.id}
                type="button"
                className={`estimate-wizard-job-btn ${selected ? 'selected' : ''}`}
                onClick={() => setData((d) => ({ ...d, jobId: j.id }))}
              >
                <div className="estimate-wizard-job-btn-name">{namePart}</div>
                {addrPart && (
                  <div className="estimate-wizard-job-btn-addr">{addrPart}</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="estimate-wizard-meta-row">
        <div className="estimate-wizard-field">
          <label className="estimate-wizard-label">Estimate Title</label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
            placeholder="e.g. Estimate, Revised Estimate…"
            className="estimate-wizard-input"
          />
        </div>
        <div className="estimate-wizard-field">
          <label className="estimate-wizard-label">Date</label>
          <input
            type="text"
            value={data.date}
            onChange={(e) => setData((d) => ({ ...d, date: e.target.value }))}
            className="estimate-wizard-input"
          />
        </div>
      </div>

      <div className="estimate-wizard-field">
        <label className="estimate-wizard-label">Client email</label>
        <input
          type="email"
          value={data.client}
          onChange={(e) => setData((d) => ({ ...d, client: e.target.value }))}
          placeholder="client@example.com"
          className="estimate-wizard-input"
        />
      </div>
    </div>
  )
}

// ─── Step 2: Line Items ───────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Labor', 'Materials', 'Services'] as const

function Step2LineItems({
  products,
  data,
  setData,
}: {
  products: CustomProduct[]
  data: WizardData
  setData: React.Dispatch<React.SetStateAction<WizardData>>
}) {
  const [catFilter, setCatFilter] = useState<string>('All')
  const [expandedLineId, setExpandedLineId] = useState<number | null>(null)

  const filtered =
    catFilter === 'All'
      ? products
      : products.filter((p) => getProductCategory(p) === catFilter)

  const addFromCatalog = (product: CustomProduct) => {
    const existing = data.lines.find((l) => l.productId === product.id)
    if (existing) {
      setData((d) => ({
        ...d,
        lines: d.lines.map((l) =>
          l.productId === product.id ? { ...l, qty: l.qty + 1 } : l
        ),
      }))
    } else {
      setData((d) => ({
        ...d,
        lines: [
          ...d.lines,
          {
            id: Date.now(),
            productId: product.id,
            name: product.name,
            qty: 1,
            unit: product.unit,
            price: product.default_unit_price,
            notes: '',
          },
        ],
      }))
    }
  }

  const updateLine = (id: number, field: keyof WizardLine, val: string | number) => {
    setData((d) => ({
      ...d,
      lines: d.lines.map((l) => (l.id === id ? { ...l, [field]: val } : l)),
    }))
  }

  const removeLine = (id: number) => {
    setData((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }))
  }

  const addCustom = () => {
    setData((d) => ({
      ...d,
      lines: [
        ...d.lines,
        {
          id: Date.now(),
          productId: null,
          name: '',
          qty: 1,
          unit: 'ea',
          price: 0,
          notes: '',
        },
      ],
    }))
  }

  const total = data.lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0
  )

  return (
    <div className="estimate-wizard-step estimate-wizard-step2">
      <div className="estimate-wizard-step-head">
        <h3 className="estimate-wizard-step-title">What&apos;s included?</h3>
        <p className="estimate-wizard-step-sub">
          Add from your catalog or create custom line items.
        </p>
      </div>

      <div className="estimate-wizard-step2-grid">
        {/* Catalog */}
        <div className="estimate-wizard-catalog">
          <div className="estimate-wizard-catalog-header">
            <label className="estimate-wizard-label" style={{ marginBottom: 0 }}>
              Catalog
            </label>
            <div className="estimate-wizard-cat-tabs">
              {CATEGORIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`estimate-wizard-cat-tab ${catFilter === f ? 'active' : ''}`}
                  onClick={() => setCatFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="estimate-wizard-catalog-list">
            {filtered.map((p) => {
              const cat = getProductCategory(p)
              const inLines = data.lines.find((l) => l.productId === p.id)
              const catClass =
                cat === 'Labor'
                  ? 'labor'
                  : cat === 'Materials'
                    ? 'materials'
                    : 'services'
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`estimate-wizard-catalog-item ${inLines ? 'added' : ''} ${catClass}`}
                  onClick={() => addFromCatalog(p)}
                >
                  <div className="estimate-wizard-catalog-item-main">
                    <div className="estimate-wizard-catalog-item-name">{p.name}</div>
                    <div className="estimate-wizard-catalog-item-desc">
                      {p.description ?? ''}
                    </div>
                  </div>
                  <div className="estimate-wizard-catalog-item-right">
                    <div className="estimate-wizard-catalog-item-price">
                      {formatCurrency(p.default_unit_price)}
                      <span>/{p.unit}</span>
                    </div>
                    {inLines ? (
                      <div className="estimate-wizard-catalog-item-added">
                        ✓ Added ({inLines.qty})
                      </div>
                    ) : (
                      <div className="estimate-wizard-catalog-item-add">+ Add</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="estimate-wizard-custom-btn"
            onClick={addCustom}
          >
            + Custom line item
          </button>
        </div>

        {/* Lines */}
        <div className="estimate-wizard-lines">
          <div className="estimate-wizard-lines-header">
            <label className="estimate-wizard-label" style={{ marginBottom: 0 }}>
              Estimate Lines
            </label>
            <span className="estimate-wizard-lines-count">{data.lines.length} items</span>
          </div>

          {data.lines.length === 0 ? (
            <div className="estimate-wizard-lines-empty">
              <div className="estimate-wizard-lines-empty-icon">←</div>
              <div className="estimate-wizard-lines-empty-text">
                Select items from the catalog
              </div>
            </div>
          ) : (
            <div className="estimate-wizard-lines-list">
              {data.lines.map((line) => {
                const expanded = expandedLineId === line.id
                return (
                  <div key={line.id} className="estimate-wizard-line-wrap">
                    <div
                      role="button"
                      tabIndex={0}
                      className={`estimate-wizard-line ${expanded ? 'expanded' : ''}`}
                      onClick={() =>
                        setExpandedLineId(expanded ? null : line.id)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setExpandedLineId(expanded ? null : line.id)
                        }
                      }}
                    >
                      <div className="estimate-wizard-line-main">
                        {line.productId ? (
                          <div className="estimate-wizard-line-name">{line.name}</div>
                        ) : (
                          <input
                            value={line.name}
                            onChange={(e) => {
                              e.stopPropagation()
                              updateLine(line.id, 'name', e.target.value)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Custom item…"
                            className="estimate-wizard-line-name-input"
                          />
                        )}
                      </div>
                      <div className="estimate-wizard-line-qty">
                        <button
                          type="button"
                          className="estimate-wizard-qty-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            updateLine(
                              line.id,
                              'qty',
                              Math.max(1, (Number(line.qty) || 1) - 1)
                            )
                          }}
                        >
                          −
                        </button>
                        <span className="estimate-wizard-qty-val">{line.qty}</span>
                        <button
                          type="button"
                          className="estimate-wizard-qty-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            updateLine(line.id, 'qty', (Number(line.qty) || 1) + 1)
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div className="estimate-wizard-line-total">
                        {formatCurrency(
                          (Number(line.qty) || 0) * (Number(line.price) || 0)
                        )}
                      </div>
                      <button
                        type="button"
                        className="estimate-wizard-line-remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeLine(line.id)
                        }}
                        aria-label="Remove line"
                      >
                        ×
                      </button>
                    </div>
                    {expanded && (
                      <div className="estimate-wizard-line-expanded">
                        <div className="estimate-wizard-line-expanded-row">
                          <div>
                            <label className="estimate-wizard-label estimate-wizard-label--sm">
                              Unit price
                            </label>
                            <div className="estimate-wizard-line-price-row">
                              <span className="estimate-wizard-currency">$</span>
                              <input
                                type="number"
                                value={line.price}
                                onChange={(e) =>
                                  updateLine(line.id, 'price', e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="estimate-wizard-input estimate-wizard-input--sm"
                              />
                              <select
                                value={line.unit}
                                onChange={(e) =>
                                  updateLine(line.id, 'unit', e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="estimate-wizard-input estimate-wizard-input--unit"
                              >
                                {UNIT_OPTIONS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="estimate-wizard-label estimate-wizard-label--sm">
                              Notes
                            </label>
                            <input
                              value={line.notes}
                              onChange={(e) =>
                                updateLine(line.id, 'notes', e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Optional note…"
                              className="estimate-wizard-input estimate-wizard-input--sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {data.lines.length > 0 && (
            <div className="estimate-wizard-total-card">
              <span className="estimate-wizard-total-label">Estimate Total</span>
              <span className="estimate-wizard-total-value">
                {formatCurrency(total)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Terms & Review ────────────────────────────────────────────────────
function Step3TermsReview({
  jobs,
  data,
  setData,
}: {
  jobs: Job[]
  data: WizardData
  setData: React.Dispatch<React.SetStateAction<WizardData>>
}) {
  const total = data.lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0
  )
  const milestonePctTotal = data.milestones.reduce(
    (s, m) => s + (Number(m.pct) || 0),
    0
  )
  const jobName = jobs.find((j) => j.id === data.jobId)?.name ?? data.jobId

  return (
    <div className="estimate-wizard-step estimate-wizard-step3">
      <div className="estimate-wizard-step-head">
        <h3 className="estimate-wizard-step-title">Terms & review</h3>
        <p className="estimate-wizard-step-sub">
          Set payment terms and confirm everything looks right.
        </p>
      </div>

      {/* Summary */}
      <div className="estimate-wizard-summary">
        <div className="estimate-wizard-summary-grid">
          <div>
            <div className="estimate-wizard-label">Job</div>
            <div className="estimate-wizard-summary-val">
              {jobName?.split('–')[0]?.trim() ?? '—'}
            </div>
          </div>
          <div>
            <div className="estimate-wizard-label">Client</div>
            <div className="estimate-wizard-summary-val">
              {data.client || '—'}
            </div>
          </div>
          <div>
            <div className="estimate-wizard-label">Total</div>
            <div className="estimate-wizard-summary-val estimate-wizard-summary-val--total">
              {formatCurrency(total)}
            </div>
          </div>
        </div>
        <div className="estimate-wizard-summary-lines">
          <div className="estimate-wizard-label">Line items</div>
          {data.lines.map((l) => (
            <div key={l.id} className="estimate-wizard-summary-line">
              <span>
                {l.name || 'Custom item'} × {l.qty} {l.unit}
              </span>
              <span>
                {formatCurrency(
                  (Number(l.qty) || 0) * (Number(l.price) || 0)
                )}
              </span>
            </div>
          ))}
          {data.lines.length === 0 && (
            <div className="estimate-wizard-summary-empty">No line items added</div>
          )}
        </div>
      </div>

      {/* Progress invoicing */}
      <div className="estimate-wizard-progress-section">
        <div className="estimate-wizard-progress-head">
          <div>
            <div className="estimate-wizard-progress-title">Progress Invoicing</div>
            <p className="estimate-wizard-progress-sub">
              Split into milestone-based invoices
            </p>
          </div>
          <button
            type="button"
            className={`estimate-wizard-toggle ${data.useProgress ? 'on' : ''}`}
            onClick={() =>
              setData((d) => ({
                ...d,
                useProgress: !d.useProgress,
                milestones:
                  d.milestones.length > 0
                    ? d.milestones
                    : [
                        { label: 'Deposit', pct: 30 },
                        { label: 'Rough-in', pct: 40 },
                        { label: 'Completion', pct: 30 },
                      ],
              }))
            }
            aria-pressed={data.useProgress}
          >
            <span className="estimate-wizard-toggle-thumb" />
          </button>
        </div>

        {data.useProgress && (
          <div className="estimate-wizard-milestones-card">
            <div className="estimate-wizard-milestones-header">
              <span>Milestone</span>
              <span>% of est.</span>
              <span>Amount</span>
              <span />
            </div>
            {data.milestones.map((m, i) => (
              <div key={i} className="estimate-wizard-milestones-row">
                <input
                  value={m.label}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      milestones: d.milestones.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x
                      ),
                    }))
                  }
                  placeholder="Milestone…"
                  className="estimate-wizard-input estimate-wizard-input--milestone"
                />
                <div className="estimate-wizard-milestone-pct">
                  <input
                    type="number"
                    value={m.pct}
                    onChange={(e) =>
                      setData((d) => ({
                        ...d,
                        milestones: d.milestones.map((x, j) =>
                          j === i
                            ? { ...x, pct: parseInt(e.target.value, 10) || 0 }
                            : x
                        ),
                      }))
                    }
                    className="estimate-wizard-input estimate-wizard-input--num estimate-wizard-input--sm"
                  />
                  <span>%</span>
                </div>
                <div className="estimate-wizard-milestone-amount">
                  {formatCurrency((m.pct / 100) * total)}
                </div>
                <button
                  type="button"
                  className="estimate-wizard-line-remove"
                  onClick={() =>
                    setData((d) => ({
                      ...d,
                      milestones: d.milestones.filter((_, j) => j !== i),
                    }))
                  }
                  aria-label="Remove milestone"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="estimate-wizard-milestones-footer">
              <button
                type="button"
                className="estimate-wizard-milestone-add"
                onClick={() =>
                  setData((d) => ({
                    ...d,
                    milestones: [...d.milestones, { label: '', pct: 0 }],
                  }))
                }
              >
                + Add milestone
              </button>
              <span
                className={
                  milestonePctTotal === 100
                    ? 'estimate-wizard-milestone-ok'
                    : 'estimate-wizard-milestone-err'
                }
              >
                {milestonePctTotal}%{' '}
                {milestonePctTotal === 100 ? '✓ Balanced' : '— must equal 100%'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="estimate-wizard-field">
        <label className="estimate-wizard-label">Notes / Terms</label>
        <textarea
          value={data.notes}
          onChange={(e) => setData((d) => ({ ...d, notes: e.target.value }))}
          rows={3}
          placeholder="Payment terms, warranty notes, special conditions, thank-you message…"
          className="estimate-wizard-input estimate-wizard-textarea"
        />
      </div>
    </div>
  )
}
