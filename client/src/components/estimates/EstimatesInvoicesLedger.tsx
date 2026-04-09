import { useEffect, useState, useMemo } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Estimate, Invoice, Job } from '@/types/global'
import { formatDate, parseToTimestamp } from '@/lib/date'
import { shouldUseMockEstimates, MOCK_ESTIMATES, MOCK_INVOICES } from '@/data/mockEstimatesData'

type DocType = 'all' | 'estimate' | 'invoice'
type DateRangeKey = '7' | '30' | '90'
type ViewFilter = 'open' | 'all'

type LedgerRow = {
  id: string
  type: 'estimate' | 'invoice'
  jobName: string
  date: string
  recipient: string
  amount: number
  status: string
  estimateId?: string | null
}

interface EstimatesInvoicesLedgerProps {
  jobs: Job[]
  onOpenEstimate?: (id: string) => void
  onOpenInvoice?: (id: string) => void
}

export function EstimatesInvoicesLedger({
  jobs,
  onOpenEstimate,
  onOpenInvoice,
}: EstimatesInvoicesLedgerProps) {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<DocType>('all')
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeKey>('30')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('open')

  const jobMap = useMemo(() => {
    const m: Record<string, string> = {}
    jobs.forEach((j) => {
      m[j.id] = j.name
    })
    return m
  }, [jobs])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    if (shouldUseMockEstimates()) {
      setEstimates(MOCK_ESTIMATES)
      setInvoices(MOCK_INVOICES)
      setLoading(false)
      return
    }
    Promise.all([estimatesApi.getEstimates(), estimatesApi.getInvoices()])
      .then(([est, inv]) => {
        if (!cancelled) {
          setEstimates(est)
          setInvoices(inv)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rows: LedgerRow[] = useMemo(() => {
    const out: LedgerRow[] = []
    estimates.forEach((e) => {
      out.push({
        id: e.id,
        type: 'estimate',
        jobName: jobMap[e.job_id] || e.job_id.slice(0, 8),
        date: e.created_at,
        recipient: (e.recipient_emails && e.recipient_emails[0]) || '—',
        amount: Number(e.total_amount),
        status: e.status,
      })
    })
    invoices.forEach((i) => {
      out.push({
        id: i.id,
        type: 'invoice',
        jobName: i.job_id ? jobMap[i.job_id] || i.job_id.slice(0, 8) : 'No project',
        date: i.created_at,
        recipient: (i.recipient_emails && i.recipient_emails[0]) || '—',
        amount: Number(i.total_amount),
        status: i.status,
        estimateId: i.estimate_id,
      })
    })
    out.sort((a, b) => parseToTimestamp(b.date) - parseToTimestamp(a.date))
    return out
  }, [estimates, invoices, jobMap])

  const moneyBar = useMemo(() => {
    const now = Date.now()
    const daysMs = (d: number) => d * 24 * 60 * 60 * 1000
    const cutoff = now - daysMs(Number(dateRange))
    const invoicedByEstimateId: Record<string, number> = {}
    invoices.forEach((inv) => {
      if (inv.estimate_id) {
        invoicedByEstimateId[inv.estimate_id] =
          (invoicedByEstimateId[inv.estimate_id] || 0) + Number(inv.total_amount)
      }
    })
    let unbilled = 0
    estimates.forEach((e) => {
      if (e.status !== 'sent' && e.status !== 'accepted') return
      const total = Number(e.total_amount)
      const invoiced =
        typeof e.invoiced_amount === 'number'
          ? Number(e.invoiced_amount)
          : invoicedByEstimateId[e.id] || 0
      unbilled += Math.max(0, total - invoiced)
    })
    const openInvoices = invoices
      .filter((i) => i.status === 'sent' || i.status === 'overdue')
      .reduce((sum, i) => sum + Number(i.total_amount), 0)
    const paidThisMonth = invoices
      .filter((i) => {
        if (i.status !== 'paid') return false
        const at = i.paid_at ? parseToTimestamp(i.paid_at) : parseToTimestamp(i.updated_at)
        return at >= cutoff
      })
      .reduce((sum, i) => sum + Number(i.total_amount), 0)
    return { unbilled, openInvoices, paidThisMonth }
  }, [estimates, invoices, dateRange])

  const filtered = useMemo(() => {
    const daysMs = (d: number) => d * 24 * 60 * 60 * 1000
    const cutoff = Date.now() - daysMs(Number(dateRange))
    let list = rows.filter((r) => parseToTimestamp(r.date) >= cutoff)
    if (viewFilter === 'open') {
      list = list.filter((r) => {
        if (r.type === 'estimate') return r.status !== 'declined'
        return r.status !== 'paid'
      })
    }
    if (typeFilter === 'estimate') list = list.filter((r) => r.type === 'estimate')
    else if (typeFilter === 'invoice') list = list.filter((r) => r.type === 'invoice')
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(s) ||
          r.jobName.toLowerCase().includes(s) ||
          r.recipient.toLowerCase().includes(s)
      )
    }
    return list
  }, [rows, typeFilter, search, dateRange, viewFilter])

  if (loading) {
    return (
      <div className="estimates-ledger__empty">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="estimates-ledger__empty" style={{ color: 'var(--red-light)' }}>
        {error}
      </div>
    )
  }

  const unbilledCount = estimates.filter((e) => (e.status === 'sent' || e.status === 'accepted') && (Number(e.invoiced_amount) || 0) < Number(e.total_amount)).length
  const openInvCount = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').length

  return (
    <div className="estimates-ledger">
      <div className="estimates-ledger-kpi">
        <div className="estimates-kpi-card unbilled">
          <div className="estimates-kpi-label">Unbilled (Estimates)</div>
          <div className="estimates-kpi-value">
            ${moneyBar.unbilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="estimates-kpi-sub">{unbilledCount} estimate{unbilledCount !== 1 ? 's' : ''} pending</div>
        </div>
        <div className="estimates-kpi-card open-inv">
          <div className="estimates-kpi-label">Open Invoices</div>
          <div className="estimates-kpi-value">
            ${moneyBar.openInvoices.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="estimates-kpi-sub">{openInvCount} invoice{openInvCount !== 1 ? 's' : ''} outstanding</div>
        </div>
        <div className="estimates-kpi-card paid">
          <div className="estimates-kpi-label">Paid (Selected Period)</div>
          <div className="estimates-kpi-value">
            ${moneyBar.paidThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="estimates-kpi-sub">Last {dateRange} days</div>
        </div>
      </div>
      <div className="est-card">
        <div className="estimates-ledger__toolbar">
          <div className="estimates-ledger__search-wrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Search by ID, job, recipient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search ledger"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="estimates-ledger__period-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
              aria-label="Date range"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <div className="estimates-ledger__filter-group">
              {(['all', 'estimate', 'invoice'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`estimates-ledger__filter-btn ${typeFilter === t ? 'active' : ''}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === 'all' ? 'All' : t === 'estimate' ? 'Estimates' : 'Invoices'}
                </button>
              ))}
            </div>
            <div className="estimates-ledger__filter-group">
              <button
                type="button"
                className={`estimates-ledger__filter-btn ${viewFilter === 'open' ? 'active' : ''}`}
                onClick={() => setViewFilter('open')}
              >
                Open
              </button>
              <button
                type="button"
                className={`estimates-ledger__filter-btn ${viewFilter === 'all' ? 'active' : ''}`}
                onClick={() => setViewFilter('all')}
              >
                All
              </button>
            </div>
          </div>
        </div>
        <div className="estimates-ledger__table-wrap">
          {filtered.length === 0 ? (
            <div className="estimates-ledger__empty">
              <div className="estimates-ledger__empty-title">No records found</div>
              Try adjusting your filters
            </div>
          ) : (
            <table className="estimates-ledger__table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th style={{ width: 90 }}>Type</th>
                  <th>Job</th>
                  <th style={{ width: 110 }}>Date</th>
                  <th style={{ width: 190 }}>Recipient</th>
                  <th className="r" style={{ width: 120 }}>Amount</th>
                  <th className="r" style={{ width: 120 }}>Status</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={`${row.type}-${row.id}`}
                    onClick={() =>
                      row.type === 'estimate'
                        ? onOpenEstimate?.(row.id)
                        : onOpenInvoice?.(row.id)
                    }
                  >
                    <td><span className="estimates-ledger__doc-id">{row.id.slice(0, 8)}</span></td>
                    <td>
                      <span className={`estimates-type-pill ${row.type}`}>
                        {row.type === 'estimate' ? 'Estimate' : 'Invoice'}
                      </span>
                    </td>
                    <td>
                      <div className="estimates-ledger__doc-job">{row.jobName}</div>
                      <div className="estimates-ledger__doc-client">{row.recipient}</div>
                    </td>
                    <td>{formatDate(row.date)}</td>
                    <td>{row.recipient}</td>
                    <td className="r"><span className="estimates-ledger__doc-amount">${Number(row.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                    <td className="r">
                      <span className={`estimates-badge ${row.status}`}>{row.status}</span>
                    </td>
                    <td>
                      <div className="estimates-ledger__row-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '4px 9px', fontSize: 11.5 }}
                          onClick={() => (row.type === 'estimate' ? onOpenEstimate?.(row.id) : onOpenInvoice?.(row.id))}
                        >
                          Edit
                        </button>
                        {row.type === 'estimate' && row.status === 'accepted' && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ padding: '4px 9px', fontSize: 11.5, color: 'var(--blue)', borderColor: 'rgba(45,111,168,0.2)' }}
                            onClick={() => onOpenEstimate?.(row.id)}
                          >
                            → Invoice
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
