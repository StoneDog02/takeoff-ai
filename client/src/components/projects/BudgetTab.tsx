import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { api } from '@/api/client'
import type { BudgetLineItem, ChangeOrder, EstimateLineItem } from '@/types/global'
import { budgetCategoryKeyFromEstimateSection } from '@/lib/budgetCategoryFromEstimateSection'
import {
  BUDGET_CATEGORY_KEY_TO_UNITS_CATEGORY,
  CATEGORY_UNITS,
  DEFAULT_UNITS,
} from '@/constants/units'
import { nextUnitForBudgetCategoryKey } from '@/lib/categoryUnits'

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

/** Normalized category key for grouping. Uses item.category when it's a real category; if category is "other" or missing, infers from label so Project Setup categories (Labor, Materials, etc.) display correctly. */
function normalizeCategoryKey(item: BudgetLineItem): string {
  const c = (item.category || '').toLowerCase().trim()
  const realCategories = ['labor', 'materials', 'subs', 'equipment', 'permits', 'overhead'] as const
  if (realCategories.includes(c as typeof realCategories[number])) return c === 'subcontractors' ? 'subs' : c
  const label = (item.label || '').toLowerCase()
  if (label.includes('labor')) return 'labor'
  if (label.includes('material')) return 'materials'
  if (label.includes('sub') || label.includes('contractor')) return 'subs'
  if (label.includes('equipment')) return 'equipment'
  if (label.includes('permit')) return 'permits'
  if (label.includes('overhead')) return 'overhead'
  return 'other'
}

/** Order for "By Category" rows so Labor, Materials, etc. appear consistently. */
const CATEGORY_ORDER: string[] = ['labor', 'materials', 'subs', 'equipment', 'permits', 'overhead', 'other']

/** Map estimate lines to budget-shaped rows; merge actuals from saved budget lines when labels match within category. */
function budgetLinesFromEstimateLineItems(
  projectId: string,
  lines: EstimateLineItem[],
  mergeActualsFrom: BudgetLineItem[]
): BudgetLineItem[] {
  const pool = [...mergeActualsFrom]
  return lines.map((li) => {
    const cat = budgetCategoryKeyFromEstimateSection(li.section)
    const predicted =
      (Number.isFinite(Number(li.total)) ? Number(li.total) : 0) ||
      (Number(li.quantity) || 0) * (Number(li.unit_price) || 0)
    const label = (li.description || 'Line item').trim() || 'Line item'
    const idx = pool.findIndex(
      (b) => normalizeCategoryKey(b) === cat && (b.label || '').trim().toLowerCase() === label.toLowerCase()
    )
    let actual = 0
    if (idx !== -1) {
      actual = Number(pool[idx].actual) || 0
      pool.splice(idx, 1)
    }
    return {
      id: `est-pending-${li.id}`,
      project_id: projectId,
      label,
      predicted: Math.max(0, predicted),
      actual,
      category: cat,
      unit: li.unit || undefined,
      source: 'estimate',
    }
  })
}

/** Transactions per line item: empty until API/live data exists. */
function getTransactions(_itemId: string): { desc: string; date: string; amount: number }[] {
  return []
}

function fmt(n: number): string {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

function fmtSigned(n: number): string {
  return (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

/** Budget line created after the project estimate was approved (not seeded from estimate). */
function isPostApprovalBudgetLine(item: BudgetLineItem, estimateApprovedAt: string | null | undefined): boolean {
  if (!estimateApprovedAt || !item.created_at) return false
  if (item.source === 'estimate') return false
  const at = new Date(estimateApprovedAt).getTime()
  const ct = new Date(item.created_at).getTime()
  if (Number.isNaN(at) || Number.isNaN(ct)) return false
  return ct > at
}

export interface BudgetTabProps {
  projectId: string
  items: BudgetLineItem[]
  onSave: (items: BudgetLineItem[]) => Promise<void>
  schedulePhases?: unknown[]
  /** When set, labor actual is auto-pulled from time entries; show hint in UI. */
  laborActualFromTimeEntries?: number
  /** When set, subs actual is auto-pulled from bid sheet awarded; show hint in UI. */
  subsActualFromBidSheet?: number
  /** From GET budget; use for KPIs so totals don't flash 0 before change orders list loads. */
  approvedChangeOrdersTotal?: number
  /** When set, budget lines with created_at after this time (and not estimate-seeded) show as scope changes (CO). */
  estimateApprovedAt?: string | null
  /** Latest open estimate lines while job is awaiting client approval — drives read-only “provisional” budget in the Line Items section. */
  provisionalEstimateLineItems?: EstimateLineItem[] | null
  /** When true with `provisionalEstimateLineItems`, line items are estimate-based, greyed, and not editable. */
  budgetAwaitingEstimateApproval?: boolean
}

type SectionId = 'budget' | 'changeorders' | 'forecast'

export function BudgetTab({
  projectId,
  items,
  onSave,
  laborActualFromTimeEntries,
  subsActualFromBidSheet,
  approvedChangeOrdersTotal,
  estimateApprovedAt,
  provisionalEstimateLineItems = null,
  budgetAwaitingEstimateApproval = false,
}: BudgetTabProps) {
  const [list, setList] = useState<BudgetLineItem[]>(() => items)
  const [viewMode, setViewMode] = useState<'category' | 'item'>('category')
  const [drawerItem, setDrawerItem] = useState<BudgetLineItem | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [editingActualId, setEditingActualId] = useState<string | null>(null)
  const [editActualVal, setEditActualVal] = useState('')
  const [addingRow, setAddingRow] = useState(false)
  /** When set, add form is shown after this category in By Item view; null = show at bottom. */
  const [addingForCategory, setAddingForCategory] = useState<string | null>(null)
  const emptyBudgetAddRow = useCallback(
    (category: string = 'labor') => ({
      description: '',
      category,
      unit: nextUnitForBudgetCategoryKey(category),
      budgeted: '',
      actual: '',
    }),
    []
  )
  const [newRow, setNewRow] = useState(() => emptyBudgetAddRow('labor'))
  const [activeSection, setActiveSection] = useState<SectionId>('budget')
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([])
  const [coModalOpen, setCoModalOpen] = useState(false)
  const [editingCoId, setEditingCoId] = useState<string | null>(null)
  const [coSaving, setCoSaving] = useState(false)
  const [coError, setCoError] = useState<string | null>(null)
  const [coMenuOpenId, setCoMenuOpenId] = useState<string | null>(null)
  const [coMenuAnchor, setCoMenuAnchor] = useState<{ top: number; right: number } | null>(null)
  const coMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const [newCO, setNewCO] = useState({ description: '', amount: '', status: 'Pending' as 'Approved' | 'Pending', date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }), category: 'other' })

  const provisionalMode = Boolean(
    budgetAwaitingEstimateApproval &&
      provisionalEstimateLineItems &&
      provisionalEstimateLineItems.length > 0
  )

  const listFromEstimateMerged = useMemo(() => {
    if (!provisionalMode || !provisionalEstimateLineItems?.length) return null
    return budgetLinesFromEstimateLineItems(projectId, provisionalEstimateLineItems, items)
  }, [provisionalMode, provisionalEstimateLineItems, projectId, items])

  const rollupList = listFromEstimateMerged ?? list

  useEffect(() => {
    if (provisionalMode) return
    setList(items)
  }, [items, provisionalMode])

  useEffect(() => {
    if (!projectId) return
    api.projects.getChangeOrders(projectId).then(setChangeOrders).catch(() => setChangeOrders([]))
  }, [projectId])

  useLayoutEffect(() => {
    if (!coMenuOpenId) {
      setCoMenuAnchor(null)
      return
    }
    const rect = coMenuButtonRef.current?.getBoundingClientRect()
    if (rect) setCoMenuAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }, [coMenuOpenId])

  const baselineBudget = useMemo(() => rollupList.reduce((s, i) => s + Number(i.predicted || 0), 0), [rollupList])
  const totalActual = useMemo(() => rollupList.reduce((s, i) => s + Number(i.actual || 0), 0), [rollupList])
  const approvedCOsFromList = useMemo(() => changeOrders.filter((c) => c.status === 'Approved').reduce((s, c) => s + c.amount, 0), [changeOrders])
  const approvedCOs = approvedChangeOrdersTotal ?? approvedCOsFromList
  const postApprovalLinesSum = useMemo(() => {
    if (!estimateApprovedAt) return 0
    return rollupList.reduce((s, i) => s + (isPostApprovalBudgetLine(i, estimateApprovedAt) ? Number(i.predicted) || 0 : 0), 0)
  }, [rollupList, estimateApprovedAt])
  const originalEstimateBaseline = useMemo(
    () => rollupList.reduce((s, i) => s + (i.source === 'estimate' ? Number(i.predicted) || 0 : 0), 0),
    [rollupList]
  )
  /** Post-approval budget lines + approved formal COs (same CO source as total budget KPIs). */
  const approvedChangesRunningTotal = useMemo(
    () => postApprovalLinesSum + approvedCOs,
    [postApprovalLinesSum, approvedCOs]
  )
  const pendingCOs = useMemo(() => changeOrders.filter((c) => c.status === 'Pending').reduce((s, c) => s + c.amount, 0), [changeOrders])
  const totalBudget = baselineBudget + approvedCOs
  const variance = totalBudget - totalActual
  const budgetPct = totalBudget ? Math.round((totalActual / totalBudget) * 100) : 0
  const forecastTotal = totalActual + approvedCOs
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

  const startEditActual = useCallback((item: BudgetLineItem) => {
    setEditingActualId(item.id)
    setEditActualVal(String(item.actual ?? 0))
  }, [])

  const commitEditActual = useCallback(
    (id: string) => {
      const val = parseFloat(editActualVal)
      if (!Number.isNaN(val) && val >= 0) {
        const next = list.map((i) => (i.id === id ? { ...i, actual: val } : i))
        setList(next)
        onSave(next).catch(() => {})
      }
      setEditingActualId(null)
    },
    [editActualVal, list, onSave]
  )

  const addRow = useCallback(() => {
    const desc = newRow.description.trim()
    const budgeted = parseFloat(newRow.budgeted) || 0
    if (!desc || budgeted <= 0) return
    const category = newRow.category || 'labor'
    const unit = (newRow.unit || '').trim() || nextUnitForBudgetCategoryKey(category)
    const newItem: BudgetLineItem = {
      id: `new-${Date.now()}`,
      project_id: list[0]?.project_id ?? '',
      label: desc,
      predicted: budgeted,
      actual: parseFloat(newRow.actual) || 0,
      category,
      unit,
    }
    const next = [...list, newItem]
    setList(next)
    onSave(next).catch(() => {})
    setNewRow(emptyBudgetAddRow('labor'))
    setAddingRow(false)
    setAddingForCategory(null)
  }, [newRow, list, onSave, emptyBudgetAddRow])

  const removeItem = useCallback(
    (id: string) => {
      const next = list.filter((i) => i.id !== id)
      setList(next)
      if (drawerItem?.id === id) setDrawerItem(null)
      onSave(next).catch(() => {})
    },
    [list, drawerItem, onSave]
  )

  const defaultCOForm = useCallback(() => ({ description: '', amount: '', status: 'Pending' as const, date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }), category: 'other' }), [])

  const handleSaveChangeOrder = useCallback(async () => {
    if (!projectId) {
      setCoError('Project not loaded. Please refresh and try again.')
      return
    }
    const desc = newCO.description.trim()
    const amount = parseFloat(newCO.amount)
    if (!desc || Number.isNaN(amount) || amount < 0) return
    setCoError(null)
    setCoSaving(true)
    try {
      const category = (newCO.category && CATEGORY_ORDER.includes(newCO.category)) ? newCO.category : 'other'
      const payload = { description: desc, amount, status: newCO.status, date: newCO.date, category }
      if (editingCoId) {
        const updated = await api.projects.updateChangeOrder(projectId, editingCoId, payload)
        setChangeOrders((prev) => prev.map((c) => (c.id === editingCoId ? updated : c)))
        setEditingCoId(null)
      } else {
        const created = await api.projects.createChangeOrder(projectId, payload)
        setChangeOrders((prev) => [created, ...prev])
      }
      setCoModalOpen(false)
      setNewCO(defaultCOForm())
    } catch (err) {
      setCoError(err instanceof Error ? err.message : 'Failed to save change order')
    } finally {
      setCoSaving(false)
    }
  }, [newCO, editingCoId, projectId, defaultCOForm])

  const openEditCO = useCallback((co: ChangeOrder) => {
    setNewCO({ description: co.description, amount: String(co.amount), status: co.status, date: co.date, category: co.category || 'other' })
    setEditingCoId(co.id)
    setCoModalOpen(true)
  }, [])

  const handleDeleteChangeOrder = useCallback(async (coId: string) => {
    setCoMenuOpenId(null)
    await api.projects.deleteChangeOrder(projectId, coId)
    setChangeOrders((prev) => prev.filter((c) => c.id !== coId))
  }, [projectId])

  const handleApproveChangeOrder = useCallback(async (coId: string) => {
    setCoMenuOpenId(null)
    try {
      const updated = await api.projects.updateChangeOrder(projectId, coId, { status: 'Approved' })
      setChangeOrders((prev) => prev.map((c) => (c.id === coId ? updated : c)))
    } catch {
      // leave state unchanged on error
    }
  }, [projectId])

  // Donut segments
  const donutTotal = totalActual || 1
  let cumPct = 0
  const segments = rollupList.map((item) => {
    const pct = Number(item.actual || 0) / donutTotal
    const start = cumPct
    cumPct += pct
    return { ...item, start, pct, color: getItemColor(item) }
  })
  const spendBreakdownRows = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const item of rollupList) {
      const key = normalizeCategoryKey(item)
      byCategory.set(key, (byCategory.get(key) ?? 0) + (Number(item.actual) || 0))
    }
    return CATEGORY_ORDER
      .filter((key) => byCategory.has(key))
      .map((key) => ({
        id: `spend-${key}`,
        project_id: projectId,
        label: CATEGORY_LABELS[key] ?? key,
        predicted: 0,
        actual: byCategory.get(key) ?? 0,
        category: key,
      }))
  }, [rollupList, projectId])

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

  function renderBudgetRow(
    item: BudgetLineItem,
    isCategoryView: boolean,
    isChangeOrder = false,
    coId?: string,
    coStatus?: 'Approved' | 'Pending',
    categoryPendingAmount?: number,
    actualSourceLabel?: string,
    postApprovalLine?: boolean,
    readOnlyProvisional = false
  ) {
    const budgeted = Number(item.predicted || 0)
    const actual = Number(item.actual || 0)
    const v = budgeted - actual
    const pct = budgeted ? Math.round((actual / budgeted) * 100) : 0
    const over = actual > budgeted
    const color = getItemColor(item)
    const rowInteractive = !readOnlyProvisional && !isCategoryView && !isChangeOrder
    const isActive = rowInteractive && drawerItem?.id === item.id
    const transactions = !isCategoryView && !isChangeOrder ? getTransactions(item.id) : []
    return (
      <div key={item.id}>
        <div
          role={rowInteractive ? 'button' : undefined}
          tabIndex={rowInteractive ? 0 : undefined}
          onClick={rowInteractive && !isChangeOrder ? () => setDrawerItem(isActive ? null : item) : undefined}
          onKeyDown={rowInteractive && !isChangeOrder ? (e) => e.key === 'Enter' && (setDrawerItem(isActive ? null : item), e.preventDefault()) : undefined}
          className={`budget-table-row ${isActive ? 'active' : ''} ${readOnlyProvisional && !isChangeOrder ? 'budget-table-row--provisional' : ''}`}
          style={{
            borderLeftColor: isActive ? color : undefined,
            cursor: rowInteractive ? undefined : 'default',
            ...(readOnlyProvisional && !isChangeOrder ? { opacity: 0.94 } : {}),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {item.label || 'Untitled'}
                {!isChangeOrder && item.source === 'estimate' && !readOnlyProvisional && (
                  <span
                    style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}
                    title="Seeded from approved estimate"
                  >
                    EST
                  </span>
                )}
                {!isChangeOrder && item.source === 'estimate' && readOnlyProvisional && (
                  <span
                    style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}
                    title="From latest estimate — not yet approved"
                  >
                    PENDING
                  </span>
                )}
                {!isChangeOrder && postApprovalLine && (
                  <span
                    style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}
                    title="Budget line added after estimate was approved"
                  >
                    CO
                  </span>
                )}
                {isChangeOrder && (
                  coStatus === 'Pending'
                    ? <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>Pending</span>
                    : <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>CO</span>
                )}
              </div>
              {!isCategoryView && !isChangeOrder && item.category === 'labor' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>🔗 Time logs</div>}
              {!isCategoryView && !isChangeOrder && item.category === 'subs' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>🔗 Bid sheet</div>}
            </div>
          </div>
          <span style={{ fontSize: 11, background: color + '18', color, padding: '2px 8px', borderRadius: 6, fontWeight: 600, width: 'fit-content' }}>{getItemCategoryLabel(item)}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {!isCategoryView && !isChangeOrder && item.unit?.trim()
              ? item.unit.trim()
              : '—'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!isCategoryView && !isChangeOrder && editingId === item.id ? (
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
              <span
                className="text-[13px] font-mono"
                style={{
                  color: readOnlyProvisional ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontStyle: readOnlyProvisional ? 'italic' : undefined,
                }}
              >
                {fmt(budgeted)}
                {readOnlyProvisional && !isCategoryView ? <span style={{ fontSize: 10, fontStyle: 'italic', marginLeft: 4, opacity: 0.85 }}>(est.)</span> : null}
              </span>
            )}
            {!isCategoryView && !isChangeOrder && !readOnlyProvisional && (
              <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer">
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!isCategoryView && !isChangeOrder && editingActualId === item.id ? (
              <input
                autoFocus
                value={editActualVal}
                onChange={(e) => setEditActualVal(e.target.value)}
                onBlur={() => commitEditActual(item.id)}
                onKeyDown={(e) => e.key === 'Enter' && (commitEditActual(item.id), e.preventDefault())}
                onClick={(e) => e.stopPropagation()}
                className="border border-[var(--border)] rounded-md px-1.5 py-0.5 w-20 text-[13px] font-mono outline-none"
                style={{ borderColor: '#6366f1' }}
              />
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: over ? 'var(--red)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(actual)}</div>
                {actualSourceLabel && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{actualSourceLabel}</div>
                )}
                <div className="budget-kpi-bar" style={{ marginTop: 4, width: 80 }}>
                  <div className="budget-kpi-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: over ? 'var(--red)' : color }} />
                </div>
              </div>
            )}
            {!isCategoryView && !isChangeOrder && !readOnlyProvisional && editingActualId !== item.id && (
              <button type="button" onClick={(e) => { e.stopPropagation(); startEditActual(item); }} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer" title="Edit actual">
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: v >= 0 ? 'var(--green, #16a34a)' : 'var(--red)', background: v >= 0 ? '#f0fdf4' : '#fef2f2', padding: '3px 8px', borderRadius: 6, fontVariantNumeric: 'tabular-nums', width: 'fit-content', flexShrink: 0 }}>{fmtSigned(v)}</span>
            {isCategoryView && categoryPendingAmount != null && categoryPendingAmount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontVariantNumeric: 'tabular-nums', width: 'fit-content', flexShrink: 0 }} title="Pending change orders">Pending +{fmt(categoryPendingAmount)}</span>
            )}
          </div>
          {isCategoryView || (readOnlyProvisional && !isChangeOrder) ? <span /> : isChangeOrder && coId ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteChangeOrder(coId); }} className="text-[12px] text-[var(--border)] hover:text-[var(--text-muted)] bg-transparent border-none cursor-pointer font-inherit">Remove</button>
          ) : (
            <button type="button" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="text-[12px] text-[var(--border)] hover:text-[var(--text-muted)] bg-transparent border-none cursor-pointer font-inherit">Remove</button>
          )}
        </div>
        {isActive && rowInteractive && (
          <div className="budget-table-drawer">
            <div className="budget-table-drawer-title">Transactions</div>
            {transactions.length > 0 ? (
              <>
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
              </>
            ) : (
              <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--text-muted)' }}>No transactions yet. Add live data when available.</div>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderAddRowForm() {
    const unitsCategory = BUDGET_CATEGORY_KEY_TO_UNITS_CATEGORY[newRow.category] ?? 'Other'
    const unitOpts = CATEGORY_UNITS[unitsCategory] ?? DEFAULT_UNITS
    return (
      <div className="budget-table-row budget-table-row--add-form" style={{ background: 'var(--bg-base)', padding: '12px 20px' }}>
        <input placeholder="Description" value={newRow.description} onChange={(e) => setNewRow({ ...newRow, description: e.target.value })} className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[13px] outline-none w-full max-w-[200px]" />
        <select
          value={newRow.category}
          onChange={(e) => {
            const category = e.target.value
            setNewRow((prev) => ({
              ...prev,
              category,
              unit: nextUnitForBudgetCategoryKey(category, prev.unit),
            }))
          }}
          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-[12px] outline-none"
        >
          {CATEGORY_ORDER.map((key) => (
            <option key={key} value={key}>{CATEGORY_LABELS[key] ?? key}</option>
          ))}
        </select>
        <select
          value={newRow.unit || nextUnitForBudgetCategoryKey(newRow.category)}
          onChange={(e) => setNewRow({ ...newRow, unit: e.target.value })}
          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-[11px] outline-none min-w-0"
          aria-label="Unit"
        >
          {unitOpts.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
          {newRow.unit &&
          !unitOpts.some((o) => o.value === newRow.unit.trim()) ? (
            <option value={newRow.unit}>{newRow.unit}</option>
          ) : null}
        </select>
        <input placeholder="Budget" value={newRow.budgeted} onChange={(e) => setNewRow({ ...newRow, budgeted: e.target.value })} className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[13px] font-mono outline-none w-20" />
        <input placeholder="Actual" value={newRow.actual} onChange={(e) => setNewRow({ ...newRow, actual: e.target.value })} className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[13px] font-mono outline-none w-20" />
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={addRow} className="px-3 py-1 rounded-md bg-[var(--text-primary)] text-white text-[12px] font-semibold border-none cursor-pointer">Add</button>
          <button
            type="button"
            onClick={() => {
              setAddingRow(false)
              setAddingForCategory(null)
              setNewRow(emptyBudgetAddRow('labor'))
            }}
            className="px-2 py-1 rounded-md bg-[var(--bg-base)] text-[var(--text-muted)] text-[12px] border-none cursor-pointer"
          >
            ✕
          </button>
        </div>
        <span />
      </div>
    )
  }

  return (
    <div className="budget-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {provisionalMode && (
        <div
          style={{
            fontSize: 13,
            color: '#92400e',
            padding: '10px 14px',
            background: '#fffbeb',
            borderRadius: 10,
            border: '1px solid #fde68a',
            lineHeight: 1.45,
          }}
        >
          Budget below reflects your latest estimate. Numbers are provisional until the client approves.
        </div>
      )}
      {/* Top KPI Row */}
      <div className="budget-kpi-row" style={provisionalMode ? { opacity: 0.92 } : undefined}>
        <div className="budget-kpi-card">
          <div className="budget-kpi-label">Total Budget</div>
          <div className="budget-kpi-value">{totalBudget ? fmt(totalBudget) : '—'}</div>
          {provisionalMode && (
            <div className="budget-kpi-sub" style={{ color: '#b45309' }}>Estimated — pending approval</div>
          )}
          {approvedCOs > 0 && (
            <div className="budget-kpi-sub" style={{ color: 'var(--green, #16a34a)' }}>+{fmt(approvedCOs)} in approved COs</div>
          )}
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
          <div className="budget-kpi-label">Forecast to Complete</div>
          <div className="budget-kpi-value">{totalActual > 0 ? fmt(forecastTotal) : '—'}</div>
          <div className="budget-kpi-sub" style={{ color: forecastVariance >= 0 ? 'var(--green, #16a34a)' : 'var(--red)' }}>{fmtSigned(forecastVariance)} projected variance</div>
        </div>
      </div>

      {/* Main Body */}
      <div className="budget-body" style={provisionalMode ? { opacity: 0.92 } : undefined}>
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
                  <div className="budget-table-sub">
                    {rollupList.length} line items
                    {!provisionalMode ? ' · click a row to see transactions' : ' · pending approval'}
                  </div>
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
                <span>Description</span>
                <span>Category</span>
                <span>Unit</span>
                <span>Budgeted</span>
                <span>Actual</span>
                <span>Variance</span>
                <span />
              </div>
              {viewMode === 'category' && (() => {
                const byCat = new Map<string, { predicted: number; actual: number }>()
                for (const i of rollupList) {
                  const key = normalizeCategoryKey(i)
                  const cur = byCat.get(key) ?? { predicted: 0, actual: 0 }
                  cur.predicted += Number(i.predicted || 0)
                  cur.actual += Number(i.actual || 0)
                  byCat.set(key, cur)
                }
                for (const co of changeOrders.filter((c) => c.status === 'Approved')) {
                  const key = (co.category && CATEGORY_ORDER.includes(co.category)) ? co.category : 'other'
                  const cur = byCat.get(key) ?? { predicted: 0, actual: 0 }
                  cur.predicted += co.amount
                  byCat.set(key, cur)
                }
                const pendingByCat = new Map<string, number>()
                for (const co of changeOrders.filter((c) => c.status === 'Pending')) {
                  const key = (co.category && CATEGORY_ORDER.includes(co.category)) ? co.category : 'other'
                  pendingByCat.set(key, (pendingByCat.get(key) ?? 0) + co.amount)
                }
                const categoryHasEstimateSource = new Map<string, boolean>()
                const categoryHasPostApprovalLine = new Map<string, boolean>()
                for (const i of rollupList) {
                  const key = normalizeCategoryKey(i)
                  if (i.source === 'estimate') categoryHasEstimateSource.set(key, true)
                  if (isPostApprovalBudgetLine(i, estimateApprovedAt)) categoryHasPostApprovalLine.set(key, true)
                }
                const categoryKeys = CATEGORY_ORDER.filter((key) => byCat.has(key) || (pendingByCat.get(key) ?? 0) > 0)
                return categoryKeys.map((key) => {
                  const catData = byCat.get(key)
                  const pendingAmt = pendingByCat.get(key) ?? 0
                  return renderBudgetRow(
                    {
                      id: `category-${key}`,
                      project_id: rollupList[0]?.project_id ?? '',
                      label: CATEGORY_LABELS[key] ?? key,
                      category: key,
                      predicted: catData?.predicted ?? 0,
                      actual: catData?.actual ?? 0,
                      ...(categoryHasEstimateSource.get(key) ? { source: 'estimate' as const } : {}),
                    } as BudgetLineItem,
                    true,
                    false,
                    undefined,
                    undefined,
                    pendingAmt,
                    undefined,
                    categoryHasPostApprovalLine.get(key) === true,
                    provisionalMode
                  )
                })
              })()}
              {viewMode === 'item' && (() => {
                const approvedCOList = changeOrders.filter((c) => c.status === 'Approved')
                const pendingCOList = changeOrders.filter((c) => c.status === 'Pending')
                const itemGroups = CATEGORY_ORDER.map((key) => ({
                  key,
                  items: rollupList.filter((i) => normalizeCategoryKey(i) === key),
                  cos: approvedCOList.filter((c) => ((c.category && CATEGORY_ORDER.includes(c.category)) ? c.category : 'other') === key),
                  pendingCos: pendingCOList.filter((c) => ((c.category && CATEGORY_ORDER.includes(c.category)) ? c.category : 'other') === key),
                })).filter((g) => g.items.length > 0 || g.cos.length > 0 || g.pendingCos.length > 0)
                return (
                  <>
                    {itemGroups.map((group) => (
                      <div key={group.key}>
                        {group.items.map((item) => {
                          const actualSourceLabel = group.key === 'labor' && laborActualFromTimeEntries != null && laborActualFromTimeEntries > 0 ? 'From time entries' : group.key === 'subs' && subsActualFromBidSheet != null && subsActualFromBidSheet > 0 ? 'From bid sheet' : undefined
                          return renderBudgetRow(
                            item,
                            false,
                            false,
                            undefined,
                            undefined,
                            undefined,
                            actualSourceLabel,
                            isPostApprovalBudgetLine(item, estimateApprovedAt),
                            provisionalMode
                          )
                        })}
                        {group.cos.map((co) => renderBudgetRow({
                          id: co.id,
                          project_id: co.project_id,
                          label: co.description,
                          predicted: co.amount,
                          actual: 0,
                          category: co.category || 'other',
                        } as BudgetLineItem, false, true, co.id, 'Approved'))}
                        {group.pendingCos.map((co) => renderBudgetRow({
                          id: co.id,
                          project_id: co.project_id,
                          label: co.description,
                          predicted: co.amount,
                          actual: 0,
                          category: co.category || 'other',
                        } as BudgetLineItem, false, true, co.id, 'Pending'))}
                        {!provisionalMode && (addingRow && addingForCategory === group.key ? renderAddRowForm() : (
                          <div className="budget-table-add-row">
                            <button
                              type="button"
                              className="budget-table-add-row-btn"
                              onClick={() => {
                                setNewRow(emptyBudgetAddRow(group.key))
                                setAddingForCategory(group.key)
                                setAddingRow(true)
                              }}
                            >
                              + Add line item
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                    {itemGroups.length === 0 && (
                      <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>No line items or change orders yet. Add line items above or add approved change orders in the Change Orders tab.</div>
                    )}
                    {!provisionalMode && (addingRow && addingForCategory === null ? renderAddRowForm() : (
                      <div className="budget-table-add-row">
                        <button
                          type="button"
                          className="budget-table-add-row-btn"
                          onClick={() => {
                            setNewRow(emptyBudgetAddRow('labor'))
                            setAddingForCategory(null)
                            setAddingRow(true)
                          }}
                        >
                          + Add line item
                        </button>
                      </div>
                    ))}
                  </>
                )
              })()}
              {viewMode === 'category' && !provisionalMode && (addingRow ? renderAddRowForm() : (
                <div className="budget-table-add-row">
                  <button
                    type="button"
                    className="budget-table-add-row-btn"
                    onClick={() => {
                      setNewRow(emptyBudgetAddRow('labor'))
                      setAddingRow(true)
                    }}
                  >
                    + Add line item
                  </button>
                </div>
              ))}
              <div className="budget-table-totals">
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL</span>
                <span />
                <span />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalBudget)}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalActual)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: variance >= 0 ? 'var(--green, #16a34a)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>{fmtSigned(variance)}</span>
                <span />
              </div>
              {estimateApprovedAt ? (
                <div className="budget-table-baseline-summary">
                  <div className="budget-table-baseline-summary-row">
                    <span>Original estimate (approved baseline)</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {originalEstimateBaseline > 0 ? fmt(originalEstimateBaseline) : '—'}
                    </span>
                  </div>
                  <div className="budget-table-baseline-summary-row">
                    <span>Approved changes</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(approvedChangesRunningTotal)}
                    </span>
                  </div>
                </div>
              ) : null}
              <div className="budget-table-badge-legend">
                {provisionalMode
                  ? 'PENDING = from latest estimate, not yet approved · CO = change order rows below.'
                  : 'EST = seeded from approved estimate · CO = change order or line added after approval.'}
              </div>
            </div>
          )}

          {activeSection === 'changeorders' && (
            <div className="budget-co-card">
              <div className="budget-co-header">
                <div>
                  <div className="budget-table-title">Change Orders</div>
                  <div className="budget-table-sub">Scope changes that adjust the budget baseline. Add COs when you have them.</div>
                </div>
                <button type="button" className="px-3.5 py-1.5 rounded-lg bg-[var(--red)] text-white text-[12px] font-semibold border-none cursor-pointer" onClick={() => { setEditingCoId(null); setCoError(null); setNewCO({ description: '', amount: '', status: 'Pending', date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }), category: 'other' }); setCoModalOpen(true); }}>+ New CO</button>
              </div>
              <div style={{ padding: '0 20px' }}>
                {changeOrders.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No change orders yet. Use “+ New CO” to add one when you have live data.</div>
                ) : (
                  changeOrders.map((co, i) => (
                    <div key={co.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 100px) 1fr auto auto auto', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < changeOrders.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={co.id}>{co.id.slice(0, 12)}…</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{co.description}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{co.date} · {CATEGORY_LABELS[co.category] ?? co.category}</div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>+{fmt(co.amount)}</span>
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, background: co.status === 'Approved' ? '#f0fdf4' : '#fffbeb', color: co.status === 'Approved' ? '#15803d' : '#a16207' }}>{co.status}</span>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          ref={coMenuOpenId === co.id ? coMenuButtonRef : undefined}
                          type="button"
                          onClick={() => setCoMenuOpenId((prev) => (prev === co.id ? null : co.id))}
                          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer p-1 rounded"
                          aria-label="Actions"
                          style={{ fontSize: 18, lineHeight: 1 }}
                        >
                          ⋮
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {changeOrders.length > 0 && (
                <div className="budget-co-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Approved: <span style={{ fontWeight: 700, color: 'var(--green, #16a34a)', fontVariantNumeric: 'tabular-nums' }}>+{fmt(approvedCOs)}</span> &nbsp;·&nbsp; Pending: <span style={{ fontWeight: 700, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>+{fmt(pendingCOs)}</span></span>
                </div>
              )}
            </div>
          )}

          {coMenuOpenId && coMenuAnchor && (() => {
            const co = changeOrders.find((c) => c.id === coMenuOpenId)
            if (!co) return null
            return createPortal(
              <>
                <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setCoMenuOpenId(null)} />
                <div
                  style={{
                    position: 'fixed',
                    top: coMenuAnchor.top,
                    right: coMenuAnchor.right,
                    zIndex: 41,
                    minWidth: 120,
                    background: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '4px 0',
                  }}
                >
                  <button type="button" onClick={() => { setCoMenuOpenId(null); openEditCO(co); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', background: '#fff', border: 'none', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9' }} onMouseOut={(e) => { e.currentTarget.style.background = '#fff' }}>Edit</button>
                  {co.status === 'Pending' && (
                    <button type="button" onClick={() => handleApproveChangeOrder(co.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--green, #16a34a)', background: '#fff', border: 'none', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9' }} onMouseOut={(e) => { e.currentTarget.style.background = '#fff' }}>Approve</button>
                  )}
                  <button type="button" onClick={() => handleDeleteChangeOrder(co.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--red)', background: '#fff', border: 'none', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9' }} onMouseOut={(e) => { e.currentTarget.style.background = '#fff' }}>Delete</button>
                </div>
              </>,
              document.body
            )
          })()}

          {activeSection === 'forecast' && (
            <div className="budget-forecast-card">
              <div className="budget-forecast-header">
                <div className="budget-table-title">Forecast to Complete</div>
                <div className="budget-table-sub">Projected final spend (actual to date + approved change orders).</div>
              </div>
              <div style={{ padding: 20 }}>
                {[
                  { label: 'Actual spend to date', value: totalActual, color: 'var(--text-primary)' },
                  { label: 'Approved change orders', value: approvedCOs, color: 'var(--green, #16a34a)' },
                  ...(pendingCOs > 0 ? [{ label: 'Pending change orders', value: pendingCOs, color: '#f59e0b' }] : []),
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 + (pendingCOs > 0 ? 1 : 0) - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.color, fontVariantNumeric: 'tabular-nums' }}>{row.value > 0 ? (row.label.includes('change order') ? `+${fmt(row.value)}` : fmt(row.value)) : '—'}</span>
                  </div>
                ))}
                <div className="budget-forecast-summary" style={{ background: forecastVariance >= 0 ? '#f0fdf4' : '#fef2f2', borderColor: forecastVariance >= 0 ? '#bbf7d0' : '#fecaca' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Projected Final Cost</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>vs {totalBudget ? fmt(totalBudget) : '—'} revised budget</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{forecastTotal > 0 ? fmt(forecastTotal) : '—'}</div>
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
                <text x={60} y={72} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--text-primary)" style={{ fontVariantNumeric: 'tabular-nums' }}>{totalActual >= 1000 ? `$${Math.round(totalActual / 1000)}k` : fmt(totalActual)}</text>
              </svg>
            </div>
            {spendBreakdownRows.map((item) => (
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
            {rollupList.map((item) => {
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
            {rollupList.every((i) => (Number(i.actual || 0) / (Number(i.predicted) || 1)) < 0.8) && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No alerts – all categories on track</div>
            )}
          </div>
        </div>
      </div>

      {coModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setCoModalOpen(false); setEditingCoId(null); setCoError(null); }} role="dialog" aria-modal="true" aria-labelledby="new-co-title">
          <div
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="new-co-title" className="text-lg font-semibold text-[var(--text-primary)] mb-4">{editingCoId ? 'Edit Change Order' : 'New Change Order'}</h2>
            {coError && (
              <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                {coError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
                <input
                  type="text"
                  value={newCO.description}
                  onChange={(e) => setNewCO((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-md px-3 py-2 border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                  placeholder="e.g. Added heated floor – tile phase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Category</label>
                <select
                  value={newCO.category}
                  onChange={(e) => setNewCO((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-md px-3 py-2 border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                >
                  {CATEGORY_ORDER.map((key) => (
                    <option key={key} value={key}>{CATEGORY_LABELS[key] ?? key}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Amount ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={newCO.amount}
                  onChange={(e) => setNewCO((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full rounded-md px-3 py-2 border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Status</label>
                <select
                  value={newCO.status}
                  onChange={(e) => setNewCO((p) => ({ ...p, status: e.target.value as 'Approved' | 'Pending' }))}
                  className="w-full rounded-md px-3 py-2 border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Date</label>
                <input
                  type="text"
                  value={newCO.date}
                  onChange={(e) => setNewCO((p) => ({ ...p, date: e.target.value }))}
                  className="w-full rounded-md px-3 py-2 border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                  placeholder="MM/DD/YYYY"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => { setCoModalOpen(false); setEditingCoId(null); }} className="px-3 py-1.5 rounded-md text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] text-sm font-medium">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveChangeOrder()}
                disabled={coSaving || !newCO.description.trim() || !newCO.amount || parseFloat(newCO.amount) < 0}
                className="px-3 py-1.5 rounded-md bg-[var(--red)] text-white text-sm font-semibold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {coSaving ? 'Saving…' : editingCoId ? 'Save changes' : 'Add change order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
