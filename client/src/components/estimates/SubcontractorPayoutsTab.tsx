import { Fragment, useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import type { BidSheet, Subcontractor } from '@/types/global'
import { formatCurrency } from '@/lib/pipeline'
import { USE_MOCK_ESTIMATES } from '@/data/mockEstimatesData'
import { MOCK_PROJECTS, getMockProjectDetail } from '@/data/mockProjectsData'

type PayoutStatus = 'awaiting' | 'received' | 'approved' | 'paid'
type StatusFilter = 'all' | 'awaiting' | 'received' | 'approved' | 'paid'

interface PayoutRow {
  key: string
  projectId: string
  projectName: string
  trade: string
  subcontractorName: string
  awardedAmount: number
  invoiceReceived: boolean
  quoteUrl?: string | null
}

interface PayoutState {
  status: PayoutStatus
  paymentDate?: string
}

const STATUS_LABELS: Record<PayoutStatus, string> = {
  awaiting: 'Awaiting Invoice',
  received: 'Invoice Received',
  approved: 'Approved',
  paid: 'Paid',
}

function toStatusClass(status: PayoutStatus): string {
  if (status === 'awaiting') return 'draft'
  if (status === 'received') return 'sent'
  if (status === 'approved') return 'invoiced'
  return 'paid'
}

export function SubcontractorPayoutsTab() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PayoutRow[]>([])
  const [payoutState, setPayoutState] = useState<Record<string, PayoutState>>({})
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({})
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [approvedDates, setApprovedDates] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const nextRows: PayoutRow[] = []
        if (USE_MOCK_ESTIMATES) {
          for (const p of MOCK_PROJECTS) {
            const detail = getMockProjectDetail(p.id)
            appendRowsForProject(nextRows, p.id, p.name || 'Project', detail.bidSheet, detail.subcontractors)
          }
        } else {
          const projects = await api.projects.list()
          const data = await Promise.all(
            projects.map(async (p) => {
              const [bidSheet, subcontractors] = await Promise.all([
                api.projects.getBidSheet(p.id),
                api.projects.getSubcontractors(p.id),
              ])
              return { id: p.id, name: p.name || 'Project', bidSheet, subcontractors }
            })
          )
          data.forEach((d) => appendRowsForProject(nextRows, d.id, d.name, d.bidSheet, d.subcontractors))
        }
        if (cancelled) return
        setRows(nextRows)
        setPayoutState((prev) => {
          const seeded: Record<string, PayoutState> = { ...prev }
          nextRows.forEach((row) => {
            if (seeded[row.key]) return
            seeded[row.key] = {
              status: row.invoiceReceived ? 'received' : 'awaiting',
            }
          })
          return seeded
        })
        setOpenProjects((prev) => {
          const seeded: Record<string, boolean> = { ...prev }
          nextRows.forEach((r) => {
            if (!(r.projectId in seeded)) seeded[r.projectId] = true
          })
          return seeded
        })
      } catch {
        if (!cancelled) {
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach((r) => map.set(r.projectId, r.projectName))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [rows])

  const withState = useMemo(() => {
    return rows.map((row) => ({
      ...row,
      payout: payoutState[row.key] ?? { status: row.invoiceReceived ? 'received' : 'awaiting' as PayoutStatus },
    }))
  }, [rows, payoutState])

  const totalAwarded = withState.reduce((s, r) => s + r.awardedAmount, 0)
  const totalPaid = withState
    .filter((r) => r.payout.status === 'paid')
    .reduce((s, r) => s + r.awardedAmount, 0)
  const totalOutstanding = Math.max(0, totalAwarded - totalPaid)

  const filtered = withState.filter((r) => {
    if (projectFilter && r.projectId !== projectFilter) return false
    if (statusFilter !== 'all' && r.payout.status !== statusFilter) return false
    return true
  })

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, row) => {
    if (!acc[row.projectId]) acc[row.projectId] = []
    acc[row.projectId].push(row)
    return acc
  }, {})

  const setStatus = (key: string, next: PayoutStatus) => {
    setPayoutState((prev) => {
      const current = prev[key] ?? { status: 'awaiting' as PayoutStatus }
      const paymentDate = next === 'paid' ? (approvedDates[key] || new Date().toISOString().slice(0, 10)) : current.paymentDate
      return { ...prev, [key]: { ...current, status: next, paymentDate } }
    })
  }

  if (loading) {
    return <div className="estimates-content-empty">Loading subcontractor payouts…</div>
  }

  return (
    <div>
      <div className="estimates-pipeline-kpis">
        <div className="estimates-pipeline-kpi" style={{ ['--kpi-bar' as string]: 'var(--blue)' } as React.CSSProperties}>
          <div className="estimates-pipeline-kpi-label">Total Awarded</div>
          <div className="estimates-pipeline-kpi-value">{formatCurrency(totalAwarded)}</div>
        </div>
        <div className="estimates-pipeline-kpi" style={{ ['--kpi-bar' as string]: 'var(--green)' } as React.CSSProperties}>
          <div className="estimates-pipeline-kpi-label">Paid Out</div>
          <div className="estimates-pipeline-kpi-value">{formatCurrency(totalPaid)}</div>
        </div>
        <div className="estimates-pipeline-kpi" style={{ ['--kpi-bar' as string]: 'var(--est-amber)' } as React.CSSProperties}>
          <div className="estimates-pipeline-kpi-label">Outstanding</div>
          <div className="estimates-pipeline-kpi-value">{formatCurrency(totalOutstanding)}</div>
        </div>
      </div>

      <div className="estimates-ledger__toolbar" style={{ marginBottom: 10 }}>
        <select
          className="estimates-ledger__period-select"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label="Filter payouts by project"
        >
          <option value="">All Projects</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="revenue-overhaul-pills">
          {[
            { id: 'all', label: 'All' },
            { id: 'awaiting', label: 'Awaiting' },
            { id: 'received', label: 'Received' },
            { id: 'approved', label: 'Approved' },
            { id: 'paid', label: 'Paid' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatusFilter(s.id as StatusFilter)}
              className={`revenue-overhaul-pill ${statusFilter === s.id ? 'active' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="estimates-ledger__table-wrap">
        <table className="estimates-ledger__table subcontractor-payouts-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Trade</th>
              <th>Subcontractor</th>
              <th className="r">Awarded Amount</th>
              <th>Invoice Received</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(grouped).length === 0 && (
              <tr>
                <td colSpan={7} className="estimates-ledger__empty">No subcontractor payouts found.</td>
              </tr>
            )}
            {Object.entries(grouped).map(([projectId, projectRows]) => {
              const projectName = projectRows[0]?.projectName || 'Project'
              const projectAwarded = projectRows.reduce((s, r) => s + r.awardedAmount, 0)
              const projectPaid = projectRows
                .filter((r) => r.payout.status === 'paid')
                .reduce((s, r) => s + r.awardedAmount, 0)
              const isOpen = openProjects[projectId] ?? true
              return (
                <Fragment key={`${projectId}-group`}>
                  <tr key={`${projectId}-header`} className="subcontractor-payouts-project-row">
                    <td colSpan={7}>
                      <button
                        type="button"
                        className="subcontractor-payouts-project-toggle"
                        onClick={() => setOpenProjects((prev) => ({ ...prev, [projectId]: !isOpen }))}
                      >
                        <span>{isOpen ? '▼' : '▶'} {projectName}</span>
                        <span>
                          Awarded {formatCurrency(projectAwarded)} · Paid {formatCurrency(projectPaid)}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {isOpen && projectRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.projectName}</td>
                      <td>{row.trade}</td>
                      <td>{row.subcontractorName}</td>
                      <td className="r">{formatCurrency(row.awardedAmount)}</td>
                      <td>{row.payout.status === 'awaiting' ? 'No' : 'Yes'}</td>
                      <td>
                        <span className={`estimates-badge ${toStatusClass(row.payout.status)}`}>
                          {STATUS_LABELS[row.payout.status]}
                        </span>
                      </td>
                      <td>
                        {row.payout.status === 'awaiting' && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(row.key, 'received')}>
                            Mark Invoice Received
                          </button>
                        )}
                        {row.payout.status === 'received' && (
                          <div className="subcontractor-payouts-actions">
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(row.key, 'approved')}>
                              Approve &amp; Pay →
                            </button>
                            {row.quoteUrl ? (
                              <a href={row.quoteUrl} target="_blank" rel="noreferrer" className="subcontractor-payouts-link">
                                View Invoice
                              </a>
                            ) : (
                              <span className="subcontractor-payouts-link disabled">View Invoice</span>
                            )}
                          </div>
                        )}
                        {row.payout.status === 'approved' && (
                          <div className="subcontractor-payouts-actions">
                            <input
                              type="date"
                              className="estimates-pipeline-job-filter-select"
                              value={approvedDates[row.key] || ''}
                              onChange={(e) => setApprovedDates((prev) => ({ ...prev, [row.key]: e.target.value }))}
                              aria-label="Payment date"
                            />
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(row.key, 'paid')}>
                              Mark as Paid
                            </button>
                          </div>
                        )}
                        {row.payout.status === 'paid' && (
                          <span className="subcontractor-payouts-paid">
                            Paid ✓ {row.payout.paymentDate ? `· ${row.payout.paymentDate}` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function appendRowsForProject(
  collector: PayoutRow[],
  projectId: string,
  projectName: string,
  bidSheet: BidSheet,
  subcontractors: Subcontractor[]
) {
  const subMap = new Map(subcontractors.map((s) => [s.id, s]))
  const tradeMap = new Map(bidSheet.trade_packages.map((tp) => [tp.id, tp.trade_tag || 'Trade']))
  bidSheet.sub_bids
    .filter((sb) => sb.awarded)
    .forEach((sb) => {
      const sub = subMap.get(sb.subcontractor_id)
      collector.push({
        key: `${projectId}:${sb.id}`,
        projectId,
        projectName,
        trade: tradeMap.get(sb.trade_package_id) || 'Trade',
        subcontractorName: sub?.name || 'Subcontractor',
        awardedAmount: Number(sb.amount || 0),
        invoiceReceived: !!sb.quote_url || sb.response_status === 'bid_received',
        quoteUrl: sb.quote_url,
      })
    })
}
