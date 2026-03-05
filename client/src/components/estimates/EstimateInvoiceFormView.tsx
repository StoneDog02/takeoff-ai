import React, { useMemo } from 'react'
import type { EstimateLineItem } from '@/types/global'
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
}: EstimateInvoiceFormViewProps) {
  const docTitle = type === 'estimate' ? 'Estimate' : 'Invoice'
  const containerClass = embedded ? 'estimate-invoice-form estimate-invoice-form--embedded' : 'estimate-invoice-form'
  const grouped = useMemo(() => groupBySection(lineItems), [lineItems])

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
                      ${Number(li.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
