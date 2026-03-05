import { useState, useEffect } from 'react'
import type { BudgetLineItem } from '@/types/global'

interface BudgetLineItemsProps {
  items: BudgetLineItem[]
  onSave: (items: BudgetLineItem[]) => Promise<void>
}

export function BudgetLineItems({ items, onSave }: BudgetLineItemsProps) {
  const [list, setList] = useState<BudgetLineItem[]>(items)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setList(items)
  }, [items])

  const addRow = () => {
    setList((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        project_id: '',
        label: '',
        predicted: 0,
        actual: 0,
        category: 'other',
      },
    ])
  }

  const update = (id: string, field: keyof BudgetLineItem, value: string | number) => {
    setList((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    )
  }

  const remove = (id: string) => {
    setList((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(list)
    } finally {
      setSaving(false)
    }
  }

  const predictedTotal = list.reduce((s, i) => s + Number(i.predicted || 0), 0)
  const actualTotal = list.reduce((s, i) => s + Number(i.actual || 0), 0)

  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-4 shadow-card overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white">Budget line items</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addRow}
            className="text-sm px-3 py-1.5 rounded-md border border-border dark:border-border-dark text-muted dark:text-white-dim hover:bg-surface dark:hover:bg-dark-4"
          >
            Add row
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border dark:border-border-dark">
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim">Label</th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim">Category</th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim text-right">Predicted</th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim text-right">Actual</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {list.map((row) => (
            <tr key={row.id} className="border-b border-border dark:border-border-dark last:border-0">
              <td className="py-2 pr-2">
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => update(row.id, 'label', e.target.value)}
                  className="w-full rounded px-2 py-1 bg-surface dark:bg-dark-4 border border-border dark:border-border-dark text-gray-900 dark:text-landing-white"
                  placeholder="Line item"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="text"
                  value={row.category}
                  onChange={(e) => update(row.id, 'category', e.target.value)}
                  className="w-full rounded px-2 py-1 bg-surface dark:bg-dark-4 border border-border dark:border-border-dark text-gray-900 dark:text-landing-white"
                  placeholder="Category"
                />
              </td>
              <td className="py-2 pr-2 text-right">
                <input
                  type="number"
                  value={row.predicted || ''}
                  onChange={(e) => update(row.id, 'predicted', Number(e.target.value) || 0)}
                  className="w-24 rounded px-2 py-1 bg-surface dark:bg-dark-4 border border-border dark:border-border-dark text-gray-900 dark:text-landing-white text-right"
                />
              </td>
              <td className="py-2 pr-2 text-right">
                <input
                  type="number"
                  value={row.actual || ''}
                  onChange={(e) => update(row.id, 'actual', Number(e.target.value) || 0)}
                  className="w-24 rounded px-2 py-1 bg-surface dark:bg-dark-4 border border-border dark:border-border-dark text-gray-900 dark:text-landing-white text-right"
                />
              </td>
              <td className="py-2">
                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  className="text-red-500 hover:text-red-600 text-xs"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex justify-end gap-4 text-sm text-muted dark:text-white-dim">
        <span>Predicted total: ${predictedTotal.toLocaleString()}</span>
        <span>Actual total: ${actualTotal.toLocaleString()}</span>
      </div>
    </div>
  )
}
