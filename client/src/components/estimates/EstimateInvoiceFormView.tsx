import React, { useMemo } from 'react'
import type { EstimateLineItem } from '@/types/global'
import type { CompanyProfile } from '@/types/global'
import { formatDate } from '@/lib/date'

function groupBySection(items: EstimateLineItem[]): { section: string; items: EstimateLineItem[] }[] {
  const map = new Map<string, EstimateLineItem[]>()
  const emptyKey = '\x00' // sort ungrouped last
  for (const li of items) {
    const key = (li.section && li.section.trim()) ? li.section.trim() : emptyKey
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(li)
  }
  const result: { section: string; items: EstimateLineItem[] }[] = []
  const keys = Array.from(map.keys()).sort((a, b) => (a === emptyKey ? 1 : b === emptyKey ? -1 : a.localeCompare(b)))
  for (const key of keys) {
    result.push({
      section: key === emptyKey ? '' : key,
      items: map.get(key)!,
    })
  }
  return result
}

/** Derive 2-letter initials from email (e.g. s.nguyen@email.com → SN) */
function getRecipientInitials(email: string): string {
  const local = email.split('@')[0] || ''
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  }
  return (local.slice(0, 2) || '?').toUpperCase()
}

const DEFAULT_TERMS =
  'Thank you for your business. Payment due within 30 days of acceptance. Work to begin within 5 business days of signed approval.'

export interface EstimateInvoiceFormViewProps {
  type: 'estimate' | 'invoice'
  documentId: string
  jobName: string
  date: string
  status: string
  recipientEmails: string[]
  lineItems: EstimateLineItem[]
  total: number
  dueDate?: string
  /** When true, use compact styling for embedding in modals */
  embedded?: boolean
  /** Elevated document layout: dark company hero, prepared for, total bar, notes & terms */
  variant?: 'default' | 'elevated'
  /** Company info for elevated variant (name, phone, email, license) */
  company?: CompanyProfile | null
  /** Optional custom terms; used in elevated variant */
  terms?: string
}

export function EstimateInvoiceFormView({
  type,
  documentId,
  jobName,
  date,
  status,
  recipientEmails,
  lineItems,
  total,
  dueDate,
  embedded,
  variant = 'default',
  company,
  terms = DEFAULT_TERMS,
}: EstimateInvoiceFormViewProps) {
  const docTitle = type === 'estimate' ? 'Estimate' : 'Invoice'
  const totalLabel = type === 'estimate' ? 'ESTIMATE TOTAL' : 'INVOICE TOTAL'
  const grouped = useMemo(() => groupBySection(lineItems), [lineItems])
  const subtotal = total
  const taxPct = 0
  const taxAmount = 0
  const displayTotal = subtotal + taxAmount
  const firstEmail = recipientEmails[0] ?? ''
  const recipientInitials = firstEmail ? getRecipientInitials(firstEmail) : '—'
  const recipientDisplayName = firstEmail ? firstEmail.replace(/@.*/, '').replace(/[._]/g, ' ') : 'Client'

  const isElevated = variant === 'elevated'

  if (isElevated) {
    return (
      <div className="estimate-doc estimate-doc--elevated">
        {/* Dark hero: company (left) + doc title + status badge (right) */}
        <header className="estimate-doc__hero">
          <div className="estimate-doc__hero-left">
            {company?.logoUrl ? (
              <img src={company.logoUrl} alt="" className="portal-company-logo" />
            ) : null}
            <h1 className="estimate-doc__company-name">
              {company?.name ?? 'Your Company'}
            </h1>
            <div className="estimate-doc__hero-contact">
              {company?.phone && <span>{company.phone}</span>}
              {company?.phone && company?.email && <span className="estimate-doc__hero-sep">·</span>}
              {company?.email && <span>{company.email}</span>}
              {company?.licenseNumber && (
                <>
                  {(company?.phone || company?.email) && <span className="estimate-doc__hero-sep">·</span>}
                  <span>LIC #{company.licenseNumber}</span>
                </>
              )}
            </div>
          </div>
          <div className="estimate-doc__hero-right">
            <span className="estimate-doc__doc-title">{docTitle}</span>
            <span className="estimate-doc__status-badge">{status.toUpperCase()}</span>
          </div>
        </header>

        {/* Key details: ESTIMATE #, DATE, JOB */}
        <div className="estimate-doc__meta">
          <div className="estimate-doc__meta-item">
            <span className="estimate-doc__meta-label">{type === 'estimate' ? 'ESTIMATE #' : 'INVOICE #'}</span>
            <span className="estimate-doc__meta-value">{documentId.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="estimate-doc__meta-item">
            <span className="estimate-doc__meta-label">DATE</span>
            <span className="estimate-doc__meta-value">{formatDate(date)}</span>
          </div>
          <div className="estimate-doc__meta-item">
            <span className="estimate-doc__meta-label">JOB</span>
            <span className="estimate-doc__meta-value">{jobName}</span>
          </div>
          {type === 'invoice' && dueDate && (
            <div className="estimate-doc__meta-item">
              <span className="estimate-doc__meta-label">DUE DATE</span>
              <span className="estimate-doc__meta-value">{formatDate(dueDate)}</span>
            </div>
          )}
        </div>

        {/* Prepared For */}
        {(recipientEmails.length > 0 || firstEmail) && (
          <div className="estimate-doc__prepared">
            <span className="estimate-doc__prepared-label">PREPARED FOR</span>
            <div className="estimate-doc__prepared-row">
              <span className="estimate-doc__initials-badge">{recipientInitials}</span>
              <div>
                <div className="estimate-doc__prepared-name">{recipientDisplayName}</div>
                {firstEmail && <div className="estimate-doc__prepared-email">{firstEmail}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Line items table */}
        <div className="estimate-doc__table-wrap">
          <table className="estimate-doc__table">
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th className="estimate-doc__th-qty">QTY</th>
                <th className="estimate-doc__th-unit">UNIT</th>
                <th className="estimate-doc__th-rate">RATE</th>
                <th className="estimate-doc__th-amount">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ section, items }) => (
                <React.Fragment key={section || 'ungrouped'}>
                  {section && (
                    <tr className="estimate-doc__section-row">
                      <td colSpan={5} className="estimate-doc__section-header">
                        {section}
                      </td>
                    </tr>
                  )}
                  {items.map((li) => (
                    <tr key={li.id}>
                      <td>{li.description}</td>
                      <td className="estimate-doc__num estimate-doc__td-qty">{li.quantity}</td>
                      <td className="estimate-doc__td-unit">{li.unit}</td>
                      <td className="estimate-doc__num estimate-doc__td-rate">
                        {li.unit === 'pct'
                          ? `${Math.min(100, Math.max(0, Number(li.unit_price) || 0))}%`
                          : `$${Number(li.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="estimate-doc__num estimate-doc__amount">
                        ${Number(li.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary: Subtotal, Tax */}
        <div className="estimate-doc__summary">
          <div className="estimate-doc__summary-row">
            <span className="estimate-doc__summary-label">Subtotal</span>
            <span className="estimate-doc__summary-value">
              ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="estimate-doc__summary-row">
            <span className="estimate-doc__summary-label">Tax ({taxPct}%)</span>
            <span className="estimate-doc__summary-value">
              ${taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        {/* Total bar: full-width container (no side padding) */}
        <div className="estimate-doc__total-bar-wrap">
          <div className="estimate-doc__total-bar">
            <span className="estimate-doc__total-bar-label">{totalLabel}</span>
            <span className="estimate-doc__total-bar-value">
              ${displayTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Notes & Terms */}
        <footer className="estimate-doc__terms">
          <h3 className="estimate-doc__terms-title">NOTES & TERMS</h3>
          <p className="estimate-doc__terms-text">{terms}</p>
        </footer>
      </div>
    )
  }

  // Default (original) layout
  const containerClass = embedded ? 'estimate-invoice-form estimate-invoice-form--embedded' : 'estimate-invoice-form'
  return (
    <div className={containerClass}>
      <header className="estimate-invoice-form__header">
        <div className="estimate-invoice-form__title-row">
          <h2 className="estimate-invoice-form__doc-title">{docTitle}</h2>
          <span className="estimate-invoice-form__doc-id">{documentId.slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="estimate-invoice-form__meta">
          <div className="estimate-invoice-form__meta-row">
            <span className="estimate-invoice-form__meta-label">Date</span>
            <span className="estimate-invoice-form__meta-value">{formatDate(date)}</span>
          </div>
          <div className="estimate-invoice-form__meta-row">
            <span className="estimate-invoice-form__meta-label">Job</span>
            <span className="estimate-invoice-form__meta-value">{jobName}</span>
          </div>
          {recipientEmails.length > 0 && (
            <div className="estimate-invoice-form__meta-row">
              <span className="estimate-invoice-form__meta-label">To</span>
              <span className="estimate-invoice-form__meta-value">{recipientEmails.join(', ')}</span>
            </div>
          )}
          {type === 'invoice' && dueDate && (
            <div className="estimate-invoice-form__meta-row">
              <span className="estimate-invoice-form__meta-label">Due date</span>
              <span className="estimate-invoice-form__meta-value">{formatDate(dueDate)}</span>
            </div>
          )}
          <div className="estimate-invoice-form__meta-row">
            <span className="estimate-invoice-form__meta-label">Status</span>
            <span className="estimate-invoice-form__status-pill">{status}</span>
          </div>
        </div>
      </header>
      <div className="estimate-invoice-form__table-wrap">
        <table className="estimate-invoice-form__table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ section, items }) => (
              <React.Fragment key={section || 'ungrouped'}>
                {section && (
                  <tr className="estimate-invoice-form__section-row">
                    <td colSpan={5} className="estimate-invoice-form__section-header">
                      {section}
                    </td>
                  </tr>
                )}
                {items.map((li) => (
                  <tr key={li.id}>
                    <td>{li.description}</td>
                    <td className="estimate-invoice-form__num">{li.quantity}</td>
                    <td>{li.unit}</td>
                    <td className="estimate-invoice-form__num">
                      {li.unit === 'pct'
                        ? `${Math.min(100, Math.max(0, Number(li.unit_price) || 0))}%`
                        : `$${Number(li.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="estimate-invoice-form__num estimate-invoice-form__amount">
                      ${Number(li.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="estimate-invoice-form__totals">
        <div className="estimate-invoice-form__total-row">
          <span className="estimate-invoice-form__total-label">Total</span>
          <span className="estimate-invoice-form__total-value">
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      <footer className="estimate-invoice-form__footer">
        <p className="estimate-invoice-form__thanks">Thank you for your business.</p>
      </footer>
    </div>
  )
}
