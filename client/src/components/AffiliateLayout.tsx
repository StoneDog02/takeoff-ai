import { Link, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

export function AffiliateLayout() {
  const navigate = useNavigate()

  async function signOut() {
    try {
      await supabase?.auth.signOut()
    } catch {
      // ignore
    }
    navigate('/sign-in', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page,#f8f7f4)]">
      <header
        className="shrink-0 border-b border-[var(--border,#e5e7eb)] bg-[var(--bg-card,#fff)] px-6 py-4 flex items-center justify-between gap-4"
      >
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Partner program</div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Referral dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/sign-in" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            Sign in help
          </Link>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-8 w-full">
        <Outlet />
      </main>
    </div>
  )
}
