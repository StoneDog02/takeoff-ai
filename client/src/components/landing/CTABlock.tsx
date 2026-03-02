import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface CTABlockProps {
  /** Short eyebrow/badge text above the title */
  eyebrow?: string
  /** Main heading */
  title: string
  /** Supporting copy below the title */
  description?: string
  /** Primary action: link (href) or button (onClick). Label required. */
  primaryAction: {
    label: string
    href?: string
    to?: string
    onClick?: () => void
  }
  /** Optional secondary action */
  secondaryAction?: {
    label: string
    href?: string
    to?: string
    onClick?: () => void
  }
  /** Optional content below the buttons (e.g. trust line or stats) */
  children?: ReactNode
  /** Layout: centered (default) or left-aligned */
  align?: 'center' | 'left'
  /** Visual style: default (light) or dark (for dark backgrounds) */
  variant?: 'default' | 'dark'
  className?: string
}

export function CTABlock({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  align = 'center',
  variant = 'default',
  className = '',
}: CTABlockProps) {
  const isDark = variant === 'dark'
  const textCls = isDark ? 'text-landing-white' : 'text-gray-900'
  const mutedCls = isDark ? 'text-white-dim' : 'text-gray-600'
  const alignCls = align === 'center' ? 'text-center mx-auto' : 'text-left'

  const renderAction = (
    action: { label: string; href?: string; to?: string; onClick?: () => void },
    primary: boolean
  ) => {
    const base =
      'inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-lg font-sora font-semibold text-[15px] transition-all duration-250'
    const primaryCls = isDark
      ? 'bg-accent text-white hover:bg-accent-hover shadow-[0_4px_24px_var(--color-accent-glow)] hover:-translate-y-0.5 hover:shadow-[0_8px_36px_var(--color-accent-glow)]'
      : 'bg-accent text-white hover:bg-accent-hover'
    const secondaryCls = isDark
      ? 'border border-border-dark text-landing-white hover:bg-white-faint hover:border-white-faint'
      : 'border border-gray-300 text-gray-900 hover:bg-gray-50'
    const cls = `${base} ${primary ? primaryCls : secondaryCls}`

    if (action.to) {
      return (
        <Link to={action.to} className={cls}>
          {action.label}
        </Link>
      )
    }
    if (action.href) {
      return (
        <a href={action.href} className={cls}>
          {action.label}
        </a>
      )
    }
    return (
      <button type="button" onClick={action.onClick} className={cls}>
        {action.label}
      </button>
    )
  }

  return (
    <div className={`max-w-2xl ${alignCls} ${className}`}>
      {eyebrow && (
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent-hover mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className={`text-3xl md:text-4xl font-sora font-extrabold tracking-tight ${textCls} mb-3`}>
        {title}
      </h2>
      {description && <p className={`text-lg ${mutedCls} mb-8`}>{description}</p>}
      <div className={`flex flex-wrap gap-4 ${align === 'center' ? 'justify-center' : ''}`}>
        {renderAction(primaryAction, true)}
        {secondaryAction && renderAction(secondaryAction, false)}
      </div>
      {children && <div className="mt-10">{children}</div>}
    </div>
  )
}
