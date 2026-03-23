import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { estimatesApi } from '@/api/estimates'
import type { CustomProduct } from '@/types/global'
import { USE_MOCK_ESTIMATES, MOCK_CUSTOM_PRODUCTS } from '@/data/mockEstimatesData'
import AddProductModal, { type AddProductModalPayload } from '@/components/estimates/AddProductModal'
import { ProductsDrawer, type ProductsDrawerProduct, type ProductsDrawerType } from '@/components/estimates/ProductsDrawer'
import {
  estimateBudgetCategoryFromProductItemType,
  itemTypeFromLineItemBudgetCategoryLabel,
  LINE_ITEM_BUDGET_CATEGORY_LABELS,
  nextUnitForCategory,
  unitOptionsForCategory,
  type LineItemBudgetCategoryLabel,
} from '@/lib/categoryUnits'

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
  const [deleteTarget, setDeleteTarget] = useState<CustomProduct | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<{
    name: string
    description: string
    unit: string
    default_unit_price: number
    category: LineItemBudgetCategoryLabel
  }>({
    name: '',
    description: '',
    unit: 'ea',
    default_unit_price: 0,
    category: 'Other',
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
    setForm({ name: '', description: '', unit: 'ea', default_unit_price: 0, category: 'Other' })
  }

  const openEdit = (p: CustomProduct) => {
    setEditing(p)
    setCreating(false)
    const category = estimateBudgetCategoryFromProductItemType(p.item_type)
    setForm({
      name: p.name,
      description: p.description ?? '',
      unit: p.unit,
      default_unit_price: p.default_unit_price,
      category,
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
        item_type: itemTypeFromLineItemBudgetCategoryLabel(form.category),
      })
      load()
      closeModal()
    } catch (err) {
      console.error(err)
    }
  }

  const requestDeleteProduct = (id: string) => {
    const target = products.find((p) => p.id === id) ?? null
    if (!target) return
    setDeleteTarget(target)
  }

  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return
    if (USE_MOCK_ESTIMATES) {
      setDeleteTarget(null)
      closeModal()
      return
    }
    try {
      setDeleting(true)
      await estimatesApi.deleteCustomProduct(deleteTarget.id)
      load()
      setDeleteTarget(null)
      closeModal()
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
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
          requestDeleteProduct(String(dp.id))
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
                <label htmlFor="add-product-category" className="add-product-form-label">
                  Category
                </label>
                <select
                  id="add-product-category"
                  value={form.category}
                  onChange={(e) => {
                    const category = e.target.value as LineItemBudgetCategoryLabel
                    setForm((f) => ({
                      ...f,
                      category,
                      unit: nextUnitForCategory(category, f.unit),
                    }))
                  }}
                  className="add-product-form-select"
                  aria-label="Budget category"
                >
                  {LINE_ITEM_BUDGET_CATEGORY_LABELS.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
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
                  aria-label="Unit"
                >
                  {unitOptionsForCategory(form.category).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  {form.unit &&
                  !unitOptionsForCategory(form.category).some((o) => o.value === form.unit.trim()) ? (
                    <option value={form.unit}>{form.unit}</option>
                  ) : null}
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
                  onClick={() => requestDeleteProduct(editing.id)}
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
      {deleteTarget &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="add-product-modal-overlay add-product-delete-modal"
            onClick={() => {
              if (!deleting) setDeleteTarget(null)
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            aria-describedby="delete-product-desc delete-product-warning"
          >
            <div
              className="add-product-modal-card"
              style={{ maxWidth: 440, padding: '24px 28px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="delete-product-title" className="add-product-modal-title">
                Remove from catalog?
              </h2>
              <p id="delete-product-desc" className="add-product-delete-modal__lead">
                You’re about to permanently remove <strong>{deleteTarget.name}</strong> from your Products &amp;
                Services library. This cannot be undone.
              </p>
              <p id="delete-product-warning" className="add-product-delete-modal__warning" role="note">
                Existing estimates are not changed automatically. You can add a new catalog item later, but you’ll
                need to update line items by hand if you want them to match.
              </p>
              <div className="add-product-delete-modal__actions">
                <button
                  type="button"
                  className="add-product-delete-modal__cancel"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="add-product-delete-modal__confirm"
                  onClick={() => void confirmDeleteProduct()}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete product'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
