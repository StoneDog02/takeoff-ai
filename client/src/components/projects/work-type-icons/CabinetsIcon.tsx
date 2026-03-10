/**
 * Cabinets work type icon.
 * Source: https://iconscout.com/icon/cabinets-icon_5245161
 * Replace the path below with the Iconscout SVG path if you download it.
 */
export function CabinetsIcon({ size = 24, className }: { size?: number; className?: string }) {
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
      <path d="M4 4h16v4H4V4zm0 6h16v4H4v-4zm0 6h16v4H4v-4zm2-10v2h4V6H6zm0 6v2h4v-2H6zm0 6v2h4v-2H6z" />
    </svg>
  )
}
