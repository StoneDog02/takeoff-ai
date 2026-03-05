import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { mockContractors } from '@/data/mockContractorsData'
import type { Contractor } from '@/types/global'

const USE_CONTRACTORS_MOCK = import.meta.env.VITE_USE_CONTRACTORS_MOCK === 'true'

export function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({ name: '', trade: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    if (USE_CONTRACTORS_MOCK) {
      setContractors([...mockContractors])
      setLoading(false)
    } else {
      api.contractors
        .list()
        .then(setContractors)
        .catch(() => setContractors([]))
        .finally(() => setLoading(false))
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRow.name.trim() || !newRow.email.trim()) return
    setSaving(true)
    try {
      if (USE_CONTRACTORS_MOCK) {
        const newContractor: Contractor = {
          id: `con-mock-${Date.now()}`,
          name: newRow.name.trim(),
          trade: newRow.trade.trim() || '',
          email: newRow.email.trim(),
          phone: newRow.phone.trim() || undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setContractors((prev) => [...prev, newContractor])
        setNewRow({ name: '', trade: '', email: '', phone: '' })
        setAdding(false)
      } else {
        await api.contractors.create(newRow)
        setNewRow({ name: '', trade: '', email: '', phone: '' })
        setAdding(false)
        load()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this contractor from your contact list?')) return
    try {
      if (USE_CONTRACTORS_MOCK) {
        setContractors((prev) => prev.filter((c) => c.id !== id))
      } else {
        await api.contractors.delete(id)
        load()
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="dashboard-app teams-page contractors-page flex flex-col flex-1 min-h-0">
      <div className="teams-page-inner flex flex-col flex-1 min-h-0">
        <div className="dashboard-page-header teams-page-header flex-shrink-0">
          <div className="flex flex-col gap-0 text-left w-full">
            <h1 className="dashboard-title">Contractors</h1>
            <p className="teams-tab-header-desc mt-1">
              Manage your contractor contact list. Add and remove contractors.
            </p>
          </div>
        </div>

        <div className="teams-page-content flex-1 min-h-0 flex flex-col">
          <div className="teams-tab-body">
            <div className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-4 shadow-card overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white">Contact list</h2>
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover"
                >
                  Add contractor
                </button>
              </div>

              {loading ? (
                <p className="text-sm text-muted dark:text-white-dim py-4">Loading…</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border dark:border-border-dark">
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
                        <td className="py-2 pr-2" colSpan={5}>
                          <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-center">
                            <input
                              value={newRow.name}
                              onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))}
                              placeholder="Name"
                              className="rounded px-2 py-1 bg-white dark:bg-dark-3 border border-border dark:border-border-dark min-w-[120px]"
                            />
                            <input
                              value={newRow.trade}
                              onChange={(e) => setNewRow((r) => ({ ...r, trade: e.target.value }))}
                              placeholder="Trade"
                              className="rounded px-2 py-1 bg-white dark:bg-dark-3 border border-border dark:border-border-dark min-w-[100px]"
                            />
                            <input
                              value={newRow.email}
                              onChange={(e) => setNewRow((r) => ({ ...r, email: e.target.value }))}
                              placeholder="Email"
                              type="email"
                              className="rounded px-2 py-1 bg-white dark:bg-dark-3 border border-border dark:border-border-dark min-w-[160px]"
                            />
                            <input
                              value={newRow.phone}
                              onChange={(e) => setNewRow((r) => ({ ...r, phone: e.target.value }))}
                              placeholder="Phone"
                              className="rounded px-2 py-1 bg-white dark:bg-dark-3 border border-border dark:border-border-dark min-w-[120px]"
                            />
                            <button
                              type="submit"
                              disabled={saving || !newRow.name.trim() || !newRow.email.trim()}
                              className="text-primary text-xs disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdding(false)
                                setNewRow({ name: '', trade: '', email: '', phone: '' })
                              }}
                              className="text-muted text-xs"
                            >
                              Cancel
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}
                    {contractors.map((c) => (
                      <tr key={c.id} className="border-b border-border dark:border-border-dark last:border-0">
                        <td className="py-2 pr-2">{c.name}</td>
                        <td className="py-2 pr-2 text-muted dark:text-white-dim">{c.trade || '—'}</td>
                        <td className="py-2 pr-2 text-muted dark:text-white-dim">{c.email}</td>
                        <td className="py-2 pr-2 text-muted dark:text-white-dim">{c.phone || '—'}</td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
                            className="text-red-500 hover:text-red-600 text-xs"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!loading && contractors.length === 0 && !adding && (
                <p className="text-sm text-muted dark:text-white-dim py-4">No contractors yet. Add one to get started.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
