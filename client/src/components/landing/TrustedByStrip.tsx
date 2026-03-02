import { ReactNode } from 'react'

export interface TrustedByStripProps {
  /** Optional heading, e.g. "Trusted by teams at" */
  title?: string
  /** List of company names or logo nodes. Strings are rendered as text. */
  items: (string | ReactNode)[]
  /** Light text on dark background */
  variant?: 'default' | 'dark'
  className?: string
}

export function TrustedByStrip({
  title = 'Trusted by teams at',
  items,
  variant = 'default',
  className = '',
}: TrustedByStripProps) {
  const isDark = variant === 'dark'
  const titleCls = isDark ? 'text-white-dim' : 'text-gray-500'
  const itemCls = isDark
    ? 'text-landing-white/80 font-medium'
    : 'text-gray-600 font-medium'

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      {title && (
        <p className={`text-sm uppercase tracking-wider ${titleCls}`}>
          {title}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {items.map((item, i) => (
          <span
            key={i}
            className={`${itemCls} text-sm md:text-base last:after:hidden`}
          >
            {typeof item === 'string' ? item : item}
          </span>
        ))}
      </div>
    </div>
  )
}
