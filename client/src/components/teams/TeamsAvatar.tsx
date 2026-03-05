interface TeamsAvatarProps {
  initials: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TeamsAvatar({ initials, size = 'md', className = '' }: TeamsAvatarProps) {
  return (
    <div
      className={`teams-avatar ${size} ${className}`.trim()}
      aria-hidden
    >
      {initials}
    </div>
  )
}

/** Get 2-letter initials from a name (e.g. "Marcus Rivera" -> "MR") */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
