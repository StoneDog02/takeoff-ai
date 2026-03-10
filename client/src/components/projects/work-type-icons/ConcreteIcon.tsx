/**
 * Concrete work type icon.
 * Source: https://iconscout.com/icon/concrete-icon_2657213
 * Replace the path below with the Iconscout SVG path if you download it.
 */
export function ConcreteIcon({ size = 24, className }: { size?: number; className?: string }) {
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
      <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z" />
    </svg>
  )
}
