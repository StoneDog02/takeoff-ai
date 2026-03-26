import type { ReactNode, CSSProperties } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useContext } from 'react'
import { SettingsMobileNavContext } from './SettingsMobileNavContext'

const styles = {
  sectionHeader: { marginBottom: 28 },
  sectionTitle: { fontSize: 22, fontWeight: 800, color: '#111', letterSpacing: '-0.02em', margin: '0 0 5px' },
  sectionDesc: { fontSize: 13.5, color: '#9ca3af', margin: 0 },
  card: { background: '#fff', borderRadius: 16, border: '1px solid #e8e6e1', overflow: 'hidden', marginBottom: 16 },
  cardHeader: { padding: '18px 24px', borderBottom: '1px solid #f1f0ed' },
  cardHeaderTitle: { fontWeight: 700, fontSize: 15, color: '#111' },
  cardHeaderDesc: { fontSize: 12.5, color: '#9ca3af', marginTop: 3 },
  cardBody: { padding: '22px 24px' },
  label: { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' as const, color: '#9ca3af' },
  labelHint: { fontSize: 11, color: '#c4bfb8', marginLeft: 8 },
  input: { border: '1px solid #e8e6e1', borderRadius: 9, padding: '10px 13px', fontSize: 14, color: '#111', background: '#fafaf9', outline: 'none', width: '100%', fontFamily: 'inherit', transition: 'all 0.15s' },
  inputFocus: { borderColor: '#b91c1c', background: '#fff', boxShadow: '0 0 0 3px rgba(185,28,28,0.07)' },
  select: { border: '1px solid #e8e6e1', borderRadius: 9, padding: '10px 13px', fontSize: 14, color: '#111', background: '#fafaf9', outline: 'none', width: '100%', fontFamily: 'inherit', cursor: 'pointer' },
  btnPrimary: { background: '#b91c1c', color: '#fff' },
  btnGhost: { background: '#f0ede8', color: '#374151', border: '1px solid #e8e6e1' },
  btnOutline: { background: '#fff', color: '#374151', border: '1px solid #e8e6e1' },
  btnDanger: { background: '#fff', color: '#b91c1c', border: '2px solid #fecaca' },
  btnDangerSolid: { background: '#b91c1c', color: '#fff' },
  btnBase: { borderRadius: 9, padding: '10px 20px', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', border: 'none', transition: 'all 0.15s', letterSpacing: '0.01em' },
  saveRow: { display: 'flex', justifyContent: 'flex-end', paddingTop: 8 },
}

export function SectionHeader({ title, desc }: { title: string; desc: string }) {
  const mobileNav = useContext(SettingsMobileNavContext)
  return (
    <div style={styles.sectionHeader}>
      <div
        style={{
          display: 'flex',
          alignItems: mobileNav?.onBack ? 'center' : 'flex-start',
          gap: 10,
        }}
      >
        {mobileNav?.onBack && (
          <button
            type="button"
            onClick={mobileNav.onBack}
            aria-label="Back to settings"
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              border: '1px solid var(--border, #e8e6e1)',
              background: 'var(--bg-surface, #fff)',
              color: 'var(--text-primary, #111)',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={styles.sectionTitle}>{title}</h2>
          <p style={styles.sectionDesc}>{desc}</p>
        </div>
      </div>
    </div>
  )
}

export function Card({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...styles.card, ...style }}>{children}</div>
}

export function CardHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div style={styles.cardHeader}>
      <div style={styles.cardHeaderTitle}>{title}</div>
      {desc && <div style={styles.cardHeaderDesc}>{desc}</div>}
    </div>
  )
}

export function CardBody({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...styles.cardBody, ...style }}>{children}</div>
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={styles.label}>{children}</span>
      {hint && <span style={styles.labelHint}>{hint}</span>}
    </div>
  )
}

export function Input({ style = {}, onFocus, onBlur, ...props }: React.ComponentProps<'input'> & { style?: CSSProperties }) {
  return (
    <input
      style={{ ...styles.input, ...style }}
      onFocus={(e) => {
        Object.assign(e.target.style, styles.inputFocus)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        e.target.style.borderColor = '#e8e6e1'
        e.target.style.background = '#fafaf9'
        e.target.style.boxShadow = 'none'
        onBlur?.(e)
      }}
      {...props}
    />
  )
}

export function Select({ style = {}, children, ...props }: React.ComponentProps<'select'> & { style?: CSSProperties }) {
  return <select style={{ ...styles.select, ...style }} {...props}>{children}</select>
}

type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'dangerSolid'

export function Btn({
  variant = 'primary',
  style = {},
  children,
  ...props
}: React.ComponentProps<'button'> & { variant?: BtnVariant; style?: CSSProperties }) {
  const variantStyles: Record<BtnVariant, CSSProperties> = {
    primary: styles.btnPrimary,
    ghost: styles.btnGhost,
    outline: styles.btnOutline,
    danger: styles.btnDanger,
    dangerSolid: styles.btnDangerSolid,
  }
  return (
    <button
      style={{ ...styles.btnBase, ...variantStyles[variant], ...style }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      {...props}
    >
      {children}
    </button>
  )
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: checked ? '#b91c1c' : '#e2ddd6',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
      role="switch"
      aria-checked={checked}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          transition: 'left 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </div>
  )
}

export function FieldRow({ children, cols = '1fr' }: { children: ReactNode; cols?: string }) {
  return <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 16, marginBottom: 16 }}>{children}</div>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  )
}

export function SaveRow({ children }: { children: ReactNode }) {
  return <div style={styles.saveRow}>{children}</div>
}

export function Divider() {
  return <div style={{ height: 1, background: '#f1f0ed', margin: '20px 0' }} />
}
