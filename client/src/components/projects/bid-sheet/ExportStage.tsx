import type { BidSheet } from '@/types/global'

interface ExportStageProps {
  bidSheet: BidSheet
  onExportPDF: () => void
  onExportCSV: () => void
  exportingPDF?: boolean
  exportingCSV?: boolean
}

const EXPORT_CARDS = [
  { title: 'Sub Scope Sheets', desc: 'One PDF per trade — scope only, no pricing. Ready to send.', color: 'var(--red)' },
  { title: 'GC Cost Summary', desc: 'Full internal breakdown with bids, margins, and overhead.', color: '#2563EB' },
  { title: 'Homeowner Proposal', desc: 'Clean proposal with outcome-based line items and total.', color: '#16A34A' },
] as const

export function ExportStage({
  bidSheet: _bidSheet,
  onExportPDF,
  onExportCSV,
  exportingPDF,
  exportingCSV,
}: ExportStageProps) {
  return (
    <div>
      <p className="text-sm text-muted mb-6">Export any view at any stage. All exports reflect current data.</p>
      <div className="bidsheet-export-grid">
        <div className="bidsheet-export-card">
          <div className="title">{EXPORT_CARDS[0].title}</div>
          <div className="desc">{EXPORT_CARDS[0].desc}</div>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={onExportPDF} disabled={exportingPDF} style={{ background: EXPORT_CARDS[0].color }}>
              PDF
            </button>
            <button type="button" className="btn-sm">Excel</button>
          </div>
        </div>
        <div className="bidsheet-export-card">
          <div className="title">{EXPORT_CARDS[1].title}</div>
          <div className="desc">{EXPORT_CARDS[1].desc}</div>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={onExportPDF} disabled={exportingPDF} style={{ background: EXPORT_CARDS[1].color }}>
              PDF
            </button>
            <button type="button" className="btn-sm" onClick={onExportCSV} disabled={exportingCSV}>
              {exportingCSV ? 'Exporting…' : 'Excel'}
            </button>
          </div>
        </div>
        <div className="bidsheet-export-card">
          <div className="title">{EXPORT_CARDS[2].title}</div>
          <div className="desc">{EXPORT_CARDS[2].desc}</div>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={onExportPDF} disabled={exportingPDF} style={{ background: EXPORT_CARDS[2].color }}>
              PDF
            </button>
            <button type="button" className="btn-sm">Excel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
