import React from 'react'
import { dayjs } from '@/lib/date'

export function formatPortalCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatPortalDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = dayjs(iso)
  return d.isValid() ? d.format('MMM D, YYYY') : '—'
}

export type ClientFacingLineItem = {
  id: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  section?: string | null
}

function roundMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100
}

function sectionKeySlug(section: string | null): string {
  if (section == null) return 'none'
  return encodeURIComponent(section).slice(0, 80)
}

/**
 * Homeowner-friendly view: one lump-sum row per takeoff / GC-work category instead of
 * every quantity-takeoff line. Preserves line totals so subtotal / general fees stay correct.
 */
function summarizeLineItemsForClientView(
  items: ClientFacingLineItem[],
  section: string | null,
  sectionWorkTypes: Record<string, string> | null
): ClientFacingLineItem[] {
  if (items.length === 0) return []

  if (section == null) {
    if (items.length === 1) return items
    const sum = roundMoney(items.reduce((s, i) => s + Number(i.total), 0))
    return [
      {
        id: `client-scope-summary-null-${items.length}`,
        description: 'Additional scope',
        quantity: 1,
        unit: 'ls',
        unit_price: sum,
        total: sum,
        section: null,
      },
    ]
  }

  const kind = inferSectionWorkKind(section, sectionWorkTypes)
  if (kind === 'subcontractor') {
    if (items.length === 1) return items
    const sum = roundMoney(items.reduce((s, i) => s + Number(i.total), 0))
    return [
      {
        id: `client-scope-summary-bid-${sectionKeySlug(section)}`,
        description: section,
        quantity: 1,
        unit: 'job',
        unit_price: sum,
        total: sum,
        section,
      },
    ]
  }

  const sum = roundMoney(items.reduce((s, i) => s + Number(i.total), 0))
  const pres = sectionHeaderPresentation(section, kind, 'summary')
  return [
    {
      id: `client-scope-summary-${sectionKeySlug(section)}`,
      description: pres.title,
      quantity: 1,
      unit: 'ls',
      unit_price: sum,
      total: sum,
      section,
    },
  ]
}

function applyClientScopeSummary(
  lineItems: ClientFacingLineItem[],
  sectionWorkTypes: Record<string, string> | null
): ClientFacingLineItem[] {
  const groups = groupBySection(lineItems)
  const out: ClientFacingLineItem[] = []
  for (const { section, items } of groups) {
    out.push(...summarizeLineItemsForClientView(items, section, sectionWorkTypes))
  }
  return out
}

function groupBySection(
  items: ClientFacingLineItem[]
): { section: string | null; items: ClientFacingLineItem[] }[] {
  const bySection = new Map<string | null, ClientFacingLineItem[]>()
  for (const item of items) {
    const section = (item.section && item.section.trim()) || null
    if (!bySection.has(section)) bySection.set(section, [])
    bySection.get(section)!.push(item)
  }
  const order = Array.from(bySection.keys()).sort((a, b) => {
    if (a == null) return 1
    if (b == null) return -1
    return a.localeCompare(b)
  })
  return order.map((section) => ({ section, items: bySection.get(section)! }))
}

export type ClientSectionNote = {
  section: string
  gc_note?: string | null
  sub_notes?: { subcontractor: string; text: string }[]
}

export type EstimateClientFacingDocumentProps = {
  companyDisplayName: string
  estimateNumber?: string | null
  dateIssued: string | null
  expiryDate?: string | null
  clientName: string
  clientAddress?: string
  projectName: string
  projectAddress?: string
  lineItems: ClientFacingLineItem[]
  total: number
  milestones?: { label: string; amount: number; percentage?: number }[] | null
  notes?: string | null
  terms?: string | null
  /** Per-scope notes (GC + subcontractor) keyed by section header text. */
  sectionNotes?: ClientSectionNote[] | null
  /** From estimate_groups_meta: section key → subcontractor | gc_self_perform | scope_detail */
  sectionWorkTypes?: Record<string, string> | null
  /** When set from portal API for change orders sent from the CO flow */
  portalDocumentKind?: 'estimate' | 'change_order'
  /**
   * `summary` (default): one lump-sum row per takeoff/GC category for homeowners.
   * `full`: show every stored line (internal / power-user).
   */
  clientScopeLineDetail?: 'summary' | 'full'
}

export type SectionWorkKind = 'subcontractor' | 'gc_self_perform' | 'scope_detail'

function inferSectionWorkKind(
  section: string,
  map?: Record<string, string> | null
): SectionWorkKind {
  const v = map?.[section]
  if (v === 'subcontractor' || v === 'gc_self_perform' || v === 'scope_detail') return v
  if (/\(your\s*work\)\s*$/i.test(section)) return 'gc_self_perform'
  if (/\s[—–]\s/.test(section)) return 'subcontractor'
  return 'scope_detail'
}

function sectionHeaderPresentation(
  section: string,
  kind: SectionWorkKind,
  presentation: 'summary' | 'detail' = 'summary'
) {
  const title =
    kind === 'gc_self_perform'
      ? section.replace(/\s*\(your\s*work\)\s*$/i, '').trim()
      : section
  const copy: Record<SectionWorkKind, { badge: string; hint: string }> = {
    subcontractor: {
      badge: 'Subcontractor work',
      hint: 'This scope is priced and performed by an independent subcontractor — not by your general contractor.',
    },
    gc_self_perform:
      presentation === 'summary'
        ? {
            badge: 'GC work (summary)',
            hint: 'Total for work your general contractor performs in-house — not shown line-by-line.',
          }
        : {
            badge: 'General contractor work',
            hint: 'This scope is performed and priced directly by your general contractor.',
          },
    scope_detail:
      presentation === 'summary'
        ? {
            badge: 'Scope summary',
            hint: 'Category total for this part of the job — detailed material and takeoff lines are not listed here.',
          }
        : {
            badge: 'Scope breakdown',
            hint: 'Line-by-line detail from your contractor’s quantity takeoff or internal estimate.',
          },
  }
  return { title, ...copy[kind], kind }
}

/**
 * Client-facing estimate document — same structure as the public estimate portal
 * (.estimate-doc--elevated: hero, meta, table, total bar, milestones, notes/terms).
 */
export function EstimateClientFacingDocument({
  companyDisplayName,
  estimateNumber,
  dateIssued,
  expiryDate,
  clientName,
  clientAddress,
  projectName,
  projectAddress,
  lineItems,
  total,
  milestones,
  notes,
  terms,
  sectionNotes = null,
  sectionWorkTypes = null,
  portalDocumentKind = 'estimate',
  clientScopeLineDetail = 'summary',
}: EstimateClientFacingDocumentProps) {
  const displayLineItems =
    clientScopeLineDetail === 'full' ? lineItems : applyClientScopeSummary(lineItems, sectionWorkTypes)
  const subtotal =
    Math.round(displayLineItems.reduce((sum, i) => sum + Number(i.total), 0) * 100) / 100
  const totalRounded = Math.round(Number(total) * 100) / 100
  let generalFees = Math.round((totalRounded - subtotal) * 100) / 100
  if (generalFees < 0.005) generalFees = 0
  const grouped = groupBySection(displayLineItems)
  const presentationMode: 'summary' | 'detail' = clientScopeLineDetail === 'full' ? 'detail' : 'summary'
  const hasMilestones = milestones && milestones.length > 0

  const notesBySection = new Map<string, ClientSectionNote>()
  for (const sn of sectionNotes || []) {
    if (!sn?.section?.trim()) continue
    const key = sn.section.trim()
    const prev = notesBySection.get(key)
    if (!prev) {
      notesBySection.set(key, { ...sn, section: key })
    } else {
      const gc = [prev.gc_note, sn.gc_note].filter(Boolean).join('\n\n') || null
      const subs = [...(prev.sub_notes || []), ...(sn.sub_notes || [])]
      notesBySection.set(key, { section: key, gc_note: gc, sub_notes: subs })
    }
  }

  function sectionNoteBlock(section: string) {
    const sn = notesBySection.get(section.trim())
    if (!sn) return null
    const hasGc = Boolean(sn.gc_note?.trim())
    const subs = (sn.sub_notes || []).filter((x) => x.text?.trim())
    if (!hasGc && subs.length === 0) return null
    return (
      <tr className="estimate-doc__section-notes-row">
        <td colSpan={5} className="estimate-doc__section-notes-cell">
          <details className="estimate-doc__section-notes-details">
            <summary className="estimate-doc__section-notes-summary">View scope notes</summary>
            <div className="estimate-doc__section-notes-body">
              {hasGc ? (
                <div className="estimate-doc__section-note-block">
                  <div className="estimate-doc__section-note-label">From your contractor</div>
                  <div className="estimate-doc__section-note-text">{sn.gc_note}</div>
                </div>
              ) : null}
              {subs.map((n, idx) => (
                <div key={idx} className="estimate-doc__section-note-block">
                  <div className="estimate-doc__section-note-label">
                    From subcontractor ({n.subcontractor || 'Sub'})
                  </div>
                  <div className="estimate-doc__section-note-text">{n.text}</div>
                </div>
              ))}
            </div>
          </details>
        </td>
      </tr>
    )
  }

  const isChangeOrder = portalDocumentKind === 'change_order'
  const heroHeadline = isChangeOrder ? 'New Change Order' : companyDisplayName

  return (
    <div className="estimate-portal-doc estimate-doc--elevated">
      <div className="estimate-doc__hero">
        <div className="estimate-doc__hero-left">
          <h1 className="estimate-doc__company-name estimate-portal-doc__company-name">
            {heroHeadline}
          </h1>
        </div>
        <div className="estimate-doc__hero-right">
          <span className="estimate-doc__status-badge">{isChangeOrder ? 'CHANGE ORDER' : 'ESTIMATE'}</span>
          {estimateNumber ? <span className="estimate-doc__doc-title">{estimateNumber}</span> : null}
          <span className="estimate-doc__hero-contact">
            Date issued: {formatPortalDate(dateIssued)}
            {expiryDate ? (
              <>
                <span className="estimate-doc__hero-sep"> · </span>
                Expires: {formatPortalDate(expiryDate)}
              </>
            ) : null}
          </span>
        </div>
      </div>
      <div className="estimate-doc__meta">
        <div className="estimate-doc__meta-item">
          <span className="estimate-doc__meta-label">Client</span>
          <span className="estimate-doc__meta-value">{clientName || '—'}</span>
          {clientAddress ? (
            <span className="estimate-doc__terms-text" style={{ marginTop: 4 }}>
              {clientAddress}
            </span>
          ) : null}
        </div>
        <div className="estimate-doc__meta-item">
          <span className="estimate-doc__meta-label">Project</span>
          <span className="estimate-doc__meta-value">{projectName || '—'}</span>
          {projectAddress ? (
            <span className="estimate-doc__terms-text" style={{ marginTop: 4 }}>
              {projectAddress}
            </span>
          ) : null}
        </div>
      </div>
      <div className="estimate-doc__table-wrap">
        <table className="estimate-doc__table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="estimate-doc__th-qty">Qty</th>
              <th className="estimate-doc__th-unit">Unit</th>
              <th className="estimate-doc__th-rate">Unit price</th>
              <th className="estimate-doc__th-amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ section, items }) => (
              <React.Fragment key={section ?? '__none'}>
                {section != null && (() => {
                  const kind = inferSectionWorkKind(section, sectionWorkTypes)
                  const pres = sectionHeaderPresentation(section, kind, presentationMode)
                  return (
                    <tr className={`estimate-doc__section-row estimate-doc__section-row--${kind}`}>
                      <td colSpan={5} className="estimate-doc__section-header">
                        <div className="estimate-doc__section-header-inner">
                          <span className="estimate-doc__section-kind-badge">{pres.badge}</span>
                          <p className="estimate-doc__section-kind-hint">{pres.hint}</p>
                          <div className="estimate-doc__section-header-title">{pres.title}</div>
                        </div>
                      </td>
                    </tr>
                  )
                })()}
                {section != null && sectionNoteBlock(section)}
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description || '—'}</td>
                    <td className="estimate-doc__td-qty estimate-doc__num">{item.quantity}</td>
                    <td className="estimate-doc__td-unit">{item.unit}</td>
                    <td className="estimate-doc__td-rate estimate-doc__num">
                      {item.unit === 'pct'
                        ? `${Math.min(100, Math.max(0, Number(item.unit_price) || 0))}%`
                        : formatPortalCurrency(item.unit_price)}
                    </td>
                    <td className="estimate-doc__amount estimate-doc__num">
                      {formatPortalCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="estimate-doc__summary">
        <div className="estimate-doc__summary-row">
          <span className="estimate-doc__summary-label">
            {generalFees > 0 ? 'Scope subtotal' : 'Subtotal'}
          </span>
          <span className="estimate-doc__summary-value estimate-doc__num">
            {formatPortalCurrency(subtotal)}
          </span>
        </div>
        {generalFees > 0 ? (
          <div className="estimate-doc__summary-row estimate-doc__summary-row--fees">
            <span className="estimate-doc__summary-label">General fees</span>
            <span className="estimate-doc__summary-value estimate-doc__num">
              {formatPortalCurrency(generalFees)}
            </span>
          </div>
        ) : null}
      </div>
      <div className="estimate-doc__total-bar-wrap">
        <div className="estimate-doc__total-bar">
          <span className="estimate-doc__total-bar-label">Total</span>
          <span className="estimate-doc__total-bar-value estimate-doc__num">
            {formatPortalCurrency(total)}
          </span>
        </div>
      </div>
      {hasMilestones && milestones && (
        <div className="estimate-portal-milestones">
          <h3 className="estimate-portal-milestones__title">Payment Schedule</h3>
          <ul className="estimate-portal-milestones__list">
            {milestones.map((m, i) => (
              <li key={i} className="estimate-portal-milestones__item">
                <span className="estimate-portal-milestones__label">{m.label}</span>
                {m.percentage != null && (
                  <span className="estimate-portal-milestones__pct">{m.percentage}%</span>
                )}
                <span className="estimate-portal-milestones__amount">
                  {formatPortalCurrency(m.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(notes || terms) && (
        <div className="estimate-doc__terms">
          {notes ? (
            <>
              <div className="estimate-doc__terms-title">Notes</div>
              <div className="estimate-doc__terms-text">{notes}</div>
            </>
          ) : null}
          {terms ? (
            <>
              <div
                className="estimate-doc__terms-title"
                style={{ marginTop: notes ? 16 : 0 }}
              >
                Terms
              </div>
              <div className="estimate-doc__terms-text">{terms}</div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

const ACTION_DISABLED_TITLE = 'These activate when sent to client.'

export function EstimatePortalStyleActionBar({ previewMode }: { previewMode?: boolean }) {
  const wrap = (node: React.ReactNode) =>
    previewMode ? (
      <span className="estimate-portal-action-btn-wrap" title={ACTION_DISABLED_TITLE}>
        {node}
      </span>
    ) : (
      node
    )
  return (
    <div className="estimate-portal-action-bar">
      <div className="estimate-portal-action-bar__inner">
        <div className="estimate-portal-action-bar__actions">
          {wrap(
            <button
              type="button"
              className="estimate-portal-btn estimate-portal-btn--primary estimate-portal-action-bar__approve"
              disabled={previewMode}
            >
              Approve Estimate
            </button>
          )}
          {wrap(
            <button
              type="button"
              className="estimate-portal-btn estimate-portal-btn--ghost"
              disabled={previewMode}
            >
              Request Changes
            </button>
          )}
          {wrap(
            <button
              type="button"
              className="estimate-portal-action-bar__decline"
              disabled={previewMode}
            >
              Decline
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
