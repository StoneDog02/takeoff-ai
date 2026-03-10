/**
 * Labor / General labor work type icon.
 * Source: https://iconscout.com/icon/labor-icon_1602072
 * Download the SVG from that URL, save as svg-sources/labor.svg, then run: node scripts/update-work-type-icons.js
 */
export function LaborIcon({ size = 24, className }: { size?: number; className?: string }) {
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
      <path d="M12 2a4 4 0 0 1 4 4v2h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v2h4V6a2 2 0 0 0-2-2zm-1 8v6h2v-6h-2zm4 0v6h2v-6h-2zM9 10v8h6v-8H9z" />
    </svg>
  )
}
