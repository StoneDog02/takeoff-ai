import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { dayjs } from '@/lib/date'

export function TakeoffPage() {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const result = await api.runTakeoff(file, name || undefined)
      navigate(`/build-lists/${result.id}`, {
        state: {
          buildList: {
            id: result.id,
            name: result.name,
            created_at: result.createdAt ?? dayjs().toISOString(),
            material_list: result.materialList,
          },
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && (f.type === 'application/pdf' || f.type.startsWith('image/'))) {
      setFile(f)
      if (!name) setName(f.name.replace(/\.[^.]+$/, '') || f.name)
    }
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-landing-white">New Takeoff</h1>
      <p className="mt-2 text-gray-500 dark:text-white-dim">
        Upload build plans (PDF or image) to generate a material list.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-landing-white mb-1">
            Plan name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Street Lot 5"
            className="w-full px-4 py-2 border border-gray-200 dark:border-border-dark rounded-md bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white placeholder:text-gray-400 dark:placeholder:text-white-dim focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-landing-white mb-1">
            Build plan (PDF or image)
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-200 dark:border-border-dark rounded-lg p-8 text-center bg-gray-50 dark:bg-dark-4 hover:border-accent/50 transition-colors"
          >
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setFile(f)
                  if (!name) setName(f.name.replace(/\.[^.]+$/, '') || f.name)
                }
              }}
              className="sr-only"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              {file ? (
                <p className="text-accent font-medium">{file.name}</p>
              ) : (
                <p className="text-gray-500 dark:text-white-dim">Drop a file here or click to browse</p>
              )}
            </label>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full py-3 px-4 rounded-md font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing…' : 'Run takeoff'}
        </button>
      </form>
    </div>
  )
}
