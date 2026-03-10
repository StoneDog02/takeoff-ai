import { useEffect, useState } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Job, JobExpense, PipelineItem } from '@/types/global'
import { buildPipelineItems } from '@/lib/pipeline'
import { PipelineTab } from '@/components/estimates/PipelineTab'
import { EstimateBuilderModal, type NewEstimatePayload } from '@/components/estimates/EstimateBuilderModal'
import { CustomProductLibrary } from '@/components/estimates/CustomProductLibrary'
import { ReceiptSpendTracking } from '@/components/estimates/ReceiptSpendTracking'
import {
  USE_MOCK_ESTIMATES,
  MOCK_JOBS,
  MOCK_ESTIMATES,
  MOCK_INVOICES,
  MOCK_JOB_EXPENSES,
  MOCK_ESTIMATE_MILESTONES,
} from '@/data/mockEstimatesData'

type Tab = 'pipeline' | 'receipts'

export function EstimatesPage() {
  const [tab, setTab] = useState<Tab>('pipeline')
  const [jobs, setJobs] = useState<Job[]>([])
  const [pipeline, setPipeline] = useState<PipelineItem[]>([])
  const [showBuilder, setShowBuilder] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [pipelineJobFilterId, setPipelineJobFilterId] = useState<string>('')
  const [allExpenses, setAllExpenses] = useState<JobExpense[]>([])

  useEffect(() => {
    if (USE_MOCK_ESTIMATES) {
      setJobs(MOCK_JOBS)
      setPipeline(
        buildPipelineItems(
          MOCK_ESTIMATES,
          MOCK_INVOICES,
          MOCK_JOBS,
          MOCK_ESTIMATE_MILESTONES
        )
      )
      return
    }
    Promise.all([
      estimatesApi.getJobs(),
      estimatesApi.getEstimates(),
      estimatesApi.getInvoices(),
      estimatesApi.getJobExpenses(),
    ])
      .then(([jobsList, estimates, invoices, expensesList]) => {
        setJobs(jobsList)
        setPipeline(
          buildPipelineItems(estimates, invoices, jobsList)
        )
        setAllExpenses(expensesList ?? [])
      })
      .catch(() => {
        setJobs([])
        setPipeline([])
        setAllExpenses([])
      })
  }, [])

  const expenses = USE_MOCK_ESTIMATES ? MOCK_JOB_EXPENSES : allExpenses

  const handleSaveEstimate = async (
    _estimateId: string,
    payload?: NewEstimatePayload
  ) => {
    setShowBuilder(false)
    if (USE_MOCK_ESTIMATES && payload) {
      setPipeline((prev) => [
        ...prev,
        {
          id: payload.id,
          type: 'estimate',
          job_id: payload.job_id,
          jobName: payload.jobName,
          client: null,
          date: payload.date,
          amount: payload.amount,
          stage: 'draft',
          invoiced: 0,
          paid: 0,
          milestones: payload.milestones,
        },
      ])
      return
    }
    if (!USE_MOCK_ESTIMATES && jobs.length) {
      try {
        const [estimates, invoices] = await Promise.all([
          estimatesApi.getEstimates(),
          estimatesApi.getInvoices(),
        ])
        setPipeline(buildPipelineItems(estimates, invoices, jobs))
      } catch {
        // keep current pipeline
      }
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'receipts', label: 'Receipts & Spend' },
  ]

  return (
    <div className="dashboard-app estimates-page flex flex-col min-h-0 flex-1">
      {showBuilder && (
        <EstimateBuilderModal
          jobs={jobs}
          onClose={() => setShowBuilder(false)}
          onSave={handleSaveEstimate}
        />
      )}

      {showSettings && (
        <div
          className="estimates-detail-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Products & Services settings"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="estimates-detail-panel__inner"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="estimates-detail-panel__header">
              <div className="estimates-detail-panel__meta">
                <div>
                  <div className="estimates-detail-panel__type-id">Settings</div>
                  <h3 className="estimates-detail-panel__title">Products & Services</h3>
                </div>
                <button
                  type="button"
                  className="estimates-detail-panel__close"
                  onClick={() => setShowSettings(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ padding: '20px 28px', flex: 1 }}>
              <CustomProductLibrary />
            </div>
          </div>
        </div>
      )}

      <div className="estimates-page__wrap w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6 flex flex-col flex-1 min-h-0">
        <div className="dashboard-page-header mb-6 flex justify-between items-center w-full flex-wrap gap-4">
          <h1 className="dashboard-title">Estimates & Invoices</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowBuilder(true)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              New Estimate
            </button>
          </div>
        </div>

        <div className="estimates-page__tabs-row">
          <nav className="estimates-page__tabs estimates-page__tabs--bar" aria-label="Estimates sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`estimates-page__tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'true' : undefined}
              >
                <span className="estimates-page__tab-icon" aria-hidden>
                  {t.id === 'pipeline' && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                  )}
                  {t.id === 'receipts' && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
                  )}
                </span>
                {t.label}
              </button>
            ))}
          </nav>
          {tab === 'pipeline' && (
            <label className="estimates-pipeline-job-filter">
              <span className="estimates-pipeline-job-filter-label">Job</span>
              <select
                className="estimates-pipeline-job-filter-select"
                value={pipelineJobFilterId}
                onChange={(e) => setPipelineJobFilterId(e.target.value)}
                aria-label="Filter pipeline by job"
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

        <div className="estimates-page__content flex flex-col min-h-0">
          <div className="estimates-page__content-inner flex flex-col min-h-0">
            {tab === 'pipeline' && (
              <PipelineTab
                pipeline={pipeline}
                setPipeline={setPipeline}
                expenses={expenses}
                jobFilterId={pipelineJobFilterId}
              />
            )}
            {tab === 'receipts' && (
              <ReceiptSpendTracking
                jobs={jobs}
                onAddToInvoice={() => setTab('pipeline')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
