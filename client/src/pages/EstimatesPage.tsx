import { useEffect, useState } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Job } from '@/types/global'
import { EstimatesInvoicesLedger } from '@/components/estimates/EstimatesInvoicesLedger'
import { EstimateBuilder } from '@/components/estimates/EstimateBuilder'
import { CustomProductLibrary } from '@/components/estimates/CustomProductLibrary'
import { ReceiptSpendTracking } from '@/components/estimates/ReceiptSpendTracking'
import { DocumentDetailModal } from '@/components/estimates/DocumentDetailModal'
import { USE_MOCK_ESTIMATES, MOCK_JOBS } from '@/data/mockEstimatesData'

type Tab = 'ledger' | 'builder' | 'products' | 'receipts'

export function EstimatesPage() {
  const [tab, setTab] = useState<Tab>('ledger')
  const [jobs, setJobs] = useState<Job[]>([])
  const [, setLoadingJobs] = useState(true)
  const [detailDoc, setDetailDoc] = useState<
    { type: 'estimate' | 'invoice'; id: string } | null
  >(null)

  useEffect(() => {
    if (USE_MOCK_ESTIMATES) {
      setJobs(MOCK_JOBS)
      setLoadingJobs(false)
      return
    }
    estimatesApi
      .getJobs()
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoadingJobs(false))
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ledger', label: 'Ledger' },
    { id: 'builder', label: 'Estimate builder' },
    { id: 'products', label: 'Products & Services' },
    { id: 'receipts', label: 'Receipts & spend' },
  ]

  return (
    <div className="dashboard-app estimates-page flex flex-col min-h-0 flex-1">
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6 flex flex-col flex-1 min-h-0">
        <div className="dashboard-page-header mb-6 flex justify-between items-center w-full flex-wrap gap-4">
          <h1 className="dashboard-title">Estimates & Invoices</h1>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setTab('builder')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New estimate
          </button>
        </div>

        <nav className="estimates-page__tabs estimates-page__tabs--bar mb-6" aria-label="Estimates sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`estimates-page__tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'true' : undefined}
            >
              <span className="estimates-page__tab-icon" aria-hidden>
                {t.id === 'ledger' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                )}
                {t.id === 'builder' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                )}
                {t.id === 'products' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" /></svg>
                )}
                {t.id === 'receipts' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
                )}
              </span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="estimates-page__content flex-1 min-h-0 flex flex-col">
          <div className="estimates-page__content-inner flex-1 min-h-0 flex flex-col">
          {tab === 'ledger' && (
            <EstimatesInvoicesLedger
              jobs={jobs}
              onOpenEstimate={(id) => setDetailDoc({ type: 'estimate', id })}
              onOpenInvoice={(id) => setDetailDoc({ type: 'invoice', id })}
            />
          )}
          {tab === 'builder' && (
            <EstimateBuilder
              jobs={jobs}
              onClose={() => setTab('ledger')}
              onSaved={(id) => {
                setTab('ledger')
                setDetailDoc({ type: 'estimate', id })
              }}
            />
          )}
          {tab === 'products' && <CustomProductLibrary />}
          {tab === 'receipts' && <ReceiptSpendTracking jobs={jobs} />}
          </div>
        </div>
      </div>

      {detailDoc && (
        <DocumentDetailModal
          type={detailDoc.type}
          id={detailDoc.id}
          jobs={jobs}
          onClose={() => setDetailDoc(null)}
          onConvertToInvoice={() => {
            setDetailDoc(null)
            setTab('ledger')
          }}
        />
      )}
    </div>
  )
}
