import { useRouteError, isRouteErrorResponse } from 'react-router-dom'

function isChunkLoadFailure(err: unknown): boolean {
  if (!err) return false
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : String(err)
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('Loading chunk') ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name: string }).name === 'ChunkLoadError')
  )
}

function errorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export function RouteErrorPage() {
  const error = useRouteError()
  const chunkFailed = isChunkLoadFailure(error)
  const details = errorMessage(error)

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-page text-center">
      <h1 className="text-xl font-bold text-text-dark mb-2">
        {chunkFailed ? 'App update needed' : 'Something went wrong'}
      </h1>
      <p className="text-text-mid max-w-md mb-6">
        {chunkFailed
          ? 'This page is out of date—usually after we ship a new version. Reload to get the latest app.'
          : 'An unexpected error occurred. You can try reloading the page.'}
      </p>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        onClick={() => window.location.reload()}
      >
        Reload page
      </button>
      {import.meta.env.DEV && (
        <pre className="mt-8 max-w-full overflow-auto rounded-md bg-slate-100 p-4 text-left text-xs text-slate-700">
          {details}
        </pre>
      )}
    </div>
  )
}
