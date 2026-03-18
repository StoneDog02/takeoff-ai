import { useState, useMemo, useEffect } from 'react'

export type ProductsDrawerType = 'labor' | 'material' | 'equipment' | 'sub' | 'service'

export type ProductsDrawerProduct = {
  id: string | number
  name: string
  desc?: string
  type: ProductsDrawerType
  trades?: string[]
  unit: string
  price: number
  taxable?: boolean
}

/* No @import here: injected <style> blocks can fail to apply rules after @import, breaking layout. */
const STYLES = `
  .pdr-root {
    --pdr-bg:             #FFFFFF;
    --pdr-bg-secondary:   rgba(0,0,0,0.04);
    --pdr-bg-tertiary:    rgba(0,0,0,0.07);
    --pdr-bg-hover:       rgba(0,0,0,0.04);
    --pdr-border:         rgba(0,0,0,0.1);
    --pdr-border-focus:   rgba(192,57,43,0.45);
    --pdr-text-primary:   #1A1A1A;
    --pdr-text-secondary: #6B6B6B;
    --pdr-text-tertiary:  #A0A0A0;
    --pdr-accent:         #C0392B;
    --pdr-accent-hover:   #A93226;
    --pdr-accent-bg:      rgba(192,57,43,0.09);
    --pdr-accent-text:    #C0392B;
    --pdr-shadow:         2px 0 12px rgba(0,0,0,0.08);
  }

  .dark .pdr-root,
  html[data-theme="dark"] .pdr-root {
    --pdr-bg:             #1C1C1C;
    --pdr-bg-secondary:   rgba(255,255,255,0.06);
    --pdr-bg-tertiary:    rgba(255,255,255,0.1);
    --pdr-bg-hover:       rgba(255,255,255,0.05);
    --pdr-border:         rgba(255,255,255,0.12);
    --pdr-border-focus:   rgba(192,57,43,0.55);
    --pdr-text-primary:   #F7F6F3;
    --pdr-text-secondary: rgba(247,246,243,0.55);
    --pdr-text-tertiary:  rgba(247,246,243,0.3);
    --pdr-accent:         #C0392B;
    --pdr-accent-hover:   #A93226;
    --pdr-accent-bg:      rgba(192,57,43,0.18);
    --pdr-accent-text:    #E8897E;
    --pdr-shadow:         none;
  }

  .pdr-root * { box-sizing: border-box; }

  .pdr-drawer {
    width: 100%;
    max-width: 480px;
    height: 100%;
    min-height: 0;
    background: var(--pdr-bg);
    display: flex;
    flex-direction: column;
    border-right: 0.5px solid var(--pdr-border);
    box-shadow: var(--pdr-shadow);
    font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
    direction: ltr;
  }

  /* 2×2 grid: col1 = Library + title, col2 = × above Add product (explicit placement) */
  .pdr-header.pdr-header--grid {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) max-content;
    grid-template-rows: auto auto;
    column-gap: 16px;
    row-gap: 10px;
    align-items: center;
    flex-shrink: 0;
    padding: 18px 24px 12px;
    margin: 0;
  }

  .pdr-header-below {
    flex-shrink: 0;
    padding: 0 24px 20px;
  }

  .pdr-header--grid .pdr-eyebrow {
    grid-column: 1 !important;
    grid-row: 1 !important;
    justify-self: start;
    align-self: start;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--pdr-text-tertiary);
    text-transform: uppercase;
    margin: 0;
    padding-top: 2px;
  }

  .pdr-header--grid .pdr-header-close {
    grid-column: 2 !important;
    grid-row: 1 !important;
    justify-self: end !important;
    align-self: start !important;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--pdr-bg-secondary);
    border: 0.5px solid var(--pdr-border);
    display: flex !important;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--pdr-text-secondary);
    padding: 0;
    flex-shrink: 0;
  }
  .pdr-header--grid .pdr-header-close:hover {
    background: var(--pdr-bg-tertiary);
  }

  .pdr-header--grid .pdr-title {
    grid-column: 1 !important;
    grid-row: 2 !important;
    justify-self: start;
    align-self: center;
    font-family: var(--font-display, Georgia, 'Times New Roman', serif);
    font-size: 22px;
    font-weight: 400;
    color: var(--pdr-text-primary);
    letter-spacing: -0.3px;
    min-width: 0;
    line-height: 1.2;
    margin: 0;
  }

  .pdr-header--grid .pdr-header-add {
    grid-column: 2 !important;
    grid-row: 2 !important;
    justify-self: end !important;
    align-self: center !important;
    display: inline-flex !important;
    align-items: center;
    gap: 6px;
    appearance: none;
    -webkit-appearance: none;
    background: var(--pdr-accent) !important;
    border: none !important;
    border-radius: 10px;
    padding: 8px 14px !important;
    font-size: 12px;
    font-weight: 700;
    color: #fff !important;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    letter-spacing: 0.01em;
    transition: background 0.15s;
    line-height: 1.2;
    box-sizing: border-box;
  }
  .pdr-header--grid .pdr-header-add:hover {
    background: var(--pdr-accent-hover);
  }

  .pdr-close-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--pdr-bg-secondary);
    border: 0.5px solid var(--pdr-border);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--pdr-text-secondary);
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .pdr-close-btn:hover { background: var(--pdr-bg-tertiary); }

  .pdr-search-wrap { position: relative; margin-bottom: 12px; }
  .pdr-search-icon {
    position: absolute; left: 12px; top: 50%;
    transform: translateY(-50%);
    color: var(--pdr-text-tertiary);
    pointer-events: none;
    display: flex; align-items: center;
  }
  .pdr-search-input {
    width: 100%;
    background: var(--pdr-bg-secondary);
    border: 0.5px solid var(--pdr-border);
    border-radius: 10px;
    padding: 10px 14px 10px 36px;
    font-size: 13px;
    color: var(--pdr-text-primary);
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }
  .pdr-search-input::placeholder { color: var(--pdr-text-tertiary); }
  .pdr-search-input:focus { border-color: var(--pdr-border-focus); }

  .pdr-filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .pdr-filter-row::-webkit-scrollbar { display: none; }

  .pdr-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--pdr-bg-secondary);
    border: 0.5px solid var(--pdr-border);
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--pdr-text-secondary);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all 0.15s;
    font-family: inherit;
  }
  .pdr-chip:hover {
    background: var(--pdr-bg-tertiary);
    color: var(--pdr-text-primary);
  }
  .pdr-chip.active {
    background: var(--pdr-accent-bg);
    border-color: var(--pdr-accent);
    color: var(--pdr-accent-text);
  }

  .pdr-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--pdr-bg-tertiary);
    border-radius: 10px;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 700;
    color: var(--pdr-text-tertiary);
  }

  .pdr-add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--pdr-accent);
    border: none;
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
    letter-spacing: 0.01em;
    transition: background 0.15s;
  }
  .pdr-add-btn:hover { background: var(--pdr-accent-hover); }

  .pdr-divider {
    height: 0.5px;
    background: var(--pdr-border);
    margin: 0 24px;
    flex-shrink: 0;
  }

  .pdr-tbl-header {
    display: grid;
    grid-template-columns: 1fr 90px 56px 80px 36px;
    padding: 10px 24px;
    gap: 8px;
    flex-shrink: 0;
  }
  .pdr-col-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--pdr-text-tertiary);
    text-transform: uppercase;
  }
  .pdr-col-label.right { text-align: right; }

  .pdr-list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: 0 12px 24px;
  }

  .pdr-row {
    display: grid;
    grid-template-columns: 1fr 90px 56px 80px 36px;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.13s;
    position: relative;
  }
  .pdr-row:hover { background: var(--pdr-bg-hover); }
  .pdr-row:hover .pdr-actions { opacity: 1; }

  .pdr-name-cell {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .pdr-type-dot {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .pdr-type-dot.labor     { background: rgba(192,57,43,0.1); }
  .pdr-type-dot.material  { background: rgba(59,130,246,0.1); }
  .pdr-type-dot.equipment { background: rgba(245,158,11,0.1); }
  .pdr-type-dot.sub       { background: rgba(139,92,246,0.1); }
  .pdr-type-dot.service   { background: rgba(16,185,129,0.1); }

  .pdr-name    { font-size: 13px; font-weight: 600; color: var(--pdr-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pdr-name-sub{ font-size: 11px; color: var(--pdr-text-tertiary); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .pdr-tags { display: flex; flex-wrap: wrap; gap: 4px; align-content: center; max-height: 52px; overflow: hidden; }
  .pdr-tag-pill {
    background: var(--pdr-bg-secondary);
    border: 0.5px solid var(--pdr-border);
    border-radius: 12px;
    padding: 2px 7px;
    font-size: 10px;
    font-weight: 600;
    color: var(--pdr-text-secondary);
    white-space: nowrap;
  }

  .pdr-unit-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--pdr-bg-secondary);
    border: 0.5px solid var(--pdr-border);
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 700;
    color: var(--pdr-text-secondary);
    font-family: ui-monospace, monospace;
  }

  .pdr-price-cell {
    font-size: 13px;
    font-weight: 700;
    color: var(--pdr-text-primary);
    text-align: right;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
  }
  .pdr-tax-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #16a34a;
    flex-shrink: 0;
  }

  .pdr-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .pdr-action-btn {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--pdr-text-tertiary);
    transition: background 0.13s, color 0.13s;
  }
  .pdr-action-btn:hover { background: var(--pdr-bg-tertiary); color: var(--pdr-text-primary); }
  .pdr-action-btn.del:hover { background: rgba(192,57,43,0.1); color: #C0392B; }

  .pdr-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
    gap: 10px;
    text-align: center;
  }
  .pdr-empty-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--pdr-bg-secondary);
    border: 0.5px solid var(--pdr-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--pdr-text-tertiary);
    margin-bottom: 4px;
  }
  .pdr-empty-title { font-size: 14px; font-weight: 600; color: var(--pdr-text-primary); }
  .pdr-empty-sub   { font-size: 12px; color: var(--pdr-text-tertiary); max-width: 200px; line-height: 1.5; }
`

const TYPE_ICON_COLORS: Record<ProductsDrawerType, string> = {
  labor: '#C0392B',
  material: '#3B82F6',
  equipment: '#F59E0B',
  sub: '#8B5CF6',
  service: '#10B981',
}

function TypeIcon({ type, size = 14 }: { type: ProductsDrawerType; size?: number }) {
  const stroke = TYPE_ICON_COLORS[type] ?? '#888'
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
  }
  switch (type) {
    case 'labor':
      return (
        <svg {...props}>
          <circle cx="12" cy="7" r="4" />
          <path d="M5 21v-2a7 7 0 0114 0v2" />
        </svg>
      )
    case 'material':
      return (
        <svg {...props}>
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        </svg>
      )
    case 'equipment':
      return (
        <svg {...props}>
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      )
    case 'sub':
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
        </svg>
      )
    case 'service':
      return (
        <svg {...props}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      )
    default:
      return null
  }
}

function ChipIcon({ type, size = 11 }: { type: string; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
  }
  switch (type) {
    case 'labor':
      return (
        <svg {...props}>
          <circle cx="12" cy="7" r="4" />
          <path d="M5 21v-2a7 7 0 0114 0v2" />
        </svg>
      )
    case 'material':
      return (
        <svg {...props}>
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        </svg>
      )
    case 'equipment':
      return (
        <svg {...props}>
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      )
    case 'sub':
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
        </svg>
      )
    case 'service':
      return (
        <svg {...props}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      )
    default:
      return null
  }
}

const FILTER_TYPES: { key: ProductsDrawerType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'labor', label: 'Labor' },
  { key: 'material', label: 'Material' },
  { key: 'service', label: 'Service' },
  { key: 'sub', label: 'Sub' },
  { key: 'equipment', label: 'Equipment' },
]

function formatPrice(price: number) {
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function injectPdrStyles() {
  if (typeof document === 'undefined') return
  let tag = document.getElementById('pdr-styles') as HTMLStyleElement | null
  if (!tag) {
    tag = document.createElement('style')
    tag.id = 'pdr-styles'
    document.head.appendChild(tag)
  }
  tag.textContent = STYLES
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="pdr-empty">
      <div className="pdr-empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      </div>
      <p className="pdr-empty-title">{query ? 'No products found' : 'No products yet'}</p>
      <p className="pdr-empty-sub">
        {query ? 'Try a different filter or search term.' : 'Add your first product or service to get started.'}
      </p>
    </div>
  )
}

function ProductRow({
  product,
  onEdit,
  onDelete,
  onRowClick,
}: {
  product: ProductsDrawerProduct
  onEdit?: (p: ProductsDrawerProduct) => void
  onDelete?: (p: ProductsDrawerProduct) => void
  onRowClick?: (p: ProductsDrawerProduct) => void
}) {
  return (
    <div
      className="pdr-row"
      role="button"
      tabIndex={0}
      onClick={() => onRowClick?.(product)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onRowClick?.(product)
        }
      }}
    >
      <div className="pdr-name-cell">
        <div className={`pdr-type-dot ${product.type}`}>
          <TypeIcon type={product.type} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="pdr-name">{product.name}</div>
          {product.desc ? <div className="pdr-name-sub">{product.desc}</div> : null}
        </div>
      </div>

      <div className="pdr-tags">
        {product.trades?.length
          ? product.trades.slice(0, 3).map((t) => (
              <span key={t} className="pdr-tag-pill">
                {t}
              </span>
            ))
          : null}
        {!product.trades?.length ? <span className="pdr-tag-pill">—</span> : null}
      </div>

      <div>
        <span className="pdr-unit-pill">{product.unit}</span>
      </div>

      <div className="pdr-price-cell">
        {formatPrice(product.price)}
        {product.taxable ? <span className="pdr-tax-dot" title="Taxable" /> : null}
      </div>

      <div className="pdr-actions">
        <button
          type="button"
          className="pdr-action-btn"
          title="Edit"
          onClick={(e) => {
            e.stopPropagation()
            onEdit?.(product)
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          type="button"
          className="pdr-action-btn del"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.(product)
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export interface ProductsDrawerProps {
  products?: ProductsDrawerProduct[]
  onClose: () => void
  onAdd: () => void
  onEdit?: (product: ProductsDrawerProduct) => void
  onDelete?: (product: ProductsDrawerProduct) => void
}

export function ProductsDrawer({ products = [], onClose, onAdd, onEdit, onDelete }: ProductsDrawerProps) {
  useEffect(() => {
    injectPdrStyles()
  }, [])

  const [activeFilter, setActiveFilter] = useState<ProductsDrawerType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchType = activeFilter === 'all' || p.type === activeFilter
      const q = searchQuery.toLowerCase()
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.desc ?? '').toLowerCase().includes(q)
      return matchType && matchSearch
    })
  }, [products, activeFilter, searchQuery])

  const handleRow = onEdit ?? (() => {})

  return (
    <div className="pdr-root" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="pdr-drawer">
        <header className="pdr-header pdr-header--grid">
          <p className="pdr-eyebrow">Library</p>
          <button type="button" className="pdr-header-close" onClick={onClose} aria-label="Close library">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <h2 className="pdr-title">Products &amp; Services</h2>
          <button type="button" className="pdr-header-add" onClick={onAdd}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add product
          </button>
        </header>

        <div className="pdr-header-below">
          <div className="pdr-search-wrap">
            <span className="pdr-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input
              className="pdr-search-input"
              type="text"
              placeholder="Search products…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search products"
            />
          </div>

          <div className="pdr-filter-row">
            {FILTER_TYPES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`pdr-chip ${activeFilter === key ? 'active' : ''}`}
                onClick={() => setActiveFilter(key)}
              >
                {key !== 'all' ? <ChipIcon type={key} /> : null}
                {label}
                {key === 'all' ? <span className="pdr-count">{products.length}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="pdr-divider" />
        <div className="pdr-tbl-header">
          <span className="pdr-col-label">Name</span>
          <span className="pdr-col-label">Tags</span>
          <span className="pdr-col-label">Unit</span>
          <span className="pdr-col-label right">Price</span>
          <span />
        </div>
        <div className="pdr-divider" />

        <div className="pdr-list">
          {filtered.length === 0 ? (
            <EmptyState query={searchQuery} />
          ) : (
            filtered.map((p) => (
              <ProductRow
                key={String(p.id)}
                product={p}
                onEdit={onEdit}
                onDelete={onDelete}
                onRowClick={handleRow}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
