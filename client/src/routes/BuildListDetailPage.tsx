import { useEffect, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { api, type BuildListDetail, type MaterialList } from '@/api/client'

function MaterialListView({ materialList }: { materialList: MaterialList }) {
  const { categories, summary } = materialList
  if (!categories?.length) {
    return (
      <p className="text-muted">
        {summary || 'No material list data.'}
      </p>
    )
  }
  return (
    <div className="space-y-8">
      {summary && (
        <p className="text-muted border-b border-border pb-4">{summary}</p>
      )}
      {categories.map((cat) => (
        <section key={cat.name} className="bg-surface-elevated rounded-lg border border-border overflow-hidden shadow-card">
          <h2 className="px-4 py-3 font-semibold text-gray-900 bg-surface border-b border-border">
            {cat.name}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-sm font-medium text-muted">Description</th>
                  <th className="px-4 py-2 text-sm font-medium text-muted text-right w-24">Qty</th>
                  <th className="px-4 py-2 text-sm font-medium text-muted w-20">Unit</th>
                  <th className="px-4 py-2 text-sm font-medium text-muted">Notes</th>
                </tr>
              </thead>
              <tbody>
                {cat.items?.map((item, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{item.description}</td>
                    <td className="px-4 py-2 text-right font-medium">{item.quantity}</td>
                    <td className="px-4 py-2 text-muted">{item.unit}</td>
                    <td className="px-4 py-2 text-sm text-muted">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

export function BuildListDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const stateBuildList = location.state?.buildList as BuildListDetail | undefined
  const [detail, setDetail] = useState<BuildListDetail | null>(stateBuildList ?? null)
  const [loading, setLoading] = useState(!stateBuildList)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || stateBuildList) return
    api
      .getBuildList(id)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, stateBuildList])

  if (loading) {
    return (
      <div>
        <p className="text-muted">Loading build list…</p>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div>
        <div className="p-4 rounded-md bg-red-50 text-red-700">{error || 'Not found'}</div>
        <Link to="/build-lists" className="mt-4 inline-block text-primary font-medium hover:underline">
          Back to Build Lists
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/build-lists" className="text-muted hover:text-primary text-sm font-medium">
          ← Build Lists
        </Link>
      </div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{detail.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {new Date(detail.created_at).toLocaleString()}
          {detail.plan_file_name && ` · ${detail.plan_file_name}`}
        </p>
      </header>
      <MaterialListView materialList={detail.material_list} />
    </div>
  )
}
