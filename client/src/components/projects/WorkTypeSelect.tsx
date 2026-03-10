import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { WorkTypeIcon } from '@/components/projects/WorkTypeIcon'
import { WORK_TYPE_KEYS, WORK_TYPE_CATEGORIES } from '@/components/projects/NewProjectWizard/constants'

const WORK_TYPE_LABELS: Record<string, string> = {
  labor: 'Labor',
  tile: 'Tile',
  plumbing: 'Plumbing',
  demolition: 'Demolition',
  framing: 'Framing',
  concrete: 'Concrete',
  cabinets: 'Cabinets',
  equipment: 'Equipment',
  countertop: 'Equipment',
  custom: 'Custom',
}

function labelForKey(key: string): string {
  return WORK_TYPE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

export interface WorkTypeSelectProps {
  value: string
  onChange: (typeKey: string) => void
  className?: string
  style?: React.CSSProperties
  /** Icon size in trigger and list */
  iconSize?: number
  /** When value is 'custom', hex color to show in trigger (e.g. #6366F1). */
  customColor?: string
}

export function WorkTypeSelect({ value, onChange, className = '', style, iconSize = 18, customColor }: WorkTypeSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  }, [open])

  const displayKey = value && WORK_TYPE_KEYS.includes(value as (typeof WORK_TYPE_KEYS)[number]) ? value : 'labor'
  const isCustom = displayKey === 'custom'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm text-left ${className}`}
        style={style}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {!isCustom && <WorkTypeIcon typeKey={displayKey} size={iconSize} className="shrink-0 text-gray-600 dark:text-white-dim" />}
        {isCustom && (
          <span
            className="shrink-0 rounded-full border border-gray-300 dark:border-gray-600"
            style={{ width: iconSize, height: iconSize, background: customColor || '#94A3B8' }}
            title="Custom"
          />
        )}
        <span className="flex-1 truncate">{labelForKey(displayKey)}</span>
        <ChevronDown size={14} className="shrink-0 opacity-60" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 shadow-lg py-1 max-h-64 overflow-auto"
          role="listbox"
        >
          {WORK_TYPE_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-border dark:border-border-dark first:border-t-0 first:pt-0 first:mt-0 mt-0.5 first:mt-0">
                {cat.label}
              </div>
              {cat.keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="option"
                  aria-selected={k === displayKey}
                  onClick={() => {
                    onChange(k)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-dark-4 transition-colors"
                >
                  {k === 'custom' ? (
                    <span className="shrink-0 rounded-full border border-gray-300 dark:border-gray-600 bg-gray-400 dark:bg-gray-500" style={{ width: iconSize, height: iconSize }} title="Custom" />
                  ) : (
                    <WorkTypeIcon typeKey={k} size={iconSize} className="shrink-0 text-gray-600 dark:text-white-dim" />
                  )}
                  <span>{labelForKey(k)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
