import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getFinancialConnectionsStatus } from '@/api/financialConnections'
import { useTransactions, EXPENSE_TYPES } from '@/hooks/useTransactions'
import { formatCurrency } from '@/lib/pipeline'
import { formatDate } from '@/lib/date'
import { isStripeConfigured } from '@/lib/stripe'
import { supabase } from '@/lib/supabaseClient'

function maskAccount(accountId) {
  if (!accountId) return '••••'
  const s = String(accountId)
  if (s.length <= 4) return `••••${s}`
  return `••••${s.slice(-4)}`
}

function formatAmount(row) {
  const n = Number(row.amount || 0)
  const abs = formatCurrency(n)
  if (row.is_debit) return { text: `− ${abs}`, className: 'text-red-600 dark:text-red-400' }
  return { text: `+ ${abs}`, className: 'text-emerald-600 dark:text-emerald-400' }
}

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'needs_tagging', label: 'Needs Tagging' },
  { id: 'tagged', label: 'Tagged' },
  { id: 'missing_receipt', label: 'Missing Receipt' },
]

export function FinancialsTransactions() {
  const { user } = useAuth()
  const {
    transactions,
    loading,
    loadError,
    jobs,
    jobsLoading,
    metrics,
    filterTab,
    setFilterTab,
    searchQuery,
    setSearchQuery,
    grouped,
    saveTransaction,
    saveError,
    setSaveError,
    savingId,
  } = useTransactions(user?.id)

  const [bankLinkLoading, setBankLinkLoading] = useState(true)
  const [hasLinkedBank, setHasLinkedBank] = useState(false)

  const loadBankLinkStatus = useCallback(async () => {
    if (!user || !supabase) {
      setBankLinkLoading(false)
      setHasLinkedBank(false)
      return
    }
    setBankLinkLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setHasLinkedBank(false)
        return
      }
      const { accounts } = await getFinancialConnectionsStatus(session.access_token)
      setHasLinkedBank((accounts?.length ?? 0) > 0)
    } catch {
      setHasLinkedBank(false)
    } finally {
      setBankLinkLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadBankLinkStatus()
  }, [loadBankLinkStatus])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') loadBankLinkStatus()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadBankLinkStatus])

  const showLinkBankPrompt =
    isStripeConfigured && !bankLinkLoading && !hasLinkedBank

  const [expandedId, setExpandedId] = useState(null)
  const [draft, setDraft] = useState({
    jobId: '',
    expenseType: '',
    notes: '',
    receiptUrl: '',
    receiptFile: null,
  })

  const expandedRow = useMemo(
    () => grouped.needsTagging.concat(grouped.tagged).find((r) => r.id === expandedId),
    [grouped, expandedId],
  )

  useEffect(() => {
    const ids = new Set([...grouped.needsTagging, ...grouped.tagged].map((r) => r.id))
    if (expandedId && !ids.has(expandedId)) setExpandedId(null)
  }, [grouped, expandedId])

  useEffect(() => {
    if (!expandedRow) return
    const r = expandedRow
    const url = r.receipt_url && String(r.receipt_url).startsWith('http') ? r.receipt_url : ''
    setDraft({
      jobId: r.job_id || '',
      expenseType: r.expense_type || '',
      notes: r.notes || '',
      receiptUrl: url,
      receiptFile: null,
    })
    setSaveError(null)
  }, [expandedRow, expandedId, setSaveError])

  const jobNameById = useMemo(() => {
    const m = new Map()
    for (const j of jobs) m.set(j.id, j.name)
    return m
  }, [jobs])

  const toggleRow = useCallback(
    (id) => {
      setExpandedId((prev) => (prev === id ? null : id))
    },
    [],
  )

  const handleCancel = useCallback(() => {
    setExpandedId(null)
    setSaveError(null)
  }, [setSaveError])

  const handleSave = useCallback(async () => {
    if (!expandedRow) return
    const ok = await saveTransaction(expandedRow, {
      jobId: draft.jobId || null,
      expenseType: draft.expenseType || null,
      notes: draft.notes,
      receiptUrl: draft.receiptUrl,
      receiptFile: draft.receiptFile,
    })
    if (ok) setExpandedId(null)
  }, [expandedRow, draft, saveTransaction])

  const openReceipt = useCallback(async (receiptUrl) => {
    if (!receiptUrl || !supabase) return
    if (receiptUrl.startsWith('http')) {
      window.open(receiptUrl, '_blank', 'noopener,noreferrer')
      return
    }
    const { data, error } = await supabase.storage.from('bank-receipts').createSignedUrl(receiptUrl, 3600)
    if (error || !data?.signedUrl) return
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }, [])

  if (!user) {
    return (
      <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-white-dim">Sign in to manage transactions.</div>
    )
  }

  return (
    <div className="financials-tx w-full pb-8">
      {loadError ? (
        <div
          className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200"
          role="status"
        >
          Could not load transactions ({loadError}). Check your connection and try again.
        </div>
      ) : null}

      {showLinkBankPrompt ? (
        <div
          className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/50 px-4 py-4 sm:px-5 sm:py-4"
          role="region"
          aria-label="Connect bank account"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
                No bank linked yet
              </h2>
              <p className="mt-1.5 text-sm text-[var(--text-muted)] leading-relaxed">
                {transactions.length === 0
                  ? 'You don’t have any transaction data here yet. Link a business bank account to import transactions and track spending on this page.'
                  : 'Link a business bank account to import new transactions automatically. You can still tag and manage entries already in Proj-X.'}
              </p>
            </div>
            <Link
              to="/settings?section=integrations"
              className="shrink-0 inline-flex items-center justify-center rounded-lg bg-[var(--red)] hover:opacity-95 text-white text-sm font-medium px-4 py-2.5 whitespace-nowrap"
            >
              Link bank in Settings
            </Link>
          </div>
        </div>
      ) : null}

      {/* Stat bar */}
      <div className="revenue-overhaul-kpi-row mb-6">
        <div className="revenue-overhaul-kpi-card">
          <div className="revenue-overhaul-kpi-bar revenue-overhaul-kpi-bar-blue" />
          <div className="revenue-overhaul-kpi-label">This month</div>
          <div className="revenue-overhaul-kpi-value">{formatCurrency(metrics.totalSpend)}</div>
          <span className="revenue-overhaul-kpi-meta-small">Total spend (debits)</span>
        </div>
        <div className="revenue-overhaul-kpi-card">
          <div className="revenue-overhaul-kpi-bar revenue-overhaul-kpi-bar-purple" />
          <div className="revenue-overhaul-kpi-label">Tagged</div>
          <div className="revenue-overhaul-kpi-value">{formatCurrency(metrics.taggedSum)}</div>
          <span className="revenue-overhaul-kpi-meta-small">Tagged debits · this month</span>
        </div>
        <div className="revenue-overhaul-kpi-card">
          <div className="revenue-overhaul-kpi-bar revenue-overhaul-kpi-bar-amber" />
          <div className="revenue-overhaul-kpi-label">Untagged</div>
          <div className="revenue-overhaul-kpi-value">{formatCurrency(metrics.untaggedSum)}</div>
          <span className="revenue-overhaul-kpi-meta-small">Needs job &amp; type · this month</span>
        </div>
        <div className="revenue-overhaul-kpi-card">
          <div className="revenue-overhaul-kpi-bar" style={{ background: '#64748b' }} />
          <div className="revenue-overhaul-kpi-label">Missing receipts</div>
          <div className="revenue-overhaul-kpi-value">{metrics.missingReceiptCount}</div>
          <span className="revenue-overhaul-kpi-meta-small">Debits · this month</span>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
        <div className="estimates-page__tabs-row !mb-0">
          <nav className="estimates-page__tabs estimates-page__tabs--bar" aria-label="Transaction filters">
            {FILTER_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`estimates-page__tab ${filterTab === t.id ? 'active' : ''}`}
                onClick={() => setFilterTab(t.id)}
                aria-current={filterTab === t.id ? 'true' : undefined}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <label className="financials-tx-search flex items-center gap-2 min-w-[220px] max-w-md w-full">
          <span className="sr-only">Search merchants</span>
          <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
            <circle cx="7" cy="7" r="5" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search merchant…"
            className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--red-border)]/40"
          />
        </label>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-sm text-[var(--text-muted)]">Loading transactions…</div>
      ) : (
        <>
          <TransactionSection
            title="Needs tagging"
            subtitle="Assign a job and expense type"
            rows={grouped.needsTagging}
            expandedId={expandedId}
            onToggle={toggleRow}
            draft={draft}
            setDraft={setDraft}
            jobs={jobs}
            jobsLoading={jobsLoading}
            jobNameById={jobNameById}
            savingId={savingId}
            saveError={saveError}
            onSave={handleSave}
            onCancel={handleCancel}
            onOpenReceipt={openReceipt}
          />
          <TransactionSection
            title="Tagged"
            subtitle="Job and category set"
            rows={grouped.tagged}
            expandedId={expandedId}
            onToggle={toggleRow}
            draft={draft}
            setDraft={setDraft}
            jobs={jobs}
            jobsLoading={jobsLoading}
            jobNameById={jobNameById}
            savingId={savingId}
            saveError={saveError}
            onSave={handleSave}
            onCancel={handleCancel}
            onOpenReceipt={openReceipt}
          />
        </>
      )}
    </div>
  )
}

function TransactionSection({
  title,
  subtitle,
  rows,
  expandedId,
  onToggle,
  draft,
  setDraft,
  jobs,
  jobsLoading,
  jobNameById,
  savingId,
  saveError,
  onSave,
  onCancel,
  onOpenReceipt,
}) {
  if (rows.length === 0) {
    return (
      <section className="mb-10">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">{title}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)]">0</span>
        </div>
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)]/40 px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          No transactions in this section for the current filters.
        </div>
      </section>
    )
  }

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">{title}</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs font-medium text-[var(--text-muted)]">{rows.length}</span>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden divide-y divide-[var(--border)]">
        {rows.map((row) => (
          <TransactionRow
            key={row.id}
            row={row}
            expanded={expandedId === row.id}
            onToggle={() => onToggle(row.id)}
            draft={draft}
            setDraft={setDraft}
            jobs={jobs}
            jobsLoading={jobsLoading}
            jobNameById={jobNameById}
            savingId={savingId}
            saveError={saveError}
            onSave={onSave}
            onCancel={onCancel}
            onOpenReceipt={onOpenReceipt}
          />
        ))}
      </div>
    </section>
  )
}

function TransactionRow({
  row,
  expanded,
  onToggle,
  draft,
  setDraft,
  jobs,
  jobsLoading,
  jobNameById,
  savingId,
  saveError,
  onSave,
  onCancel,
  onOpenReceipt,
}) {
  const amt = formatAmount(row)
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3.5 flex flex-wrap items-center gap-3 hover:bg-[var(--bg-raised)]/60 transition-colors"
      >
        <div className="flex-1 min-w-[180px]">
          <div className="font-medium text-[var(--text-primary)] text-sm">{row.merchant_name || '—'}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {formatDate(row.transaction_date)} · {maskAccount(row.account_id)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 justify-end">
          {row.job_id ? (
            <span className="inline-flex items-center rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[11px] font-medium">
              {jobNameById.get(row.job_id) || 'Job'}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-gray-500/10 text-[var(--text-muted)] px-2 py-0.5 text-[11px] font-medium">
              No job
            </span>
          )}
          {row.expense_type ? (
            <span className="inline-flex items-center rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[11px] font-medium">
              {row.expense_type}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-gray-500/10 text-[var(--text-muted)] px-2 py-0.5 text-[11px] font-medium">
              No type
            </span>
          )}
          {row.is_debit && !row.receipt_url ? (
            <span className="inline-flex items-center rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200 px-2 py-0.5 text-[11px] font-medium">
              No receipt
            </span>
          ) : row.receipt_url ? (
            <span className="inline-flex items-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-medium">
              Receipt
            </span>
          ) : null}
        </div>
        <div className={`text-sm font-semibold tabular-nums min-w-[100px] text-right ${amt.className}`}>{amt.text}</div>
      </button>

      {expanded ? (
        <div className="px-4 pb-4 pt-0 border-t border-[var(--border)] bg-[var(--bg-raised)]/30">
          <div className="pt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Job</span>
              <select
                value={draft.jobId}
                disabled={jobsLoading}
                onChange={(e) => setDraft((d) => ({ ...d, jobId: e.target.value }))}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="">Select job…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Expense type</span>
              <select
                value={draft.expenseType}
                onChange={(e) => setDraft((d) => ({ ...d, expenseType: e.target.value }))}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="">Select type…</option>
                {EXPENSE_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Receipt link (optional)</span>
              <input
                type="url"
                value={draft.receiptUrl}
                onChange={(e) => setDraft((d) => ({ ...d, receiptUrl: e.target.value }))}
                placeholder="https://…"
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <div className="sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] block mb-1.5">
                Upload receipt
              </span>
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6">
                <label className="flex flex-col items-center justify-center cursor-pointer hover:opacity-90">
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/*,.pdf,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      setDraft((d) => ({ ...d, receiptFile: f || null }))
                    }}
                  />
                  <span className="text-sm text-[var(--text-secondary)]">
                    {draft.receiptFile ? draft.receiptFile.name : 'Drop a file or click to browse'}
                  </span>
                </label>
                {row.receipt_url ? (
                  <button
                    type="button"
                    className="mt-3 w-full text-center text-xs font-medium text-[var(--red-light)]"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenReceipt(row.receipt_url)
                    }}
                  >
                    View current receipt
                  </button>
                ) : null}
              </div>
            </div>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Notes</span>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] resize-y min-h-[64px]"
              />
            </label>
          </div>
          {saveError ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSave()
              }}
              disabled={savingId === row.id}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--red)] hover:opacity-95 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
            >
              {savingId === row.id ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCancel()
              }}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium px-4 py-2 text-[var(--text-primary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
