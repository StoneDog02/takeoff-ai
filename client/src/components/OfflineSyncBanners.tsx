function WifiOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="offline-banner-icon"
      aria-hidden
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  )
}

type Props = {
  isOnline: boolean
  syncPending: number
}

export function OfflineSyncBanners({ isOnline, syncPending }: Props) {
  return (
    <>
      {!isOnline && (
        <div className="offline-banner" role="status" aria-live="polite">
          <WifiOffIcon />
          <span className="offline-banner-text">
            You&apos;re offline — changes will sync when connection returns
          </span>
          {syncPending > 0 ? (
            <span className="offline-banner-pending">
              {syncPending} item{syncPending !== 1 ? 's' : ''} pending
            </span>
          ) : null}
        </div>
      )}

      {isOnline && syncPending > 0 ? (
        <div className="sync-banner" role="status" aria-live="polite">
          <span className="sync-spinner" aria-hidden />
          Syncing {syncPending} offline change{syncPending !== 1 ? 's' : ''}...
        </div>
      ) : null}
    </>
  )
}
