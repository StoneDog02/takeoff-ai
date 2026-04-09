/**
 * Coerce DB/client `schedule_snapshot` to a plain object (handles JSON string, null).
 */
function normalizeInvoiceScheduleSnapshot(raw) {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
    } catch {
      return {}
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw
  return {}
}

/**
 * Manual (non-estimate) invoices store line items and client-facing copy in schedule_snapshot.
 */
function parseManualInvoiceSnapshot(scheduleSnapshot) {
  const snap = normalizeInvoiceScheduleSnapshot(scheduleSnapshot)
  const items = Array.isArray(snap.line_items)
    ? snap.line_items
    : Array.isArray(snap.lineItems)
      ? snap.lineItems
      : []
  const hasManualFlag = !!snap.manual_invoice
  if (!hasManualFlag && items.length === 0) return null
  return {
    line_items: items.map((li, i) => {
      const qty = Number(li.quantity) || 0
      const unitPrice = Number(li.unit_price) || 0
      const totalRaw = li.total != null ? Number(li.total) : qty * unitPrice
      return {
        id: String(li.id || `manual-${i}`),
        description: String(li.description ?? ''),
        quantity: qty,
        unit: li.unit || 'ea',
        unit_price: unitPrice,
        total: Number.isFinite(totalRaw) ? totalRaw : 0,
        section: li.section != null ? li.section : null,
      }
    }),
    client_name:
      snap.client_name != null && String(snap.client_name).trim()
        ? String(snap.client_name).trim()
        : null,
    notes: snap.notes != null && String(snap.notes).trim() ? String(snap.notes).trim() : null,
    terms: snap.terms != null && String(snap.terms).trim() ? String(snap.terms).trim() : null,
  }
}

module.exports = { parseManualInvoiceSnapshot, normalizeInvoiceScheduleSnapshot }
