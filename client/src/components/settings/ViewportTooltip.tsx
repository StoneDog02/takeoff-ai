import { useRef, useState, useLayoutEffect, useCallback, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

const MARGIN = 12

const tipBaseStyle: CSSProperties = {
  position: 'fixed',
  padding: '8px 10px',
  background: '#111827',
  color: '#fff',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.4,
  textAlign: 'center',
  overflowWrap: 'break-word',
  borderRadius: 8,
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.22)',
  pointerEvents: 'none',
  opacity: 0,
  zIndex: 10000,
}

type ViewportTooltipProps = {
  label: string
  children: React.ReactNode
  /** Single tab stop for keyboard users (e.g. column header only). */
  focusable?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * Tooltip rendered in a portal with `position: fixed` and clamped to the viewport
 * (avoids clipping from overflow and off-screen centering on narrow layouts).
 */
export function ViewportTooltip({ label, children, focusable, className, style }: ViewportTooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [tipStyle, setTipStyle] = useState<CSSProperties>({})

  const place = useCallback(() => {
    const a = anchorRef.current
    const tip = tipRef.current
    if (!a || !tip) return
    const r = a.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxW = Math.min(280, vw - 2 * MARGIN)
    tip.style.maxWidth = `${maxW}px`
    const tw = tip.getBoundingClientRect().width
    const th = tip.getBoundingClientRect().height
    let left = r.left + r.width / 2 - tw / 2
    left = Math.max(MARGIN, Math.min(left, vw - tw - MARGIN))
    let top = r.top - th - 10
    if (top < MARGIN) top = r.bottom + 10
    if (top + th > vh - MARGIN) top = Math.max(MARGIN, vh - th - MARGIN)
    setTipStyle({
      left,
      top,
      maxWidth: maxW,
      opacity: 1,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    const id = requestAnimationFrame(() => place())
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, label, place])

  const show = () => setOpen(true)
  const hide = () => setOpen(false)

  return (
    <>
      <span
        ref={anchorRef}
        className={className}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={focusable ? show : undefined}
        onBlur={focusable ? hide : undefined}
        tabIndex={focusable ? 0 : undefined}
      >
        {children}
      </span>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div ref={tipRef} role="tooltip" style={{ ...tipBaseStyle, ...tipStyle }}>
            {label}
          </div>,
          document.body
        )}
    </>
  )
}
