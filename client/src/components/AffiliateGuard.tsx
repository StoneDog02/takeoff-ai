import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface AffiliateGuardProps {
  children: ReactNode
}

/** Redirects to sign-in if the user has no linked partner (affiliates) portal. */
export function AffiliateGuard({ children }: AffiliateGuardProps) {
  const { has_affiliate_portal, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!has_affiliate_portal) {
      navigate('/sign-in', { replace: true })
    }
  }, [has_affiliate_portal, loading, navigate])

  if (loading) {
    return (
      <div className="admin-page" style={{ padding: 'var(--space-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </div>
    )
  }
  if (!has_affiliate_portal) {
    return null
  }
  return <>{children}</>
}
