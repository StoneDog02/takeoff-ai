import { useState, useEffect, useMemo } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { CustomProduct } from '@/types/global'
import { USE_MOCK_ESTIMATES, MOCK_CUSTOM_PRODUCTS } from '@/data/mockEstimatesData'
import AddProductModal, { type AddProductModalPayload } from '@/components/estimates/AddProductModal'
import { ProductsDrawer, type ProductsDrawerProduct, type ProductsDrawerType } from '@/components/estimates/ProductsDrawer'

const UNIT_OPTIONS = ['ea', 'hr', 'sqft', 'lf', 'gal', 'sheet', 'load', 'flat']

function itemTypeToDrawerType(itemType?: string | null): ProductsDrawerType {
  const t = (itemType || 'service').toLowerCase()
  if (t === 'labor') return 'labor'
  if (t === 'product' || t === 'material') return 'material'
  if (t === 'sub') return 'sub'
  if (t === 'equipment') return 'equipment'
  return 'service'
}

function toDrawerProduct(p: CustomProduct): ProductsDrawerProduct {
  return {
    id: p.id,
    name: p.name,
    desc: p.description?.trim() || undefined,
    type: itemTypeToDrawerType(p.item_type),
    trades: p.trades?.filter(Boolean) as string[] | undefined,
    unit: p.unit,
    price: Number(p.default_unit_price) || 0,
    taxable: !!p.taxable,
  }
}

export interface CustomProductLibraryProps {
  /** When set, drawer close button calls this (e.g. dismiss portal). */
  onClose?: () => void
}

export function CustomProductLibrary({ onClose }: CustomProductLibraryProps) {
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

  const saveCreate = async (payload: AddProductModalPayload) => {
    if (USE_MOCK_ESTIMATES) {
      closeModal()
      return
    }
    try {
      await estimatesApi.createCustomProduct({
        name: payload.name.trim(),
        description: payload.description.trim() || undefined,
        unit: payload.unit,
        default_unit_price: payload.type === 'sub' ? (payload.billedPrice ?? payload.price) : payload.price,
        item_type: payload.type,
        sub_cost: payload.subCost,
        markup_pct: payload.markupPct,
        billed_price: payload.billedPrice,
        trades: payload.trades,
        taxable: payload.taxable,
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

  const drawerProducts = useMemo(() => products.map(toDrawerProduct), [products])

  const resolveProduct = (dp: ProductsDrawerProduct) =>
    products.find((x) => String(x.id) === String(dp.id))

  if (loading) {
    return (
      <div className="pdr-root" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #888)' }}>
        Loading…
      </div>
    )
  }

  return (
    <>
      <ProductsDrawer
        products={drawerProducts}
        onClose={onClose ?? (() => {})}
        onAdd={openCreate}
        onEdit={(dp) => {
          const full = resolveProduct(dp)
          if (full) openEdit(full)
        }}
        onDelete={(dp) => {
          void deleteProduct(String(dp.id))
        }}
      />

      {creating && <AddProductModal onClose={closeModal} onSubmit={saveCreate} />}
      {editing && (
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
              Edit product
            </h2>
            <form
              className="add-product-form"
              onSubmit={(e) => {
                e.preventDefault()
                saveEdit()
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
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="add-product-form-row">
                <label htmlFor="add-product-price" className="add-product-form-label">
                  Default unit price
                </label>
                <div className="add-product-form-price-wrap">
                  <span className="add-product-form-price-prefix" aria-hidden>
                    $
                  </span>
                  <input
                    id="add-product-price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.default_unit_price}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        default_unit_price: parseFloat((e.target as HTMLInputElement).value) || 0,
                      }))
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
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ color: 'var(--red-light)', marginRight: 'auto' }}
                  onClick={() => deleteProduct(editing.id)}
                >
                  Delete
                </button>
                <button type="submit" className="btn btn-primary">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
