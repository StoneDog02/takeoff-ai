import { useState, useEffect, useMemo, useRef, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { estimatesApi, type CustomProductsImportPreview } from '@/api/estimates'
import type { CustomProduct } from '@/types/global'
import { shouldUseMockEstimates, MOCK_CUSTOM_PRODUCTS } from '@/data/mockEstimatesData'
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

  const importFileRef = useRef<HTMLInputElement>(null)
  const importTableRef = useRef<HTMLDivElement | null>(null)
  const [importPreviewLoading, setImportPreviewLoading] = useState(false)
  const [importRunLoading, setImportRunLoading] = useState(false)
  const [importPreview, setImportPreview] = useState<CustomProductsImportPreview | null>(null)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [importBanner, setImportBanner] = useState<string | null>(null)
  const [importPreviewPage, setImportPreviewPage] = useState(0)
  const IMPORT_PREVIEW_PAGE_SIZE = 25

  const load = () => {
    if (shouldUseMockEstimates()) {
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
    if (shouldUseMockEstimates()) {
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
    if (shouldUseMockEstimates()) {
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
    if (shouldUseMockEstimates()) {
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

  const openImportPicker = () => {
    importFileRef.current?.click()
  }

  const onImportFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportPreviewLoading(true)
    setImportPreview(null)
    setPendingImportFile(null)
    setImportPreviewPage(0)
    try {
      const preview = await estimatesApi.previewCustomProductsImport(file)
      setImportPreview(preview)
      setPendingImportFile(file)
      setImportPreviewPage(0)
    } catch (err) {
      console.error(err)
      window.alert(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setImportPreviewLoading(false)
    }
  }

  const closeImportModal = () => {
    if (importRunLoading) return
    setImportPreview(null)
    setPendingImportFile(null)
    setImportPreviewPage(0)
  }

  const confirmImport = async () => {
    if (!pendingImportFile || !importPreview) return
    if (importPreview.wouldInsert === 0) {
      window.alert('Nothing new to import — all rows match items already in your library (same name and unit).')
      return
    }
    setImportRunLoading(true)
    try {
      const r = await estimatesApi.importCustomProducts(pendingImportFile)
      setImportPreview(null)
      setPendingImportFile(null)
      load()
      const parts = [`Imported ${r.inserted} item${r.inserted === 1 ? '' : 's'}`]
      if (r.skippedDuplicates > 0) {
        parts.push(`${r.skippedDuplicates} duplicate${r.skippedDuplicates === 1 ? '' : 's'} skipped`)
      }
      setImportBanner(parts.join(' · '))
      window.setTimeout(() => setImportBanner(null), 10000)
    } catch (err) {
      console.error(err)
      window.alert(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImportRunLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="pdr-root" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #888)' }}>
        Loading…
      </div>
    )
  }

  return (
    <>
      <input
        ref={importFileRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        aria-hidden
        onChange={onImportFileChange}
      />
      {importBanner ? (
        <div
          style={{
            padding: '10px 16px',
            marginBottom: 8,
            borderRadius: 10,
            background: 'var(--pdr-accent-bg, rgba(192,57,43,0.09))',
            color: 'var(--pdr-text-primary, inherit)',
            fontSize: 13,
            border: '0.5px solid var(--pdr-border, rgba(0,0,0,0.1))',
          }}
          role="status"
        >
          {importBanner}
        </div>
      ) : null}
      <ProductsDrawer
        products={drawerProducts}
        onClose={onClose ?? (() => {})}
        onAdd={openCreate}
        onImport={shouldUseMockEstimates() ? undefined : openImportPicker}
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
      {importPreviewLoading &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 12000,
              background: 'rgba(0,0,0,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            role="status"
            aria-live="polite"
          >
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Reading spreadsheet…</span>
          </div>,
          document.body
        )}
      {importPreview &&
        pendingImportFile &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="add-product-modal-overlay"
            onClick={closeImportModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-products-title"
          >
            <div
              className="add-product-modal-card"
              style={{
                maxWidth: 720,
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                padding: '24px 28px',
                boxShadow: '0 18px 45px rgba(15,23,42,0.25)',
                background: 'var(--surface, #ffffff)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="import-products-title" className="add-product-modal-title">
                Import products
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 16 }}>
                <strong>{pendingImportFile.name}</strong>
                {' · '}
                QuickBooks-style Excel or CSV (header row with item name and price columns).
              </p>
              {importPreview.totalParsed === 0 ? (
                <p style={{ fontSize: 14, marginBottom: 16 }}>
                  No product rows were found. Check that the first sheet has a header row (e.g. Item name, Sales price)
                  and data below it.
                </p>
              ) : null}
              <div style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.6, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <strong>{importPreview.totalParsed}</strong> row{importPreview.totalParsed === 1 ? '' : 's'} in file
                </div>
                <div style={{ color: importPreview.wouldInsert > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <strong>{importPreview.wouldInsert}</strong> new item{importPreview.wouldInsert === 1 ? '' : 's'} will be added
                </div>
                {importPreview.skippedDuplicates > 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>
                    <strong>{importPreview.skippedDuplicates}</strong> skipped (already in your library — same name and unit)
                  </div>
                ) : null}
              </div>
              {importPreview.warnings.length > 0 ? (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Notes</p>
                  <ul style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, paddingLeft: '1.1rem' }}>
                    {importPreview.warnings.slice(0, 5).map((w, i) => (
                      <li key={i} style={{ marginBottom: 2 }}>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {importPreview.parseErrors.length > 0 ? (
                <ul style={{ fontSize: 12, color: 'var(--red-light, #c0392b)', margin: '0 0 12px 1rem' }}>
                  {importPreview.parseErrors.map((pe, i) => (
                    <li key={i}>
                      Row {pe.row}: {pe.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {importPreview.previewRows.length > 0 ? (
                <>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                    Preview · Showing{' '}
                    {Math.min(
                      importPreview.totalParsed,
                      importPreviewPage * IMPORT_PREVIEW_PAGE_SIZE + 1
                    )}
                    –
                    {Math.min(
                      importPreview.totalParsed,
                      (importPreviewPage + 1) * IMPORT_PREVIEW_PAGE_SIZE
                    )}{' '}
                    of {importPreview.totalParsed} item
                    {importPreview.totalParsed === 1 ? '' : 's'}
                  </p>
                  <div
                    ref={importTableRef}
                    style={{
                      overflowX: 'auto',
                      maxHeight: 260,
                      border: '0.5px solid var(--border)',
                      borderRadius: 8,
                    }}
                  >
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary, rgba(148,163,184,0.1))' }}>
                          <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
                          <th style={{ textAlign: 'left', padding: 8 }}>Unit</th>
                          <th style={{ textAlign: 'right', padding: 8 }}>Price</th>
                          <th style={{ textAlign: 'right', padding: 8 }}>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.previewRows
                          .slice(
                            importPreviewPage * IMPORT_PREVIEW_PAGE_SIZE,
                            (importPreviewPage + 1) * IMPORT_PREVIEW_PAGE_SIZE
                          )
                          .map((row, i) => {
                            const globalIndex = importPreviewPage * IMPORT_PREVIEW_PAGE_SIZE + i
                            return (
                          <tr
                            key={globalIndex}
                            style={{
                              borderTop: '0.5px solid var(--border)',
                              background:
                                globalIndex % 2 === 0
                                  ? 'transparent'
                                  : 'var(--bg-secondary, rgba(148,163,184,0.06))',
                            }}
                          >
                            <td style={{ padding: 8, maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.name}
                            </td>
                            <td style={{ padding: 8, width: 60 }}>{row.unit}</td>
                            <td style={{ padding: 8, textAlign: 'right', width: 110 }}>
                              ${Number(row.default_unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: 8, textAlign: 'right', width: 110 }}>
                              {row.sub_cost != null ? `$${Number(row.sub_cost).toFixed(2)}` : '—'}
                            </td>
                          </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                  {importPreview.totalParsed > IMPORT_PREVIEW_PAGE_SIZE ? (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 10,
                        fontSize: 12,
                      }}
                    >
                      <div>
                        Page {importPreviewPage + 1} of{' '}
                        {Math.max(1, Math.ceil(importPreview.totalParsed / IMPORT_PREVIEW_PAGE_SIZE))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ paddingInline: 10, fontSize: 12 }}
                          onClick={() => {
                            setImportPreviewPage((p) => {
                              const next = Math.max(0, p - 1)
                              if (next !== p && importTableRef.current) {
                                importTableRef.current.scrollTop = 0
                              }
                              return next
                            })
                          }}
                          disabled={importPreviewPage === 0}
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ paddingInline: 10, fontSize: 12 }}
                          onClick={() =>
                            setImportPreviewPage((p) => {
                              const lastPage = Math.max(
                                0,
                                Math.ceil(importPreview.totalParsed / IMPORT_PREVIEW_PAGE_SIZE) - 1
                              )
                              const next = Math.min(lastPage, p + 1)
                              if (next !== p && importTableRef.current) {
                                importTableRef.current.scrollTop = 0
                              }
                              return next
                            })
                          }
                          disabled={
                            importPreviewPage >=
                            Math.max(0, Math.ceil(importPreview.totalParsed / IMPORT_PREVIEW_PAGE_SIZE) - 1)
                          }
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className="add-product-form-actions" style={{ marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={closeImportModal} disabled={importRunLoading}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void confirmImport()}
                  disabled={importRunLoading || importPreview.wouldInsert === 0}
                >
                  {importRunLoading ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </div>,
          document.body
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
