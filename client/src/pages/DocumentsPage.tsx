import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import type { DashboardProject } from '@/api/client'
import type { PaperDocumentType, PaperTrailDocument } from '@/types/global'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { DocumentViewer } from '@/components/documents/DocumentViewer'
import {
  DocTypeIcon,
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
        <div className="estimates-page__wrap w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6 flex flex-col flex-1 min-h-0">
        <header className="mb-6">
          <h1 className="dashboard-title m-0">Documents</h1>
          <p className="text-[var(--text-muted)] text-sm mt-2 m-0">
            {loading ? (
              'Loading…'
            ) : (
              <>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">{totalCount}</span> documents
                <span className="mx-2 opacity-40">·</span>
                <span className="tabular-nums">{formatBytes(storageBytes)}</span> estimated storage
                {error ? <span className="text-red-600 ml-3">{error}</span> : null}
              </>
            )}
          </p>
        </header>

        <div className="documents-toolbar">
          <label className="documents-toolbar__search flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Search</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Title, client, or sub name"
              className={toolbarSelectClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Type</span>
            <select className={toolbarSelectClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {TYPE_FILTER.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</span>
            <select className={toolbarSelectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FILTER.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">From</span>
            <input
              type="date"
              className={toolbarSelectClass}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">To</span>
            <input type="date" className={toolbarSelectClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 min-w-[200px]">
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
          <label className="flex items-center gap-2 cursor-pointer select-none pb-1">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            <span className="text-[13px] text-[var(--text-secondary)]">Show archived</span>
          </label>
        </div>

        {loading && rows.length === 0 ? (
          <LoadingSkeleton variant="page" className="min-h-[40vh]" />
        ) : (
          <div className="documents-table">
            <div className="documents-table-scroll">
              <div className="documents-table-header" role="row">
                <span aria-hidden />
                <span>Type</span>
                <span>Title</span>
                <span>Project</span>
                <span>Recipient</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Date</span>
                <span className="documents-table-cell--actions">Actions</span>
              </div>
              {rows.length === 0 ? (
                <div className="documents-table-row documents-table-row--noninteractive" role="row">
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
                      className={`documents-table-row ${archived ? 'archived' : ''} ${projectDeleted ? 'unlinked' : ''}`}
                      onClick={() => onView(doc)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onView(doc)
                        }
                      }}
                    >
                      <div className="flex items-center justify-center" aria-hidden>
                        <DocTypeIcon type={doc.document_type as PaperDocumentType} />
                      </div>
                      <div className="text-[var(--text-secondary)]">{documentTypeLabel(doc.document_type as PaperDocumentType)}</div>
                      <div className="min-w-0">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-[var(--text-primary)] truncate">{doc.title || '—'}</span>
                          {projectDeleted ? (
                            <span
                              className="documents-unlinked-badge"
                              title="Original project was deleted; document retained with reference in metadata"
                            >
                              Project deleted
                            </span>
                          ) : pl.unlinked ? (
                            <span className="documents-unlinked-badge documents-unlinked-badge--muted" title="Not linked to a project">
                              Unlinked
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="documents-table-cell--project">
                        {projectDeleted ? (
                          <span title={origId ? `Former project id: ${origId}` : undefined}>Project deleted</span>
                        ) : pl.unlinked ? (
                          <span className="text-[var(--text-secondary)] truncate block">{pl.text}</span>
                        ) : (
                          <Link
                            to={`/projects/${doc.project_id}?tab=documents`}
                            className="text-[var(--accent)] hover:underline font-medium truncate block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {pl.text}
                          </Link>
                        )}
                      </div>
                      <div className="text-[var(--text-secondary)] truncate">{recipientLabel(doc)}</div>
                      <div className="font-mono tabular-nums">{formatMoney(doc.total_amount)}</div>
                      <div>
                        <span className={statusBadgeClass(doc.status)}>{statusDisplayLabel(doc.status)}</span>
                      </div>
                      <div className="text-[var(--text-muted)] whitespace-nowrap">{displayDate(doc)}</div>
                      <div className="documents-table-cell--actions flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="documents-btn documents-btn-primary text-[12px] py-1 px-2.5"
                          onClick={() => onView(doc)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="documents-btn text-[12px] py-1 px-2.5"
                          onClick={() => void onPdf(doc)}
                          disabled={pdfWorkingId === doc.id}
                        >
                          {pdfWorkingId === doc.id ? '…' : 'Download PDF'}
                        </button>
                        <div className="relative inline-block" data-documents-row-menu={doc.id}>
                          <button
                            type="button"
                            className="documents-btn text-[12px] py-1 px-2 min-w-[36px]"
                            aria-label="More actions"
                            onClick={() => setMenuOpenId((id) => (id === doc.id ? null : doc.id))}
                          >
                            •••
                          </button>
                          {menuOpenId === doc.id ? (
                            <div
                              className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg py-1 text-left"
                              role="menu"
                            >
                              <p
                                className="px-3 py-2 text-[11px] text-[var(--text-muted)] m-0 border-b border-[var(--border)] leading-snug"
                                title={PAPER_TRAIL_RETENTION_HINT}
                              >
                                No delete — archive to hide. Records kept for legal and tax purposes.
                              </p>
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
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
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
