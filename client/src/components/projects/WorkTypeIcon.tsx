import {
  HardHatIcon,
  GridFourIcon,
  PipeWrenchIcon,
  HammerIcon,
  CubeIcon,
  StackIcon,
  PackageIcon,
  BulldozerIcon,
  BriefcaseIcon,
} from '@phosphor-icons/react'

type IconComponent = React.ComponentType<{
  size?: number | string
  className?: string
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
}>

const ICON_MAP: Record<string, IconComponent> = {
  labor: HardHatIcon,
  tile: GridFourIcon,
  plumbing: PipeWrenchIcon,
  demolition: HammerIcon,
  framing: CubeIcon,
  concrete: StackIcon,
  cabinets: PackageIcon,
  equipment: BulldozerIcon,
  countertop: BulldozerIcon, // backward compat
  default: BriefcaseIcon,
}

export interface WorkTypeIconProps {
  typeKey?: string | null
  size?: number
  className?: string
  /** When typeKey is 'custom', optional hex color for the dot (no icon). */
  customColor?: string
}

export function WorkTypeIcon({ typeKey, size = 20, className, customColor }: WorkTypeIconProps) {
  if (typeKey === 'custom') {
    return (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: customColor || '#94A3B8',
          display: 'inline-block',
          flexShrink: 0,
        }}
        aria-hidden
      />
    )
  }
  const key: keyof typeof ICON_MAP =
    typeKey && typeKey in ICON_MAP ? (typeKey as keyof typeof ICON_MAP) : 'default'
  const Icon = ICON_MAP[key]
  return <Icon size={size} className={className} weight="regular" />
}
