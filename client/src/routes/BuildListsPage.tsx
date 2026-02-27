import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type BuildListItem } from '@/api/client'

export function BuildListsPage() {
  const [list, setList] = useState<BuildListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getBuildLists()
      .then(setList)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Build Lists</h1>
        <p className="mt-4 text-muted">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Build Lists</h1>
        <div className="mt-4 p-4 rounded-md bg-red-50 text-red-700">{error}</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Build Lists</h1>
      <p className="mt-2 text-muted">Your past takeoffs and material lists.</p>

      {list.length === 0 ? (
        <div className="mt-8 p-8 rounded-lg border border-border bg-surface-elevated text-center text-muted">
          <p>No build lists yet.</p>
          <Link to="/takeoff" className="mt-2 inline-block text-primary font-medium hover:underline">
            Create your first takeoff
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((item) => (
            <li key={item.id}>
              <Link
                to={`/build-lists/${item.id}`}
                className="block p-4 rounded-lg border border-border bg-surface-elevated hover:border-primary/50 hover:shadow-card transition-all"
              >
                <span className="font-medium text-gray-900">{item.name}</span>
                <span className="ml-2 text-sm text-muted">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
