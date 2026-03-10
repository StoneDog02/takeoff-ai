import { useEffect, useRef, useState } from 'react'
import { AddBtn } from '../primitives'
import { uid, BUDGET_CATS, WIZARD_RED } from '../constants'
import type { WizardProjectState, WizardBudgetCategory } from '../types'

type OnChange = (key: keyof WizardProjectState, value: unknown) => void

export function StepBudget({ data, onChange }: { data: WizardProjectState; onChange: OnChange }) {
  const cats = data.budgetCategories ?? []
  const [focusAmountForId, setFocusAmountForId] = useState<string | null>(null)
  const amountInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (focusAmountForId && amountInputRefs.current[focusAmountForId]) {
      amountInputRefs.current[focusAmountForId]?.focus()
      setFocusAmountForId(null)
    }
  }, [focusAmountForId])

  function addCat(name = '', id?: string) {
    const newId = id ?? uid()
    onChange('budgetCategories', [...cats, { id: newId, name, amount: '' }])
    if (id) setFocusAmountForId(id)
  }
  function updateCat(id: string, field: keyof WizardBudgetCategory, val: string) {
    const updated = cats.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    onChange('budgetCategories', updated)
    onChange(
      'budget',
      updated.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
    )
  }
  function removeCat(id: string) {
    const updated = cats.filter((c) => c.id !== id)
    onChange('budgetCategories', updated)
    onChange(
      'budget',
      updated.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
    )
  }

  const total = cats.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
  const suggested = BUDGET_CATS.filter((n) => !cats.some((c) => c.name === n))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {suggested.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--muted, #64748b)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              marginBottom: '8px',
            }}
          >
            Suggested categories
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {suggested.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  const newId = uid()
                  addCat(n, newId)
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1.5px dashed var(--border, #cbd5e1)',
                  background: 'var(--bg-muted, #f8fafc)',
                  color: 'var(--muted, #64748b)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = WIZARD_RED
                  e.currentTarget.style.color = WIZARD_RED
                  e.currentTarget.style.background = `${WIZARD_RED}08`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border, #cbd5e1)'
                  e.currentTarget.style.color = 'var(--muted, #64748b)'
                  e.currentTarget.style.background = 'var(--bg-muted, #f8fafc)'
                }}
              >
                + {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {cats.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px 32px',
              gap: '8px',
              padding: '0 4px',
            }}
          >
            {['Category', 'Budget Amount', ''].map((h, i) => (
              <span
                key={i}
                style={{
                  fontSize: '10px',
                  color: 'var(--muted, #94a3b8)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                {h}
              </span>
            ))}
          </div>
          {cats.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 160px 32px',
                gap: '8px',
                alignItems: 'center',
                padding: '10px 12px',
                background: 'var(--bg-muted, #f8fafc)',
                borderRadius: '10px',
                border: '1.5px solid var(--border, #e2e8f0)',
              }}
            >
              <input
                value={c.name}
                onChange={(e) => updateCat(c.id, 'name', e.target.value)}
                placeholder="Category name"
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text, #0f172a)',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1.5px solid var(--border, #e2e8f0)',
                  borderRadius: '7px',
                  background: 'var(--bg-input, #fff)',
                  padding: '5px 10px',
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--muted, #94a3b8)' }}>$</span>
                <input
                  ref={(el) => { amountInputRefs.current[c.id] = el }}
                  type="number"
                  value={c.amount}
                  onChange={(e) => updateCat(c.id, 'amount', e.target.value)}
                  placeholder="0"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text, #0f172a)',
                    fontFamily: "'DM Mono', monospace",
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeCat(c.id)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '7px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted, #cbd5e1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#dc2626'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--muted, #cbd5e1)'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              background: 'var(--text, #0f172a)',
              borderRadius: '10px',
              marginTop: '4px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted, #94a3b8)' }}>
              Total Project Budget
            </span>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#4ade80', fontFamily: "'DM Mono', monospace" }}>
              ${total.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <AddBtn label="Add Custom Category" onClick={() => addCat('')} />
    </div>
  )
}
