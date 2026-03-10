import { useState } from 'react'
import type { Job, JobExpense, Invoice } from '@/types/global'
import type { ExpenseCategory } from '@/types/global'
import { formatCurrency } from '@/lib/pipeline'
import { formatDate } from '@/lib/date'

const STEPS = ['Invoice', 'Expenses', 'Markup', 'Preview'] as const

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  materials: 'Materials',
  labor: 'Labor',
  equipment: 'Equipment',
  subs: 'Subs',
  misc: 'Other',
}

const DEFAULT_MARKUPS: Record<ExpenseCategory, number> = {
  materials: 12,
  labor: 0,
  equipment: 10,
  subs: 5,
  misc: 0,
}

export interface AddToInvoiceModalProps {
  job: Job
  billableExpenses: JobExpense[]
  existingInvoices: Invoice[]
  onClose: () => void
  onSuccess?: () => void
}

export function AddToInvoiceModal({
  job,
  billableExpenses,
  existingInvoices,
  onClose,
  onSuccess,
}: AddToInvoiceModalProps) {
  const [step, setStep] = useState(1)
  const [invoiceChoice, setInvoiceChoice] = useState<string>(
    existingInvoices[0]?.id ?? 'new'
  )
  const [selectedIds, setSelectedIds] = useState<string[]>(
    billableExpenses.map((r) => r.id)
  )
  const [markups, setMarkups] = useState<Record<string, number>>({
    ...DEFAULT_MARKUPS,
  })
  const [done, setDone] = useState(false)

  const canNext = () => {
    if (step === 1) return !!invoiceChoice
    if (step === 2) return selectedIds.length > 0
    return true
  }

  const handleConfirm = () => {
    setDone(true)
    onSuccess?.()
  }

  const selectedExpenses = billableExpenses.filter((r) => selectedIds.includes(r.id))
  const jobNameShort = job.name.split('–')[0].trim()

  return (
    <div
      className="add-to-invoice-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-invoice-title"
    >
      <div className="add-to-invoice-modal" onClick={(e) => e.stopPropagation()}>
        <header className="add-to-invoice-header">
          <div>
            <div className="add-to-invoice-eyebrow">{jobNameShort}</div>
            <h2 id="add-to-invoice-title" className="add-to-invoice-title">
              {done ? 'Done' : 'Add Expenses to Invoice'}
            </h2>
          </div>
          <button
            type="button"
            className="add-to-invoice-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {!done && (
          <div className="add-to-invoice-stepbar">
            {STEPS.map((label, i) => {
              const num = i + 1
              const doneStep = num < step
              const active = num === step
              return (
                <div key={label} className="add-to-invoice-stepbar__item">
                  <div className="add-to-invoice-stepbar__cell">
                    <span
                      className={`add-to-invoice-stepbar__dot ${doneStep ? 'done' : ''} ${active ? 'active' : ''}`}
                    >
                      {doneStep ? '✓' : num}
                    </span>
                    <span
                      className={`add-to-invoice-stepbar__label ${active ? 'active' : ''} ${doneStep ? 'done' : ''}`}
                    >
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <span
                      className={`add-to-invoice-stepbar__line ${doneStep ? 'done' : ''}`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="add-to-invoice-divider" />

        <div className="add-to-invoice-body">
          {done ? (
            <AddToInvoiceSuccess onClose={onClose} onViewInvoice={onSuccess} />
          ) : (
            <>
              {step === 1 && (
                <StepInvoice
                  jobName={job.name}
                  existingInvoices={existingInvoices}
                  choice={invoiceChoice}
                  setChoice={setInvoiceChoice}
                />
              )}
              {step === 2 && (
                <StepExpenses
                  expenses={billableExpenses}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                />
              )}
              {step === 3 && (
                <StepMarkup
                  expenses={selectedExpenses}
                  markups={markups}
                  setMarkups={setMarkups}
                />
              )}
              {step === 4 && (
                <StepPreview
                  invoiceChoice={invoiceChoice}
                  existingInvoices={existingInvoices}
                  job={job}
                  selectedExpenses={selectedExpenses}
                  markups={markups}
                />
              )}
            </>
          )}
        </div>

        {!done && (
          <footer className="add-to-invoice-footer">
            <button
              type="button"
              className="add-to-invoice-footer-back"
              onClick={() => (step > 1 ? setStep((s) => s - 1) : onClose())}
            >
              {step === 1 ? 'Cancel' : '← Back'}
            </button>
            <div className="add-to-invoice-footer-dots">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`add-to-invoice-footer-dot ${i + 1 === step ? 'active' : ''} ${i + 1 < step ? 'done' : ''}`}
                />
              ))}
            </div>
            {step < 4 ? (
              <button
                type="button"
                className="add-to-invoice-footer-next"
                disabled={!canNext()}
                onClick={() => canNext() && setStep((s) => s + 1)}
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                className="add-to-invoice-footer-confirm"
                onClick={handleConfirm}
              >
                Confirm & Add to Invoice
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  )
}

// ─── Step 1: Choose invoice ───────────────────────────────────────────────────
function StepInvoice({
  jobName,
  existingInvoices,
  choice,
  setChoice,
}: {
  jobName: string
  existingInvoices: Invoice[]
  choice: string
  setChoice: (id: string) => void
}) {
  const jobNameShort = jobName.split('–')[0].trim()
  return (
    <div className="add-to-invoice-step-content">
      <h3 className="add-to-invoice-step-title">
        Which invoice should these expenses go on?
      </h3>
      <p className="add-to-invoice-step-sub">
        Add to an existing open invoice, or start a fresh one.
      </p>
      <div className="add-to-invoice-choices">
        {existingInvoices.map((inv) => {
          const isSelected = choice === inv.id
          const sentLabel = inv.sent_at ? `Sent ${formatDate(inv.sent_at)}` : 'Draft'
          return (
            <button
              key={inv.id}
              type="button"
              className={`add-to-invoice-choice ${isSelected ? 'selected' : ''}`}
              onClick={() => setChoice(inv.id)}
            >
              <span className="add-to-invoice-choice-icon" aria-hidden>
                🧾
              </span>
              <div className="add-to-invoice-choice-main">
                <span className="add-to-invoice-choice-label">
                  Invoice #{inv.id.slice(-4)}
                </span>
                <span className="add-to-invoice-choice-meta">
                  {jobNameShort} · {sentLabel} · Current total{' '}
                  {formatCurrency(inv.total_amount)}
                </span>
              </div>
              <div className="add-to-invoice-choice-right">
                <span className="add-to-invoice-choice-status">{inv.status}</span>
                {isSelected && <span className="add-to-invoice-choice-check">✓</span>}
              </div>
            </button>
          )
        })}
        <button
          type="button"
          className={`add-to-invoice-choice add-to-invoice-choice-new ${choice === 'new' ? 'selected' : ''}`}
          onClick={() => setChoice('new')}
        >
          <span
            className={`add-to-invoice-choice-icon add-to-invoice-choice-icon-new ${choice === 'new' ? 'selected' : ''}`}
            aria-hidden
          >
            +
          </span>
          <div>
            <span className="add-to-invoice-choice-label">Create new invoice</span>
            <span className="add-to-invoice-choice-meta">
              Start a fresh invoice with just these expenses
            </span>
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Select expenses ──────────────────────────────────────────────────
function StepExpenses({
  expenses,
  selectedIds,
  setSelectedIds,
}: {
  expenses: JobExpense[]
  selectedIds: string[]
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const total = expenses
    .filter((r) => selectedIds.includes(r.id))
    .reduce((s, r) => s + Number(r.amount), 0)
  const toggleAll = () => {
    if (selectedIds.length === expenses.length) setSelectedIds([])
    else setSelectedIds(expenses.map((r) => r.id))
  }
  const allSelected = selectedIds.length === expenses.length

  return (
    <div className="add-to-invoice-step-content">
      <h3 className="add-to-invoice-step-title">
        Which expenses to include?
      </h3>
      <p className="add-to-invoice-step-sub">
        Uncheck anything you're not ready to bill yet.
      </p>
      <div className="add-to-invoice-expenses-card">
        <div className="add-to-invoice-expenses-header">
          <label className="add-to-invoice-expenses-selectall">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="add-to-invoice-checkbox"
            />
            <span className="add-to-invoice-expenses-selectall-label">
              {allSelected ? 'Deselect all' : 'Select all'}
            </span>
          </label>
          <span className="add-to-invoice-expenses-count">
            {selectedIds.length} of {expenses.length} selected
          </span>
        </div>
        {expenses.map((r) => {
          const checked = selectedIds.includes(r.id)
          const catLabel = CATEGORY_LABELS[r.category]
          return (
            <label
              key={r.id}
              className={`add-to-invoice-expense-row ${checked ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setSelectedIds((s) =>
                    checked ? s.filter((id) => id !== r.id) : [...s, r.id]
                  )
                }
                className="add-to-invoice-checkbox"
              />
              <div className="add-to-invoice-expense-info">
                <span className={`estimates-cat-badge ${r.category}`}>
                  {catLabel}
                </span>
                <div className="add-to-invoice-expense-desc">
                  <span>{r.description || '—'}</span>
                  <span className="add-to-invoice-expense-meta">
                    {r.vendor || '—'} · {formatDate(r.created_at)}
                  </span>
                </div>
              </div>
              <span className="add-to-invoice-expense-amount">
                {formatCurrency(Number(r.amount))}
              </span>
            </label>
          )
        })}
        <div className="add-to-invoice-expenses-footer">
          <span className="add-to-invoice-expenses-footer-label">
            Selected subtotal
          </span>
          <span className="add-to-invoice-expenses-footer-total">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Markup ───────────────────────────────────────────────────────────
function StepMarkup({
  expenses,
  markups,
  setMarkups,
}: {
  expenses: JobExpense[]
  markups: Record<string, number>
  setMarkups: React.Dispatch<React.SetStateAction<Record<string, number>>>
}) {
  const categories = [...new Set(expenses.map((r) => r.category))]
  const catSubtotals = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = expenses
      .filter((r) => r.category === cat)
      .reduce((s, r) => s + r.amount, 0)
    return acc
  }, {})
  const totalCost = expenses.reduce((s, r) => s + r.amount, 0)
  const totalBilled = categories.reduce((sum, cat) => {
    const subtotal = catSubtotals[cat]
    const m = markups[cat] ?? DEFAULT_MARKUPS[cat as ExpenseCategory] ?? 0
    return sum + subtotal * (1 + m / 100)
  }, 0)
  const totalMarkup = totalBilled - totalCost

  return (
    <div className="add-to-invoice-step-content">
      <h3 className="add-to-invoice-step-title">
        Apply markup by category
      </h3>
      <p className="add-to-invoice-step-sub">
        Set a markup % per category. Your cost vs. what the client sees are kept
        separate.
      </p>
      <div className="add-to-invoice-markup-list">
        {categories.map((cat) => {
          const subtotal = catSubtotals[cat]
          const m = Number(markups[cat]) || DEFAULT_MARKUPS[cat as ExpenseCategory] || 0
          const billed = subtotal * (1 + m / 100)
          const markupAmt = billed - subtotal
          const catLabel = CATEGORY_LABELS[cat as ExpenseCategory]
          return (
            <div key={cat} className="add-to-invoice-markup-card">
              <div className="add-to-invoice-markup-card-head">
                <span className={`estimates-cat-badge ${cat}`}>{catLabel}</span>
                <span className="add-to-invoice-markup-card-count">
                  {expenses.filter((r) => r.category === cat).length} items
                </span>
              </div>
              <div className="add-to-invoice-markup-card-grid">
                <div>
                  <div className="add-to-invoice-markup-label">Your cost</div>
                  <div className="add-to-invoice-markup-cost">
                    {formatCurrency(subtotal)}
                  </div>
                </div>
                <div className="add-to-invoice-markup-controls">
                  <div className="add-to-invoice-markup-label">Markup</div>
                  <div className="add-to-invoice-markup-buttons">
                    <button
                      type="button"
                      className="add-to-invoice-markup-btn"
                      onClick={() =>
                        setMarkups((mk) => ({
                          ...mk,
                          [cat]: Math.max(
                            0,
                            (Number(mk[cat]) || 0) - 5
                          ),
                        }))
                      }
                    >
                      −
                    </button>
                    <div className="add-to-invoice-markup-input-wrap">
                      <input
                        type="number"
                        value={markups[cat] ?? DEFAULT_MARKUPS[cat as ExpenseCategory] ?? 0}
                        onChange={(e) =>
                          setMarkups((mk) => ({
                            ...mk,
                            [cat]: Math.max(
                              0,
                              parseFloat(e.target.value) || 0
                            ),
                          }))
                        }
                        className="add-to-invoice-markup-input"
                      />
                      <span className="add-to-invoice-markup-pct">%</span>
                    </div>
                    <button
                      type="button"
                      className="add-to-invoice-markup-btn"
                      onClick={() =>
                        setMarkups((mk) => ({
                          ...mk,
                          [cat]: (Number(mk[cat]) || 0) + 5,
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                  {markupAmt > 0 && (
                    <div className="add-to-invoice-markup-amt">
                      +{formatCurrency(markupAmt)}
                    </div>
                  )}
                </div>
                <div className="add-to-invoice-markup-billed-wrap">
                  <div className="add-to-invoice-markup-label">Client billed</div>
                  <div className="add-to-invoice-markup-billed">
                    {formatCurrency(billed)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="add-to-invoice-markup-summary">
        <div className="add-to-invoice-markup-summary-item">
          <div className="add-to-invoice-markup-summary-label">Your cost</div>
          <div className="add-to-invoice-markup-summary-val cost">
            {formatCurrency(totalCost)}
          </div>
        </div>
        <div className="add-to-invoice-markup-summary-item">
          <div className="add-to-invoice-markup-summary-label">Markup</div>
          <div className="add-to-invoice-markup-summary-val markup">
            +{formatCurrency(totalMarkup)}
          </div>
        </div>
        <div className="add-to-invoice-markup-summary-item">
          <div className="add-to-invoice-markup-summary-label">You invoice</div>
          <div className="add-to-invoice-markup-summary-val total">
            {formatCurrency(totalBilled)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Preview ─────────────────────────────────────────────────────────
function StepPreview({
  invoiceChoice,
  existingInvoices,
  job,
  selectedExpenses,
  markups,
}: {
  invoiceChoice: string
  existingInvoices: Invoice[]
  job: Job
  selectedExpenses: JobExpense[]
  markups: Record<string, number>
}) {
  const inv =
    invoiceChoice === 'new'
      ? null
      : existingInvoices.find((i) => i.id === invoiceChoice)
  const categories = [...new Set(selectedExpenses.map((r) => r.category))]
  const newLines = categories.map((cat) => {
    const items = selectedExpenses.filter((r) => r.category === cat)
    const cost = items.reduce((s, r) => s + r.amount, 0)
    const m = Number(markups[cat]) || DEFAULT_MARKUPS[cat as ExpenseCategory] || 0
    const billed = cost * (1 + m / 100)
    return {
      cat,
      catLabel: CATEGORY_LABELS[cat as ExpenseCategory],
      items,
      cost,
      billed,
      markup: m,
    }
  })
  const existingTotal = inv ? inv.total_amount : 0
  const newItemsTotal = newLines.reduce((s, l) => s + l.billed, 0)
  const grandTotal = existingTotal + newItemsTotal

  return (
    <div className="add-to-invoice-step-content">
      <h3 className="add-to-invoice-step-title">Invoice preview</h3>
      <p className="add-to-invoice-step-sub">
        Here's exactly what your client will see. Confirm to add these to the
        invoice.
      </p>
      <div className="add-to-invoice-preview-card">
        <div className="add-to-invoice-preview-header">
          <div>
            <div className="add-to-invoice-preview-title">
              {inv ? `Invoice #${inv.id.slice(-4)}` : 'New Invoice'}
            </div>
            <div className="add-to-invoice-preview-meta">{job.name}</div>
            {job.client_name && (
              <div className="add-to-invoice-preview-meta">{job.client_name}</div>
            )}
          </div>
          <div className="add-to-invoice-preview-dates">
            <div className="add-to-invoice-preview-label">Invoice date</div>
            <div className="add-to-invoice-preview-date">
              {new Date().toLocaleDateString('en-US')}
            </div>
            {inv && (
              <>
                <div className="add-to-invoice-preview-label add-to-invoice-preview-label--mt">
                  Status
                </div>
                <span className="add-to-invoice-preview-status">{inv.status}</span>
              </>
            )}
          </div>
        </div>
        {inv && (
          <div className="add-to-invoice-preview-existing">
            <div className="add-to-invoice-preview-section-label">
              Existing items
            </div>
            <div className="add-to-invoice-preview-existing-row">
              <span>Current balance</span>
              <span>{formatCurrency(inv.total_amount)}</span>
            </div>
          </div>
        )}
        <div className="add-to-invoice-preview-new">
          <div className="add-to-invoice-preview-section-label new">
            <span className="add-to-invoice-preview-new-badge">NEW</span>
            Expenses being added
          </div>
          {newLines.map((line, i) => (
            <div key={i} className="add-to-invoice-preview-line">
              <div className="add-to-invoice-preview-line-main">
                <span className={`estimates-cat-badge ${line.cat}`}>
                  {line.catLabel}
                </span>
                <span className="add-to-invoice-preview-line-desc">
                  {line.items.map((r) => r.description).join(', ')}
                </span>
                <div className="add-to-invoice-preview-line-right">
                  {line.markup > 0 && (
                    <span className="add-to-invoice-preview-line-markup">
                      +{line.markup}% markup
                    </span>
                  )}
                  <span className="add-to-invoice-preview-line-amount">
                    {formatCurrency(line.billed)}
                  </span>
                </div>
              </div>
              {line.markup > 0 && (
                <div className="add-to-invoice-preview-line-note">
                  Cost {formatCurrency(line.cost)} +{' '}
                  {formatCurrency(line.billed - line.cost)} markup
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="add-to-invoice-preview-totals">
          {inv && (
            <div className="add-to-invoice-preview-total-row">
              <span>Previous balance</span>
              <span>{formatCurrency(existingTotal)}</span>
            </div>
          )}
          <div className="add-to-invoice-preview-total-row">
            <span>New expenses</span>
            <span className="add-to-invoice-preview-total-new">
              +{formatCurrency(newItemsTotal)}
            </span>
          </div>
          <div className="add-to-invoice-preview-grand">
            <span>New total</span>
            <span className="add-to-invoice-preview-grand-val">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────
function AddToInvoiceSuccess({
  onClose,
  onViewInvoice,
}: {
  onClose: () => void
  onViewInvoice?: () => void
}) {
  return (
    <div className="add-to-invoice-success">
      <div className="add-to-invoice-success-icon">✓</div>
      <h3 className="add-to-invoice-success-title">Added to invoice</h3>
      <p className="add-to-invoice-success-text">
        The expenses have been added and marked as invoiced. They won't appear
        in your billable pool again.
      </p>
      <div className="add-to-invoice-success-actions">
        {onViewInvoice && (
          <button
            type="button"
            className="add-to-invoice-success-btn primary"
            onClick={() => {
              onClose()
              onViewInvoice()
            }}
          >
            View Invoice →
          </button>
        )}
        <button
          type="button"
          className="add-to-invoice-success-btn secondary"
          onClick={onClose}
        >
          Back to Receipts
        </button>
      </div>
    </div>
  )
}
