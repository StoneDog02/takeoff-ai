import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

/**
 * Handles redirect after Supabase email confirmation.
 * Supabase sends users here with hash params (#access_token=...); the client
 * recovers the session, then we redirect to dashboard.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setError('Auth is not configured.')
      return
    }

    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const hasTokens = hashParams.has('access_token') || hashParams.has('error')

    if (hashParams.get('error')) {
      setError(hashParams.get('error_description') || hashParams.get('error') || 'Confirmation failed.')
      return
    }

    if (hasTokens) {
      // Supabase client will pick up the session from the URL; give it a moment then redirect
      supabase.auth.getSession().then(() => {
        navigate('/dashboard', { replace: true })
      })
      return
    }

    // No hash (e.g. landed here manually) — go to sign-in
    navigate('/sign-in', { replace: true })
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white p-6">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/sign-in', { replace: true })}
            className="text-sm underline text-white/80 hover:text-white"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white">
      <p className="text-white/80">Confirming your email…</p>
    </div>
  )
}
