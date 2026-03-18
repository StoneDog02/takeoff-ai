import { useState, useEffect, useRef } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Job, CustomProduct } from '@/types/global'
import type { EstimateLineItem } from '@/types/global'
import { USE_MOCK_ESTIMATES, MOCK_CUSTOM_PRODUCTS } from '@/data/mockEstimatesData'
import { EstimateInvoiceFormView } from './EstimateInvoiceFormView'

const UNIT_OPTIONS = ['ea', 'hr', 'sqft', 'lf', 'gal', 'sheet', 'load', 'flat']

function catalogCategoryClass(itemType: string | undefined): string {
  if (!itemType) return 'materials'
  const t = itemType.toLowerCase()
  if (t === 'labor') return 'labor'
  if (t === 'sub') return 'sub'
  if (t === 'equipment') return 'materials'
  if (t === 'material') return 'materials'
  if (t === 'service') return 'service'
  return 'materials'
}

type LineRow = {
  id: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  product_id: string | null
  section: string
}

/** Optional seed for a new estimate (e.g. from takeoff + awarded bids). */
export type InitialEstimateLine = {
  description: string
  quantity: number
  unit: string
  unit_price: number
  section?: string
  subcontractor_note?: string
  subcontractor_name?: string
}

interface EstimateBuilderProps {
  jobs: Job[]
  estimateId?: string | null
  /** When creating a new estimate, pre-fill job (e.g. current project). */
  initialJobId?: string | null
  /** When creating a new estimate, pre-fill lines (e.g. from takeoff + awarded bid sheet). */
  initialLines?: InitialEstimateLine[] | null
  onClose: () => void
  onSaved: (estimateId: string) => void
}

export function EstimateBuilder({
  jobs,
  estimateId: initialEstimateId,
  initialJobId,
  initialLines,
  onClose,
  onSaved,
}: EstimateBuilderProps) {
  const [estimateId, setEstimateId] = useState<string | null>(initialEstimateId ?? null)
  const [jobId, setJobId] = useState<string>(initialJobId ?? jobs[0]?.id ?? '')
  const [title, setTitle] = useState('Estimate')
  const [lines, setLines] = useState<LineRow[]>([])
  const [loading, setLoading] = useState(!initialEstimateId)
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<CustomProduct[]>([])
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [mode, setMode] = useState<'build' | 'preview'>('build')
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set())
  const catalogRef = useRef<HTMLDivElement>(null)

  const catalogFiltered =
    catalogQuery.trim().length > 0
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(catalogQuery.toLowerCase()) ||
            (p.description ?? '').toLowerCase().includes(catalogQuery.toLowerCase()) ||
            (p.item_type ?? '').toLowerCase().includes(catalogQuery.toLowerCase())
        )
      : products

  useEffect(() => {
    if (USE_MOCK_ESTIMATES) {
      setProducts(MOCK_CUSTOM_PRODUCTS)
      return
    }
    estimatesApi.getCustomProducts().then(setProducts).catch(() => setProducts([]))
  }, [])

  useEffect(() => {
    if (estimateId) {
      setLoading(true)
      estimatesApi
        .getEstimate(estimateId)
        .then((est) => {
          setJobId(est.job_id)
          setTitle(est.title)
          setLines(
            (est.line_items || []).map((li) => ({
              id: li.id,
              description: li.description,
              quantity: li.quantity,
              unit: li.unit,
              unit_price: li.unit_price,
              total: li.total,
              product_id: li.product_id ?? (li as { custom_product_id?: string }).custom_product_id ?? null,
              section: li.section ?? '',
            }))
          )
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      if (initialLines?.length) {
        setLines(
          initialLines.map((l, i) => ({
            id: `seed-${i}-${Date.now()}`,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unit_price: l.unit_price,
            total: (l.quantity ?? 1) * (l.unit_price ?? 0),
            product_id: null,
            section: l.section ?? '',
          }))
        )
      } else {
        setLines([])
      }
      if (initialJobId != null) setJobId(initialJobId)
      setLoading(false)
    }
  }, [estimateId, initialJobId, initialLines])

  const subtotal = lines.reduce((sum, l) => sum + l.total, 0)

  const addCustomLine = () => {
    const newLine: LineRow = {
      id: `new-${Date.now()}`,
      description: '',
      quantity: 1,
      unit: 'ea',
      unit_price: 0,
      total: 0,
      product_id: null,
      section: '',
    }
    setLines((prev) => [...prev, newLine])
  }

  const addFromProduct = (p: CustomProduct) => {
    const newLine: LineRow = {
      id: `new-${Date.now()}`,
      description: p.description ?? '',
      quantity: 1,
      unit: p.unit,
      unit_price: p.default_unit_price,
      total: p.default_unit_price,
      product_id: p.id,
      section: p.name,
    }
    setLines((prev) => [...prev, newLine])
    setCatalogQuery('')
    setCatalogOpen(false)
  }

  const toggleLineExpanded = (lineId: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const updateLine = (idx: number, updates: Partial<LineRow>) => {
    setLines((prev) => {
      const next = [...prev]
      const row = { ...next[idx], ...updates }
      if (
        updates.quantity !== undefined ||
        updates.unit_price !== undefined
      ) {
        row.total = (row.quantity ?? next[idx].quantity) * (row.unit_price ?? next[idx].unit_price)
      }
      next[idx] = row
      return next
    })
  }

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const save = async () => {
    if (USE_MOCK_ESTIMATES) return
    if (!estimateId && !jobId) {
      alert('Please select a job.')
      return
    }
    setSaving(true)
    try {
      let eid = estimateId
      if (!eid) {
        const created = await estimatesApi.createEstimate({
          job_id: jobId || undefined,
          title,
        })
        eid = created.id
        setEstimateId(eid)
      } else {
        await estimatesApi.updateEstimate(eid, {
          job_id: jobId,
          title,
          total_amount: subtotal,
        })
        const existing = await estimatesApi.getEstimate(eid)
        for (const li of existing.line_items) {
          await estimatesApi.deleteLineItem(eid, li.id)
        }
      }
      for (const line of lines) {
        await estimatesApi.addLineItem(eid!, {
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unit_price: line.unit_price,
          ...(line.product_id ? { custom_product_id: line.product_id } : {}),
          ...(line.section.trim() ? { section: line.section.trim() } : {}),
        })
      }
      await estimatesApi.updateEstimate(eid!, { total_amount: subtotal })
      onSaved(eid!)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const [notes, setNotes] = useState('')
  const [estimateDate, setEstimateDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (!catalogOpen) return
    const handleClick = (e: MouseEvent) => {
      if (catalogRef.current && !catalogRef.current.contains(e.target as Node)) {
        setCatalogOpen(false)
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [catalogOpen])

  if (loading && estimateId) {
    return <div className="estimates-content-empty">Loading…</div>
  }

  const previewLineItems: EstimateLineItem[] = lines.map((l) => ({
    id: l.id,
    estimate_id: estimateId ?? 'preview',
    product_id: l.product_id,
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    unit_price: l.unit_price,
    total: l.total,
    section: l.section || (l.product_id ? products.find((p) => p.id === l.product_id)?.name ?? null : null),
  }))
  const jobName = jobs.find((j) => j.id === jobId)?.name ?? '—'

  return (
    <div className="estimates-builder-wrap flex flex-col min-h-0 flex-1 w-full">
      <div className="estimates-builder-top">
        <div className="estimates-builder-top-left">
          <button type="button" className="btn btn-ghost estimates-builder-back" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <div className="estimates-builder-divider" aria-hidden />
          <h2 className="estimates-builder-title">{estimateId ? 'Edit Estimate' : 'New Estimate'}</h2>
        </div>
        <div className="estimates-builder-top-right" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="estimates-mode-toggle">
            <button
              type="button"
              className={`estimates-mode-toggle-btn ${mode === 'build' ? 'active' : ''}`}
              onClick={() => setMode('build')}
            >
              Build
            </button>
            <button
              type="button"
              className={`estimates-mode-toggle-btn ${mode === 'preview' ? 'active' : ''}`}
              onClick={() => setMode('preview')}
            >
              Preview
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save estimate'}
          </button>
        </div>
      </div>

      {mode === 'preview' ? (
        <div className="estimates-builder-layout estimates-builder-layout--single" style={{ marginTop: 16 }}>
          <EstimateInvoiceFormView
            type="estimate"
            documentId={estimateId ?? 'preview'}
            jobName={jobName}
            date={estimateDate}
            status="draft"
            recipientEmails={[]}
            lineItems={previewLineItems}
            total={subtotal}
            embedded
          />
        </div>
      ) : (
        <div className="estimates-builder-layout estimates-builder-layout--single" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header card */}
          <div className="est-card">
            <div className="estimates-builder-meta-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
              <div className="estimates-builder-field">
                <div className="estimates-builder-label">Job</div>
                <select
                  id="est-job"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="estimates-catalog-search-input"
                  style={{ width: '100%' }}
                >
                  <option value="">Select job</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </select>
              </div>
              <div className="estimates-builder-field">
                <div className="estimates-builder-label">Title</div>
                <input
                  id="est-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Estimate, Phase 1 Quote…"
                  className="estimates-catalog-search-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="estimates-builder-field">
                <div className="estimates-builder-label">Date</div>
                <input
                  type="date"
                  value={estimateDate}
                  onChange={(e) => setEstimateDate(e.target.value)}
                  className="estimates-catalog-search-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Line items card */}
          <div className="estimates-line-items-card">
            <div className="estimates-line-items-card-header">
              <div>
                <div className="estimates-line-items-card-title">Line Items</div>
                <div className="estimates-line-items-card-sub">
                  {lines.length} item{lines.length !== 1 ? 's' : ''} · ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} subtotal
                </div>
              </div>
              <div className="estimates-line-items-card-actions" ref={catalogRef} style={{ position: 'relative' }}>
                <div className="estimates-catalog-search">
                  <span className="estimates-catalog-search-icon" aria-hidden>⌕</span>
                  <input
                    type="text"
                    placeholder="Search catalog…"
                    value={catalogQuery}
                    onChange={(e) => { setCatalogQuery(e.target.value); setCatalogOpen(true) }}
                    onFocus={() => setCatalogOpen(true)}
                    className="estimates-catalog-search-input"
                  />
                  {catalogOpen && (
                    <div className={`estimates-catalog-dropdown estimates-catalog-dropdown--search`} role="listbox">
                      {catalogFiltered.length === 0 ? (
                        <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)' }}>No matches found</div>
                      ) : (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 4 }}>
                          {catalogFiltered.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                role="option"
                                className="estimates-catalog-dropdown-item"
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', justifyContent: 'flex-start', width: '100%', textAlign: 'left' }}
                                onClick={() => addFromProduct(p)}
                              >
                                <span className={`estimates-catalog-dropdown-item-cat ${catalogCategoryClass(p.item_type)}`}>
                                  {p.item_type === 'labor'
                                    ? 'Labor'
                                    : p.item_type === 'service'
                                      ? 'Service'
                                      : p.item_type === 'sub'
                                        ? 'Sub'
                                        : p.item_type === 'equipment'
                                          ? 'Equipment'
                                          : p.item_type === 'material'
                                            ? 'Material'
                                            : 'Materials'}
                                </span>
                                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
                                <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                                  ${Number(p.default_unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}/{p.unit}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-primary" onClick={addCustomLine}>
                  + Add line
                </button>
              </div>
            </div>

            {lines.length > 0 && (
              <div className="estimates-line-card-columns">
                <span>#</span>
                <span>Item</span>
                <span>Qty / Unit</span>
                <span>Unit Price</span>
                <span>Total</span>
                <span />
                <span />
                <span />
              </div>
            )}

            <div className="estimates-line-items-card-body">
              {lines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>No line items yet</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Search the catalog above or click &quot;Add line&quot; to start</div>
                </div>
              ) : (
                lines.map((line, idx) => {
                  const productName = line.product_id ? (products.find((pr) => pr.id === line.product_id)?.name ?? line.section) : line.section
                  const isExpanded = expandedLines.has(line.id)
                  return (
                    <div key={line.id} className="estimates-line-card">
                      <div className="estimates-line-card__main">
                        <div className="estimates-line-card__index">{idx + 1}</div>
                        {line.product_id ? (
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{productName}</span>
                        ) : (
                          <input
                            type="text"
                            value={line.section}
                            onChange={(e) => updateLine(idx, { section: e.target.value })}
                            placeholder="Item name"
                            className="estimates-line-card__item-input"
                          />
                        )}
                        <div className="estimates-line-card__qty-unit">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, { quantity: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                            className="estimates-line-card__qty-input"
                          />
                          <select
                            value={line.unit}
                            onChange={(e) => updateLine(idx, { unit: e.target.value })}
                            className="estimates-line-card__unit-select"
                          >
                            {UNIT_OPTIONS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        <div className="estimates-line-card__price-wrap">
                          <span className="estimates-line-card__price-prefix">$</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unit_price}
                            onChange={(e) => updateLine(idx, { unit_price: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                            className="estimates-line-card__price-input"
                          />
                        </div>
                        <div className="estimates-line-card__total">
                          ${Number(line.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <button
                          type="button"
                          className={`estimates-line-card__expand-btn ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => toggleLineExpanded(line.id)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? '−' : '+'}
                        </button>
                        <button
                          type="button"
                          className="estimates-line-card__delete-btn"
                          onClick={() => removeLine(idx)}
                          aria-label="Remove line"
                        >
                          ×
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="estimates-line-card__expanded">
                          <div className="estimates-line-card__expanded-label">Description / Notes</div>
                          <textarea
                            value={line.description}
                            onChange={(e) => updateLine(idx, { description: e.target.value })}
                            placeholder="Add a description, scope note, or spec detail…"
                            rows={2}
                            className="estimates-line-card__desc-textarea"
                          />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {lines.length > 0 && (
              <div className="estimates-line-items-card-add">
                <button type="button" className="estimates-line-items-card-add-btn" onClick={addCustomLine}>
                  + Add another line
                </button>
              </div>
            )}

            <div className="estimates-line-items-card-footer">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 300 }}>
                Add items from the catalog or create custom lines. Expand a row to add description or notes.
              </div>
              <div className="estimates-line-items-card-totals">
                <div className="estimates-line-items-card-total-row">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="estimates-line-items-card-total-grand">
                  <span>Total</span>
                  <span>${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes card */}
          <div className="est-card">
            <div className="estimates-builder-notes">
              <div className="estimates-builder-label" style={{ marginBottom: 6 }}>Notes / Terms</div>
              <textarea
                rows={3}
                placeholder="Payment terms, special conditions, warranty notes, thank you message…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="estimates-line-card__desc-textarea"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
