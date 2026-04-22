import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  isPublicDemo,
  getPublicDemoPersona,
  setPublicDemoPersona,
  exitPublicDemo,
  type PublicDemoPersona,
} from '@/lib/publicDemo'

export function PublicDemoBanner() {
  const navigate = useNavigate()
  const { refetch, loading } = useAuth()

  if (!isPublicDemo()) return null

  const persona = getPublicDemoPersona()

  const applyPersona = async (next: PublicDemoPersona) => {
    setPublicDemoPersona(next)
    await refetch()
    if (next === 'employee') {
      navigate('/employee/clock', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  const handleExit = async () => {
    const exitTo = exitPublicDemo()
    await refetch()
    navigate(exitTo ?? '/', { replace: true })
  }

  return (
    <div
      className="public-demo-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 16px',
        background: 'rgba(192, 57, 43, 0.12)',
        borderBottom: '1px solid var(--border, #e5e7eb)',
        fontSize: 13,
        color: 'var(--text-primary)',
      }}
    >
      <span>
        <strong>Interactive demo</strong>
        <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
          Sample data only — nothing is saved.
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-sm"
          disabled={loading}
          onClick={() => void applyPersona(persona === 'pm' ? 'employee' : 'pm')}
        >
          {persona === 'pm' ? 'Switch to employee view' : 'Switch to manager view'}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => void handleExit()}>
          Exit demo
        </button>
      </span>
    </div>
  )
}
