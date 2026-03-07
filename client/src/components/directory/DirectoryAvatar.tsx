interface DirectoryAvatarProps {
  initials: string
  color: string
  size?: number
}

export function DirectoryAvatar({ initials, color, size = 40 }: DirectoryAvatarProps) {
  return (
    <div className="flex shrink-0 relative">
      <div
        className="flex items-center justify-center text-white font-bold rounded-full"
        style={{
          width: size,
          height: size,
          background: color,
          fontSize: size * 0.3,
          letterSpacing: '0.02em',
        }}
      >
        {initials}
      </div>
    </div>
  )
}
