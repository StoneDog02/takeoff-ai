import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface AdminGuardProps {
  children: ReactNode
}

/** Redirects to /dashboard if the current user is not an admin. */
export function AdminGuard({ children }: AdminGuardProps) {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!isAdmin) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAdmin, loading, navigate])

  if (loading) {
    return (
      <div className="admin-page" style={{ padding: 'var(--space-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </div>
    )
  }
  if (!isAdmin) {
    return null
  }
  return <>{children}</>
}
