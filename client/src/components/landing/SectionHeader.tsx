export interface SectionHeaderProps {
  /** Short label above the title (e.g. "Features", "Pricing") */
  eyebrow?: string
  title: string
  subtitle: string
  /** Use on dark backgrounds */
  variant?: 'default' | 'dark'
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  variant = 'default',
}: SectionHeaderProps) {
  const isDark = variant === 'dark'
  const titleCls = isDark ? 'text-white' : 'text-gray-900'
  const subtitleCls = isDark ? 'text-gray-400' : 'text-gray-600'
  const eyebrowCls = isDark ? 'text-accent' : 'text-accent'

  return (
    <div className="text-center mb-12">
      {eyebrow && (
        <p className={`text-sm font-medium uppercase tracking-wider ${eyebrowCls} mb-2`}>
          {eyebrow}
        </p>
      )}
      <h2 className={`text-3xl md:text-4xl font-bold ${titleCls} mb-2`}>{title}</h2>
      <p className={`text-lg max-w-2xl mx-auto ${subtitleCls}`}>{subtitle}</p>
    </div>
  )
}
