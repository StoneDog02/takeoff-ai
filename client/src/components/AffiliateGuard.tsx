import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface AffiliateGuardProps {
  children: ReactNode
}

/** Redirects to sign-in if the user is not an affiliate (partner portal). */
export function AffiliateGuard({ children }: AffiliateGuardProps) {
  const { type, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (type !== 'affiliate') {
      navigate('/sign-in', { replace: true })
    }
  }, [type, loading, navigate])

  if (loading) {
    return (
      <div className="admin-page" style={{ padding: 'var(--space-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </div>
    )
  }
  if (type !== 'affiliate') {
    return null
  }
  return <>{children}</>
}
