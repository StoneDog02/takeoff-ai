import { useState } from 'react'

interface RevenueExportProps {
  onExportCSV: () => void
  onExportPDF: () => void
}

export function RevenueExport({ onExportCSV, onExportPDF }: RevenueExportProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-sm"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-surface-elevated py-1 shadow-lg min-w-[160px]">
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm hover:bg-surface dark:hover:bg-dark-4"
              onClick={() => {
                onExportCSV()
                setOpen(false)
              }}
            >
              Download CSV
            </button>
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm hover:bg-surface dark:hover:bg-dark-4"
              onClick={() => {
                onExportPDF()
                setOpen(false)
              }}
            >
              Download PDF
            </button>
          </div>
        </>
      )}
    </div>
  )
}
