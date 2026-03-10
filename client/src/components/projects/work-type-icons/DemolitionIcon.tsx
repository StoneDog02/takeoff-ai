/**
 * Demolition work type icon.
 * Source: https://iconscout.com/icon/demolition-icon_13219176
 * Replace the path below with the Iconscout SVG path if you download it.
 */
export function DemolitionIcon({ size = 24, className }: { size?: number; className?: string }) {
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
      <path d="M11 2v6H6l7 7 1.5-1.5L9.5 9H14V2h-3zm8 10l-2 2 2 2 2-2-2-2zM4 18l2-2 2 2-2 2-2-2z" />
    </svg>
  )
}
