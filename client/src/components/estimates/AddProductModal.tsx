import { useState, useEffect, useMemo } from 'react'
import type { GcEstimateLine } from '@/lib/estimatingTrades'
import type { CustomProduct } from '@/types/global'

const STYLES = `
  .apm-root {
    --apm-bg:           #FFFFFF;
    --apm-bg-input:     rgba(0, 0, 0, 0.04);
    --apm-bg-input-hover: rgba(0, 0, 0, 0.06);
    --apm-bg-toggle:    rgba(0, 0, 0, 0.08);
    --apm-bg-tag:       rgba(0, 0, 0, 0.05);
    --apm-bg-tag-hover: rgba(0, 0, 0, 0.09);
    --apm-bg-type:      rgba(0, 0, 0, 0.04);
    --apm-bg-type-hover:rgba(0, 0, 0, 0.07);
    --apm-border:       rgba(0, 0, 0, 0.1);
    --apm-border-focus: rgba(192, 57, 43, 0.55);
    --apm-border-active:#C0392B;
    --apm-text-primary: #1A1A1A;
    --apm-text-secondary:#6B6B6B;
    --apm-text-hint:    #A0A0A0;
    --apm-text-active:  #C0392B;
    --apm-accent:       #C0392B;
    --apm-accent-hover: #A93226;
    --apm-accent-bg:    rgba(192, 57, 43, 0.08);
    --apm-divider:      rgba(0, 0, 0, 0.08);
    --apm-cancel-bg:    transparent;
    --apm-cancel-text:  #6B6B6B;
    --apm-cancel-hover: rgba(0, 0, 0, 0.05);
    --apm-placeholder:  rgba(26, 26, 26, 0.3);
    --apm-shadow:       0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04);
  }

  .dark .apm-root,
  [data-theme="dark"] .apm-root {
    --apm-bg:           #1C1C1C;
    --apm-bg-input:     rgba(255, 255, 255, 0.06);
    --apm-bg-input-hover: rgba(255, 255, 255, 0.09);
    --apm-bg-toggle:    rgba(255, 255, 255, 0.05);
    --apm-bg-tag:       rgba(255, 255, 255, 0.06);
    --apm-bg-tag-hover: rgba(255, 255, 255, 0.11);
    --apm-bg-type:      rgba(255, 255, 255, 0.05);
    --apm-bg-type-hover:rgba(255, 255, 255, 0.09);
    --apm-border:       rgba(255, 255, 255, 0.12);
    --apm-border-focus: rgba(192, 57, 43, 0.6);
    --apm-border-active:#C0392B;
    --apm-text-primary: #F7F6F3;
    --apm-text-secondary:rgba(247, 246, 243, 0.55);
    --apm-text-hint:    rgba(247, 246, 243, 0.3);
    --apm-text-active:  #E8897E;
    --apm-accent:       #C0392B;
    --apm-accent-hover: #A93226;
    --apm-accent-bg:    rgba(192, 57, 43, 0.18);
    --apm-divider:      rgba(255, 255, 255, 0.08);
    --apm-cancel-bg:    transparent;
    --apm-cancel-text:  rgba(247, 246, 243, 0.55);
    --apm-cancel-hover: rgba(255, 255, 255, 0.06);
    --apm-placeholder:  rgba(247, 246, 243, 0.3);
    --apm-shadow:       none;
  }

  .apm-root * { box-sizing: border-box; }
  .apm-root--compact .apm-type-grid { gap: 6px; }
  .apm-root--compact .apm-field { margin-bottom: 14px; }
  .apm-root--compact .apm-type-btn { padding: 8px 2px 6px; }
  .apm-root--compact .apm-toggle-row { margin-bottom: 14px; }
  .apm-root--compact .apm-textarea { height: 64px; }

  .apm-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    padding: 24px;
  }

  .apm-modal {
    background: var(--apm-bg);
    border-radius: 16px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 32px;
    border: 0.5px solid var(--apm-border);
    box-shadow: var(--apm-shadow);
  }

  .apm-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    color: var(--apm-text-primary);
    font-weight: 400;
    margin: 0 0 28px;
    letter-spacing: -0.3px;
  }

  .apm-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--apm-text-secondary);
    text-transform: uppercase;
    margin-bottom: 8px;
    display: block;
  }

  .apm-label-note {
    font-weight: 400;
    text-transform: none;
    font-size: 11px;
    color: var(--apm-text-hint);
    letter-spacing: 0;
  }

  .apm-field { margin-bottom: 20px; }

  .apm-type-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-bottom: 24px;
  }

  .apm-type-btn {
    background: var(--apm-bg-type);
    border: 0.5px solid var(--apm-border);
    border-radius: 10px;
    padding: 10px 4px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .apm-type-btn:hover {
    background: var(--apm-bg-type-hover);
    border-color: rgba(128, 128, 128, 0.3);
  }
  .apm-type-btn.active {
    background: var(--apm-accent-bg);
    border-color: var(--apm-border-active);
  }
  .apm-type-icon {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .apm-type-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--apm-text-secondary);
    text-transform: uppercase;
    text-align: center;
    line-height: 1.2;
  }
  .apm-type-btn.active .apm-type-label { color: var(--apm-text-active); }

  .apm-input,
  .apm-select,
  .apm-textarea {
    width: 100%;
    background: var(--apm-bg-input);
    border: 0.5px solid var(--apm-border);
    border-radius: 10px;
    padding: 11px 14px;
    font-size: 14px;
    color: var(--apm-text-primary);
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
  }
  .apm-input::placeholder,
  .apm-textarea::placeholder { color: var(--apm-placeholder); }
  .apm-input:focus,
  .apm-select:focus,
  .apm-textarea:focus {
    border-color: var(--apm-border-focus);
    background: var(--apm-bg-input-hover);
  }
  .apm-select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    background-color: var(--apm-bg-input);
    padding-right: 36px;
    cursor: pointer;
  }
  .apm-textarea { resize: none; height: 80px; line-height: 1.5; }

  .apm-two-col   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .apm-price-wrap { position: relative; }
  .apm-price-wrap .apm-input { padding-left: 28px; }
  .apm-price-prefix {
    position: absolute; left: 13px; top: 50%;
    transform: translateY(-50%);
    font-size: 13px; color: var(--apm-text-hint); pointer-events: none;
  }
  .apm-pct-wrap { position: relative; }
  .apm-pct-wrap .apm-input { padding-right: 28px; }
  .apm-pct-suffix {
    position: absolute; right: 13px; top: 50%;
    transform: translateY(-50%);
    font-size: 13px; color: var(--apm-text-hint); pointer-events: none;
  }
  .apm-calc-hint {
    font-size: 11px;
    color: var(--apm-text-hint);
    margin: 6px 0 0;
    line-height: 1.4;
  }

  .apm-tag-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .apm-tag {
    background: var(--apm-bg-tag);
    border: 0.5px solid var(--apm-border);
    border-radius: 20px;
    padding: 5px 12px;
    font-size: 12px;
    color: var(--apm-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    font-weight: 500;
    user-select: none;
  }
  .apm-tag:hover { background: var(--apm-bg-tag-hover); color: var(--apm-text-primary); }
  .apm-tag.active {
    background: var(--apm-accent-bg);
    border-color: var(--apm-border-active);
    color: var(--apm-text-active);
  }

  .apm-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--apm-bg-toggle);
    border: 0.5px solid var(--apm-border);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 20px;
  }
  .apm-toggle-info { display: flex; flex-direction: column; gap: 2px; }
  .apm-toggle-label { font-size: 14px; color: var(--apm-text-primary); font-weight: 500; }
  .apm-toggle-hint  { font-size: 12px; color: var(--apm-text-hint); }

  .apm-switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
  .apm-switch input { opacity: 0; width: 0; height: 0; }
  .apm-track {
    position: absolute; inset: 0;
    background: var(--apm-border);
    border-radius: 11px;
    cursor: pointer;
    transition: background 0.2s;
    border: 0.5px solid var(--apm-border);
  }
  .apm-switch input:checked + .apm-track { background: var(--apm-accent); border-color: var(--apm-accent); }
  .apm-thumb {
    position: absolute; top: 3px; left: 3px;
    width: 14px; height: 14px;
    background: #FFFFFF;
    border-radius: 50%;
    transition: transform 0.2s;
    pointer-events: none;
  }
  .apm-switch input:checked ~ .apm-thumb { transform: translateX(18px); }

  .apm-divider { border: none; border-top: 0.5px solid var(--apm-divider); margin: 24px 0; }

  .apm-actions { display: flex; justify-content: flex-end; gap: 10px; }

  .apm-btn-cancel {
    background: var(--apm-cancel-bg);
    border: 0.5px solid var(--apm-border);
    border-radius: 10px;
    padding: 11px 22px;
    font-size: 14px;
    color: var(--apm-cancel-text);
    cursor: pointer;
    font-family: inherit;
    font-weight: 500;
    transition: all 0.15s;
  }
  .apm-btn-cancel:hover { background: var(--apm-cancel-hover); color: var(--apm-text-primary); }

  .apm-btn-create {
    background: var(--apm-accent);
    border: none;
    border-radius: 10px;
    padding: 11px 24px;
    font-size: 14px;
    color: #FFFFFF;
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: background 0.15s;
  }
  .apm-btn-create:hover { background: var(--apm-accent-hover); }
`

const IconLabor = ({ color }: { color: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="7" r="4" />
    <path d="M5 21v-2a7 7 0 0114 0v2" />
  </svg>
)
const IconMaterial = ({ color }: { color: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
  </svg>
)
const IconEquipment = ({ color }: { color: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
)
const IconSub = ({ color }: { color: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
  </svg>
)
const IconService = ({ color }: { color: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
)

const TYPES = [
  { key: 'labor', label: 'Labor', Icon: IconLabor },
  { key: 'material', label: 'Material', Icon: IconMaterial },
  { key: 'equipment', label: 'Equipment', Icon: IconEquipment },
  { key: 'sub', label: 'Sub', Icon: IconSub },
  { key: 'service', label: 'Service', Icon: IconService },
] as const

const UNITS_BY_TYPE = {
  labor: ['hr', 'day', 'wk', 'mo'],
  material: ['ea', 'sqft', 'lnft', 'cuyd', 'lb', 'ton', 'bag', 'sheet', 'lf'],
  equipment: ['day', 'wk', 'mo', 'hr'],
  sub: ['ls', 'job', 'ea', 'sqft'],
  service: ['ea', 'hr', 'ls', 'job', 'mo'],
} as const

const TRADES = [
  'Framing', 'Electrical', 'Plumbing', 'HVAC',
  'Drywall', 'Roofing', 'Concrete', 'Painting', 'General',
]

const ACCENT = '#C0392B'
const MUTED = 'rgba(128,128,128,0.45)'

export type AddProductModalPayload = {
  type: 'labor' | 'material' | 'equipment' | 'sub' | 'service'
  name: string
  unit: string
  price: number
  trades: string[]
  taxable: boolean
  description: string
  subCost?: number
  markupPct?: number
  billedPrice?: number
}

export type ProductFormValue = {
  type: AddProductModalPayload['type']
  name: string
  unit: string
  price: string
  subCost: string
  markup: string
  trades: string[]
  taxable: boolean
  description: string
}

function injectApmStyles() {
  if (typeof document !== 'undefined' && !document.getElementById('apm-styles')) {
    const tag = document.createElement('style')
    tag.id = 'apm-styles'
    tag.textContent = STYLES
    document.head.appendChild(tag)
  }
}

export function defaultProductFormValue(scopeTradeTag?: string | null): ProductFormValue {
  return {
    type: 'labor',
    name: '',
    unit: 'hr',
    price: '',
    subCost: '',
    markup: '15',
    trades: scopeTradeTag ? [scopeTradeTag] : [],
    taxable: false,
    description: '',
  }
}

/** Map saved GC estimate line back into product form (best-effort unit/type). */
export function restoreProductFormFromGcLine(line: GcEstimateLine, scopeTrade: string): ProductFormValue {
  const u = (line.unit || 'ea').trim()
  let type: AddProductModalPayload['type'] = 'service'
  for (const t of ['labor', 'material', 'equipment', 'sub', 'service'] as const) {
    if ((UNITS_BY_TYPE[t] as readonly string[]).includes(u)) {
      type = t
      break
    }
  }
  const allowed = UNITS_BY_TYPE[type] as readonly string[]
  const unit = allowed.includes(u as (typeof allowed)[number]) ? u : allowed[0]
  return {
    type,
    name: line.description || '',
    unit,
    price: line.unit_price != null && Number(line.unit_price) >= 0 ? String(line.unit_price) : '',
    subCost: '',
    markup: '15',
    trades: scopeTrade ? [scopeTrade] : [],
    taxable: false,
    description: '',
  }
}

/** Fill product form from a saved library item (Products & Services). */
export function customProductToProductFormValue(
  p: CustomProduct,
  scopeTradeTag?: string | null
): ProductFormValue {
  const raw = (p.item_type || 'service').toLowerCase()
  let type: AddProductModalPayload['type'] = 'service'
  if (raw === 'labor') type = 'labor'
  else if (raw === 'product' || raw === 'material') type = 'material'
  else if (raw === 'equipment') type = 'equipment'
  else if (raw === 'sub') type = 'sub'
  else type = 'service'

  const allowed = UNITS_BY_TYPE[type] as readonly string[]
  const u = (p.unit || '').trim()
  const unit = allowed.includes(u as (typeof allowed)[number]) ? u : allowed[0]

  const fromProduct = (Array.isArray(p.trades) ? p.trades.filter(Boolean) : []) as string[]
  let trades: string[]
  if (scopeTradeTag && !fromProduct.includes(scopeTradeTag)) {
    trades = [...fromProduct, scopeTradeTag]
  } else if (fromProduct.length) {
    trades = fromProduct
  } else if (scopeTradeTag) {
    trades = [scopeTradeTag]
  } else {
    trades = []
  }

  const base: ProductFormValue = {
    type,
    name: (p.name || '').trim(),
    unit,
    price: '',
    subCost: p.sub_cost != null && String(p.sub_cost) !== '' ? String(p.sub_cost) : '',
    markup:
      p.markup_pct != null && String(p.markup_pct) !== '' ? String(p.markup_pct) : '15',
    trades,
    taxable: !!p.taxable,
    description: p.description?.trim() || '',
  }
  if (type === 'sub') {
    base.price =
      p.billed_price != null && Number(p.billed_price) >= 0
        ? String(p.billed_price)
        : String(Number(p.default_unit_price) || 0)
  } else {
    base.price =
      p.default_unit_price != null && Number(p.default_unit_price) >= 0
        ? String(p.default_unit_price)
        : ''
  }
  return base
}

export function productFormValueToPayload(v: ProductFormValue): AddProductModalPayload {
  const cost = parseFloat(v.subCost) || 0
  const pct = parseFloat(v.markup) || 0
  const billed = cost * (1 + pct / 100)
  const payload: AddProductModalPayload = {
    type: v.type,
    name: v.name,
    unit: v.unit,
    price: parseFloat(v.price) || 0,
    trades: v.trades,
    taxable: v.taxable,
    description: v.description,
  }
  if (v.type === 'sub') {
    payload.subCost = cost
    payload.markupPct = pct
    payload.billedPrice = parseFloat(billed.toFixed(2))
  }
  return payload
}

export function gcLineFromProductForm(v: ProductFormValue, qty: number): GcEstimateLine {
  const p = productFormValueToPayload(v)
  const unitPrice = p.type === 'sub' ? (p.billedPrice ?? p.price) : p.price
  return {
    description: p.name.trim() || 'Line item',
    quantity: Math.max(0.0001, Number(qty) || 0) || 1,
    unit: p.unit,
    unit_price: Math.max(0, unitPrice),
  }
}

export function AddProductFormFields({
  value,
  onChange,
  scopeTradeTag,
  compact,
}: {
  value: ProductFormValue
  onChange: (patch: Partial<ProductFormValue>) => void
  scopeTradeTag?: string | null
  compact?: boolean
}) {
  useEffect(() => {
    injectApmStyles()
  }, [])

  const tradePills = useMemo(
    () => [...new Set([...(scopeTradeTag ? [scopeTradeTag] : []), ...TRADES])],
    [scopeTradeTag]
  )

  const billedToClient = () => {
    const cost = parseFloat(value.subCost) || 0
    const pct = parseFloat(value.markup) || 0
    return (cost * (1 + pct / 100)).toFixed(2)
  }

  const handleTypeChange = (key: AddProductModalPayload['type']) => {
    onChange({ type: key, unit: UNITS_BY_TYPE[key][0] })
  }

  const toggleTrade = (trade: string) => {
    onChange({
      trades: value.trades.includes(trade)
        ? value.trades.filter((t) => t !== trade)
        : [...value.trades, trade],
    })
  }

  return (
    <div className={`apm-root ${compact ? 'apm-root--compact' : ''}`}>
      <span className="apm-label">Type</span>
      <div className="apm-type-grid">
        {TYPES.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className={`apm-type-btn ${value.type === key ? 'active' : ''}`}
            onClick={() => handleTypeChange(key)}
          >
            <span className="apm-type-icon">
              <Icon color={value.type === key ? ACCENT : MUTED} />
            </span>
            <span className="apm-type-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="apm-field">
        <span className="apm-label">Name</span>
        <input
          className="apm-input"
          type="text"
          placeholder="e.g. Framing Labor — 2x6 Wall Assembly"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="apm-two-col">
        <div className="apm-field">
          <span className="apm-label">Unit</span>
          <select
            className="apm-select"
            value={value.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
          >
            {UNITS_BY_TYPE[value.type].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="apm-field">
          <span className="apm-label">Default unit price</span>
          <div className="apm-price-wrap">
            <span className="apm-price-prefix">$</span>
            <input
              className="apm-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={value.price}
              onChange={(e) => onChange({ price: e.target.value })}
            />
          </div>
        </div>
      </div>

      {value.type === 'sub' && (
        <div className="apm-two-col" style={{ marginBottom: compact ? 12 : 20 }}>
          <div className="apm-field" style={{ marginBottom: 0 }}>
            <span className="apm-label">Sub cost (your cost)</span>
            <div className="apm-price-wrap">
              <span className="apm-price-prefix">$</span>
              <input
                className="apm-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={value.subCost}
                onChange={(e) => onChange({ subCost: e.target.value })}
              />
            </div>
          </div>
          <div className="apm-field" style={{ marginBottom: 0 }}>
            <span className="apm-label">Markup %</span>
            <div className="apm-pct-wrap">
              <input
                className="apm-input"
                type="number"
                min="0"
                step="1"
                value={value.markup}
                onChange={(e) => onChange({ markup: e.target.value })}
              />
              <span className="apm-pct-suffix">%</span>
            </div>
            <p className="apm-calc-hint">Billed to client: ${billedToClient()}</p>
          </div>
        </div>
      )}

      <div className="apm-field">
        <span className="apm-label">
          Trade / Category <span className="apm-label-note">— multi-select</span>
        </span>
        <div className="apm-tag-row">
          {tradePills.map((trade) => (
            <span
              key={trade}
              className={`apm-tag ${value.trades.includes(trade) ? 'active' : ''}`}
              onClick={() => toggleTrade(trade)}
            >
              {trade}
            </span>
          ))}
        </div>
      </div>

      <div className="apm-toggle-row">
        <div className="apm-toggle-info">
          <span className="apm-toggle-label">Taxable</span>
          <span className="apm-toggle-hint">Auto-applies tax in estimate builder when toggled on</span>
        </div>
        <label className="apm-switch">
          <input
            type="checkbox"
            checked={value.taxable}
            onChange={(e) => onChange({ taxable: e.target.checked })}
          />
          <span className="apm-track" />
          <span className="apm-thumb" />
        </label>
      </div>

      <div className="apm-field" style={{ marginBottom: compact ? 0 : undefined }}>
        <span className="apm-label">
          Description <span className="apm-label-note">(optional)</span>
        </span>
        <textarea
          className="apm-textarea"
          placeholder="Scope notes, spec details, or anything relevant for estimates…"
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  )
}

interface AddProductModalProps {
  onClose: () => void
  onSubmit: (payload: AddProductModalPayload) => void
}

export default function AddProductModal({ onClose, onSubmit }: AddProductModalProps) {
  const [value, setValue] = useState<ProductFormValue>(() => defaultProductFormValue())

  useEffect(() => {
    injectApmStyles()
  }, [])

  const patch = (u: Partial<ProductFormValue>) => setValue((prev) => ({ ...prev, ...u }))

  const handleSubmit = () => {
    onSubmit(productFormValueToPayload(value))
    onClose()
  }

  return (
    <div className="apm-root">
      <div className="apm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="apm-modal">
          <p className="apm-title">Add product</p>
          <AddProductFormFields value={value} onChange={patch} />

          <hr className="apm-divider" />

          <div className="apm-actions">
            <button type="button" className="apm-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="apm-btn-create" onClick={handleSubmit}>
              Create product
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
