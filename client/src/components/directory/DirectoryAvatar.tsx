import type { DirectoryContractorStatus } from '@/data/mockDirectoryData'
import { STATUS_COLOR } from '@/data/mockDirectoryData'

interface DirectoryAvatarProps {
  initials: string
  color: string
  size?: number
  status?: DirectoryContractorStatus
}

export function DirectoryAvatar({ initials, color, size = 40, status }: DirectoryAvatarProps) {
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
      {status && (
        <div
          className="absolute rounded-full border-2 border-[var(--bg-page)]"
          style={{
            bottom: 1,
            right: 1,
            width: size > 36 ? 11 : 9,
            height: size > 36 ? 11 : 9,
            background: STATUS_COLOR[status],
          }}
        />
      )}
    </div>
  )
}
