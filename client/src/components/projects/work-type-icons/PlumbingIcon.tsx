/**
 * Plumbing work type icon.
 * Source: https://iconscout.com/icon/plumbing-icon_1195647
 * Replace the path below with the Iconscout SVG path if you download it.
 */
export function PlumbingIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M19 14V8c0-1.1-.9-2-2-2h-2V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v3H7c-1.1 0-2 .9-2 2v6h2v4c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-4h2v4c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-4h2zm-4-8h-2V4h2v2zm-4 0H9V4h2v2z" />
    </svg>
  )
}
