/**
 * Reusable skeleton (suspense-style) loader used across the app.
 * Use variant="page" for full-page loading, variant="inline" for cards/lists.
 */
export function LoadingSkeleton({
  variant = 'inline',
  lines = 3,
  className = '',
}: {
  variant?: 'page' | 'inline' | 'cards'
  lines?: number
  className?: string
}) {
  if (variant === 'page') {
    return (
      <div className={`page-loading ${className}`}>
        <div className="page-loading-skeleton">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </div>
    )
  }
  if (variant === 'cards') {
    return (
      <div className={`loading-skeleton-cards ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton loading-skeleton-card" />
        ))}
      </div>
    )
  }
  return (
    <div className={`loading-skeleton-lines ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton loading-skeleton-line" style={{ width: i === lines - 1 && lines > 1 ? '70%' : '100%' }} />
      ))}
    </div>
  )
}
