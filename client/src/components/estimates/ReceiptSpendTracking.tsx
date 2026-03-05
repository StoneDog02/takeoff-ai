import { useState, useEffect } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Job, JobExpense } from '@/types/global'
import type { ExpenseCategory } from '@/types/global'
import { formatDate } from '@/lib/date'
import { USE_MOCK_ESTIMATES, getMockJobExpensesByJob } from '@/data/mockEstimatesData'

const CATEGORIES: ExpenseCategory[] = ['materials', 'labor', 'equipment', 'misc']

interface ReceiptSpendTrackingProps {
  jobs: Job[]
}

export function ReceiptSpendTracking({ jobs }: ReceiptSpendTrackingProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?.id ?? '')
  const [expenses, setExpenses] = useState<JobExpense[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    amount: 0,
    category: 'misc' as ExpenseCategory,
    description: '',
  })

  useEffect(() => {
    if (!selectedJobId) {
      setExpenses([])
      return
    }
    if (USE_MOCK_ESTIMATES) {
      setExpenses(getMockJobExpensesByJob(selectedJobId))
      setLoading(false)
      return
    }
    setLoading(true)
    estimatesApi
      .getJobExpenses(selectedJobId)
      .then(setExpenses)
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false))
  }, [selectedJobId])

  const totalSpend = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const addExpense = async () => {
    if (!selectedJobId || form.amount <= 0) return
    if (USE_MOCK_ESTIMATES) {
      setForm({ amount: 0, category: 'misc', description: '' })
      setShowAdd(false)
      return
    }
    try {
      await estimatesApi.createJobExpense({
        job_id: selectedJobId,
        amount: form.amount,
        category: form.category,
        description: form.description.trim() || undefined,
      })
      setForm({ amount: 0, category: 'misc', description: '' })
      setShowAdd(false)
      const list = await estimatesApi.getJobExpenses(selectedJobId)
      setExpenses(list)
    } catch (err) {
      console.error(err)
    }
  }

  const removeExpense = async (id: string) => {
    if (!confirm('Remove this expense?')) return
    if (USE_MOCK_ESTIMATES) {
      setExpenses((prev) => prev.filter((e) => e.id !== id))
      return
    }
    try {
      await estimatesApi.deleteJobExpense(id)
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const byCategory = CATEGORIES.reduce<Partial<Record<ExpenseCategory, number>>>((acc, c) => {
    acc[c] = expenses.filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount), 0)
    return acc
  }, {})
  const maxCat = Math.max(...Object.values(byCategory).filter(Boolean), 1)

  return (
    <>
    <div className="estimates-receipts-layout">
      <div>
        <div className="est-card">
          <div className="estimates-receipts-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="estimates-ledger__search-wrap" style={{ maxWidth: 220 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input type="text" placeholder="Search expenses…" style={{ paddingLeft: 34 }} />
              </div>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                aria-label="Select job"
                style={{ width: 'auto', minWidth: 180, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13 }}
              >
                <option value="">Select job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={!selectedJobId}>
              Log expense
            </button>
          </div>
          {!selectedJobId ? (
            <div className="estimates-ledger__empty" style={{ padding: 48 }}>
              Select a job to view and log expenses.
            </div>
          ) : loading ? (
            <div className="estimates-ledger__empty">Loading…</div>
          ) : (
            <table className="estimates-receipt-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Date</th>
                  <th style={{ width: 110 }}>Category</th>
                  <th>Description</th>
                  <th style={{ width: 160 }}>Job</th>
                  <th className="r" style={{ width: 110 }}>Amount</th>
                  <th style={{ width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="estimates-ledger__empty">
                        <div className="estimates-ledger__empty-title">No expenses yet</div>
                        Click &quot;Log expense&quot; to get started
                      </div>
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{formatDate(e.created_at)}</td>
                      <td><span className={`estimates-cat-badge ${e.category}`}>{e.category}</span></td>
                      <td>
                        <div className="estimates-receipt-desc">{e.description || '—'}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{jobs.find((j) => j.id === selectedJobId)?.name || '—'}</td>
                      <td className="r"><span className="estimates-receipt-amount">${Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                      <td>
                        <button type="button" className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 11.5, color: 'var(--red-light)' }} onClick={() => removeExpense(e.id)}>Remove</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="estimates-spend-sidebar">
        <div className="estimates-spend-total-card">
          <div className="estimates-spend-total-label">Running Spend Total</div>
          <div className="estimates-spend-total-val">${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div className="estimates-spend-total-sub">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} logged</div>
        </div>
        <div className="estimates-spend-breakdown-card">
          <div className="estimates-spend-breakdown-header">By Category</div>
          <div className="estimates-spend-breakdown-body">
            {CATEGORIES.map((cat) => {
              const amt = byCategory[cat] || 0
              if (amt === 0 && totalSpend > 0) return null
              return (
                <div key={cat} className="estimates-spend-cat-row">
                  <div className="estimates-spend-cat-info">
                    <div className="estimates-spend-cat-name">{cat}</div>
                    <div className="estimates-spend-cat-track">
                      <div className="estimates-spend-cat-fill" style={{ width: `${Math.round((amt / maxCat) * 100)}%`, background: cat === 'materials' ? 'var(--blue)' : cat === 'labor' ? 'var(--est-amber)' : cat === 'equipment' ? 'var(--red-light)' : 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <div className="estimates-spend-cat-val">${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
      {showAdd && selectedJobId && (
        <div
          className="add-product-modal-overlay"
          onClick={() => setShowAdd(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="log-expense-title"
        >
          <div
            className="add-product-modal-card"
            style={{ padding: '24px 28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="log-expense-title" className="add-product-modal-title">
              Log expense
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-8px 0 16px' }}>
              Job: {jobs.find((j) => j.id === selectedJobId)?.name ?? '—'}
            </p>
            <form
              className="add-product-form"
              onSubmit={(e) => {
                e.preventDefault()
                addExpense()
              }}
            >
              <div className="add-product-form-row">
                <label htmlFor="log-expense-amount" className="add-product-form-label">
                  Amount
                </label>
                <div className="add-product-form-price-wrap">
                  <span className="add-product-form-price-prefix" aria-hidden>$</span>
                  <input
                    id="log-expense-amount"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.amount || ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: parseFloat((e.target as HTMLInputElement).value) || 0 }))
                    }
                    className="add-product-form-input price"
                    placeholder="0.00"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="add-product-form-row">
                <label htmlFor="log-expense-category" className="add-product-form-label">
                  Category
                </label>
                <select
                  id="log-expense-category"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
                  }
                  className="add-product-form-select"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="add-product-form-row">
                <label htmlFor="log-expense-desc" className="add-product-form-label">
                  Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <textarea
                  id="log-expense-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="add-product-form-textarea"
                  placeholder="e.g. Lumber delivery, plumbing supplies"
                  rows={3}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Receipt upload can be added later.
              </p>
              <div className="add-product-form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={form.amount <= 0}
                >
                  Add expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
