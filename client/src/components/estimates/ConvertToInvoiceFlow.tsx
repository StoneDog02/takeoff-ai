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
      className="dashboard-app"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
      }}
      onClick={onClose}
    >
      <div
        className="projects-card"
        style={{ padding: 24, maxWidth: 420, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="page-title" style={{ marginBottom: 16 }}>
          Convert to invoice
        </h2>
        <div className="dashboard-app timeline-val" style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 4 }}>
            Estimate total: ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          {invoiced > 0 && (
            <p style={{ marginBottom: 4, color: 'var(--text-muted)' }}>
              Already invoiced: ${invoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          )}
          <p style={{ fontWeight: 600 }}>
            Remaining: ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <span className="section-title" style={{ display: 'block', marginBottom: 8 }}>
            Amount to invoice
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input
              type="radio"
              checked={mode === 'full'}
              onChange={() => setMode('full')}
            />
            <span>Invoice full remaining amount (${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              checked={mode === 'partial'}
              onChange={() => setMode('partial')}
            />
            <span>Invoice partial amount</span>
          </label>
          {mode === 'partial' && (
            <div style={{ marginTop: 8 }}>
              <input
                type="number"
                min={0.01}
                max={remaining}
                step={0.01}
                placeholder={`Max ${remaining.toFixed(2)}`}
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                className="dashboard-app"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          )}
        </div>
        <label className="dashboard-app" style={{ display: 'block', marginBottom: 16 }}>
          <span className="section-title" style={{ display: 'block', marginBottom: 4 }}>
            Due date (optional)
          </span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="dashboard-app"
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 7,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
            }}
          />
        </label>
        {error && (
          <p style={{ color: 'var(--red-light)', marginBottom: 16, fontSize: 13 }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
  )
}
