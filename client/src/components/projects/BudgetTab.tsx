import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { BudgetLineItem } from '@/types/global'
import type { BuilderPhase } from '@/components/projects/ScheduleBuilder'

const CATEGORIES = [
  { key: 'labor', label: 'Labor', color: '#2563EB' },
  { key: 'materials', label: 'Materials', color: '#0D9488' },
  { key: 'subs', label: 'Subcontractors', color: '#7C3AED' },
  { key: 'equipment', label: 'Equipment', color: '#D97706' },
  { key: 'permits', label: 'Permits & Fees', color: '#059669' },
  { key: 'overhead', label: 'Overhead', color: '#C2410C' },
  { key: 'other', label: 'Other', color: '#64748B' },
] as const

const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]))

export interface ScheduleLinkItem {
  id: string
  type: 'phase' | 'task'
  name: string
  status: 'complete' | 'in-progress' | 'not-started'
  phaseName?: string
}

/** Line item row with schedule link and locked-actual state (client-only until API supports). */
export type LineItemRow = BudgetLineItem & { linkedIds: string[]; actLocked: boolean }

function fmt(n: number): string {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

function fmtV(n: number): string {
  return (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toLocaleString('en-US')
}

function toLineItemRow(item: BudgetLineItem): LineItemRow {
  return {
    ...item,
    linkedIds: [],
    actLocked: item.actual != null && item.actual !== 0,
  }
}

/** Build flat schedule items from builder phases for link picker. */
function buildScheduleItems(phases: BuilderPhase[]): ScheduleLinkItem[] {
  const out: ScheduleLinkItem[] = []
  phases.forEach((p) => {
    const phaseStatus: ScheduleLinkItem['status'] =
      p.tasks.every((t) => t.status === 'complete')
        ? 'complete'
        : p.tasks.some((t) => t.status === 'complete' || t.status === 'in-progress')
          ? 'in-progress'
          : 'not-started'
    out.push({
      id: `p-${p.id}`,
      type: 'phase',
      name: p.name,
      status: phaseStatus,
      phaseName: p.name,
    })
    p.tasks.forEach((t) => {
      out.push({
        id: `t-${p.id}-${t.id}`,
        type: 'task',
        name: t.name,
        status: t.status === 'complete' ? 'complete' : t.status === 'in-progress' ? 'in-progress' : 'not-started',
        phaseName: p.name,
      })
    })
  })
  return out
}

export interface BudgetTabProps {
  items: BudgetLineItem[]
  onSave: (items: BudgetLineItem[]) => Promise<void>
  /** Phases from Schedule tab; used for "Link to schedule" picker. */
  schedulePhases?: BuilderPhase[]
}

export function BudgetTab({ items, onSave, schedulePhases = [] }: BudgetTabProps) {
  const [list, setList] = useState<LineItemRow[]>(() => items.map(toLineItemRow))
  const [saving, setSaving] = useState(false)
  const [bvaView, setBvaView] = useState<'category' | 'item'>('category')
  const [popoverRowId, setPopoverRowId] = useState<string | null>(null)
  const [popoverSelected, setPopoverSelected] = useState<Set<string>>(new Set())
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number } | null>(null)
  const [popoverSearch, setPopoverSearch] = useState('')
  const [modalRowId, setModalRowId] = useState<string | null>(null)
  const [modalAmount, setModalAmount] = useState('')
  const [modalNote, setModalNote] = useState('')
  const pendingRowRef = useRef<HTMLDivElement>(null)

  const scheduleItems = useMemo(() => buildScheduleItems(schedulePhases), [schedulePhases])
  const schedMap = useMemo(() => Object.fromEntries(scheduleItems.map((i) => [i.id, i])), [scheduleItems])

  useEffect(() => {
    setList(items.map(toLineItemRow))
  }, [items])

  const totalPred = useMemo(() => list.reduce((s, r) => s + Number(r.predicted || 0), 0), [list])
  const totalAct = useMemo(() => list.reduce((s, r) => s + Number(r.actual || 0), 0), [list])
  const variance = totalPred - totalAct
  const pctUsed = totalPred ? Math.round((totalAct / totalPred) * 100) : 0

  const groupedByCategory = useMemo(() => {
    const g: Record<string, { cat: string; pred: number; act: number; items: LineItemRow[] }> = {}
    list.forEach((r) => {
      const cat = r.category || 'other'
      if (!g[cat]) g[cat] = { cat, pred: 0, act: 0, items: [] }
      g[cat].pred += Number(r.predicted || 0)
      g[cat].act += Number(r.actual || 0)
      g[cat].items.push(r)
    })
    return Object.values(g)
  }, [list])

  const rowHasPendingActual = useCallback(
    (r: LineItemRow) => {
      if (r.actLocked || (r.actual != null && r.actual !== 0)) return false
      return r.linkedIds.some((id) => schedMap[id]?.status === 'complete')
    },
    [schedMap]
  )

  const pendingCount = useMemo(() => list.filter((r) => rowHasPendingActual(r)).length, [list, rowHasPendingActual])
  const firstPendingRowId = useMemo(() => list.find((r) => rowHasPendingActual(r))?.id ?? null, [list, rowHasPendingActual])

  const stripeColor = useCallback((r: LineItemRow): string => {
    const cat = catMap[r.category as keyof typeof catMap]
    return cat?.color ?? 'var(--border)'
  }, [])

  const addRow = useCallback(() => {
    setList((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        project_id: '',
        label: '',
        predicted: 0,
        actual: 0,
        category: 'labor',
        linkedIds: [],
        actLocked: false,
      },
    ])
  }, [])

  const updateRow = useCallback((id: string, field: keyof LineItemRow, value: string | number | string[] | boolean) => {
    setList((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        if (field === 'linkedIds') return { ...row, linkedIds: value as string[] }
        if (field === 'actLocked') return { ...row, actLocked: value as boolean }
        return {
          ...row,
          [field]: field === 'predicted' || field === 'actual' ? Number(value) || 0 : value,
        }
      })
    )
  }, [])

  const removeRow = useCallback((id: string) => {
    setList((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const apiItems: BudgetLineItem[] = list.map(({ linkedIds, actLocked, ...rest }) => rest)
      await onSave(apiItems)
    } finally {
      setSaving(false)
    }
  }, [list, onSave])

  const openPopover = useCallback((rowId: string, el: HTMLElement) => {
    const row = list.find((r) => r.id === rowId)
    setPopoverRowId(rowId)
    setPopoverSelected(new Set(row?.linkedIds ?? []))
    setPopoverSearch('')
    const rect = el.getBoundingClientRect()
    const popoverWidth = 320
    const popoverHeight = 420
    const padding = 12
    const spaceBelow = window.innerHeight - rect.bottom - padding
    const openAbove = spaceBelow < popoverHeight
    const top = openAbove
      ? Math.max(padding, rect.top - popoverHeight - 6)
      : Math.min(rect.bottom + 6, window.innerHeight - popoverHeight - padding)
    const left = Math.max(padding, Math.min(rect.left, window.innerWidth - popoverWidth - padding))
    setPopoverAnchor({ top, left })
  }, [list])

  const closePopover = useCallback(() => {
    setPopoverRowId(null)
    setPopoverAnchor(null)
  }, [])

  const togglePopoverItem = useCallback((id: string) => {
    setPopoverSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const confirmLink = useCallback(() => {
    if (popoverRowId) {
      updateRow(popoverRowId, 'linkedIds', [...popoverSelected])
      closePopover()
    }
  }, [popoverRowId, popoverSelected, updateRow, closePopover])

  const openModal = useCallback((rowId: string) => {
    const row = list.find((r) => r.id === rowId)
    if (!row) return
    setModalRowId(rowId)
    setModalAmount(row.actual != null ? String(row.actual) : '')
    setModalNote('')
  }, [list])

  const closeModal = useCallback(() => {
    setModalRowId(null)
  }, [])

  const confirmModal = useCallback(() => {
    if (!modalRowId) return
    const amt = parseFloat(modalAmount)
    if (Number.isNaN(amt)) return
    setList((prev) => prev.map((r) => (r.id === modalRowId ? { ...r, actual: amt, actLocked: true } : r)))
    closeModal()
  }, [modalRowId, modalAmount, closeModal])

  const scrollToPending = useCallback(() => {
    pendingRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  // Donut: segments from grouped actuals
  const donutSegments = useMemo(() => {
    const total = totalAct || 1
    const r = 26
    const circ = 2 * Math.PI * r
    let cumulPct = 0
    return groupedByCategory.map((g) => {
      const cat = catMap[g.cat as keyof typeof catMap] || { color: '#ccc', label: g.cat }
      const frac = g.act / total
      const dash = frac * circ
      const gap = circ - dash
      const dashOffset = circ * (0.25 - cumulPct)
      cumulPct += frac
      return { ...cat, dash, gap, dashOffset }
    })
  }, [groupedByCategory, totalAct])

  return (
    <div className="budget-tab">
      {/* Top row: 3 stat cards + donut */}
      <div className="budget-stats-row">
        <div className="stat-card predicted">
          <div className="stat-card-label">Budget</div>
          <div className="stat-card-value">{totalPred ? fmt(totalPred) : '—'}</div>
          <div className="stat-card-sub">Total predicted spend</div>
        </div>
        <div className="stat-card actual">
          <div className="stat-card-label">Actual Spend</div>
          <div className="stat-card-value">{totalAct ? fmt(totalAct) : '—'}</div>
          <div className="stat-card-sub">{totalPred ? `${pctUsed}% of budget used` : '—'}</div>
        </div>
        <div className={`stat-card profit ${variance < 0 ? 'over' : ''}`}>
          <div className="stat-card-label">Variance</div>
          <div className="stat-card-value">{variance === 0 ? '$0' : fmtV(variance)}</div>
          <div className="stat-card-sub">
            {variance > 0 ? 'Under budget' : variance < 0 ? 'Over budget' : 'On budget'}
          </div>
        </div>
        <div className="donut-card">
          <div className="donut-card-label">Spend breakdown</div>
          <div className="donut-wrap">
            <svg className="donut-svg" width={96} height={96} viewBox="0 0 68 68">
              <g transform="rotate(-90 34 34)">
                <circle cx={34} cy={34} r={26} fill="none" stroke="var(--bg-raised)" strokeWidth={9} />
                {donutSegments.map((seg, i) => (
                  <circle
                    key={i}
                    cx={34}
                    cy={34}
                    r={26}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={9}
                    strokeDasharray={`${seg.dash} ${seg.gap}`}
                    strokeDashoffset={seg.dashOffset}
                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                  />
                ))}
              </g>
              <text
                x={34}
                y={31}
                textAnchor="middle"
                className="text-[11px] font-semibold fill-[var(--text-primary)]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {totalAct ? '$' + Math.round(totalAct / 1000) + 'k' : ''}
              </text>
              <text x={34} y={43} textAnchor="middle" className="text-[7.5px] font-semibold fill-[var(--text-muted)]">
                ACTUAL
              </text>
            </svg>
            <div className="donut-legend">
              {groupedByCategory.slice(0, 4).map((g) => {
                const cat = catMap[g.cat as keyof typeof catMap] || { color: '#ccc', label: g.cat }
                return (
                  <div key={g.cat} className="donut-leg-item">
                    <div className="donut-leg-dot" style={{ background: cat.color }} />
                    <span className="donut-leg-label" title={cat.label}>{cat.label}</span>
                    <span className="donut-leg-val">{fmt(g.act)}</span>
                  </div>
                )
              })}
              {groupedByCategory.length > 4 && (
                <div className="text-[10.5px] text-muted mt-0.5">+{groupedByCategory.length - 4} more</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Budget vs Actual */}
      <div className="bva-card">
        <div className="bva-header">
          <div className="flex items-baseline gap-2">
            <div className="bva-title">Budget vs Actual</div>
            {totalPred > 0 && (
              <span className="text-[11px] font-medium text-muted" title="Share of budget spent">
                {pctUsed}% used
              </span>
            )}
          </div>
          <div className="bva-toggle">
            <button
              type="button"
              className={`bva-tog-btn ${bvaView === 'category' ? 'active' : ''}`}
              onClick={() => setBvaView('category')}
            >
              By Category
            </button>
            <button
              type="button"
              className={`bva-tog-btn ${bvaView === 'item' ? 'active' : ''}`}
              onClick={() => setBvaView('item')}
            >
              By Item
            </button>
          </div>
        </div>
        <div className="bva-body">
          {bvaView === 'category' && (
            <>
              {groupedByCategory.length === 0 ? (
                <div className="py-5 text-center text-sm text-muted">No line items yet</div>
              ) : (
                <>
                  {groupedByCategory.map((g) => {
                    const cat = catMap[g.cat as keyof typeof catMap] || { color: '#ccc', label: g.cat }
                    const v = g.pred - g.act
                    const predW = totalPred ? Math.min(100, (g.pred / totalPred) * 100) : 0
                    const actW = totalPred ? Math.min(100, (g.act / totalPred) * 100) : 0
                    const isOver = g.act > g.pred
                    return (
                      <div key={g.cat} className="bva-cat-row">
                        <div className="bva-cat-top">
                          <div className="bva-cat-name">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: cat.color }}
                            />
                            {cat.label}
                          </div>
                          <div className="bva-cat-summary">
                            <div className="bva-cat-summary-row">
                              <span className="bva-cat-summary-label">Budget</span>
                              <span className="bva-cat-num pred">{fmt(g.pred)}</span>
                            </div>
                            <div className="bva-cat-summary-row">
                              <span className="bva-cat-summary-label">Actual</span>
                              <span className="bva-cat-num act">{fmt(g.act)}</span>
                            </div>
                            <div className="bva-cat-summary-row">
                              <span className="bva-cat-summary-label">Variance</span>
                              <span className={`bva-cat-num ${v > 0 ? 'var-pos' : v < 0 ? 'var-neg' : ''}`}>
                                {v === 0 ? 'On budget' : fmtV(v)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="bva-bars">
                          <div className="bva-bar-row">
                            <div className="bva-bar-label">Budget</div>
                            <div className="bva-bar-track">
                              <div
                                className="bva-bar-fill pred"
                                style={{
                                  width: `${predW}%`,
                                  background: cat.color,
                                  opacity: 0.4,
                                }}
                              />
                            </div>
                          </div>
                          <div className="bva-bar-row">
                            <div className="bva-bar-label">Actual</div>
                            <div className="bva-bar-track">
                              <div
                                className={`bva-bar-fill act ${isOver ? '' : 'under'}`}
                                style={{
                                  width: `${actW}%`,
                                  background: isOver ? 'var(--red)' : cat.color,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}
          {bvaView === 'item' && (
            <>
              {list.length === 0 ? (
                <div className="py-5 text-center text-sm text-muted">No line items yet</div>
              ) : (
                <>
                  {list.map((r) => {
                    const cat = catMap[r.category as keyof typeof catMap] || { color: '#ccc' }
                    const pred = Number(r.predicted || 0)
                    const act = Number(r.actual || 0)
                    const v = pred - act
                    const predW = totalPred ? Math.min(100, (pred / totalPred) * 100) : 0
                    const actW = totalPred ? Math.min(100, (act / totalPred) * 100) : 0
                    const isOver = act > pred
                    return (
                      <div key={r.id} className="bva-cat-row">
                        <div className="bva-cat-top">
                          <div className="bva-cat-name">
                            <div
                              className="w-1.5 h-1.5 rounded-sm rotate-45 shrink-0"
                              style={{ background: cat.color }}
                            />
                            {r.label || 'Untitled'}
                          </div>
                          <div className="bva-cat-summary">
                            <div className="bva-cat-summary-row">
                              <span className="bva-cat-summary-label">Budget</span>
                              <span className="bva-cat-num pred">{fmt(pred)}</span>
                            </div>
                            <div className="bva-cat-summary-row">
                              <span className="bva-cat-summary-label">Actual</span>
                              <span className="bva-cat-num act">{fmt(act)}</span>
                            </div>
                            <div className="bva-cat-summary-row">
                              <span className="bva-cat-summary-label">Variance</span>
                              <span className={`bva-cat-num ${v > 0 ? 'var-pos' : v < 0 ? 'var-neg' : ''}`}>
                                {v === 0 ? 'On budget' : fmtV(v)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="bva-bars">
                          <div className="bva-bar-row">
                            <div className="bva-bar-label">Budget</div>
                            <div className="bva-bar-track">
                              <div
                                className="bva-bar-fill"
                                style={{ width: `${predW}%`, background: cat.color, opacity: 0.4 }}
                              />
                            </div>
                          </div>
                          <div className="bva-bar-row">
                            <div className="bva-bar-label">Actual</div>
                            <div className="bva-bar-track">
                              <div
                                className="bva-bar-fill"
                                style={{
                                  width: `${actW}%`,
                                  background: isOver ? 'var(--red)' : cat.color,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="li-card">
        <div className="li-header">
          <div className="li-header-left">
            <div className="li-header-title">Line Items</div>
            <div className="li-header-sub">
              {list.length} item{list.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="li-header-right">
            <button type="button" className="btn-sm flex items-center gap-1.5" onClick={addRow}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1={12} y1={5} x2={12} y2={19} />
                <line x1={5} y1={12} x2={19} y2={12} />
              </svg>
              Add row
            </button>
            <button type="button" className="btn btn-primary flex items-center gap-1.5" onClick={handleSave} disabled={saving}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="pending-banner" onClick={scrollToPending} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && scrollToPending()}>
            <div className="pending-banner-icon">
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <circle cx={12} cy={12} r={10} />
                <line x1={12} y1={8} x2={12} y2={12} />
                <line x1={12} y1={16} x2={12.01} y2={16} />
              </svg>
            </div>
            <div className="pending-banner-text">
              <strong>{pendingCount} item{pendingCount !== 1 ? 's' : ''}</strong> {pendingCount === 1 ? 'has' : 'have'} completed tasks — ready to log actual costs
            </div>
            <div className="pending-banner-cta">Log costs →</div>
          </div>
        )}

        <div className="li-col-headers">
          <div className="li-col-hdr" />
          <div className="li-col-hdr">Description</div>
          <div className="li-col-hdr">Category</div>
          <div className="li-col-hdr r">Budgeted</div>
          <div className="li-col-hdr r">Actual</div>
          <div className="li-col-hdr c">Linked to</div>
          <div className="li-col-hdr r">Variance</div>
          <div />
        </div>
        {list.map((row) => {
          const pred = Number(row.predicted || 0)
          const act = row.actual != null ? Number(row.actual) : null
          const v = pred - (act ?? 0)
          const varCls = act != null ? (v > 0 ? 'under' : v < 0 ? 'over' : 'zero') : rowHasPendingActual(row) ? 'pending' : 'zero'
          const varLbl = act != null ? (v === 0 ? '—' : fmtV(v)) : rowHasPendingActual(row) ? 'Pending' : '—'

          let actualCell: React.ReactNode
          if (row.actLocked && act != null) {
            actualCell = (
              <div className="li-actual-locked" style={{ justifyContent: 'flex-end', gap: 6 }}>
                <svg className="lock-icon" width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <rect x={3} y={11} width={18} height={11} rx={2} ry={2} />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>{fmt(act)}</span>
                <button type="button" onClick={() => openModal(row.id)} title="Edit" className="p-0.5 rounded text-muted hover:text-[var(--color-primary)] inline-flex transition-colors bg-transparent border-none cursor-pointer">
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            )
          } else if (rowHasPendingActual(row)) {
            actualCell = (
              <div className="li-actual-pending" ref={row.id === firstPendingRowId ? pendingRowRef : undefined}>
                <button type="button" className="li-actual-pending-btn" onClick={() => openModal(row.id)}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1={12} y1={5} x2={12} y2={19} />
                    <line x1={5} y1={12} x2={19} y2={12} />
                  </svg>
                  Log actual
                </button>
              </div>
            )
          } else {
            actualCell = (
              <div className="flex items-center justify-end gap-1.5">
                {act != null && <span className="text-[13px] tabular-nums text-secondary">{fmt(act)}</span>}
                <button type="button" className="li-log-btn" onClick={() => openModal(row.id)}>
                  {act != null ? (
                    <>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edit
                    </>
                  ) : (
                    <>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <line x1={12} y1={5} x2={12} y2={19} />
                        <line x1={5} y1={12} x2={19} y2={12} />
                      </svg>
                      Enter
                    </>
                  )}
                </button>
              </div>
            )
          }

          const linkedCount = row.linkedIds.length
          let linkLabel: string
          let linkCls: string
          if (linkedCount === 0) {
            linkLabel = 'Link to task'
            linkCls = 'unlinked'
          } else if (linkedCount === 1) {
            const item = schedMap[row.linkedIds[0]]
            linkLabel = item ? (item.type === 'phase' ? `Phase: ${item.name}` : item.name) : '1 item'
            linkCls = 'linked'
          } else {
            linkLabel = `${linkedCount} items`
            linkCls = 'linked'
          }

          return (
            <div key={row.id} className="li-row">
              <div className="li-status-stripe" style={{ background: stripeColor(row) }} />
              <input
                type="text"
                className="li-in"
                placeholder="Description…"
                value={row.label}
                onChange={(e) => updateRow(row.id, 'label', e.target.value)}
              />
              <select
                className="li-cat-sel"
                value={row.category || 'other'}
                onChange={(e) => updateRow(row.id, 'category', e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="li-num-in"
                placeholder="0"
                value={row.predicted || ''}
                onChange={(e) => updateRow(row.id, 'predicted', e.target.value)}
              />
              <div className="li-actual-cell">{actualCell}</div>
              <div className="flex justify-center">
                <button
                  type="button"
                  className={`li-link-chip ${linkCls}`}
                  onClick={(e) => openPopover(row.id, e.currentTarget)}
                  title={linkedCount ? 'Edit links' : 'Link to schedule'}
                >
                  {linkedCount ? (
                    <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  ) : (
                    <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1={12} y1={5} x2={12} y2={19} />
                      <line x1={5} y1={12} x2={19} y2={12} />
                    </svg>
                  )}
                  <span className="overflow-hidden text-ellipsis max-w-[66px]">{linkLabel}</span>
                </button>
              </div>
              <div className="li-var-cell">
                <span className={`li-var-badge ${varCls}`}>{varLbl}</span>
              </div>
              <button type="button" className="li-del" onClick={() => removeRow(row.id)} aria-label="Remove row">
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1={18} y1={6} x2={6} y2={18} />
                  <line x1={6} y1={6} x2={18} y2={18} />
                </svg>
              </button>
            </div>
          )
        })}
        <button type="button" className="li-add-row" onClick={addRow}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1={12} y1={5} x2={12} y2={19} />
            <line x1={5} y1={12} x2={19} y2={12} />
          </svg>
          Add line item
        </button>
        <div className="li-footer">
          <div />
          <div className="li-footer-label">Total</div>
          <div />
          <div className="li-footer-val">{totalPred ? fmt(totalPred) : '—'}</div>
          <div className="li-footer-val">{totalAct ? fmt(totalAct) : '—'}</div>
          <div />
          <div className={`li-footer-val ${variance > 0 ? 'green' : variance < 0 ? 'red' : ''}`}>
            {variance === 0 ? '—' : fmtV(variance)}
          </div>
          <div />
        </div>
      </div>

      {/* Link picker popover */}
      {popoverAnchor && (
        <>
          <div className="popover-overlay" onClick={closePopover} aria-hidden />
          <div className="popover" style={{ top: popoverAnchor.top, left: popoverAnchor.left }}>
            <div className="popover-header">
              <div className="popover-title">Link to schedule</div>
              <input
                type="text"
                className="popover-search"
                placeholder="Search phases & tasks…"
                value={popoverSearch}
                onChange={(e) => setPopoverSearch(e.target.value)}
              />
            </div>
            <div className="popover-body">
              {schedulePhases
                .filter((p) => !popoverSearch.trim() || p.name.toLowerCase().includes(popoverSearch.toLowerCase()) || p.tasks.some((t) => t.name.toLowerCase().includes(popoverSearch.toLowerCase())))
                .map((p) => {
                  const phaseItem = scheduleItems.find((i) => i.id === `p-${p.id}`)
                  const tasks = p.tasks.filter((t) => !popoverSearch.trim() || t.name.toLowerCase().includes(popoverSearch.toLowerCase()) || p.name.toLowerCase().includes(popoverSearch.toLowerCase()))
                  const showPhase = !popoverSearch.trim() || p.name.toLowerCase().includes(popoverSearch.toLowerCase()) || tasks.length > 0
                  if (!showPhase) return null
                  return (
                    <div key={p.id} className="popover-section">
                      <div className="popover-section-label">{p.name}</div>
                      {(!popoverSearch.trim() || p.name.toLowerCase().includes(popoverSearch.toLowerCase())) && phaseItem && (
                        <div
                          className={`popover-item ${popoverSelected.has(phaseItem.id) ? 'selected' : ''}`}
                          onClick={() => togglePopoverItem(phaseItem.id)}
                        >
                          <div className="popover-item-check">
                            {popoverSelected.has(phaseItem.id) && (
                              <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5}>
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <div className="popover-item-name" style={{ fontWeight: 600 }}>Entire phase</div>
                          <span className={`popover-item-status ${phaseItem.status}`}>
                            {phaseItem.status === 'complete' ? 'Complete' : phaseItem.status === 'in-progress' ? 'In progress' : 'Not started'}
                          </span>
                        </div>
                      )}
                      {tasks.map((t) => {
                        const tid = `t-${p.id}-${t.id}`
                        const item = scheduleItems.find((i) => i.id === tid)
                        if (!item) return null
                        return (
                          <div
                            key={tid}
                            className={`popover-item ${popoverSelected.has(tid) ? 'selected' : ''}`}
                            onClick={() => togglePopoverItem(tid)}
                            style={{ paddingLeft: 24 }}
                          >
                            <div className="popover-item-check">
                              {popoverSelected.has(tid) && (
                                <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5}>
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                            <div className="popover-item-name">{t.name}</div>
                            <span className={`popover-item-status ${item.status}`}>
                              {item.status === 'complete' ? 'Complete' : item.status === 'in-progress' ? 'In progress' : 'Not started'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              {schedulePhases.length === 0 && (
                <div className="py-5 text-center text-sm text-muted">No schedule phases. Add phases in the Schedule tab.</div>
              )}
            </div>
            <div className="popover-footer">
              <button type="button" className="btn-sm" onClick={closePopover}>Cancel</button>
              <button type="button" className="btn btn-primary text-xs py-1.5 px-3.5" onClick={confirmLink}>Link</button>
            </div>
          </div>
        </>
      )}

      {/* Log Actual modal */}
      <div className={`modal-overlay ${modalRowId ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && closeModal()}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              Log actual — {list.find((r) => r.id === modalRowId)?.label || 'this item'}
            </div>
            <div className="modal-sub">
              Budget: {modalRowId ? fmt(Number(list.find((r) => r.id === modalRowId)?.predicted || 0)) : '—'}. Enter the final amount spent.
            </div>
          </div>
          <div className="modal-body">
            <div className="modal-field">
              <div className="modal-label">Actual Amount</div>
              <input
                type="number"
                className="modal-input"
                placeholder="0.00"
                value={modalAmount}
                onChange={(e) => setModalAmount(e.target.value)}
              />
              <div className="modal-hint">
                {modalRowId && (() => {
                  const pred = Number(list.find((r) => r.id === modalRowId)?.predicted || 0)
                  const entered = parseFloat(modalAmount) || 0
                  if (!entered) return <span className="font-semibold text-secondary">Budgeted: {fmt(pred)}</span>
                  const diff = pred - entered
                  const pct = pred ? Math.round((Math.abs(diff) / pred) * 100) : 0
                  if (diff > 0) return <span className="text-[var(--green)] font-bold">✓ {fmt(diff)} under budget ({pct}%)</span>
                  if (diff < 0) return <span className="text-[var(--red)] font-bold">⚠ {fmt(-diff)} over budget ({pct}%)</span>
                  return <span className="text-muted">On budget</span>
                })()}
              </div>
            </div>
            <div className="modal-field">
              <div className="modal-label">Note (optional)</div>
              <textarea
                className="modal-note"
                placeholder="Any notes about this cost…"
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-sm" onClick={closeModal}>Cancel</button>
            <button type="button" className="btn btn-primary flex items-center gap-1.5" onClick={confirmModal}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Save actual
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
