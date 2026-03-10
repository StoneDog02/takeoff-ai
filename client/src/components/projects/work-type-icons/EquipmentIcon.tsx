/**
 * Equipment (skid steer) work type icon.
 * Outline style skid-steer loader: cab, tracks, articulated arm and bucket.
 */
export function EquipmentIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* Cab */}
      <path d="M14 6h5l1 4h-2v3h-4V6z" />
      {/* Body */}
      <path d="M5 11h10v3H5v-3z" />
      {/* Tracks */}
      <path d="M4 15.5h3v2.5H4V15.5zM8.5 15.5h3v2.5h-3V15.5zM13 15.5h3v2.5h-3V15.5zM17.5 15.5H21v2.5h-3.5V15.5z" />
      {/* Arm + bucket */}
      <path d="M7 12L4 15v2" />
      <path d="M2 17h4v2.5H2V17z" />
      <circle cx="7" cy="12" r="0.6" stroke="currentColor" fill="none" />
      <circle cx="4" cy="15" r="0.6" stroke="currentColor" fill="none" />
    </svg>
  )
}
