/** Paper icon + count for project cards (board / grid); hidden when count ≤ 0. */
export function ProjectDocumentCountBadge({
  count,
  variant = 'grid',
}: {
  count: number
  variant?: 'board' | 'grid'
}) {
  if (count <= 0) return null
  const display = count > 99 ? '99+' : String(count)
  const label = `${count} paper-trail document${count === 1 ? '' : 's'}`
  const layout = variant === 'board' ? 'doc-count-badge--board' : 'doc-count-badge--grid'

  return (
    <div className={`doc-count-badge ${layout}`} title={label} role="img" aria-label={label}>
      <svg
        className="doc-count-badge__icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span className="doc-count-badge__num">{display}</span>
    </div>
  )
}
