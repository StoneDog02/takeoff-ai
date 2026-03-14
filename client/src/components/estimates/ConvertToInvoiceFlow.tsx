import { useState } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { EstimateWithLines } from '@/api/estimates'

interface ConvertToInvoiceFlowProps {
  estimateId: string
  estimate: EstimateWithLines
  onClose: () => void
  onConverted: () => void
}

export function ConvertToInvoiceFlow({
  estimateId,
  estimate,
  onClose,
  onConverted,
}: ConvertToInvoiceFlowProps) {
  const [dueDate, setDueDate] = useState('')
  const [mode, setMode] = useState<'full' | 'partial'>('full')
  const [partialAmount, setPartialAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = Number(estimate.total_amount) || 0
  const invoiced = Number(estimate.invoiced_amount) || 0
  const remaining = Math.max(0, total - invoiced)

  const getRequestedAmount = (): number | null => {
    if (mode === 'full') return null
    const val = parseFloat(partialAmount)
    if (Number.isNaN(val) || val <= 0) return null
    if (val > remaining) return null
    return val
  }

  const handleConvert = async () => {
    const amount = getRequestedAmount()
    if (mode === 'partial' && amount === null) {
      setError(
        remaining <= 0
          ? 'No remaining amount to invoice.'
          : `Enter an amount between 0.01 and ${remaining.toFixed(2)}.`
      )
      return
    }
    setError(null)
    setLoading(true)
    try {
      await estimatesApi.convertToInvoice(estimateId, {
        due_date: dueDate || undefined,
        amount: amount ?? undefined,
      })
      onConverted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="convert-to-invoice-overlay"
      onClick={onClose}
    >
      <div
        className="convert-to-invoice-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-to-invoice-title"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="convert-to-invoice-modal__scroll">
          <h2 id="convert-to-invoice-title" className="convert-to-invoice-modal__title">
            Convert to invoice
          </h2>

          <div className="convert-to-invoice-modal__summary">
            <div className="convert-to-invoice-modal__summary-row">
              <span>Estimate total</span>
              <span>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            {invoiced > 0 && (
              <div className="convert-to-invoice-modal__summary-row convert-to-invoice-modal__summary-row--muted">
                <span>Already invoiced</span>
                <span>${invoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="convert-to-invoice-modal__summary-row convert-to-invoice-modal__summary-row--strong">
              <span>Remaining</span>
              <span>${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <fieldset className="convert-to-invoice-modal__fieldset">
            <legend className="convert-to-invoice-modal__legend">Amount to invoice</legend>
            <label className="convert-to-invoice-modal__radio">
              <input
                type="radio"
                name="amount-mode"
                checked={mode === 'full'}
                onChange={() => { setMode('full'); setError(null) }}
              />
              <span>Invoice full remaining amount (${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
            </label>
            <label className="convert-to-invoice-modal__radio">
              <input
                type="radio"
                name="amount-mode"
                checked={mode === 'partial'}
                onChange={() => { setMode('partial'); setError(null) }}
              />
              <span>Invoice partial amount</span>
            </label>
            {mode === 'partial' && (
              <div className="convert-to-invoice-modal__partial-wrap">
                <input
                  type="number"
                  min={0.01}
                  max={remaining}
                  step={0.01}
                  placeholder={`Enter amount (max $${remaining.toFixed(2)})`}
                  value={partialAmount}
                  onChange={(e) => { setPartialAmount(e.target.value); setError(null) }}
                  className="convert-to-invoice-modal__input"
                  aria-label="Partial amount"
                />
              </div>
            )}
          </fieldset>

          <div className="convert-to-invoice-modal__field">
            <label htmlFor="convert-due-date" className="convert-to-invoice-modal__label">
              Due date (optional)
            </label>
            <input
              id="convert-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="convert-to-invoice-modal__input"
              aria-label="Due date"
            />
          </div>

          {error && (
            <p className="convert-to-invoice-modal__error" role="alert">
              {error}
            </p>
          )}

          <div className="convert-to-invoice-modal__actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConvert}
              disabled={loading || (mode === 'partial' && !partialAmount.trim())}
            >
              {loading ? 'Creating…' : 'Create invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
