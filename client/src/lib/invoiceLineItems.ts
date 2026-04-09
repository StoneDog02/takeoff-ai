import type { EstimateLineItem, Invoice } from '@/types/global'

/**
 * Manual / standalone invoices persist line rows on `schedule_snapshot.line_items`
 * (there is no `invoices.line_items` table). Map them to the same shape used by estimates UI.
 */
export function lineItemsFromInvoice(invoice: Invoice | null): EstimateLineItem[] {
  if (!invoice) return []
  const snap = invoice.schedule_snapshot
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return []
  const raw = (snap as Record<string, unknown>).line_items
  if (!Array.isArray(raw)) return []
  const invoiceId = invoice.id
  const out: EstimateLineItem[] = []
  let i = 0
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const description = String(r.description ?? '').trim()
    if (!description) continue
    const quantity = Number(r.quantity)
    const unit_price = Number(r.unit_price)
    const totalRaw = r.total
    const total =
      totalRaw != null && totalRaw !== ''
        ? Number(totalRaw)
        : Number.isFinite(quantity) && Number.isFinite(unit_price)
          ? quantity * unit_price
          : 0
    const id = String(r.id ?? '').trim() || `invoice-line-${invoiceId}-${i}`
    i += 1
    out.push({
      id,
      estimate_id: invoiceId,
      product_id: null,
      description,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unit: String(r.unit ?? 'ea'),
      unit_price: Number.isFinite(unit_price) ? unit_price : 0,
      total: Number.isFinite(total) ? total : 0,
      section: r.section != null && String(r.section).trim() ? String(r.section).trim() : null,
    })
  }
  return out
}

/** Rows from `schedule_snapshot.client_attachments` (uploads, bid quotes, bid docs). */
export function attachmentSummariesFromInvoice(invoice: Invoice | null): { id: string; label: string }[] {
  if (!invoice) return []
  const snap = invoice.schedule_snapshot
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return []
  const raw = (snap as Record<string, unknown>).client_attachments
  if (!Array.isArray(raw)) return []
  const out: { id: string; label: string }[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = String(r.id ?? '').trim()
    if (!id) continue
    out.push({
      id,
      label: String(r.label || 'Attachment').trim() || 'Attachment',
    })
  }
  return out
}
