import { useState, useRef } from 'react'
import { api } from '@/api/client'
import { parseScheduleExcel } from '@/lib/parseScheduleExcel'

interface ImportScheduleModalProps {
  projectId: string
  projectStartDate?: string
  onClose: () => void
  onImported: () => void
}

/**
 * Upload Custom Build Schedule (Excel). Parses phases and tasks, creates them via API.
 */
export function ImportScheduleModal({ projectId, projectStartDate, onClose, onImported }: ImportScheduleModalProps) {
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const { phases, tasks } = parseScheduleExcel(buffer, projectStartDate)

      const phaseIds: string[] = []
      for (const p of phases) {
        const created = await api.projects.createPhase(projectId, {
          name: p.name,
          start_date: p.start_date,
          end_date: p.end_date,
          order: p.order,
        })
        phaseIds.push(created.id)
      }

      for (const t of tasks) {
        const phaseId = t.phaseIndex >= 0 && t.phaseIndex < phaseIds.length ? phaseIds[t.phaseIndex] : undefined
        await api.projects.createTask(projectId, {
          phase_id: phaseId,
          title: t.title,
          responsible: t.responsible,
          start_date: t.start_date,
          end_date: t.end_date,
          duration_weeks: t.duration_weeks,
          order: t.order,
        })
      }

      onImported()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-6 shadow-lg max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-2">Import schedule</h2>
        <p className="text-sm text-muted dark:text-white-dim mb-4">
          Upload a Custom Home Construction Schedule (Excel). Columns: #, PHASE/TASK, RESP., DURATION (WKS), START WK, END WK. Start Date from the sheet or project start is used to convert weeks to calendar dates.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={handleFile}
          className="block w-full text-sm text-gray-600 dark:text-white-dim file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white file:font-medium"
        />
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {importing && <p className="mt-2 text-sm text-muted dark:text-white-faint">Importing…</p>}
        <div className="flex justify-end mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border dark:border-border-dark text-muted dark:text-white-dim hover:bg-gray-100 dark:hover:bg-dark-4">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
