import { CUSTOM_WORK_TYPE_PALETTE } from '@/components/projects/NewProjectWizard/constants'

const BUILT_IN_BG_COLORS = [
  '#EFF6FF', '#F0FDF4', '#FFF7ED', '#FDF2F8', '#F0FDF4', '#EFF6FF', '#F5F3FF', '#FEFCE8', '#F1F5F9',
  '#2563EB', '#16A34A', '#EA580C', '#DB2777', '#15803d', '#7C3AED', '#CA8A04', '#475569',
]

export interface CustomWorkTypeColorPickerProps {
  value: string
  onChange: (hex: string) => void
  /** Colors already in use (built-in work types + other custom types). Picker will exclude these. */
  usedColors: Set<string>
  className?: string
}

function normalizeHex(hex: string): string {
  const h = (hex || '').trim()
  return h.startsWith('#') ? h.toLowerCase() : `#${h.toLowerCase()}`
}

/** Returns the set of colors already in use (built-in + other work types' custom_color). Pass excludeId to allow keeping the same color when editing. */
export function getUsedWorkTypeColors(
  workTypes: { id?: string; type_key?: string; custom_color?: string }[],
  excludeId?: string
): Set<string> {
  const used = new Set<string>(BUILT_IN_BG_COLORS.map(normalizeHex))
  for (const w of workTypes) {
    if (w.custom_color && w.id !== excludeId) used.add(normalizeHex(w.custom_color))
    if (w.type_key && w.type_key !== 'custom') {
      const builtIn = BUILT_IN_COLORS_BY_KEY[w.type_key]
      if (builtIn) {
        used.add(normalizeHex(builtIn.bg))
        used.add(normalizeHex(builtIn.rate))
      }
    }
  }
  return used
}

const BUILT_IN_COLORS_BY_KEY: Record<string, { bg: string; rate: string }> = {
  labor: { bg: '#EFF6FF', rate: '#2563EB' },
  tile: { bg: '#F0FDF4', rate: '#16A34A' },
  plumbing: { bg: '#FFF7ED', rate: '#EA580C' },
  demolition: { bg: '#FDF2F8', rate: '#DB2777' },
  framing: { bg: '#F0FDF4', rate: '#15803d' },
  concrete: { bg: '#EFF6FF', rate: '#2563EB' },
  cabinets: { bg: '#F5F3FF', rate: '#7C3AED' },
  equipment: { bg: '#FEFCE8', rate: '#CA8A04' },
  countertop: { bg: '#FEFCE8', rate: '#CA8A04' },
  default: { bg: '#F1F5F9', rate: '#475569' },
}

function lightenHex(hex: string, amount: number): string {
  const n = hex.replace('#', '')
  const r = Math.round(parseInt(n.slice(0, 2), 16) * (1 - amount) + 255 * amount)
  const g = Math.round(parseInt(n.slice(2, 4), 16) * (1 - amount) + 255 * amount)
  const b = Math.round(parseInt(n.slice(4, 6), 16) * (1 - amount) + 255 * amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/** Resolve bg/rate for display. Pass customColor when type_key is 'custom'. */
export function getWorkTypeStyle(typeKey?: string, customColor?: string): { bg: string; rate: string } {
  if (typeKey === 'custom' && customColor) {
    return { bg: lightenHex(customColor, 0.85), rate: customColor }
  }
  const key = typeKey && BUILT_IN_COLORS_BY_KEY[typeKey] ? typeKey : 'default'
  return BUILT_IN_COLORS_BY_KEY[key] ?? BUILT_IN_COLORS_BY_KEY.default
}

export function CustomWorkTypeColorPicker({ value, onChange, usedColors, className = '' }: CustomWorkTypeColorPickerProps) {
  const available = CUSTOM_WORK_TYPE_PALETTE.filter((c) => !usedColors.has(normalizeHex(c)))
  return (
    <div className={className}>
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Color (no icon for custom)</p>
      <div className="flex flex-wrap gap-2">
        {available.length === 0 ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">All colors in use. Remove a custom type to free one.</p>
        ) : (
          available.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              className="w-8 h-8 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-900"
              style={{
                background: hex,
                borderColor: value === hex ? '#1f2937' : 'transparent',
                boxShadow: value === hex ? '0 0 0 2px white, 0 0 0 4px #1f2937' : undefined,
              }}
              title={hex}
              aria-label={`Choose ${hex}`}
              aria-pressed={value === hex}
            />
          ))
        )}
      </div>
    </div>
  )
}
