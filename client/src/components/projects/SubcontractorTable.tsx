import { useState } from 'react'
import type { Subcontractor } from '@/types/global'

interface SubcontractorTableProps {
  subcontractors: Subcontractor[]
  onAdd: (row: { name: string; trade: string; email: string; phone: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onBulkSend: (subIds: string[]) => void
}

export function SubcontractorTable({
  subcontractors,
  onAdd,
  onDelete,
  onBulkSend,
}: SubcontractorTableProps) {
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({ name: '', trade: '', email: '', phone: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === subcontractors.length) setSelected(new Set())
    else setSelected(new Set(subcontractors.map((s) => s.id)))
  }

  const handleAdd = async () => {
    if (!newRow.name.trim() || !newRow.email.trim()) return
    await onAdd(newRow)
    setNewRow({ name: '', trade: '', email: '', phone: '' })
    setAdding(false)
  }

  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-4 shadow-card overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white">Subcontractors</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onBulkSend(Array.from(selected))}
            disabled={selected.size === 0}
            className="text-sm px-3 py-1.5 rounded-md border border-border dark:border-border-dark text-muted dark:text-white-dim hover:bg-surface dark:hover:bg-dark-4 disabled:opacity-50"
          >
            Bulk send ({selected.size})
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover"
          >
            Add sub
          </button>
        </div>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border dark:border-border-dark">
            <th className="pb-2 pr-2">
              <input
                type="checkbox"
                checked={subcontractors.length > 0 && selected.size === subcontractors.length}
                onChange={selectAll}
                className="rounded border-border dark:border-border-dark"
              />
            </th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim">Name</th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim">Trade</th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim">Email</th>
            <th className="pb-2 pr-2 font-medium text-muted dark:text-white-dim">Phone</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {adding && (
            <tr className="border-b border-border dark:border-border-dark bg-surface dark:bg-dark-4">
              <td className="py-2 pr-2" />
              <td className="py-2 pr-2">
                <input
                  value={newRow.name}
                  onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))}
                  placeholder="Name"
                  className="w-full rounded px-2 py-1 bg-white dark:bg-dark-3 border border-border dark:border-border-dark"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  value={newRow.trade}
                  onChange={(e) => setNewRow((r) => ({ ...r, trade: e.target.value }))}
                  placeholder="Trade"
                  className="w-full rounded px-2 py-1 bg-white dark:bg-dark-3 border border-border dark:border-border-dark"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  value={newRow.email}
                  onChange={(e) => setNewRow((r) => ({ ...r, email: e.target.value }))}
                  placeholder="Email"
                  type="email"
                  className="w-full rounded px-2 py-1 bg-white dark:bg-dark-3 border border-border dark:border-border-dark"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  value={newRow.phone}
                  onChange={(e) => setNewRow((r) => ({ ...r, phone: e.target.value }))}
                  placeholder="Phone"
                  className="w-full rounded px-2 py-1 bg-white dark:bg-dark-3 border border-border dark:border-border-dark"
                />
              </td>
              <td className="py-2 flex gap-1">
                <button type="button" onClick={handleAdd} className="text-primary text-xs">
                  Save
                </button>
                <button type="button" onClick={() => setAdding(false)} className="text-muted text-xs">
                  Cancel
                </button>
              </td>
            </tr>
          )}
          {subcontractors.map((sub) => (
            <tr key={sub.id} className="border-b border-border dark:border-border-dark last:border-0">
              <td className="py-2 pr-2">
                <input
                  type="checkbox"
                  checked={selected.has(sub.id)}
                  onChange={() => toggleSelect(sub.id)}
                  className="rounded border-border dark:border-border-dark"
                />
              </td>
              <td className="py-2 pr-2">{sub.name}</td>
              <td className="py-2 pr-2 text-muted dark:text-white-dim">{sub.trade}</td>
              <td className="py-2 pr-2 text-muted dark:text-white-dim">{sub.email}</td>
              <td className="py-2 pr-2 text-muted dark:text-white-dim">{sub.phone || '—'}</td>
              <td className="py-2">
                <button
                  type="button"
                  onClick={() => onDelete(sub.id)}
                  className="text-red-500 hover:text-red-600 text-xs"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {subcontractors.length === 0 && !adding && (
        <p className="text-sm text-muted dark:text-white-dim py-4">No subcontractors yet. Add one to get started.</p>
      )}
    </div>
  )
}
