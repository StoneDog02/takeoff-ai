import { useState, useEffect } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Job, JobExpense, JobReceiptsMeta, Invoice } from '@/types/global'
import type { ExpenseCategory } from '@/types/global'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/pipeline'
import { ScanReceiptModal } from './ScanReceiptModal'
import { AddToInvoiceModal } from './AddToInvoiceModal'
import {
  USE_MOCK_ESTIMATES,
  MOCK_JOB_EXPENSES,
  MOCK_JOB_RECEIPTS_META,
  MOCK_INVOICES,
} from '@/data/mockEstimatesData'

const CATEGORY_OPTIONS: { value: ExpenseCategory | 'All'; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'materials', label: 'Materials' },
  { value: 'labor', label: 'Labor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'subs', label: 'Subs' },
  { value: 'misc', label: 'Other' },
]

const BILLABLE_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'Billable', label: 'Billable' },
  { value: 'Overhead', label: 'Overhead' },
]

/** Map our category to budget key (Labor, Materials, etc.) for BudgetPanel */
const CAT_TO_BUDGET_KEY: Record<ExpenseCategory, string> = {
  materials: 'Materials',
  labor: 'Labor',
  equipment: 'Equipment',
  subs: 'Subs',
  misc: 'Other',
}

interface ReceiptSpendTrackingProps {
  jobs: Job[]
  /** Called when user clicks "Add to Invoice" (e.g. switch to Pipeline tab) */
  onAddToInvoice?: () => void
}

export function ReceiptSpendTracking({ jobs, onAddToInvoice }: ReceiptSpendTrackingProps) {
  const [activeJobId, setActiveJobId] = useState<string>(jobs[0]?.id ?? '')
  const [expenses, setExpenses] = useState<JobExpense[]>([])
  const [loading, setLoading] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [catFilter, setCatFilter] = useState<ExpenseCategory | 'All'>('All')
  const [billableFilter, setBillableFilter] = useState<string>('All')
  const [dismissedBanner, setDismissedBanner] = useState(false)
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null)
  const [showAddToInvoiceModal, setShowAddToInvoiceModal] = useState(false)
  const [invoicesForJob, setInvoicesForJob] = useState<Invoice[]>([])

  useEffect(() => {
    if (!activeJobId) {
      setExpenses([])
      return
    }
    if (USE_MOCK_ESTIMATES) {
      setExpenses(MOCK_JOB_EXPENSES.filter((e) => e.job_id === activeJobId))
      setLoading(false)
      return
    }
    setLoading(true)
    estimatesApi
      .getJobExpenses(activeJobId)
      .then(setExpenses)
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false))
  }, [activeJobId])

  useEffect(() => {
    if (!showAddToInvoiceModal || !activeJobId) {
      setInvoicesForJob([])
      return
    }
    if (USE_MOCK_ESTIMATES) {
      setInvoicesForJob(
        MOCK_INVOICES.filter((i) => i.job_id === activeJobId && i.status !== 'paid')
      )
      return
    }
    estimatesApi
      .getInvoices(activeJobId)
      .then((list) =>
        setInvoicesForJob(list.filter((i) => i.status !== 'paid'))
      )
      .catch(() => setInvoicesForJob([]))
  }, [showAddToInvoiceModal, activeJobId])

  const jobReceipts = expenses
  const filtered = jobReceipts
    .filter((r) => catFilter === 'All' || r.category === catFilter)
    .filter((r) =>
      billableFilter === 'All'
        ? true
        : billableFilter === 'Billable'
          ? r.billable === true
          : r.billable !== true
    )

  const totalSpent = jobReceipts.reduce((s, r) => s + Number(r.amount), 0)
  const billableTotal = jobReceipts.filter((r) => r.billable).reduce((s, r) => s + Number(r.amount), 0)
  const overheadTotal = jobReceipts.filter((r) => !r.billable).reduce((s, r) => s + Number(r.amount), 0)
  const activeJob = jobs.find((j) => j.id === activeJobId)
  const meta = USE_MOCK_ESTIMATES ? MOCK_JOB_RECEIPTS_META[activeJobId] : undefined
  const estimateTotal = meta?.estimateTotal ?? 0
  const pctComplete = meta?.pctComplete ?? 0
  const estimatedFinal = pctComplete > 0 ? (totalSpent / pctComplete) * 100 : 0
  const showChangeOrderBanner =
    !dismissedBanner &&
    pctComplete > 0 &&
    estimatedFinal > estimateTotal &&
    estimateTotal > 0

  const addReceipt = (r: Omit<JobExpense, 'id' | 'created_at'> & { id: number; created_at: string }) => {
    const newExpense: JobExpense = {
      id: String(r.id),
      job_id: r.job_id,
      amount: r.amount,
      category: r.category,
      description: r.description,
      created_at: r.created_at,
      billable: r.billable,
      vendor: r.vendor,
    }
    if (USE_MOCK_ESTIMATES) {
      setExpenses((prev) => [newExpense, ...prev])
      return
    }
    estimatesApi
      .createJobExpense({
        job_id: r.job_id,
        amount: r.amount,
        category: r.category,
        description: r.description,
        billable: r.billable,
        vendor: r.vendor,
      })
      .then((created) => setExpenses((prev) => [created, ...prev]))
      .catch(console.error)
  }

  const toggleBillable = (id: string) => {
    if (USE_MOCK_ESTIMATES) {
      setExpenses((prev) =>
        prev.map((r) => (r.id === id ? { ...r, billable: !r.billable } : r))
      )
      return
    }
    // API might not have PATCH; for now only mock supports toggle
    setExpenses((prev) =>
      prev.map((r) => (r.id === id ? { ...r, billable: !r.billable } : r))
    )
  }

  const removeReceipt = async (id: string) => {
    if (!confirm('Remove this expense?')) return
    if (USE_MOCK_ESTIMATES) {
      setExpenses((prev) => prev.filter((r) => r.id !== id))
      return
    }
    try {
      await estimatesApi.deleteJobExpense(id)
      setExpenses((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <>
      {showScan && (
        <ScanReceiptModal
          jobs={jobs}
          defaultJobId={activeJobId}
          onClose={() => setShowScan(false)}
          onAdd={addReceipt}
        />
      )}

      {showAddToInvoiceModal && activeJob && (
        <AddToInvoiceModal
          job={activeJob}
          billableExpenses={jobReceipts.filter((r) => r.billable)}
          existingInvoices={invoicesForJob}
          onClose={() => setShowAddToInvoiceModal(false)}
          onSuccess={() => {
            setShowAddToInvoiceModal(false)
            onAddToInvoice?.()
          }}
        />
      )}

      <div className="receipts-page-header">
        <div className="receipts-page-header__top">
          <div>
            <div className="receipts-page-header__eyebrow">Finance</div>
            <h1 className="receipts-page-header__title">Receipts & Spend</h1>
          </div>
          <button
            type="button"
            className="receipts-page-header__scan-btn"
            onClick={() => setShowScan(true)}
          >
            Scan Receipt
          </button>
        </div>
        <div className="receipts-page-job-tabs">
          {jobs.map((j) => (
            <button
              key={j.id}
              type="button"
              className={`receipts-page-job-tab ${activeJobId === j.id ? 'active' : ''}`}
              onClick={() => {
                setActiveJobId(j.id)
                setDismissedBanner(false)
              }}
            >
              {j.name.split('–')[0].trim()}
            </button>
          ))}
        </div>
      </div>

      <div
        className="estimates-receipts-layout"
        style={{ padding: '24px 32px', maxWidth: 1280, gridTemplateColumns: '1fr 320px' }}
      >
        <div>
          {showChangeOrderBanner && activeJob && meta && (
            <ChangeOrderBanner
              jobName={activeJob.name}
              estimateTotal={estimateTotal}
              spent={totalSpent}
              pctComplete={pctComplete}
              onDismiss={() => setDismissedBanner(true)}
            />
          )}

          <div className="receipts-kpis">
            {[
              {
                label: 'Total Spent',
                val: formatCurrency(totalSpent),
                sub: `${jobReceipts.length} expenses`,
                color: 'var(--text-primary)',
              },
              {
                label: 'Billable',
                val: formatCurrency(billableTotal),
                sub: 'Passthrough to client',
                color: 'var(--green)',
              },
              {
                label: 'Overhead',
                val: formatCurrency(overheadTotal),
                sub: 'Your cost to carry',
                color: 'var(--est-amber)',
              },
              {
                label: 'Est. Remaining',
                val: formatCurrency(Math.max(0, estimateTotal - totalSpent)),
                sub: 'Budget left',
                color: 'var(--blue)',
              },
            ].map((k, i) => (
              <div key={i} className="receipts-kpi">
                <div className="receipts-kpi__label">{k.label}</div>
                <div className="receipts-kpi__val" style={{ color: k.color }}>
                  {k.val}
                </div>
                <div className="receipts-kpi__sub">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="receipts-table-card">
            <div className="receipts-table-toolbar">
              <div className="receipts-table-tabs">
                {CATEGORY_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className={`receipts-table-tab ${catFilter === f.value ? 'active' : ''}`}
                    onClick={() => setCatFilter(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="receipts-table-tabs">
                {BILLABLE_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className={`receipts-table-tab ${billableFilter === f.value ? 'active' : ''}`}
                    onClick={() => setBillableFilter(f.value)}
                  >
                    {f.value}
                  </button>
                ))}
              </div>
              <span className="receipts-kpi__sub" style={{ marginLeft: 'auto' }}>
                {filtered.length} expenses
              </span>
            </div>

            <div className="receipts-table-header">
              <span>Date</span>
              <span>Category</span>
              <span>Description</span>
              <span>Vendor</span>
              <span>Amount</span>
              <span>Billable</span>
              <span />
            </div>

            {loading ? (
              <div className="estimates-ledger__empty" style={{ padding: 48 }}>
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="estimates-ledger__empty" style={{ padding: 48 }}>
                No expenses match this filter
              </div>
            ) : (
              filtered.map((r) => {
                const isSelected = selectedReceiptId === r.id
                return (
                  <div
                    key={r.id}
                    className={`receipts-table-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedReceiptId(isSelected ? null : r.id)}
                  >
                    <div className="receipts-table-row__date">
                      {formatDate(r.created_at)}
                    </div>
                    <div>
                      <span className={`estimates-cat-badge ${r.category}`}>
                        {r.category === 'misc' ? 'Other' : r.category.charAt(0).toUpperCase() + r.category.slice(1)}
                      </span>
                    </div>
                    <div>
                      <div className="receipts-table-row__desc">
                        {r.description || '—'}
                      </div>
                      {r.vendor && (
                        <div className="receipts-table-row__vendor">{r.vendor}</div>
                      )}
                    </div>
                    <div className="receipts-table-row__vendor">
                      {r.vendor || '—'}
                    </div>
                    <div className="receipts-table-row__amount">
                      {formatCurrency(Number(r.amount))}
                    </div>
                    <button
                      type="button"
                      className={`receipts-billable-pill ${r.billable ? 'billable' : 'overhead'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleBillable(r.id)
                      }}
                    >
                      {r.billable ? 'Billable' : 'Overhead'}
                    </button>
                    <div className="receipts-table-row__remove-wrap">
                      <button
                        type="button"
                        className="receipts-table-row__remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeReceipt(r.id)
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })
            )}

            {filtered.some((r) => r.billable) && (
              <div className="receipts-table-footer">
                <div className="receipts-kpi__sub">
                  <span style={{ fontWeight: 600, color: 'var(--green)' }}>
                    {formatCurrency(
                      filtered.filter((r) => r.billable).reduce((s, r) => s + Number(r.amount), 0)
                    )}
                  </span>
                  {' '}
                  billable — ready to add to next invoice
                </div>
                <button
                  type="button"
                  className="receipts-table-footer__btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowAddToInvoiceModal(true)
                  }}
                >
                  Add to Invoice →
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="estimates-spend-sidebar">
          {activeJobId && meta?.budget && (
            <BudgetPanel
              jobId={activeJobId}
              jobName={activeJob?.name ?? ''}
              budget={meta.budget}
              receipts={jobReceipts}
            />
          )}
          <div className="receipts-quick-log-card">
            <div className="receipts-quick-log-card__title">Quick Log</div>
            <QuickLog
              onAdd={addReceipt}
              defaultJobId={activeJobId}
            />
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Change Order Banner ─────────────────────────────────────────────────────
function ChangeOrderBanner({
  jobName,
  estimateTotal,
  spent,
  pctComplete,
  onDismiss,
}: {
  jobName: string
  estimateTotal: number
  spent: number
  pctComplete: number
  onDismiss: () => void
}) {
  const estimatedFinal = pctComplete > 0 ? (spent / pctComplete) * 100 : 0
  const overBy = estimatedFinal - estimateTotal
  if (overBy <= 0) return null

  return (
    <div className="receipts-change-order-banner">
      <div className="receipts-change-order-banner__icon">⚠️</div>
      <div>
        <div className="receipts-change-order-banner__title">
          Budget overrun projected — {jobName.split('–')[0].trim()}
        </div>
        <div className="receipts-change-order-banner__text">
          You're <strong>{pctComplete}% complete</strong> but have spent{' '}
          <strong>{formatCurrency(spent)}</strong>. At this pace, the job will finish{' '}
          <strong style={{ color: 'var(--red)' }}>{formatCurrency(overBy)} over estimate</strong>.
        </div>
        <div className="receipts-change-order-banner__actions">
          <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '7px 16px' }}>
            Create Change Order
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '7px 14px' }}
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Budget Panel ────────────────────────────────────────────────────────────
function BudgetPanel({
  jobId,
  jobName,
  budget,
  receipts,
}: {
  jobId: string
  jobName: string
  budget: NonNullable<JobReceiptsMeta['budget']>
  receipts: JobExpense[]
}) {
  const budgetEntries = Object.entries(budget)
  const totalBudget = budgetEntries.reduce((s, [, v]) => s + v.allocated, 0)
  const spentByKey: Record<string, number> = {}
  budgetEntries.forEach(([key]) => {
    const cat = key.toLowerCase() as ExpenseCategory
    const match = (k: string) => k === key || CAT_TO_BUDGET_KEY[cat] === key
    spentByKey[key] = receipts
      .filter((r) => CAT_TO_BUDGET_KEY[r.category] === key)
      .reduce((s, r) => s + Number(r.amount), 0)
  })
  const totalSpent = Object.values(spentByKey).reduce((s, v) => s + v, 0)
  const pctUsed = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0
  const meta = MOCK_JOB_RECEIPTS_META[jobId]
  const pctComplete = meta?.pctComplete ?? 0

  const barColor =
    pctUsed > 90 ? 'var(--red)' : pctUsed > 70 ? 'var(--est-amber)' : 'var(--green)'

  return (
    <div className="receipts-budget-panel">
      <div className="receipts-budget-panel__eyebrow">Budget vs. Actual</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div className="receipts-budget-panel__job-name">
          {jobName.split('–')[0].trim()}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="receipts-kpi__sub" style={{ marginBottom: 2 }}>Total spent</div>
          <div className="receipts-budget-panel__total">{formatCurrency(totalSpent)}</div>
          <div className="receipts-kpi__sub">of {formatCurrency(totalBudget)}</div>
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div className="receipts-budget-panel__bar">
          <div
            className="receipts-budget-panel__bar-fill"
            style={{ width: `${pctUsed}%`, background: barColor }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="receipts-kpi__sub">{pctUsed}% of budget used</span>
          <span className="receipts-kpi__sub">{pctComplete}% of job complete</span>
        </div>
      </div>
      {budgetEntries.map(([cat, { allocated, color, bg }]) => {
        const catSpent = spentByKey[cat] ?? 0
        const catPct = allocated > 0 ? Math.min(100, Math.round((catSpent / allocated) * 100)) : 0
        const over = catSpent > allocated
        const remaining = allocated - catSpent
        return (
          <div key={cat} className="receipts-budget-cat">
            <div className="receipts-budget-cat__head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span
                  className="receipts-budget-cat__badge"
                  style={{ background: bg, color }}
                >
                  {cat}
                </span>
                {over && <span className="receipts-budget-cat__over">OVER</span>}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="receipts-kpi__sub">{formatCurrency(catSpent)} spent</span>
                <span className="receipts-kpi__sub">/ {formatCurrency(allocated)}</span>
              </div>
            </div>
            <div className="receipts-budget-cat__bar">
              <div
                className="receipts-budget-cat__bar-fill"
                style={{
                  width: `${catPct}%`,
                  background: over ? 'var(--red)' : catPct > 80 ? 'var(--est-amber)' : color,
                }}
              />
            </div>
            <div
              className="receipts-budget-cat__footer"
              style={{ color: over ? 'var(--red)' : 'var(--text-muted)' }}
            >
              {over
                ? `${formatCurrency(Math.abs(remaining))} over budget`
                : `${formatCurrency(remaining)} remaining`}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Quick Log ───────────────────────────────────────────────────────────────
function QuickLog({
  onAdd,
  defaultJobId,
}: {
  onAdd: (r: Omit<JobExpense, 'id' | 'created_at'> & { id: number; created_at: string }) => void
  defaultJobId: string
}) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'materials' as ExpenseCategory,
    billable: true,
  })

  const valid = !!form.description.trim() && !!form.amount

  const submit = () => {
    if (!valid || !defaultJobId) return
    onAdd({
      id: Date.now(),
      job_id: defaultJobId,
      vendor: '',
      ...form,
      amount: parseFloat(form.amount),
      created_at: new Date().toISOString().slice(0, 10),
    })
    setForm({ description: '', amount: '', category: 'materials', billable: true })
  }

  return (
    <div className="add-product-form" style={{ gap: 10 }}>
      <input
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder="What was purchased?"
        className="receipt-scan-input"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="receipt-scan-amount-wrap">
          <span className="receipt-scan-amount-prefix">$</span>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="0.00"
            className="receipt-scan-input receipt-scan-input--amount"
          />
        </div>
        <select
          value={form.category}
          onChange={(e) =>
            setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
          }
          className="receipt-scan-input"
        >
          {CATEGORY_OPTIONS.filter((c) => c.value !== 'All').map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          className="receipt-scan-billable-row"
          style={{ padding: 0 }}
          onClick={() => setForm((f) => ({ ...f, billable: !f.billable }))}
        >
          <div
            className={`receipt-scan-toggle ${form.billable ? 'receipt-scan-toggle--on' : ''}`}
            style={{ width: 30, height: 17 }}
          >
            <span
              className="receipt-scan-toggle-thumb"
              style={{ width: 13, height: 13, top: 2, left: form.billable ? 14 : 2 }}
            />
          </div>
          <span className="receipts-kpi__sub">Billable</span>
        </button>
        <button
          type="button"
          className="receipt-scan-save-btn"
          style={{ padding: '8px 16px', fontSize: 12 }}
          onClick={submit}
          disabled={!valid}
        >
          Log →
        </button>
      </div>
    </div>
  )
}
