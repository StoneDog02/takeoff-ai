import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { MaterialList, TakeoffItem } from '@/types/global'
import { dayjs } from '@/lib/date'
import { api } from '@/api/client'

const PROGRESS_MESSAGES = [
  'Uploading plan…',
  'Analyzing drawings…',
  'Extracting dimensions…',
  'Identifying materials…',
  'Building material list…',
]
const PROGRESS_CAP = 90
const PROGRESS_INTERVAL_MS = 800
const PROGRESS_STEP = 4
const SIDEBAR_PAGE_SIZE = 10

export type TakeoffPlanType = 'residential' | 'commercial' | 'civil' | 'auto'

/** Single trade key, or array of keys; null = all trades. */
export type TakeoffTradeFilter = null | string | string[]

interface LaunchTakeoffWidgetProps {
  projectId: string
  /** Plan type from project (set in project creation). Used for takeoff reference docs and skills. */
  planType: TakeoffPlanType
  onUpload: (file: File, planType: TakeoffPlanType, tradeFilter?: TakeoffTradeFilter) => Promise<{ material_list: MaterialList }>
  existingTakeoffs?: { id: string; material_list: MaterialList; created_at: string }[]
}

/** Group items by subcategory (if any), else by trade_tag. Returns array of { label, items }. */
function groupItemsBySubcategory(items: TakeoffItem[]): { label: string; items: TakeoffItem[] }[] {
  const list = items || []
  const useSubcategory = list.some((it) => (it.subcategory ?? '').trim() !== '')
  const groups = new Map<string, TakeoffItem[]>()
  for (const it of list) {
    const key = useSubcategory
      ? (it.subcategory ?? '').trim() || 'General'
      : it.trade_tag?.trim() || 'TBD'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(it)
  }
  const keys = Array.from(groups.keys()).sort((a, b) =>
    a === 'General' || a === 'TBD' ? 1 : b === 'General' || b === 'TBD' ? -1 : a.localeCompare(b)
  )
  return keys.map((label) => ({ label, items: groups.get(label)! }))
}

/** Build and download a PDF of the full takeoff (all categories, grouped by subcategory). */
async function downloadTakeoffPdf(categories: { name: string; items: TakeoffItem[] }[]) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const internal = (doc as unknown as { internal: { pageSize: { getWidth: () => number; getHeight: () => number } } }).internal
  const pageWidth = internal.pageSize.getWidth()
  const pageHeight = internal.pageSize.getHeight()
  const margin = 14
  const marginBottom = 20
  let y = margin
  const lineHeight = 5
  const tableLineHeight = 5.5

  const maybeNewPage = (needed: number) => {
    if (y + needed > pageHeight - marginBottom) {
      doc.addPage('a4', 'landscape')
      y = margin
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text('Material Takeoff (continued)', margin, y)
      y += lineHeight + 2
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Material Takeoff', margin, y)
  y += lineHeight + 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated ${dayjs().format('MMM D, YYYY h:mm A')}`, margin, y)
  doc.setTextColor(0, 0, 0)
  y += lineHeight + 6

  const colDesc = margin
  const colQty = pageWidth - margin - 28
  const colUnit = pageWidth - margin - 14
  const descMaxWidth = colQty - colDesc - 4

  for (const cat of categories) {
    maybeNewPage(25)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(cat.name, margin, y)
    y += lineHeight + 4

    const groups = groupItemsBySubcategory(cat.items ?? [])
    for (const { label, items: groupItems } of groups) {
      maybeNewPage(15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(60, 60, 60)
      doc.text(label, margin + 2, y)
      doc.setTextColor(0, 0, 0)
      y += lineHeight + 2

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Description', colDesc, y)
      doc.text('Qty', colQty, y)
      doc.text('Unit', colUnit, y)
      y += tableLineHeight

      for (const item of groupItems) {
        maybeNewPage(tableLineHeight * 2)
        const desc = String(item.description ?? '').trim() || '—'
        const lines = doc.splitTextToSize(desc, descMaxWidth)
        doc.text(lines, colDesc, y)
        doc.text(String(Number(item.quantity) ?? 0).toLocaleString(), colQty, y)
        doc.text(String(item.unit ?? '').trim() || '—', colUnit, y)
        y += tableLineHeight * Math.max(1, lines.length)
      }
      y += 4
    }
    y += 6
  }

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 8)
  }

  doc.save(`material-takeoff-${dayjs().format('YYYY-MM-DD-HHmm')}.pdf`)
}

function TakeoffTable({ items }: { items: TakeoffItem[] }) {
  const groups = groupItemsBySubcategory(items)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="bg-muted/30 dark:bg-dark-4">
            <th className="px-4 py-3 font-semibold text-muted dark:text-white-dim text-xs uppercase tracking-wider">
              Description
            </th>
            <th className="px-4 py-3 font-semibold text-muted dark:text-white-dim text-xs uppercase tracking-wider text-right w-20">
              Qty
            </th>
            <th className="px-4 py-3 font-semibold text-muted dark:text-white-dim text-xs uppercase tracking-wider w-16">
              Unit
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ label, items: groupItems }) => (
            <React.Fragment key={label}>
              <tr className="bg-slate-100 dark:bg-dark-4">
                <td colSpan={3} className="px-4 py-2.5 font-bold text-gray-900 dark:text-landing-white text-xs uppercase tracking-wider">
                  {label}
                </td>
              </tr>
              {groupItems.map((item: TakeoffItem, i: number) => (
                <tr
                  key={`${label}-${i}`}
                  className="hover:bg-muted/20 dark:hover:bg-white-faint/5 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-900 dark:text-landing-white leading-snug">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-landing-white">
                    {Number(item.quantity).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted dark:text-white-dim text-xs">
                    {item.unit}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LaunchTakeoffWidget({
  projectId: _projectId,
  planType,
  onUpload,
  existingTakeoffs = [],
}: LaunchTakeoffWidgetProps) {
  const [file, setFile] = useState<File | null>(null)
  const [tradeOptions, setTradeOptions] = useState<{ key: string; label: string }[]>([])
  const [tradeFilter, setTradeFilter] = useState<TakeoffTradeFilter>(null)
  const [tradeDropdownOpen, setTradeDropdownOpen] = useState(false)
  const tradeDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tradeDropdownRef.current && !tradeDropdownRef.current.contains(e.target as Node)) {
        setTradeDropdownOpen(false)
      }
    }
    if (tradeDropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [tradeDropdownOpen])

  const tradeTriggerLabel =
    tradeFilter === null
      ? 'All Trades (Full Takeoff)'
      : Array.isArray(tradeFilter)
        ? tradeFilter.length === 0
          ? 'All Trades (Full Takeoff)'
          : tradeFilter.length === 1
            ? tradeOptions.find((t) => t.key === tradeFilter[0])?.label ?? tradeFilter[0]
            : `${tradeFilter.length} trades selected`
        : tradeOptions.find((t) => t.key === tradeFilter)?.label ?? String(tradeFilter)

  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState(PROGRESS_MESSAGES[0])
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<MaterialList | null>(null)
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0)
  const [sidebarPage, setSidebarPage] = useState(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messageIndexRef = useRef(0)

  useEffect(() => {
    api.projects.getTrades().then((list) => setTradeOptions(list)).catch(() => setTradeOptions([]))
  }, [])

  const latestTakeoff = lastResult
    ? { material_list: lastResult, created_at: dayjs().toISOString() }
    : existingTakeoffs[0]
  const categories = latestTakeoff?.material_list?.categories ?? []

  useEffect(() => {
    setActiveCategoryIndex(0)
    setSidebarPage(1)
  }, [lastResult])

  const totalSidebarPages = Math.max(1, Math.ceil(categories.length / SIDEBAR_PAGE_SIZE))
  const sidebarStart = (sidebarPage - 1) * SIDEBAR_PAGE_SIZE
  const visibleCategories = categories.slice(sidebarStart, sidebarStart + SIDEBAR_PAGE_SIZE)

  const handleDownloadPdf = useCallback(() => {
    downloadTakeoffPdf(categories).catch((err) => {
      console.error('PDF download failed:', err)
    })
  }, [categories])

  useEffect(() => {
    if (!processing) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      return
    }
    setProgress(0)
    messageIndexRef.current = 0
    setProgressMessage(PROGRESS_MESSAGES[0])
    progressIntervalRef.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + PROGRESS_STEP, PROGRESS_CAP)
        const idx = Math.min(Math.floor(next / 20), PROGRESS_MESSAGES.length - 1)
        if (idx !== messageIndexRef.current) {
          messageIndexRef.current = idx
          setProgressMessage(PROGRESS_MESSAGES[idx])
        }
        return next
      })
    }, PROGRESS_INTERVAL_MS)
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [processing])

  /** Normalize API material_list so we always have { categories: array, summary? } for the UI. */
  const normalizeMaterialList = (raw: unknown): MaterialList => {
    if (raw && typeof raw === 'object' && Array.isArray((raw as MaterialList).categories)) {
      return raw as MaterialList
    }
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const summary = typeof obj.summary === 'string' ? obj.summary : ''
    return {
      categories: Array.isArray(obj.categories) ? obj.categories : [],
      summary: summary || undefined,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Select a file')
      return
    }
    setError(null)
    setProcessing(true)
    try {
      const { material_list } = await onUpload(file, planType, tradeFilter)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setProgress(100)
      setProgressMessage('Complete')
      setLastResult(normalizeMaterialList(material_list))
      await new Promise((r) => setTimeout(r, 600))
    } catch (err) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setProcessing(false)
      setProgress(0)
    }
  }

  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-4 shadow-card">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-3">Launch Takeoff</h2>
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-muted dark:text-white-dim">
          Upload PDF blueprints/plans to generate a structured material takeoff with trade tags and cost estimates.
        </p>
        <button
          type="submit"
          form="launch-takeoff-form"
          disabled={!file || processing}
          className="flex-shrink-0 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {processing ? 'Running takeoff…' : 'Run takeoff'}
        </button>
      </div>
      <form id="launch-takeoff-form" onSubmit={handleSubmit} className="mb-4">
        <div className="mb-4" ref={tradeDropdownRef}>
          <p className="text-xs font-semibold text-muted dark:text-white-dim uppercase tracking-wider mb-2">Trade scope</p>
          <p className="text-sm text-muted dark:text-white-dim mb-2">
            Optionally limit the takeoff to one or more trades. Default: all trades.
          </p>
          <div className="relative w-full max-w-sm">
            <button
              type="button"
              onClick={() => setTradeDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 rounded-md border border-border dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white px-3 py-2 text-sm text-left hover:border-accent/50 transition-colors"
            >
              <span className="truncate">{tradeTriggerLabel}</span>
              <svg
                className={`w-4 h-4 flex-shrink-0 text-muted dark:text-white-dim transition-transform ${tradeDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {tradeDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border dark:border-border-dark bg-white dark:bg-dark-4 shadow-lg max-h-64 overflow-y-auto">
                <label className="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-muted/30 dark:hover:bg-dark-3 border-b border-border dark:border-border-dark">
                  <input
                    type="checkbox"
                    checked={tradeFilter === null}
                    onChange={() => {
                      setTradeFilter(null)
                      setTradeDropdownOpen(false)
                    }}
                    className="rounded border-border dark:border-border-dark"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-landing-white">All Trades (Full Takeoff)</span>
                </label>
                {tradeOptions.map((t) => {
                  const selected = Array.isArray(tradeFilter) ? tradeFilter.includes(t.key) : tradeFilter === t.key
                  return (
                    <label
                      key={t.key}
                      className="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-muted/30 dark:hover:bg-dark-3"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          setTradeFilter((prev) => {
                            const arr = Array.isArray(prev) ? [...prev] : prev ? [prev] : []
                            const idx = arr.indexOf(t.key)
                            if (idx >= 0) {
                              const next = arr.filter((_, i) => i !== idx)
                              return next.length === 0 ? null : next.length === 1 ? next[0] : next
                            }
                            return [...arr, t.key]
                          })
                        }}
                        className="rounded border-border dark:border-border-dark"
                      />
                      <span className="text-sm text-gray-700 dark:text-landing-white">{t.label}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        {(tradeFilter !== null && (Array.isArray(tradeFilter) ? tradeFilter.length > 0 : true)) && (
          <div className="mb-4 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm text-blue-800 dark:text-blue-200">
            <strong>Scoped to:</strong>{' '}
            {Array.isArray(tradeFilter)
              ? tradeFilter
                  .map((k) => tradeOptions.find((t) => t.key === k)?.label ?? k)
                  .join(', ')
              : tradeOptions.find((t) => t.key === tradeFilter)?.label ?? tradeFilter}
          </div>
        )}
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border dark:border-border-dark rounded-lg p-6 text-center cursor-pointer hover:border-accent/50 transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFile(f)
              e.target.value = ''
            }}
          />
          {file ? (
            <p className="text-accent font-medium">{file.name}</p>
          ) : (
            <p className="text-muted dark:text-white-dim">Click or drop PDF here</p>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
      {processing && (
        <div className="mt-4 p-4 rounded-lg bg-muted/30 dark:bg-dark-4 border border-border dark:border-border-dark">
          <p className="text-sm font-medium text-gray-700 dark:text-landing-white mb-2">{progressMessage}</p>
          <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-dark-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted dark:text-white-dim mt-2">{progress}%</p>
        </div>
      )}
      {lastResult !== null && (
        <div className="border-t border-border dark:border-border-dark pt-4 mt-4">
          <div className="flex items-center justify-end gap-2 mb-3">
            {categories.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </button>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-white-dim mb-0 sr-only">
            Takeoff line items
          </h3>
          {categories.length > 0 ? (
          <div className="flex rounded-lg overflow-hidden bg-white dark:bg-dark-3">
            {/* Sidebar: light in light mode, dark in dark mode */}
            <div className="w-[220px] flex-shrink-0 flex flex-col bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/80">
              <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Takeoff sections
                </div>
                {totalSidebarPages > 1 && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarPage((p) => Math.max(1, p - 1))
                        setActiveCategoryIndex(sidebarStart - SIDEBAR_PAGE_SIZE)
                      }}
                      disabled={sidebarPage <= 1}
                      className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label="Previous page"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums min-w-[2.5rem] text-center">
                      {sidebarPage}/{totalSidebarPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarPage((p) => Math.min(totalSidebarPages, p + 1))
                        setActiveCategoryIndex(sidebarStart + SIDEBAR_PAGE_SIZE)
                      }}
                      disabled={sidebarPage >= totalSidebarPages}
                      className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label="Next page"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="py-2">
                {visibleCategories.map((cat, i) => {
                  const globalIndex = sidebarStart + i
                  const isActive = globalIndex === Math.min(activeCategoryIndex, categories.length - 1)
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setActiveCategoryIndex(globalIndex)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm border-l-[3px] transition-all ${
                        isActive
                          ? 'bg-slate-200 dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-semibold border-l-accent'
                          : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-800/50'
                      }`}
                      aria-selected={isActive}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-accent' : 'bg-slate-400 dark:bg-slate-600'
                        }`}
                        aria-hidden
                      />
                      <span className="flex-1 min-w-0 truncate">{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Content: table scrolls internally when many rows */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-dark-3">
              {(() => {
                const activeCat = categories[Math.min(activeCategoryIndex, categories.length - 1)]
                const items = activeCat?.items ?? []
                return (
                  <>
                    <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
                      <span className="text-lg font-bold text-gray-900 dark:text-landing-white">
                        {activeCat?.name ?? '—'}
                      </span>
                      <div className="ml-auto">
                        <span className="text-xs bg-muted/50 dark:bg-dark-4 text-muted dark:text-white-dim px-2.5 py-1 rounded-md font-medium">
                          {items.length} item{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                      <TakeoffTable items={items} />
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
          ) : (
            <div className="rounded-lg border border-border dark:border-border-dark bg-muted/20 dark:bg-dark-4 p-6 text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-landing-white mb-1">Takeoff complete</p>
              <p className="text-sm text-muted dark:text-white-dim mb-3">
                No line items were extracted. Try a different trade scope, or check that the plan contains measurable materials.
              </p>
              {lastResult?.summary && (
                <p className="text-xs text-left text-muted dark:text-white-dim bg-white dark:bg-dark-3 rounded p-3 mt-2">
                  {lastResult.summary}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
