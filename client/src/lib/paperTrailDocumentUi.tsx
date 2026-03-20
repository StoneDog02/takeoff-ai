import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PaperDocumentType, PaperTrailDocument } from '@/types/global'
import { formatDate } from '@/lib/date'
import { extractProgressMilestonesOnly } from '@/lib/progressMilestones'

export function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function documentTypeLabel(t: PaperDocumentType): string {
  const map: Record<PaperDocumentType, string> = {
    estimate: 'Estimate',
    invoice: 'Invoice',
    change_order: 'Change Order',
    bid_package: 'Bid Package',
    receipt: 'Receipt',
    sub_contract: 'Sub Contract',
  }
  return map[t] || t
}

export function recipientLabel(doc: PaperTrailDocument): string {
  const n = (doc.client_name || '').trim()
  if (n) return n
  const e = (doc.client_email || '').trim()
  if (e) return e
  const meta = doc.metadata || {}
  if (typeof meta.subcontractor_name === 'string' && meta.subcontractor_name.trim()) {
    return meta.subcontractor_name.trim()
  }
  return '—'
}

export function sentLabel(doc: PaperTrailDocument): string {
  if (doc.sent_at) return formatDate(doc.sent_at)
  return doc.created_at ? formatDate(doc.created_at) : '—'
}

export function displayDate(doc: PaperTrailDocument): string {
  return sentLabel(doc)
}

export function portalPath(doc: PaperTrailDocument): string | null {
  const t = doc.token?.trim()
  if (!t) return null
  const enc = encodeURIComponent(t)
  switch (doc.document_type) {
    case 'estimate':
      return `/estimate/${enc}`
    case 'invoice':
      return `/invoice/${enc}`
    case 'bid_package':
      return `/bid/${enc}`
    default:
      return null
  }
}

export function openDocumentPortalView(doc: PaperTrailDocument): void {
  const path = portalPath(doc)
  if (path) {
    window.open(`${window.location.origin}${path}`, '_blank', 'noopener,noreferrer')
  }
}

/** Human-readable status for paper-trail list (matches server estimate/bid status strings). */
export function statusDisplayLabel(status: string | null | undefined): string {
  const s = (status || '').toLowerCase()
  if (!s) return '—'
  if (s === 'declined') return 'Denied'
  if (s === 'changes_requested') return 'Requested Edit'
  return status || '—'
}

export function statusBadgeClass(status: string | null | undefined): string {
  const s = (status || '').toLowerCase()
  if (s === 'paid' || s === 'accepted' || s === 'awarded') return 'documents-status documents-status--success'
  if (s === 'sent' || s === 'dispatched' || s === 'scanned' || s === 'added' || s === 'recorded') {
    return 'documents-status documents-status--info'
  }
  if (s === 'viewed') return 'documents-status documents-status--info'
  if (s === 'bid_received') return 'documents-status documents-status--info'
  if (s === 'overdue' || s === 'declined') return 'documents-status documents-status--danger'
  if (s === 'changes_requested') return 'documents-status documents-status--warning'
  return 'documents-status documents-status--neutral'
}

const DOC_TYPE_ICON_MOD: Record<PaperDocumentType, string> = {
  estimate: 'estimate',
  invoice: 'invoice',
  change_order: 'change_order',
  bid_package: 'bid_package',
  receipt: 'receipt',
  sub_contract: 'sub_contract',
}

export function DocTypeIcon({ type }: { type: PaperDocumentType }) {
  const cls = 'documents-type-icon-svg'
  const mod = DOC_TYPE_ICON_MOD[type]
  let inner: ReactNode
  switch (type) {
    case 'estimate':
      inner = (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )
      break
    case 'invoice':
      inner = (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 7h4M7 12h10M7 17h6" />
        </svg>
      )
      break
    case 'change_order':
      inner = (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      )
      break
    case 'bid_package':
      inner = (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )
      break
    case 'receipt':
      inner = (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h2" />
          <path d="M18 2h2a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-2" />
          <line x1="12" y1="6" x2="12" y2="18" />
        </svg>
      )
      break
    case 'sub_contract':
      inner = (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
      break
    default:
      inner = (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        </svg>
      )
  }
  return <span className={`documents-type-icon documents-type-icon--${mod}`}>{inner}</span>
}

/** Single-line display for unknown metadata values (never raw JSON dumps). */
function formatMetaScalar(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') {
    const t = v.trim()
    return t || '—'
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (v instanceof Date) return v.toISOString()
  return '—'
}

function formatMetaBlock(label: string, value: unknown): string[] {
  if (value == null) return []
  if (typeof value === 'string') {
    const t = value.trim()
    if (!t) return []
    return ['', label, ...t.split('\n').filter(Boolean)]
  }
  return []
}

/** Short summary for nested JSON blobs (invoice schedule, estimate groups). */
function linesFromNestedSnapshot(label: string, v: unknown, maxLines = 24): string[] {
  if (v == null) return []
  if (Array.isArray(v) && v.length === 0) return []
  const out: string[] = ['', label]
  if (Array.isArray(v)) {
    const slice = v.slice(0, 20)
    for (let i = 0; i < slice.length; i++) {
      const item = slice[i]
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        const title = String(o.name ?? o.label ?? o.title ?? o.description ?? `Item ${i + 1}`).slice(0, 120)
        out.push(`  • ${title}`)
      } else {
        out.push(`  • ${String(item)}`)
      }
    }
    if (v.length > 20) out.push(`  … +${v.length - 20} more`)
    return out
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>).slice(0, maxLines)
    if (entries.length === 0) return []
    for (const [k, val] of entries) {
      if (val != null && typeof val === 'object') {
        out.push(`  ${k}: (see structure)`)
      } else {
        out.push(`  ${k}: ${formatMetaScalar(val)}`)
      }
    }
    return out
  }
  out.push(`  ${String(v)}`)
  return out
}

/** Maps internal group source keys to PDF/preview copy. */
const GROUP_SOURCE_ENGLISH: Record<string, string> = {
  bid: 'Subcontractor bid',
  takeoff: 'Takeoff',
  custom: 'Custom',
}

function englishGroupSource(src: string): string {
  const k = (src || '').toLowerCase()
  return GROUP_SOURCE_ENGLISH[k] || src.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatEstimateGroupLine(g: Record<string, unknown>): string {
  const name = String(g.categoryName ?? '').trim() || 'Section'
  const src = englishGroupSource(String(g.source ?? 'custom'))
  const total = g.clientTotal != null && g.clientTotal !== '' ? formatMoney(Number(g.clientTotal)) : '—'
  const budget = g.budgetCategory != null ? String(g.budgetCategory).trim() : ''
  const nItems = Array.isArray(g.items) ? g.items.length : 0
  const linesPart = nItems > 0 ? ` · ${nItems} line${nItems === 1 ? '' : 's'}` : ''
  const budgetPart = budget ? ` · ${budget}` : ''
  return `  • ${name} — ${total}${linesPart} · ${src}${budgetPart}`
}

function linesFromEstimateGroupsArray(groups: unknown[]): string[] {
  const out: string[] = []
  const slice = groups.slice(0, 40)
  for (const g of slice) {
    if (!g || typeof g !== 'object') continue
    out.push(formatEstimateGroupLine(g as Record<string, unknown>))
  }
  if (groups.length > 40) out.push(`  … +${groups.length - 40} more sections`)
  return out
}

/**
 * Readable English for `estimate_groups_meta` (arrays, or `{ estimate_groups, progress_milestones }`).
 * Avoids raw keys like `estimate_groups: (see structure)`.
 */
function linesEstimateGroupsMetaSnapshot(meta: unknown): string[] {
  if (meta == null) return []

  const out: string[] = []

  if (Array.isArray(meta)) {
    if (meta.length === 0) return []
    out.push('', 'Estimate sections')
    out.push(...linesFromEstimateGroupsArray(meta))
    return out
  }

  if (typeof meta === 'object' && !Array.isArray(meta)) {
    const root = meta as Record<string, unknown>
    const eg = root.estimate_groups
    if (Array.isArray(eg) && eg.length > 0) {
      out.push('', 'Estimate sections')
      out.push(...linesFromEstimateGroupsArray(eg))
    }

    const milestones = extractProgressMilestonesOnly(meta)
    if (milestones.length > 0) {
      out.push('', 'Progress milestones')
      for (const m of milestones) {
        const inv = m.invoiced ? ' · Invoiced' : ''
        const pct =
          Number.isInteger(m.pct) || Math.abs(m.pct - Math.round(m.pct)) < 1e-6
            ? String(Math.round(m.pct))
            : String(Math.round(m.pct * 10) / 10)
        out.push(`  • ${m.label} — ${formatMoney(m.amount)} (${pct}%)${inv}`)
      }
    }

    return out
  }

  return []
}

/**
 * Human-readable metadata lines (no JSON.stringify of the whole blob).
 * Used by preview overlay and PDF export.
 */
export function metadataDetailLines(doc: PaperTrailDocument): string[] {
  const meta =
    doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
      ? (doc.metadata as Record<string, unknown>)
      : {}
  const lines: string[] = []
  const skipKeys = new Set([
    'snapshot_at',
    'line_items',
    'recipient_emails',
    'source_change_order_id',
    'trade_package_id',
    'subcontractor_id',
  ])

  const pushLabel = (label: string, key: keyof typeof meta | string) => {
    const v = meta[key as string]
    if (v == null || v === '') return
    lines.push(`${label}: ${formatMetaScalar(v)}`)
  }

  switch (doc.document_type) {
    case 'bid_package':
      pushLabel('Trade', 'trade_tag')
      pushLabel('Project (snapshot)', 'project_name')
      pushLabel('Response deadline', 'response_deadline')
      if (typeof meta.notes === 'string' && meta.notes.trim()) {
        lines.push(...formatMetaBlock('Notes', meta.notes))
      }
      if (typeof meta.portal_url === 'string' && meta.portal_url.trim()) {
        lines.push(`Bid portal: ${meta.portal_url.trim()}`)
      }
      break
    case 'invoice':
      pushLabel('Due date', 'due_date')
      if (meta.estimate_id != null) pushLabel('Linked estimate id', 'estimate_id')
      if (meta.schedule_snapshot != null) {
        lines.push(...linesFromNestedSnapshot('Payment schedule (snapshot)', meta.schedule_snapshot))
      }
      break
    case 'receipt':
      pushLabel('Vendor', 'vendor')
      pushLabel('Date', 'date')
      pushLabel('Category', 'category')
      if (typeof meta.description === 'string' && meta.description.trim()) {
        lines.push(...formatMetaBlock('Description', meta.description))
      }
      break
    case 'estimate':
    case 'change_order':
      if (meta.source_change_order_id != null) {
        pushLabel('Change order id', 'source_change_order_id')
      }
      if (typeof meta.client_notes === 'string' && meta.client_notes.trim()) {
        lines.push(...formatMetaBlock('Notes to client', meta.client_notes))
      }
      if (typeof meta.client_terms === 'string' && meta.client_terms.trim()) {
        lines.push(...formatMetaBlock('Terms', meta.client_terms))
      }
      if (meta.estimate_groups_meta != null) {
        const gLines = linesEstimateGroupsMetaSnapshot(meta.estimate_groups_meta)
        if (gLines.length > 0) lines.push(...gLines)
      }
      break
    default:
      break
  }

  const extra: string[] = []
  for (const [k, v] of Object.entries(meta)) {
    if (skipKeys.has(k)) continue
    if (v == null || v === '') continue
    if (
      [
        'trade_tag',
        'project_name',
        'response_deadline',
        'notes',
        'portal_url',
        'due_date',
        'estimate_id',
        'schedule_snapshot',
        'vendor',
        'date',
        'category',
        'description',
        'client_notes',
        'client_terms',
        'estimate_groups_meta',
        'source_change_order_id',
      ].includes(k)
    ) {
      continue
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      extra.push(`${k.replace(/_/g, ' ')}: ${formatMetaScalar(v)}`)
    }
  }
  if (extra.length) {
    lines.push('', 'Additional', ...extra)
  }

  return lines
}

export type LineItemSnapshotRow = {
  section?: string
  description?: string
  quantity?: number | string | null
  unit?: string | null
  unit_price?: number | string | null
  total?: number | string | null
}

export function getLineItemSnapshots(doc: PaperTrailDocument): LineItemSnapshotRow[] {
  const meta = doc.metadata && typeof doc.metadata === 'object' ? (doc.metadata as Record<string, unknown>) : {}
  const raw = meta.line_items
  if (!Array.isArray(raw) || raw.length === 0) return []
  const out: LineItemSnapshotRow[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    out.push({
      section: r.section != null ? String(r.section) : '',
      description: r.description != null ? String(r.description) : '',
      quantity: r.quantity as LineItemSnapshotRow['quantity'],
      unit: r.unit != null ? String(r.unit) : '',
      unit_price: r.unit_price as LineItemSnapshotRow['unit_price'],
      total: r.total as LineItemSnapshotRow['total'],
    })
  }
  return out
}

export function previewBody(doc: PaperTrailDocument): string {
  const lines: string[] = []
  lines.push(`Type: ${documentTypeLabel(doc.document_type)}`)
  lines.push(`Title: ${doc.title || '—'}`)
  lines.push(`Status: ${statusDisplayLabel(doc.status)}`)
  lines.push(`Amount: ${formatMoney(doc.total_amount)}`)
  lines.push(`Recipient: ${recipientLabel(doc)}`)
  lines.push(`Sent: ${sentLabel(doc)}`)
  if (doc.client_email) lines.push(`Email: ${doc.client_email}`)
  const lineItems = getLineItemSnapshots(doc)
  if (lineItems.length > 0) {
    lines.push('')
    lines.push('Line items (snapshot)')
    lineItems.slice(0, 40).forEach((row, idx) => {
      const parts = [
        row.section ? `[${row.section}] ` : '',
        row.description || '—',
        row.total != null && row.total !== '' ? ` — ${row.total}` : '',
      ]
      lines.push(`  ${idx + 1}. ${parts.join('')}`)
    })
    if (lineItems.length > 40) lines.push(`  … +${lineItems.length - 40} more`)
  }
  const detail = metadataDetailLines(doc)
  if (detail.length > 0) {
    lines.push('', 'Details')
    lines.push(...detail)
  }
  return lines.join('\n')
}

function fmtPdfMoney(n: unknown): string {
  if (n == null || n === '') return '—'
  const x = typeof n === 'number' ? n : Number(n)
  if (Number.isNaN(x)) return String(n)
  return `$${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function downloadDocumentPdf(doc: PaperTrailDocument, projectName: string) {
  const url = doc.file_url?.trim()
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' })
  const pageW = pdf.internal.pageSize.getWidth()
  const margin = 16
  const contentW = pageW - margin * 2
  let y = margin

  const ensureSpace = (mm: number) => {
    const pageH = pdf.internal.pageSize.getHeight()
    if (y + mm > pageH - 14) {
      pdf.addPage()
      y = margin
    }
  }

  const addHeading = (text: string, size = 12) => {
    ensureSpace(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(size)
    pdf.text(text, margin, y)
    y += size * 0.55 + 4
    pdf.setFont('helvetica', 'normal')
  }

  const addParagraph = (text: string, size = 9.5) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(size)
    const lines = pdf.splitTextToSize(text, contentW)
    for (const ln of lines) {
      ensureSpace(size * 0.45)
      pdf.text(ln, margin, y)
      y += size * 0.42
    }
    y += 2
  }

  const addKv = (label: string, value: string) => {
    const labelW = 42
    const lineGap = 4.0
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    const vLines = pdf.splitTextToSize(value, contentW - labelW - 4)
    const blockH = Math.max(lineGap, vLines.length * lineGap)
    ensureSpace(blockH + 2)
    pdf.text(label, margin, y)
    pdf.setFont('helvetica', 'normal')
    let lineY = y
    for (const vl of vLines) {
      pdf.text(vl, margin + labelW, lineY)
      lineY += lineGap
    }
    y = lineY + 1
  }

  const title = (doc.title || documentTypeLabel(doc.document_type)).trim() || 'Document'
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.text(title, margin, y)
  y += 10

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(60, 60, 60)
  pdf.text(`${documentTypeLabel(doc.document_type)} · ${statusDisplayLabel(doc.status)}`, margin, y)
  pdf.setTextColor(0, 0, 0)
  y += 8

  addKv('Project', projectName)
  addKv('Amount', formatMoney(doc.total_amount))
  addKv('Recipient', recipientLabel(doc))
  if (doc.client_email?.trim()) addKv('Email', doc.client_email.trim())
  addKv('Sent', sentLabel(doc))
  if (doc.viewed_at) addKv('Viewed', formatDate(doc.viewed_at))
  if (doc.actioned_at) addKv('Actioned', formatDate(doc.actioned_at))
  addKv('Exported', new Date().toLocaleString())

  const items = getLineItemSnapshots(doc)
  if (items.length > 0) {
    y += 4
    addHeading('Line items', 11)
    pdf.setFontSize(8)
    const colNum = margin
    const colDesc = margin + 10
    const descMaxW = 66
    const colQty = margin + 88
    const colUnit = margin + 108
    const colPrice = margin + 128
    const colTotal = margin + 158
    pdf.setFont('helvetica', 'bold')
    ensureSpace(10)
    pdf.text('#', colNum, y)
    pdf.text('Description', colDesc, y)
    pdf.text('Qty', colQty, y)
    pdf.text('Unit', colUnit, y)
    pdf.text('Price', colPrice, y)
    pdf.text('Total', colTotal, y)
    y += 5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    items.forEach((row, idx) => {
      const sec = (row.section || '').trim()
      const head = sec ? `[${sec}] ` : ''
      const desc = `${head}${(row.description || '—').trim()}`
      const descLines = pdf.splitTextToSize(desc, descMaxW)
      const rowH = Math.max(descLines.length * 3.2, 4.5)
      ensureSpace(rowH + 2)
      pdf.text(String(idx + 1), colNum, y)
      pdf.text(descLines, colDesc, y)
      pdf.text(row.quantity != null && row.quantity !== '' ? String(row.quantity) : '—', colQty, y)
      pdf.text((row.unit || '').trim() || '—', colUnit, y)
      pdf.text(fmtPdfMoney(row.unit_price), colPrice, y)
      pdf.text(fmtPdfMoney(row.total), colTotal, y)
      y += rowH + 1
    })
    y += 4
  }

  const details = metadataDetailLines(doc)
  if (details.length > 0) {
    addHeading('Details', 11)
    pdf.setFont('helvetica', 'normal')
    for (const line of details) {
      if (line === '') {
        y += 2
        continue
      }
      addParagraph(line, 9)
    }
  }

  const safe = (doc.title || doc.document_type || 'document').replace(/[^\w\s-]/g, '').slice(0, 40)
  pdf.save(`${safe}-${doc.id.slice(0, 8)}.pdf`)
}

export function DocumentPreviewOverlay({
  doc,
  onClose,
}: {
  doc: PaperTrailDocument | null
  onClose: () => void
}) {
  if (!doc || typeof document === 'undefined') return null
  return createPortal(
    <div
      className="documents-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Document preview"
      onClick={onClose}
    >
      <div className="documents-preview-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="documents-preview-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>{doc.title || doc.document_type}</h3>
        <pre className="documents-preview-pre">{previewBody(doc)}</pre>
      </div>
    </div>,
    document.body
  )
}
