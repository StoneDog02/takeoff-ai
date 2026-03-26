import { useEffect, useState } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Invoice, Job } from '@/types/global'
import { formatCurrency } from '@/lib/pipeline'
import { PipelineTab } from '@/components/estimates/PipelineTab'
import { CustomProductLibrary } from '@/components/estimates/CustomProductLibrary'
import { NewInvoiceModal } from '@/components/estimates/NewInvoiceModal'
import { SubcontractorPayoutsTab } from '@/components/estimates/SubcontractorPayoutsTab'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import {
  USE_MOCK_ESTIMATES,
  MOCK_JOBS,
  MOCK_INVOICES,
} from '@/data/mockEstimatesData'

type InvoicingTab = 'client_invoices' | 'subcontractor_payouts'

export function EstimatesPage({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [showBuilder, setShowBuilder] = useState(false)
  const [activeTab, setActiveTab] = useState<InvoicingTab>('client_invoices')
  const [showSettings, setShowSettings] = useState(false)
  const [pipelineJobFilterId, setPipelineJobFilterId] = useState<string>('')
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([])
  const [invoicePeriod, setInvoicePeriod] = useState<'This month' | 'Last 30 days' | 'This year' | 'All time'>('This month')

  useEffect(() => {
    if (USE_MOCK_ESTIMATES) {
      setJobs(MOCK_JOBS)
      setAllInvoices(MOCK_INVOICES)
      setLoading(false)
      return
    }
    Promise.all([
      estimatesApi.getJobs(),
      estimatesApi.getInvoices(),
    ])
      .then(([jobsList, invoices]) => {
        setJobs(jobsList)
        setAllInvoices(invoices)
      })
      .catch(() => {
        setJobs([])
        setAllInvoices([])
      })
      .finally(() => setLoading(false))
  }, [])

  const refreshPipeline = async () => {
    if (USE_MOCK_ESTIMATES) return
    try {
      const [jobsList, invoices] = await Promise.all([
        estimatesApi.getJobs(),
        estimatesApi.getInvoices(),
      ])
      setJobs(jobsList)
      setAllInvoices(invoices)
    } catch {
      // keep current state on error
    }
  }

  const rootClass = embedded
    ? 'estimates-page estimates-page--embedded w-full'
    : 'dashboard-app estimates-page flex flex-col min-h-0 flex-1'
  const wrapClass = embedded
    ? 'financials-invoicing-embedded-wrap w-full max-w-none mx-0 px-0 sm:px-0 lg:px-0 py-0'
    : 'estimates-page__wrap w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6 flex flex-col flex-1 min-h-0'

  if (loading) {
    return (
      <div className={rootClass}>
        <div className={wrapClass}>
          <LoadingSkeleton variant="page" className="min-h-[30vh]" />
        </div>
      </div>
    )
  }

  const invoicesForKpis = (pipelineJobFilterId
    ? allInvoices.filter((inv) => inv.job_id === pipelineJobFilterId)
    : allInvoices)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 30)

  const inSelectedPeriod = (dateValue: string) => {
    if (invoicePeriod === 'All time') return true
    const dt = new Date(dateValue)
    if (Number.isNaN(dt.getTime())) return false
    if (invoicePeriod === 'This month') return dt >= monthStart
    if (invoicePeriod === 'Last 30 days') return dt >= thirtyDaysAgo
    return dt >= yearStart
  }

  const outstandingTotal = invoicesForKpis
    .filter((inv) => inv.status === 'sent' || inv.status === 'viewed')
    .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)

  const invoicedTotal = invoicesForKpis
    .filter((inv) => inSelectedPeriod(inv.created_at))
    .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)

  const collectedTotal = invoicesForKpis
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)

  const overdueTotal = invoicesForKpis
    .filter((inv) => {
      if (inv.status === 'paid') return false
      if (inv.status === 'overdue') return true
      if (!inv.due_date) return false
      const due = new Date(inv.due_date)
      if (Number.isNaN(due.getTime())) return false
      return due < now
    })
    .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)

  return (
    <div className={rootClass}>
      {showBuilder && (
        <NewInvoiceModal
          jobs={jobs}
          onClose={() => setShowBuilder(false)}
          onSaved={() => {
            setShowBuilder(false)
            refreshPipeline()
          }}
        />
      )}

      {showSettings && (
        <div
          className="estimates-detail-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Products & Services library"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="estimates-detail-panel__inner estimates-detail-panel__inner--products-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <CustomProductLibrary onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      <div className={wrapClass}>
        <div className={`dashboard-page-header mb-6 flex justify-between items-center w-full flex-wrap gap-4 ${embedded ? 'mb-4' : ''}`}>
          {embedded ? (
            <h2 className="dashboard-title text-lg sm:text-xl">Invoicing</h2>
          ) : (
            <h1 className="dashboard-title">Invoicing</h1>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowSettings(true)}
            >
              Products & Services
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowBuilder(true)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              New Invoice
            </button>
          </div>
        </div>

        <div className="estimates-page__tabs-row">
          <nav className="estimates-page__tabs estimates-page__tabs--bar" aria-label="Invoicing sections">
            <button
              type="button"
              className={`estimates-page__tab ${activeTab === 'client_invoices' ? 'active' : ''}`}
              onClick={() => setActiveTab('client_invoices')}
              aria-current={activeTab === 'client_invoices' ? 'true' : undefined}
            >
              <span className="estimates-page__tab-icon" aria-hidden>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              </span>
              Client Invoices
            </button>
            <button
              type="button"
              className={`estimates-page__tab ${activeTab === 'subcontractor_payouts' ? 'active' : ''}`}
              onClick={() => setActiveTab('subcontractor_payouts')}
              aria-current={activeTab === 'subcontractor_payouts' ? 'true' : undefined}
            >
              <span className="estimates-page__tab-icon" aria-hidden>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20" /></svg>
              </span>
              Subcontractor Payouts
            </button>
          </nav>
          {activeTab === 'client_invoices' && (
            <label className="estimates-pipeline-job-filter">
              <span className="estimates-pipeline-job-filter-label">Job</span>
              <select
                className="estimates-pipeline-job-filter-select"
                value={pipelineJobFilterId}
                onChange={(e) => setPipelineJobFilterId(e.target.value)}
                aria-label="Filter client invoices by job"
              >
                <option value="">All jobs</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name.split('–')[0].trim()}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {activeTab === 'client_invoices' && (
          <>
            <div className="revenue-overhaul-pills mb-4">
              {(['This month', 'Last 30 days', 'This year', 'All time'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setInvoicePeriod(p)}
                  className={`revenue-overhaul-pill ${invoicePeriod === p ? 'active' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="estimates-pipeline-kpis">
              <div className="estimates-pipeline-kpi" style={{ ['--kpi-bar' as string]: 'var(--blue)' } as React.CSSProperties}>
                <div className="estimates-pipeline-kpi-label">Outstanding</div>
                <div className="estimates-pipeline-kpi-value">{formatCurrency(outstandingTotal)}</div>
                <div className="estimates-pipeline-kpi-sub">Awaiting payment</div>
              </div>
              <div className="estimates-pipeline-kpi" style={{ ['--kpi-bar' as string]: 'var(--est-amber)' } as React.CSSProperties}>
                <div className="estimates-pipeline-kpi-label">Invoiced</div>
                <div className="estimates-pipeline-kpi-value">{formatCurrency(invoicedTotal)}</div>
                <div className="estimates-pipeline-kpi-sub">
                  {invoicePeriod === 'This month' ? 'This month' : invoicePeriod}
                </div>
              </div>
              <div className="estimates-pipeline-kpi" style={{ ['--kpi-bar' as string]: 'var(--green)' } as React.CSSProperties}>
                <div className="estimates-pipeline-kpi-label">Collected</div>
                <div className="estimates-pipeline-kpi-value">{formatCurrency(collectedTotal)}</div>
                <div className="estimates-pipeline-kpi-sub">Total collected</div>
              </div>
              <div
                className={`estimates-pipeline-kpi ${overdueTotal > 0 ? 'estimates-pipeline-kpi--overdue' : 'estimates-pipeline-kpi--muted'}`}
                style={{ ['--kpi-bar' as string]: 'var(--red)' } as React.CSSProperties}
              >
                <div className="estimates-pipeline-kpi-label">Overdue</div>
                <div className="estimates-pipeline-kpi-value">{formatCurrency(overdueTotal)}</div>
                <div className="estimates-pipeline-kpi-sub">Past due date</div>
              </div>
            </div>
          </>
        )}

        <div className="estimates-page__content flex flex-col min-h-0">
          <div className="estimates-page__content-inner flex flex-col min-h-0">
            {activeTab === 'client_invoices' && (
              <PipelineTab
                invoices={allInvoices}
                jobFilterId={pipelineJobFilterId}
                jobs={jobs}
                onPipelineRefresh={refreshPipeline}
              />
            )}
            {activeTab === 'subcontractor_payouts' && (
              <SubcontractorPayoutsTab />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
