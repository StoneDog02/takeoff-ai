/**
 * Framing work type icon.
 * Source: https://iconscout.com/icon/framing-icon_11392924
 * Replace the path below with the Iconscout SVG path if you download it.
 */
export function FramingIcon({ size = 24, className }: { size?: number; className?: string }) {
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
      <path d="M4 4v16h16V4H4zm2 2h4v4H6V6zm6 0h4v4h-4V6zM6 12h4v4H6v-4zm6 0h4v4h-4v-4z" />
    </svg>
  )
}
