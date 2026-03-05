import { useState, useRef } from 'react'
import type { MaterialList, TakeoffItem } from '@/types/global'
import { dayjs } from '@/lib/date'

interface LaunchTakeoffWidgetProps {
  projectId: string
  onUpload: (file: File) => Promise<{ material_list: MaterialList }>
  existingTakeoffs?: { id: string; material_list: MaterialList; created_at: string }[]
}

function TakeoffTable({ materialList }: { materialList: MaterialList }) {
  const items = materialList.categories?.flatMap((c) => c.items || []) ?? []
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border dark:border-border-dark">
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim">Description</th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim text-right w-20">Qty</th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim w-16">Unit</th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim">Trade</th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim text-right w-24">Est. cost</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: TakeoffItem, i: number) => (
            <tr key={i} className="border-b border-border dark:border-border-dark last:border-0">
              <td className="py-2 pr-2">{item.description}</td>
              <td className="py-2 pr-2 text-right font-medium">{item.quantity}</td>
              <td className="py-2 pr-2 text-muted dark:text-white-dim">{item.unit}</td>
              <td className="py-2 pr-2">
                <span
                  className={
                    (item.trade_tag || '') === 'TBD'
                      ? 'text-amber-600 dark:text-amber-400 font-medium'
                      : ''
                  }
                >
                  {item.trade_tag || 'TBD'}
                </span>
              </td>
              <td className="py-2 pr-2 text-right">
                {item.cost_estimate != null ? `$${Number(item.cost_estimate).toLocaleString()}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LaunchTakeoffWidget({
  projectId: _projectId,
  onUpload,
  existingTakeoffs = [],
}: LaunchTakeoffWidgetProps) {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<MaterialList | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Select a file')
      return
    }
    setError(null)
    setProcessing(true)
    try {
      const { material_list } = await onUpload(file)
      setLastResult(material_list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setProcessing(false)
    }
  }

  const latestTakeoff = lastResult
    ? { material_list: lastResult, created_at: dayjs().toISOString() }
    : existingTakeoffs[0]

  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-4 shadow-card">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-3">Launch Takeoff</h2>
      <p className="text-sm text-muted dark:text-white-dim mb-4">
        Upload PDF blueprints/plans to generate a structured material takeoff with trade tags and cost estimates.
      </p>
      <form onSubmit={handleSubmit} className="mb-4">
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
        <button
          type="submit"
          disabled={!file || processing}
          className="mt-3 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {processing ? 'Processing…' : 'Run takeoff'}
        </button>
      </form>
      {(latestTakeoff?.material_list?.categories?.length ?? 0) > 0 && (
        <div className="border-t border-border dark:border-border-dark pt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-white-dim mb-2">Takeoff line items</h3>
          <TakeoffTable materialList={latestTakeoff!.material_list} />
        </div>
      )}
    </div>
  )
}
