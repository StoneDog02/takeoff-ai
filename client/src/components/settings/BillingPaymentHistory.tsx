import { useCallback, useEffect, useState } from 'react'
import { stripeBillingApi, type SubscriptionInvoiceRow } from '@/api/stripeBilling'

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function formatInvoiceDate(createdUnix: number): string {
  try {
    return new Date(createdUnix * 1000).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function formatStatus(status: string | null): string {
  const s = (status || '').replace(/_/g, ' ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
}

type BillingPaymentHistoryProps = {
  refreshKey?: number
}

export function BillingPaymentHistory({ refreshKey = 0 }: BillingPaymentHistoryProps) {
  const [rows, setRows] = useState<SubscriptionInvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    stripeBillingApi
      .getSubscriptionInvoices()
      .then((r) => setRows(r.invoices || []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  if (loading) {
    return <p className="m-0 text-[13px] text-[#9ca3af]">Loading payment history…</p>
  }
  if (error) {
    return <p className="m-0 text-[13px] text-red-600">{error}</p>
  }
  if (rows.length === 0) {
    return (
      <p className="m-0 text-[13px] text-[#9ca3af]">
        No subscription invoices yet. After your first charge, receipts will appear here.
      </p>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[320px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#e8e6e1] text-[11px] font-bold uppercase tracking-wide text-[#9ca3af] dark:border-[var(--border)]">
            <th className="py-2 pr-3 font-semibold">Date</th>
            <th className="py-2 pr-3 font-semibold">Invoice</th>
            <th className="py-2 pr-3 font-semibold">Amount</th>
            <th className="py-2 pr-3 font-semibold">Status</th>
            <th className="py-2 font-semibold">Receipt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => (
            <tr
              key={inv.id}
              className="border-b border-[#f1f0ed] last:border-0 dark:border-[var(--border)]"
            >
              <td className="py-2.5 pr-3 text-[#111] dark:text-[var(--text-primary)]">
                {formatInvoiceDate(inv.created)}
              </td>
              <td className="py-2.5 pr-3 text-[#374151] dark:text-[var(--text-muted)]">
                {inv.number || inv.id.slice(0, 12)}
              </td>
              <td className="py-2.5 pr-3 font-medium text-[#111] dark:text-[var(--text-primary)]">
                {formatMoney(inv.amount_paid, inv.currency)}
              </td>
              <td className="py-2.5 pr-3 text-[#374151] dark:text-[var(--text-muted)]">
                {formatStatus(inv.status)}
              </td>
              <td className="py-2.5">
                {inv.hosted_invoice_url ? (
                  <a
                    href={inv.hosted_invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#b91c1c] underline-offset-2 hover:underline"
                  >
                    View
                  </a>
                ) : inv.invoice_pdf ? (
                  <a
                    href={inv.invoice_pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#b91c1c] underline-offset-2 hover:underline"
                  >
                    PDF
                  </a>
                ) : (
                  <span className="text-[#9ca3af]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
