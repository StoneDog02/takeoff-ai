import { WIZARD_RED } from './constants'

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: '10px',
        background: `${color}18`,
        color,
        padding: '2px 8px',
        borderRadius: '20px',
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  )
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  half,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  half?: boolean
}) {
  const base = {
    width: '100%',
    padding: '9px 12px',
    border: '1.5px solid var(--border, #e2e8f0)',
    borderRadius: '9px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
    color: 'var(--text, #0f172a)',
    background: 'var(--bg-input, #fff)',
    transition: 'border-color 0.15s',
  }
  return (
    <div style={{ flex: half ? 1 : undefined, width: half ? undefined : '100%' }}>
      {label && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--muted, #64748b)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            marginBottom: '5px',
          }}
        >
          {label}
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={base}
        onFocus={(e) => {
          e.target.style.borderColor = WIZARD_RED
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border, #e2e8f0)'
        }}
      />
    </div>
  )
}

export function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        background: 'var(--bg-muted, #f8fafc)',
        border: '1.5px dashed var(--border, #cbd5e1)',
        borderRadius: '9px',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--muted, #64748b)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        width: '100%',
        justifyContent: 'center',
        marginTop: '8px',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = WIZARD_RED
        e.currentTarget.style.color = WIZARD_RED
        e.currentTarget.style.background = `${WIZARD_RED}08`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border, #cbd5e1)'
        e.currentTarget.style.color = 'var(--muted, #64748b)'
        e.currentTarget.style.background = 'var(--bg-muted, #f8fafc)'
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      {label}
    </button>
  )
}
