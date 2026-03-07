import { useState, useEffect, useMemo, useCallback } from 'react'
import type { BudgetLineItem } from '@/types/global'

const CATEGORY_LABELS: Record<string, string> = {
  labor: 'Labor',
  materials: 'Materials',
  subs: 'Subcontractors',
  equipment: 'Equipment',
  permits: 'Permits & Fees',
  overhead: 'Overhead',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  Labor: '#6366f1',
  Materials: '#0ea5e9',
  Subcontractors: '#8b5cf6',
  Equipment: '#94a3b8',
  'Permits & Fees': '#94a3b8',
  Overhead: '#94a3b8',
  Other: '#94a3b8',
}

/** Mock change orders (no API yet). */
const MOCK_CHANGE_ORDERS = [
  { id: 'CO-001', description: 'Added heated floor – tile phase', amount: 1200, status: 'Approved' as const, date: '02/14/2026' },
  { id: 'CO-002', description: 'Upgraded vanity fixtures', amount: 650, status: 'Pending' as const, date: '03/01/2026' },
]

/** Mock transactions per line item id (no API yet). */
function getMockTransactions(itemId: string): { desc: string; date: string; amount: number }[] {
  const byId: Record<string, { desc: string; date: string; amount: number }[]> = {
    b1: [
      { desc: 'Crew A – Demo week', date: '01/27/2026', amount: 4250 },
      { desc: 'Crew A – Rough plumbing assist', date: '02/12/2026', amount: 6800 },
      { desc: 'Tile crew – Week 1', date: '03/03/2026', amount: 6150 },
    ],
    b2: [
      { desc: 'Tile – 220sqft porcelain', date: '02/10/2026', amount: 8800 },
      { desc: 'Plumbing fixtures', date: '02/18/2026', amount: 7400 },
      { desc: 'Vanity + mirror', date: '02/24/2026', amount: 5600 },
      { desc: 'Misc materials – PO #1042', date: '03/02/2026', amount: 3300 },
    ],
    b3: [
      { desc: 'ABC Electrical – rough-in', date: '02/08/2026', amount: 4200 },
      { desc: 'Quality Plumbing Co', date: '02/20/2026', amount: 7600 },
    ],
  }
  return byId[itemId] ?? []
}

/** Mock forecast (no API yet). */
const MOCK_FORECAST = { laborRate: 85, hoursLeft: 24, materialsPending: 1800, subsRemaining: 0 }

function fmt(n: number): string {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

function fmtSigned(n: number): string {
  return (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

export interface BudgetTabProps {
  items: BudgetLineItem[]
  onSave: (items: BudgetLineItem[]) => Promise<void>
  schedulePhases?: unknown[]
}

type SectionId = 'budget' | 'changeorders' | 'forecast'

export function BudgetTab({ items, onSave }: BudgetTabProps) {
  const [list, setList] = useState<BudgetLineItem[]>(() => items)
  const [viewMode, setViewMode] = useState<'category' | 'item'>('category')
  const [drawerItem, setDrawerItem] = useState<BudgetLineItem | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [addingRow, setAddingRow] = useState(false)
  const [newRow, setNewRow] = useState({ description: '', category: 'labor', budgeted: '', actual: '' })
  const [activeSection, setActiveSection] = useState<SectionId>('budget')
  const [changeOrders] = useState(MOCK_CHANGE_ORDERS)

  useEffect(() => {
    setList(items)
  }, [items])

  const totalBudget = useMemo(() => list.reduce((s, i) => s + Number(i.predicted || 0), 0), [list])
  const totalActual = useMemo(() => list.reduce((s, i) => s + Number(i.actual || 0), 0), [list])
  const variance = totalBudget - totalActual
  const budgetPct = totalBudget ? Math.round((totalActual / totalBudget) * 100) : 0

  const approvedCOs = changeOrders.filter((c) => c.status === 'Approved').reduce((s, c) => s + c.amount, 0)
  const pendingCOs = changeOrders.filter((c) => c.status === 'Pending').reduce((s, c) => s + c.amount, 0)
  const forecastTotal = totalActual + (MOCK_FORECAST.laborRate * MOCK_FORECAST.hoursLeft) + MOCK_FORECAST.materialsPending + MOCK_FORECAST.subsRemaining
  const forecastVariance = totalBudget - forecastTotal

  const getItemColor = useCallback((item: BudgetLineItem): string => {
    const label = CATEGORY_LABELS[item.category] || item.category || 'Other'
    return CATEGORY_COLORS[label] ?? '#94a3b8'
  }, [])

  const getItemCategoryLabel = useCallback((item: BudgetLineItem): string => {
    return CATEGORY_LABELS[item.category] || item.category || 'Other'
  }, [])

  const startEdit = useCallback((item: BudgetLineItem) => {
    setEditingId(item.id)
    setEditVal(String(item.predicted ?? 0))
  }, [])

  const commitEdit = useCallback(
    (id: string) => {
      const val = parseFloat(editVal)
      if (!Number.isNaN(val) && val >= 0) {
        const next = list.map((i) => (i.id === id ? { ...i, predicted: val } : i))
        setList(next)
        onSave(next).catch(() => {})
      }
      setEditingId(null)
    },
    [editVal, list, onSave]
  )

  const addRow = useCallback(() => {
    const desc = newRow.description.trim()
    const budgeted = parseFloat(newRow.budgeted) || 0
    if (!desc || budgeted <= 0) return
    const category = newRow.category || 'labor'
    const label = CATEGORY_LABELS[category] || category
    const newItem: BudgetLineItem = {
      id: `new-${Date.now()}`,
      project_id: list[0]?.project_id ?? '',
      label: desc,
      predicted: budgeted,
      actual: parseFloat(newRow.actual) || 0,
      category,
    }
    const next = [...list, newItem]
    setList(next)
    onSave(next).catch(() => {})
    setNewRow({ description: '', category: 'labor', budgeted: '', actual: '' })
    setAddingRow(false)
  }, [newRow, list, onSave])

  const removeItem = useCallback(
    (id: string) => {
      const next = list.filter((i) => i.id !== id)
      setList(next)
      if (drawerItem?.id === id) setDrawerItem(null)
      onSave(next).catch(() => {})
    },
    [list, drawerItem, onSave]
  )

  // Donut segments
  const donutTotal = totalActual || 1
  let cumPct = 0
  const segments = list.map((item) => {
    const pct = Number(item.actual || 0) / donutTotal
    const start = cumPct
    cumPct += pct
    return { ...item, start, pct, color: getItemColor(item) }
  })

  function polarToXY(pct: number, r: number) {
    const angle = pct * 2 * Math.PI - Math.PI / 2
    return { x: 60 + r * Math.cos(angle), y: 60 + r * Math.sin(angle) }
  }

  function arcPath(startPct: number, endPct: number, r: number) {
    if (endPct - startPct >= 1) endPct = startPct + 0.9999
    const s = polarToXY(startPct, r)
    const e = polarToXY(endPct, r)
    const large = endPct - startPct > 0.5 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  return (
    <div className="budget-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top KPI Row */}
      <div className="budget-kpi-row">
        <div className="budget-kpi-card">
          <div className="budget-kpi-label">Total Budget</div>
          <div className="budget-kpi-value">{totalBudget ? fmt(totalBudget) : '—'}</div>
          <div className="budget-kpi-sub" style={{ color: 'var(--green, #16a34a)' }}>+{fmt(approvedCOs)} in approved COs</div>
        </div>
        <div className="budget-kpi-card">
          <div className="budget-kpi-label">Actual Spend</div>
          <div className="budget-kpi-value" style={{ color: budgetPct > 95 ? 'var(--red)' : undefined }}>{totalActual ? fmt(totalActual) : '—'}</div>
          <div className="budget-kpi-sub" style={{ color: budgetPct > 95 ? 'var(--red)' : 'var(--text-muted)' }}>{budgetPct}% of budget used</div>
          <div className="budget-kpi-bar">
            <div
              className="budget-kpi-bar-fill"
              style={{
                width: `${Math.min(100, budgetPct)}%`,
                background: budgetPct > 95 ? 'var(--red)' : budgetPct > 80 ? '#f59e0b' : 'var(--green, #16a34a)',
              }}
            />
          </div>
        </div>
        <div className="budget-kpi-card">
          <div className="budget-kpi-label">Variance</div>
          <div className="budget-kpi-value" style={{ color: variance >= 0 ? 'var(--green, #16a34a)' : 'var(--red)' }}>{fmtSigned(variance)}</div>
          <div className="budget-kpi-sub" style={{ color: variance >= 0 ? 'var(--green, #16a34a)' : 'var(--red)' }}>{variance >= 0 ? 'Under budget' : 'Over budget'}</div>
        </div>
        <div className="budget-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span className="budget-kpi-label">Forecast to Complete</span>
            <span className="budget-kpi-tag" style={{ background: '#fdf4ff', color: '#7e22ce' }}>AI Est.</span>
          </div>
          <div className="budget-kpi-value">{fmt(forecastTotal)}</div>
          <div className="budget-kpi-sub" style={{ color: forecastVariance >= 0 ? 'var(--green, #16a34a)' : 'var(--red)' }}>{fmtSigned(forecastVariance)} projected variance</div>
        </div>
      </div>

      {/* Main Body */}
      <div className="budget-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Section tabs */}
          <div className="budget-section-tabs">
            {(['budget', 'changeorders', 'forecast'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key)}
                className={`budget-section-tab ${activeSection === key ? 'active' : ''}`}
              >
                {key === 'budget' ? 'Line Items' : key === 'changeorders' ? 'Change Orders' : 'Forecast'}
                {key === 'changeorders' && <span className="budget-section-tab-badge" style={{ background: activeSection === key ? 'rgba(255,255,255,0.2)' : '#fef3c7', color: activeSection === key ? '#fff' : '#92400e' }}>{changeOrders.length}</span>}
              </button>
            ))}
          </div>

          {activeSection === 'budget' && (
            <div className="budget-table-card">
              <div className="budget-table-header">
                <div>
                  <div className="budget-table-title">Budget vs Actual</div>
                  <div className="budget-table-sub">{list.length} line items · click a row to see transactions</div>
                </div>
                <div className="budget-view-toggle">
                  {(['category', 'item'] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setViewMode(v)} className={`budget-view-toggle-btn ${viewMode === v ? 'active' : ''}`}>
                      {v === 'category' ? 'By Category' : 'By Item'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="budget-table-col-headers">
                <span>Description</span><span>Category</span><span>Budgeted</span><span>Actual</span><span>Variance</span><span />
              </div>
              {(viewMode === 'category'
                ? list.reduce<BudgetLineItem[]>((acc, i) => {
                    const last = acc.find((x) => (x.category || 'other') === (i.category || 'other'))
                    if (last) {
                      const idx = acc.indexOf(last)
                      acc[idx] = { ...last, predicted: last.predicted + Number(i.predicted || 0), actual: last.actual + Number(i.actual || 0) }
                      return acc
                    }
                    return [...acc, { ...i }]
                  }, [])
                : list
              ).map((item) => {
                const budgeted = Number(item.predicted || 0)
                const actual = Number(item.actual || 0)
                const v = budgeted - actual
                const pct = budgeted ? Math.round((actual / budgeted) * 100) : 0
                const over = actual > budgeted
                const color = getItemColor(item)
                const isActive = viewMode === 'item' && drawerItem?.id === item.id
                const transactions = viewMode === 'item' ? getMockTransactions(item.id) : []
                const isCategoryView = viewMode === 'category'
                return (
                  <div key={item.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setDrawerItem(isActive ? null : item)}
                      onKeyDown={(e) => e.key === 'Enter' && (setDrawerItem(isActive ? null : item), e.preventDefault())}
                      className={`budget-table-row ${isActive ? 'active' : ''}`}
                      style={{ borderLeftColor: isActive ? color : undefined }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label || 'Untitled'}</div>
                          {viewMode === 'item' && item.category === 'labor' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>🔗 Time logs</div>}
                          {viewMode === 'item' && item.category === 'subs' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>🔗 Bid sheet</div>}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, background: color + '18', color, padding: '2px 8px', borderRadius: 6, fontWeight: 600, width: 'fit-content' }}>{getItemCategoryLabel(item)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {!isCategoryView && editingId === item.id ? (
                          <input
                            autoFocus
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onBlur={() => commitEdit(item.id)}
                            onKeyDown={(e) => e.key === 'Enter' && (commitEdit(item.id), e.preventDefault())}
                            onClick={(e) => e.stopPropagation()}
                            className="border border-[var(--border)] rounded-md px-1.5 py-0.5 w-20 text-[13px] font-mono outline-none"
                            style={{ borderColor: '#6366f1' }}
                          />
                        ) : (
                          <span className="text-[13px] font-mono text-[var(--text-primary)]">{fmt(budgeted)}</span>
                        )}
                        {!isCategoryView && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer">
                            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: over ? 'var(--red)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(actual)}</div>
                        <div className="budget-kpi-bar" style={{ marginTop: 4, width: 80 }}>
                          <div className="budget-kpi-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: over ? 'var(--red)' : color }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: v >= 0 ? 'var(--green, #16a34a)' : 'var(--red)', background: v >= 0 ? '#f0fdf4' : '#fef2f2', padding: '3px 8px', borderRadius: 6, fontVariantNumeric: 'tabular-nums' }}>{fmtSigned(v)}</span>
                      {isCategoryView ? <span /> : <button type="button" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="text-[12px] text-[var(--border)] hover:text-[var(--text-muted)] bg-transparent border-none cursor-pointer font-inherit">Remove</button>}
                    </div>
                    {isActive && transactions.length > 0 && (
                      <div className="budget-table-drawer">
                        <div className="budget-table-drawer-title">Transactions</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {transactions.map((tx, j) => (
                            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: j < transactions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tx.desc}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{tx.date}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(tx.amount)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Total: {fmt(transactions.reduce((s, t) => s + t.amount, 0))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {addingRow ? (
                <div className="budget-table-row" style={{ background: 'var(--bg-base)', gridTemplateColumns: '2fr 120px 120px 120px 100px 80px', padding: '12px 20px' }}>
                  <input placeholder="Description" value={newRow.description} onChange={(e) => setNewRow({ ...newRow, description: e.target.value })} className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[13px] outline-none w-full max-w-[200px]" />
                  <select value={newRow.category} onChange={(e) => setNewRow({ ...newRow, category: e.target.value })} className="rounded-md border border-[var(--border)] px-2 py-1.5 text-[12px] outline-none">
                    <option value="labor">Labor</option><option value="materials">Materials</option><option value="subs">Subcontractors</option>
                  </select>
                  <input placeholder="Budget" value={newRow.budgeted} onChange={(e) => setNewRow({ ...newRow, budgeted: e.target.value })} className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[13px] font-mono outline-none w-20" />
                  <input placeholder="Actual" value={newRow.actual} onChange={(e) => setNewRow({ ...newRow, actual: e.target.value })} className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[13px] font-mono outline-none w-20" />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={addRow} className="px-3 py-1 rounded-md bg-[var(--text-primary)] text-white text-[12px] font-semibold border-none cursor-pointer">Add</button>
                    <button type="button" onClick={() => setAddingRow(false)} className="px-2 py-1 rounded-md bg-[var(--bg-base)] text-[var(--text-muted)] text-[12px] border-none cursor-pointer">✕</button>
                  </div>
                  <span />
                </div>
              ) : (
                <div className="budget-table-add-row">
                  <button type="button" onClick={() => setAddingRow(true)} className="budget-table-add-row-btn">
                    + Add line item
                  </button>
                </div>
              )}
              <div className="budget-table-totals">
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL</span>
                <span /><span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalBudget)}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalActual)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: variance >= 0 ? 'var(--green, #16a34a)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>{fmtSigned(variance)}</span>
                <span />
              </div>
            </div>
          )}

          {activeSection === 'changeorders' && (
            <div className="budget-co-card">
              <div className="budget-co-header">
                <div>
                  <div className="budget-table-title">Change Orders</div>
                  <div className="budget-table-sub">Scope changes that adjust the budget baseline</div>
                </div>
                <button type="button" className="px-3.5 py-1.5 rounded-lg bg-[var(--red)] text-white text-[12px] font-semibold border-none cursor-pointer">+ New CO</button>
              </div>
              <div style={{ padding: '0 20px' }}>
                {changeOrders.map((co, i) => (
                  <div key={co.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < changeOrders.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', width: 60 }}>{co.id}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{co.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{co.date}</div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>+{fmt(co.amount)}</span>
                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, background: co.status === 'Approved' ? '#f0fdf4' : '#fffbeb', color: co.status === 'Approved' ? '#15803d' : '#a16207' }}>{co.status}</span>
                  </div>
                ))}
              </div>
              <div className="budget-co-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Approved: <span style={{ fontWeight: 700, color: 'var(--green, #16a34a)', fontVariantNumeric: 'tabular-nums' }}>+{fmt(approvedCOs)}</span> &nbsp;·&nbsp; Pending: <span style={{ fontWeight: 700, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>+{fmt(pendingCOs)}</span></span>
              </div>
            </div>
          )}

          {activeSection === 'forecast' && (
            <div className="budget-forecast-card">
              <div className="budget-forecast-header">
                <div className="budget-table-title">Forecast to Complete</div>
                <div className="budget-table-sub">Projected final spend based on current burn rate</div>
              </div>
              <div style={{ padding: 20 }}>
                {[
                  { label: 'Actual spend to date', value: totalActual, color: 'var(--text-primary)' },
                  { label: `Labor remaining (${MOCK_FORECAST.hoursLeft}hrs × $${MOCK_FORECAST.laborRate}/hr)`, value: MOCK_FORECAST.laborRate * MOCK_FORECAST.hoursLeft, color: '#6366f1' },
                  { label: 'Materials pending (open POs)', value: MOCK_FORECAST.materialsPending, color: '#0ea5e9' },
                  { label: 'Subcontractors remaining', value: MOCK_FORECAST.subsRemaining, color: '#8b5cf6' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {i > 0 && <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />}
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.color, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.value)}</span>
                  </div>
                ))}
                <div className="budget-forecast-summary" style={{ background: forecastVariance >= 0 ? '#f0fdf4' : '#fef2f2', borderColor: forecastVariance >= 0 ? '#bbf7d0' : '#fecaca' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Projected Final Cost</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>vs {fmt(totalBudget)} budget</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(forecastTotal)}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: forecastVariance >= 0 ? 'var(--green, #16a34a)' : 'var(--red)' }}>{fmtSigned(forecastVariance)} projected</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Donut + Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="budget-donut-right">
            <div className="budget-donut-title">Spend Breakdown</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <svg width={120} height={120} viewBox="0 0 120 120">
                {segments.filter((s) => s.pct > 0).map((seg) => (
                  <path key={seg.id} d={arcPath(seg.start, seg.start + seg.pct, 44)} fill="none" stroke={seg.color} strokeWidth={12} strokeLinecap="butt" />
                ))}
                <circle cx={60} cy={60} r={32} fill="var(--bg-surface)" />
                <text x={60} y={56} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-primary)">ACTUAL</text>
                <text x={60} y={72} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--text-primary)" style={{ fontVariantNumeric: 'tabular-nums' }}>${Math.round(totalActual / 1000)}k</text>
              </svg>
            </div>
            {list.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: getItemColor(item) }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(item.actual || 0))}</span>
              </div>
            ))}
          </div>
          <div className="budget-alerts-card">
            <div className="budget-alerts-title">Alerts</div>
            {list.map((item) => {
              const budgeted = Number(item.predicted || 0)
              const actual = Number(item.actual || 0)
              const pct = budgeted ? Math.round((actual / budgeted) * 100) : 0
              if (pct < 80) return null
              const over = pct > 100
              return (
                <div key={item.id} className="budget-alert-item" style={{ background: over ? '#fef2f2' : '#fffbeb', borderColor: over ? '#fecaca' : '#fde68a' }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={over ? 'var(--red)' : '#f59e0b'} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: over ? '#991b1b' : '#92400e' }}>{over ? `${item.label} over budget` : `${item.label} at ${pct}% of budget`}</div>
                    <div style={{ fontSize: 11, color: over ? 'var(--red)' : '#f59e0b', marginTop: 1 }}>{fmt(actual)} of {fmt(budgeted)} budgeted</div>
                  </div>
                </div>
              )
            })}
            {list.every((i) => (Number(i.actual || 0) / (Number(i.predicted) || 1)) < 0.8) && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No alerts – all categories on track</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
