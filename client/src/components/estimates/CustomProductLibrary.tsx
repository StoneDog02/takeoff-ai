import { useState, useEffect } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { CustomProduct } from '@/types/global'
import { USE_MOCK_ESTIMATES, MOCK_CUSTOM_PRODUCTS } from '@/data/mockEstimatesData'

const UNIT_OPTIONS = ['ea', 'hr', 'sqft', 'lf', 'gal', 'sheet', 'load', 'flat']

export function CustomProductLibrary() {
  const [products, setProducts] = useState<CustomProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CustomProduct | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    unit: 'ea',
    default_unit_price: 0,
  })

  const load = () => {
    if (USE_MOCK_ESTIMATES) {
      setProducts(MOCK_CUSTOM_PRODUCTS)
      setLoading(false)
      return
    }
    setLoading(true)
    estimatesApi
      .getCustomProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setCreating(true)
    setEditing(null)
    setForm({ name: '', description: '', unit: 'ea', default_unit_price: 0 })
  }

  const openEdit = (p: CustomProduct) => {
    setEditing(p)
    setCreating(false)
    setForm({
      name: p.name,
      description: p.description ?? '',
      unit: p.unit,
      default_unit_price: p.default_unit_price,
    })
  }

  const closeModal = () => {
    setEditing(null)
    setCreating(false)
  }

  const saveCreate = async () => {
    if (!form.name.trim()) return
    if (USE_MOCK_ESTIMATES) {
      closeModal()
      return
    }
    try {
      await estimatesApi.createCustomProduct({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        unit: form.unit,
        default_unit_price: form.default_unit_price,
      })
      load()
      closeModal()
    } catch (err) {
      console.error(err)
    }
  }

  const saveEdit = async () => {
    if (!editing || !form.name.trim()) return
    if (USE_MOCK_ESTIMATES) {
      closeModal()
      return
    }
    try {
      await estimatesApi.updateCustomProduct(editing.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        unit: form.unit,
        default_unit_price: form.default_unit_price,
      })
      load()
      closeModal()
    } catch (err) {
      console.error(err)
    }
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return
    if (USE_MOCK_ESTIMATES) {
      closeModal()
      return
    }
    try {
      await estimatesApi.deleteCustomProduct(id)
      load()
      closeModal()
    } catch (err) {
      console.error(err)
    }
  }

  const [psSearch, setPsSearch] = useState('')
  const [psFilter, setPsFilter] = useState<'all' | 'labor' | 'material' | 'service'>('all')
  const filteredProducts = products.filter((p) => {
    const q = psSearch.toLowerCase()
    if (q && !p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) return false
    if (psFilter !== 'all') {
      const type = (p.item_type || 'service') as string
      if (psFilter === 'labor' && type !== 'service') return false
      if (psFilter === 'material' && type !== 'product') return false
      if (psFilter === 'service' && type !== 'service') return false
    }
    return true
  })
  const psFilterOptions: { value: 'all' | 'labor' | 'material' | 'service'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'labor', label: 'Labor' },
    { value: 'material', label: 'Materials' },
    { value: 'service', label: 'Services' },
  ]

  if (loading) {
    return <div className="estimates-content-empty">Loading…</div>
  }

  return (
    <div>
      <div className="est-card">
        <div className="estimates-ps-toolbar">
          <div className="estimates-ps-toolbar-left">
            <div className="estimates-ledger__search-wrap" style={{ maxWidth: 240 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Search products…" value={psSearch} onChange={(e) => setPsSearch(e.target.value)} />
            </div>
            <div className="estimates-ledger__filter-group">
              {psFilterOptions.map((f) => (
                <button key={f.value} type="button" className={`estimates-ledger__filter-btn ${psFilter === f.value ? 'active' : ''}`} onClick={() => setPsFilter(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add product
          </button>
        </div>
        <table className="estimates-ps-table">
          <thead>
            <tr>
              <th style={{ width: 200 }}>Name</th>
              <th>Description</th>
              <th style={{ width: 80 }}>Category</th>
              <th className="r" style={{ width: 70 }}>Unit</th>
              <th className="r" style={{ width: 110 }}>Default Price</th>
              <th style={{ width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="estimates-ledger__empty">
                    <div className="estimates-ledger__empty-title">No products found</div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p.id} onClick={() => openEdit(p)}>
                  <td>
                    <div className="estimates-ps-name">{p.name}</div>
                    {p.description && <div className="estimates-ps-desc">{p.description}</div>}
                  </td>
                  <td><span className="estimates-ps-desc">{p.description || '—'}</span></td>
                  <td><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{p.item_type || 'service'}</span></td>
                  <td className="r"><span className="estimates-ps-unit">{p.unit}</span></td>
                  <td className="r"><span className="estimates-ps-price">${Number(p.default_unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                  <td>
                    <div className="estimates-ps-row-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 11.5 }} onClick={() => openEdit(p)}>Edit</button>
                      <button type="button" className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 11.5, color: 'var(--red-light)' }} onClick={() => deleteProduct(p.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {(creating || editing) && (
        <div
          className="add-product-modal-overlay"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-product-title"
        >
          <div
            className="add-product-modal-card"
            style={{ padding: '24px 28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-product-title" className="add-product-modal-title">
              {creating ? 'Add product' : 'Edit product'}
            </h2>
            <form
              className="add-product-form"
              onSubmit={(e) => {
                e.preventDefault()
                creating ? saveCreate() : saveEdit()
              }}
            >
              <div className="add-product-form-row">
                <label htmlFor="add-product-name" className="add-product-form-label">
                  Name
                </label>
                <input
                  id="add-product-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="add-product-form-input"
                  placeholder="e.g. Labor – Carpentry, Drywall 4x8 Sheet"
                  required
                  autoFocus
                />
              </div>
              <div className="add-product-form-row">
                <label htmlFor="add-product-desc" className="add-product-form-label">
                  Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <textarea
                  id="add-product-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="add-product-form-textarea"
                  placeholder="Brief description or scope for estimates"
                  rows={3}
                />
              </div>
              <div className="add-product-form-row">
                <label htmlFor="add-product-unit" className="add-product-form-label">
                  Unit
                </label>
                <select
                  id="add-product-unit"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="add-product-form-select"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="add-product-form-row">
                <label htmlFor="add-product-price" className="add-product-form-label">
                  Default unit price
                </label>
                <div className="add-product-form-price-wrap">
                  <span className="add-product-form-price-prefix" aria-hidden>$</span>
                  <input
                    id="add-product-price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.default_unit_price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, default_unit_price: parseFloat((e.target as HTMLInputElement).value) || 0 }))
                    }
                    className="add-product-form-input price"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="add-product-form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                {creating ? (
                  <button type="submit" className="btn btn-primary">
                    Create product
                  </button>
                ) : (
                  <>
                    {editing && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ color: 'var(--red-light)', marginRight: 'auto' }}
                        onClick={() => editing && deleteProduct(editing.id)}
                      >
                        Delete
                      </button>
                    )}
                    <button type="submit" className="btn btn-primary">
                      Save changes
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
