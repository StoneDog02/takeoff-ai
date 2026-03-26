import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import type { DashboardProject } from '@/api/client'
import type { PaperDocumentType, PaperTrailDocument } from '@/types/global'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { DocumentViewer } from '@/components/documents/DocumentViewer'
import {
  displayDate,
  documentTypeLabel,
  downloadDocumentPdf,
  formatMoney,
  recipientLabel,
  statusBadgeClass,
  statusDisplayLabel,
} from '@/lib/paperTrailDocumentUi'

const TYPE_FILTER: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'estimate', label: 'Estimates' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'change_order', label: 'Change Orders' },
  { value: 'bid_package', label: 'Bid Packages' },
  { value: 'receipt', label: 'Receipts' },
]

const PAPER_TRAIL_RETENTION_HINT =
  'Documents are kept permanently for legal and tax purposes. You can archive to hide from view.'

const STATUS_FILTER: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Denied' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'scanned', label: 'Scanned' },
  { value: 'added', label: 'Added' },
  { value: 'recorded', label: 'Recorded' },
  { value: 'changes_requested', label: 'Requested Edit' },
  { value: 'bid_received', label: 'Bid received' },
  { value: 'awarded', label: 'Awarded' },
]

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function DocumentsPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PaperTrailDocument[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [storageBytes, setStorageBytes] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<DashboardProject[]>([])

  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [docType, setDocType] = useState('all')
  const [status, setStatus] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [viewerDocId, setViewerDocId] = useState<string | null>(null)
  const [pdfWorkingId, setPdfWorkingId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [linkDoc, setLinkDoc] = useState<PaperTrailDocument | null>(null)
  const [linkProjectId, setLinkProjectId] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)
  const [backfillWorking, setBackfillWorking] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(searchInput.trim()), 320)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.documents.list({
        q: searchDebounced || undefined,
        document_type: docType,
        status,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        project_id: projectFilter,
        show_archived: showArchived,
      })
      setRows(res.documents)
      setTotalCount(res.total_count)
      setStorageBytes(res.storage_bytes_estimate)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setRows([])
      setTotalCount(0)
      setStorageBytes(0)
    } finally {
      setLoading(false)
    }
  }, [searchDebounced, docType, status, dateFrom, dateTo, projectFilter, showArchived])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  useEffect(() => {
    api.projects
      .list()
      .then(setProjects)
      .catch(() => setProjects([]))
  }, [])

  useEffect(() => {
    if (!menuOpenId) return
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      const wrap = t.closest('[data-documents-row-menu]') as HTMLElement | null
      if (wrap && wrap.getAttribute('data-documents-row-menu') === menuOpenId) return
      setMenuOpenId(null)
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [menuOpenId])

  const projectLabel = useCallback((doc: PaperTrailDocument) => {
    const meta = doc.metadata && typeof doc.metadata === 'object' ? (doc.metadata as Record<string, unknown>) : {}
    const origName =
      typeof meta.original_project_name === 'string' && meta.original_project_name.trim()
        ? meta.original_project_name.trim()
        : null
    const hadProjectDeleted = Boolean(meta.original_project_id)
    if (!doc.project_id) {
      if (origName || hadProjectDeleted) {
        return {
          text: origName || 'Former project',
          unlinked: true as const,
          projectDeleted: true as const,
        }
      }
      return { text: '—', unlinked: true as const }
    }
    const name = doc.project_name?.trim()
    return { text: name || 'Project', unlinked: false as const }
  }, [])

  const pdfNameFor = (doc: PaperTrailDocument) =>
    doc.project_name?.trim() || (doc.project_id ? 'Project' : 'Unlinked')

  const onView = (doc: PaperTrailDocument) => {
    setViewerDocId(doc.id)
  }

  const onPdf = async (doc: PaperTrailDocument) => {
    setPdfWorkingId(doc.id)
    try {
      await downloadDocumentPdf(doc, pdfNameFor(doc))
    } catch (err) {
      console.error(err)
    } finally {
      setPdfWorkingId(null)
    }
  }

  const onArchive = async (doc: PaperTrailDocument) => {
    setMenuOpenId(null)
    try {
      await api.documents.update(doc.id, { archived: true })
      await fetchList()
    } catch (e) {
      console.error(e)
    }
  }

  const onUnarchive = async (doc: PaperTrailDocument) => {
    setMenuOpenId(null)
    try {
      await api.documents.update(doc.id, { archived: false })
      await fetchList()
    } catch (e) {
      console.error(e)
    }
  }

  const openLinkModal = (doc: PaperTrailDocument) => {
    setMenuOpenId(null)
    setLinkDoc(doc)
    setLinkProjectId(projects[0]?.id ?? '')
  }

  const runBackfill = async () => {
    setBackfillWorking(true)
    setBackfillMsg(null)
    try {
      const r = await api.documents.backfill({ demo: true })
      const parts: string[] = []
      if (r.estimates) parts.push(`${r.estimates} estimate${r.estimates === 1 ? '' : 's'}`)
      if (r.invoices) parts.push(`${r.invoices} invoice${r.invoices === 1 ? '' : 's'}`)
      if (r.bid_packages) parts.push(`${r.bid_packages} bid package${r.bid_packages === 1 ? '' : 's'}`)
      if (r.demo) parts.push(`${r.demo} demo receipt`)
      setBackfillMsg(
        parts.length
          ? `Imported ${parts.join(', ')}.`
          : 'Nothing new to import (history may already be in paper trail).'
      )
      if (r.errors.length) {
        setBackfillMsg((prev) => `${prev} ${r.errors.slice(0, 2).join('; ')}`)
      }
      await fetchList()
    } catch (e) {
      setBackfillMsg(e instanceof Error ? e.message : 'Backfill failed')
    } finally {
      setBackfillWorking(false)
    }
  }

  const submitLink = async () => {
    if (!linkDoc || !linkProjectId.trim()) return
    setLinkSaving(true)
    try {
      await api.documents.update(linkDoc.id, { project_id: linkProjectId.trim() })
      setLinkDoc(null)
      await fetchList()
    } catch (e) {
      console.error(e)
    } finally {
      setLinkSaving(false)
    }
  }

  const toolbarSelectClass =
    'rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-primary)] text-[13px] px-2.5 py-1.5 min-w-0'

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [projects]
  )

  return (
    <div className="dashboard-app estimates-page documents-tab flex flex-col min-h-0 flex-1">
      <div className="documents-page">
        <div className="documents-page__wrap w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
          <header className="documents-top">
            <div>
              <h1 className="dashboard-title m-0">Documents</h1>
              <p className="documents-top__meta m-0">
                {loading ? (
                  'Loading…'
                ) : (
                  <>
                    <span className="tabular-nums">{totalCount}</span> documents
                    <span className="mx-2 opacity-40">·</span>
                    <span className="tabular-nums">{formatBytes(storageBytes)}</span>
                    {error ? <span className="text-red-600 ml-3">{error}</span> : null}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              className="documents-filters-btn"
              onClick={() => setShowFilters((s) => !s)}
            >
              ⚙ Filters
            </button>
          </header>

          <div className="documents-search-wrap">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Title, client, or sub name"
              className="documents-search-input"
            />
          </div>

          <div className="documents-chip-row">
            <button
              type="button"
              className={`documents-chip ${docType === 'all' ? 'active' : ''}`}
              onClick={() => setDocType('all')}
            >
              All types
            </button>
            <button
              type="button"
              className={`documents-chip ${docType === 'estimate' ? 'active' : ''}`}
              onClick={() => setDocType('estimate')}
            >
              Estimates
            </button>
            <button
              type="button"
              className={`documents-chip ${docType === 'bid_package' ? 'active' : ''}`}
              onClick={() => setDocType('bid_package')}
            >
              Bid Packages
            </button>
          </div>

          {showFilters ? (
            <div className="documents-advanced-filters">
              <label className="flex flex-col gap-1 min-w-[160px]">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</span>
                <select className={toolbarSelectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_FILTER.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 min-w-[180px]">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Project</span>
                <select className={toolbarSelectClass} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                  <option value="all">All projects</option>
                  <option value="unlinked">Unlinked</option>
                  {sortedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">From</span>
                <input type="date" className={toolbarSelectClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">To</span>
                <input type="date" className={toolbarSelectClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none pt-5">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="rounded border-[var(--border)]"
                />
                <span className="text-[13px] text-[var(--text-secondary)]">Show archived</span>
              </label>
            </div>
          ) : null}

          {loading && rows.length === 0 ? (
            <LoadingSkeleton variant="page" className="min-h-[40vh]" />
          ) : (
            <div className="documents-list-shell">
              {rows.length === 0 ? (
                <div className="documents-table-empty">
                  <p className="m-0 mb-3">No documents match these filters.</p>
                  <p className="m-0 mb-3 text-[12px] text-[var(--text-muted)] max-w-md">
                    Import rows from sent estimates, invoices, and dispatched bid packages. If you have no history yet,
                    we can add a sample receipt so you can preview the table and viewer.
                  </p>
                  <button
                    type="button"
                    className="documents-btn documents-btn-primary text-[13px]"
                    disabled={backfillWorking}
                    onClick={() => void runBackfill()}
                  >
                    {backfillWorking ? 'Importing…' : 'Import paper trail / demo sample'}
                  </button>
                  {backfillMsg ? <p className="m-0 mt-3 text-[13px] text-[var(--text-secondary)]">{backfillMsg}</p> : null}
                </div>
              ) : (
                rows.map((doc) => {
                  const pl = projectLabel(doc)
                  const archived = !!doc.archived_at
                  const projectDeleted = 'projectDeleted' in pl && pl.projectDeleted
                  const meta = doc.metadata && typeof doc.metadata === 'object' ? doc.metadata : null
                  const origId =
                    meta && 'original_project_id' in meta && meta.original_project_id != null
                      ? String(meta.original_project_id)
                      : undefined
                  return (
                    <div
                      key={doc.id}
                      role="button"
                      tabIndex={0}
                      className={`documents-list-row ${archived ? 'archived' : ''} ${projectDeleted ? 'unlinked' : ''}`}
                      onClick={() => onView(doc)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onView(doc)
                        }
                      }}
                    >
                      <div className="documents-list-row__main">
                        <div className="documents-list-row__line1">
                          <div className="documents-list-row__title">{doc.title || '—'}</div>
                          <div className="documents-list-row__amount">{formatMoney(doc.total_amount)}</div>
                          <div className="relative inline-block documents-list-row__menu-wrap" data-documents-row-menu={doc.id}>
                            <button
                              type="button"
                              className="documents-row-menu-trigger"
                              aria-label="More actions"
                              onClick={(e) => {
                                e.stopPropagation()
                                setMenuOpenId((id) => (id === doc.id ? null : doc.id))
                              }}
                            >
                              •••
                            </button>
                            {menuOpenId === doc.id ? (
                              <div
                                className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg py-1 text-left"
                                role="menu"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p
                                  className="px-3 py-2 text-[11px] text-[var(--text-muted)] m-0 border-b border-[var(--border)] leading-snug"
                                  title={PAPER_TRAIL_RETENTION_HINT}
                                >
                                  No delete — archive to hide. Records kept for legal and tax purposes.
                                </p>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--bg-base)] bg-transparent border-none cursor-pointer"
                                  onClick={() => {
                                    onView(doc)
                                    setMenuOpenId(null)
                                  }}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--bg-base)] bg-transparent border-none cursor-pointer"
                                  onClick={() => {
                                    void onPdf(doc)
                                    setMenuOpenId(null)
                                  }}
                                  disabled={pdfWorkingId === doc.id}
                                >
                                  {pdfWorkingId === doc.id ? 'Preparing PDF…' : 'Download PDF'}
                                </button>
                                {!archived ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--bg-base)] bg-transparent border-none cursor-pointer"
                                    title={PAPER_TRAIL_RETENTION_HINT}
                                    onClick={() => void onArchive(doc)}
                                  >
                                    Archive
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--bg-base)] bg-transparent border-none cursor-pointer"
                                    onClick={() => void onUnarchive(doc)}
                                  >
                                    Restore
                                  </button>
                                )}
                                {!doc.project_id ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--bg-base)] bg-transparent border-none cursor-pointer"
                                    onClick={() => openLinkModal(doc)}
                                  >
                                    Link to project
                                  </button>
                                ) : (
                                  <Link
                                    to={`/projects/${doc.project_id}?tab=documents`}
                                    className="w-full block text-left px-3 py-2 text-[13px] hover:bg-[var(--bg-base)] text-[var(--text-primary)] no-underline"
                                    onClick={() => setMenuOpenId(null)}
                                  >
                                    Open project
                                  </Link>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="documents-list-row__meta">
                          <span>{documentTypeLabel(doc.document_type as PaperDocumentType)}</span>
                          <span>·</span>
                          <span className="truncate">{recipientLabel(doc)}</span>
                          <span>·</span>
                          <span>{displayDate(doc)}</span>
                        </div>
                        <div className="documents-list-row__actions" onClick={(e) => e.stopPropagation()}>
                          <span className={`${statusBadgeClass(doc.status)} documents-status-pill-compact`}>{statusDisplayLabel(doc.status)}</span>
                          {projectDeleted ? (
                            <span className="documents-unlinked-badge documents-unlinked-badge--compact" title={origId ? `Former project id: ${origId}` : undefined}>
                              Project deleted
                            </span>
                          ) : pl.unlinked ? (
                            <span className="documents-unlinked-badge documents-unlinked-badge--muted documents-unlinked-badge--compact">Unlinked</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      <DocumentViewer documentId={viewerDocId} onClose={() => setViewerDocId(null)} />

      {linkDoc ? (
        <div
          className="documents-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Link document to project"
          onClick={() => !linkSaving && setLinkDoc(null)}
        >
          <div className="documents-preview-panel max-w-[420px]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="documents-preview-close"
              onClick={() => !linkSaving && setLinkDoc(null)}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="mt-0">Link to project</h3>
            <p className="text-sm text-[var(--text-muted)] m-0 mb-4">
              Re-associate this document with a project. Use when a job was removed by mistake.
            </p>
            <label className="flex flex-col gap-1 mb-4">
              <span className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">Project</span>
              {sortedProjects.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] m-0">No projects yet. Create one from the Projects page.</p>
              ) : (
                <select
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-[13px]"
                  value={linkProjectId}
                  onChange={(e) => setLinkProjectId(e.target.value)}
                >
                  {sortedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="documents-btn" onClick={() => setLinkDoc(null)} disabled={linkSaving}>
                Cancel
              </button>
              <button
                type="button"
                className="documents-btn documents-btn-primary"
                onClick={() => void submitLink()}
                disabled={linkSaving || !linkProjectId || sortedProjects.length === 0}
              >
                {linkSaving ? 'Saving…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
