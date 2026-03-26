import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import type { PaperDocumentType, PaperTrailDocument } from '@/types/global'
import { DocumentViewer } from '@/components/documents/DocumentViewer'
import {
  DocTypeIcon,
  downloadDocumentPdf,
  formatMoney,
  recipientLabel,
  sentLabel,
  statusBadgeClass,
  statusDisplayLabel,
} from '@/lib/paperTrailDocumentUi'

const GROUPS: { label: string; types: PaperDocumentType[] }[] = [
  { label: 'Estimates', types: ['estimate'] },
  { label: 'Invoices', types: ['invoice'] },
  { label: 'Change Orders', types: ['change_order'] },
  { label: 'Bid Packages', types: ['bid_package'] },
  { label: 'Receipts', types: ['receipt'] },
  { label: 'Other documents', types: ['sub_contract'] },
]

const PAPER_TRAIL_RETENTION_HINT =
  'Documents are kept permanently for legal and tax purposes. You can archive to hide from view.'

export interface ProjectDocumentsTabProps {
  projectId: string
  projectName: string
  refreshTrigger: number
}

export function ProjectDocumentsTab({ projectId, projectName, refreshTrigger }: ProjectDocumentsTabProps) {
  const [docs, setDocs] = useState<PaperTrailDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewerDocId, setViewerDocId] = useState<string | null>(null)
  const [pdfWorkingId, setPdfWorkingId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api.projects
      .getDocuments(projectId, { show_archived: showArchived })
      .then(setDocs)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load documents')
        setDocs([])
      })
      .finally(() => setLoading(false))
  }, [projectId, showArchived])

  useEffect(() => {
    load()
  }, [load, refreshTrigger])

  const summary = useMemo(() => {
    let estimated = 0
    let invoiced = 0
    let collected = 0
    let receipts = 0
    for (const d of docs) {
      const amt = d.total_amount != null ? Number(d.total_amount) : 0
      if (!Number.isFinite(amt)) continue
      switch (d.document_type) {
        case 'estimate':
        case 'change_order':
          estimated += amt
          break
        case 'invoice':
          invoiced += amt
          if ((d.status || '').toLowerCase() === 'paid') collected += amt
          break
        case 'receipt':
          receipts += amt
          break
        default:
          break
      }
    }
    return { estimated, invoiced, collected, receipts }
  }, [docs])

  const grouped = useMemo(() => {
    const byType = new Map<PaperDocumentType, PaperTrailDocument[]>()
    for (const d of docs) {
      const list = byType.get(d.document_type) ?? []
      list.push(d)
      byType.set(d.document_type, list)
    }
    return GROUPS.map((g) => ({
      ...g,
      items: g.types.flatMap((t) => byType.get(t) ?? []),
    })).filter((g) => g.items.length > 0)
  }, [docs])

  const openView = (doc: PaperTrailDocument) => {
    setViewerDocId(doc.id)
  }

  const handlePdf = async (doc: PaperTrailDocument) => {
    setPdfWorkingId(doc.id)
    try {
      await downloadDocumentPdf(doc, projectName)
    } catch (e) {
      console.error(e)
    } finally {
      setPdfWorkingId(null)
    }
  }

  const handleArchive = async (doc: PaperTrailDocument) => {
    try {
      await api.documents.update(doc.id, { archived: true })
      await load()
    } catch (e) {
      console.error(e)
    }
  }

  const handleRestore = async (doc: PaperTrailDocument) => {
    try {
      await api.documents.update(doc.id, { archived: false })
      await load()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="documents-tab budget-tab">
      <div className="documents-summary-row">
        <div className="documents-summary-card">
          <div className="documents-summary-label">Total estimated (sent)</div>
          <div className="documents-summary-value">{formatMoney(summary.estimated)}</div>
        </div>
        <div className="documents-summary-card">
          <div className="documents-summary-label">Total invoiced</div>
          <div className="documents-summary-value">{formatMoney(summary.invoiced)}</div>
        </div>
        <div className="documents-summary-card">
          <div className="documents-summary-label">Total collected</div>
          <div className="documents-summary-value">{formatMoney(summary.collected)}</div>
        </div>
        <div className="documents-summary-card">
          <div className="documents-summary-label">Receipts logged</div>
          <div className="documents-summary-value">{formatMoney(summary.receipts)}</div>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none mb-4">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="rounded border-[var(--border)]"
        />
        <span className="text-[13px] text-[var(--text-secondary)]">Show archived</span>
      </label>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)] m-0">Loading documents…</p>
      ) : error ? (
        <p className="text-sm text-red-600 m-0">{error}</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] m-0">
          No paper-trail documents yet. Sending estimates, invoices, bid packages, or scanning receipts will appear here.
        </p>
      ) : (
        grouped.map((group, gi) => (
          <details key={group.label} className="documents-group" open={gi === 0}>
            <summary className="documents-group-summary">
              <span>
                {group.label}
                <span className="text-[var(--text-muted)] font-normal text-[13px] ml-2">({group.items.length})</span>
              </span>
            </summary>
            <div className="documents-group-body">
              {group.items.map((doc) => {
                const archived = !!doc.archived_at
                const isDraft = (doc.status || '').toLowerCase() === 'draft'
                const pdfBusy = pdfWorkingId === doc.id
                return (
                  <div key={doc.id} className={`documents-row ${archived ? 'documents-row--archived' : ''}`}>
                    <div className="documents-type-icon" title={doc.document_type}>
                      <DocTypeIcon type={doc.document_type} />
                    </div>
                    <div className="documents-row-title" title={doc.title || ''}>
                      {doc.title || doc.document_type}
                    </div>
                    <div className="documents-row-recipient text-[var(--text-secondary)] min-w-0 truncate">{recipientLabel(doc)}</div>
                    <div className="documents-row-amount font-mono text-[13px] tabular-nums font-semibold text-[var(--text-primary)]">
                      {formatMoney(doc.total_amount)}
                    </div>
                    <div className="documents-row-date text-[12px] text-[var(--text-muted)]">{sentLabel(doc)}</div>
                    <div className="documents-row-actions">
                      <span className={`documents-row-status ${statusBadgeClass(doc.status)}`}>{statusDisplayLabel(doc.status)}</span>
                      <div className="documents-row-btns">
                        <button type="button" className="documents-btn documents-btn-primary" onClick={() => openView(doc)}>
                          View
                        </button>
                        <button
                          type="button"
                          className="documents-btn documents-btn-outline"
                          onClick={() => void handlePdf(doc)}
                          disabled={pdfBusy || isDraft}
                          title={isDraft ? 'Save and send the document first' : undefined}
                        >
                          {pdfBusy ? (
                            '…'
                          ) : (
                            <>
                              <span className="documents-btn-pdf-full">Download PDF</span>
                              <span className="documents-btn-pdf-short">PDF</span>
                            </>
                          )}
                        </button>
                        {!archived ? (
                          <button
                            type="button"
                            className="documents-btn documents-btn-outline"
                            title={PAPER_TRAIL_RETENTION_HINT}
                            onClick={() => void handleArchive(doc)}
                            disabled={isDraft}
                          >
                            Archive
                          </button>
                        ) : (
                          <button type="button" className="documents-btn documents-btn-outline" onClick={() => void handleRestore(doc)}>
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </details>
        ))
      )}
      <DocumentViewer documentId={viewerDocId} onClose={() => setViewerDocId(null)} />
    </div>
  )
}
