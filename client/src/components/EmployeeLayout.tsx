import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PreviewBanner } from '@/components/PreviewBanner'
import { AppLayoutProvider } from '@/contexts/AppLayoutContext'
import { SupportBubble } from '@/components/support/SupportBubble'
import { getMe } from '@/api/me'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { usePreview } from '@/contexts/PreviewContext'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { MobileNavBar } from '@/components/MobileNavBar'

export function EmployeeLayout() {
  const [ready, setReady] = useState(false)
  const [employeeName, setEmployeeName] = useState<string | null>(null)
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()
  const { previewRole, clearPreview } = usePreview()

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!supabase) {
        if (!cancelled) setReady(true)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        if (!cancelled) navigate('/sign-in', { replace: true })
        return
      }
      try {
        const me = await getMe()
        if (cancelled) return
        const allowAsEmployee = me.type === 'employee'
        const allowAsAdminPreview = isAdmin && previewRole === 'employee'
        if (allowAsEmployee || allowAsAdminPreview) {
          setReady(true)
          if (me.employee?.name) setEmployeeName(me.employee.name)
        } else {
          navigate('/dashboard', { replace: true })
        }
      } catch {
        if (!cancelled) navigate('/sign-in', { replace: true })
      }
    }
    check()
    return () => { cancelled = true }
  }, [navigate, isAdmin, previewRole])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, location.search])

  const isPreview = isAdmin && previewRole === 'employee'

  const toggleCollapse = () => setNavCollapsed((c) => !c)
  const openMobileNav = () => setMobileNavOpen(true)
  const closeMobileNav = () => setMobileNavOpen(false)

  async function handleLogout() {
    await supabase?.auth.signOut()
    navigate('/sign-in', { replace: true })
  }

  function handleExitPreview() {
    clearPreview()
    navigate('/admin')
  }

  if (!ready) {
    return (
      <div className="dashboard-app flex items-center justify-center min-h-screen">
        <LoadingSkeleton variant="inline" lines={3} />
      </div>
    )
  }

  const initials = employeeName
    ? employeeName.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
    : 'EM'

  return (
    <div className="dashboard-app">
      <div className={`nav-overlay ${mobileNavOpen ? 'visible' : ''}`} onClick={closeMobileNav} aria-hidden />

      <div className="app">
        <nav
          className={`sidenav ${navCollapsed ? 'collapsed' : ''} ${mobileNavOpen ? 'open' : ''}`}
          id="sidenav"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a[href]')) closeMobileNav()
          }}
        >
          <div className="nav-header">
            <Link to="/employee/clock" className="logo" aria-label="Proj-X home">
              <div className="logo-icon">
                <svg viewBox="0 0 14 14" aria-hidden><path d="M7 1L13 4.5V10.5L7 14L1 10.5V4.5L7 1Z" fill="currentColor" /></svg>
              </div>
              <span className="logo-text">Proj-X</span>
            </Link>
            <button type="button" className="collapse-btn" onClick={toggleCollapse} title={navCollapsed ? 'Expand' : 'Collapse'} aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M7.5 2L4 6l3.5 4" /></svg>
            </button>
          </div>

          <div className="nav-body">
            <div className="nav-section-label">Workspace</div>
            <NavLink to="/employee/clock" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><circle cx="8" cy="8" r="6" /><path d="M8 4v4l2 2" /></svg>
              <span className="nav-label">Clock</span>
            </NavLink>
            <NavLink to="/employee/hours" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M2 6h12M6 2v12" /></svg>
              <span className="nav-label">My Hours</span>
            </NavLink>
            <NavLink to="/employee/jobs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M2 6h12M6 2v12" /></svg>
              <span className="nav-label">My Jobs</span>
            </NavLink>
            <NavLink to="/employee/messages" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6l-2 2V4z" /></svg>
              <span className="nav-label">Messages</span>
            </NavLink>

            <div className="nav-divider" />
            <div className="nav-section-label">Account</div>
            <NavLink to="/employee/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M8 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" /></svg>
              <span className="nav-label">Profile</span>
            </NavLink>
          </div>

          <div className="nav-divider" />
          <div className="nav-actions">
            {isPreview ? (
              <button type="button" className="nav-item" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleExitPreview}>
                <span className="nav-label">Exit preview</span>
              </button>
            ) : (
              <button type="button" className="nav-item" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleLogout} aria-label="Log out">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M11 11l3-3-3-3M11 4h3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="nav-label">Log out</span>
              </button>
            )}
            <ThemeToggle className="nav-item" />
          </div>

          <div className="nav-footer">
            <div className="user-row">
              <div className="user-avatar">{initials}</div>
              <div className="user-info">
                <div className="user-name">{employeeName ?? 'Employee'}</div>
                <div className="user-role">Employee</div>
              </div>
            </div>
          </div>
        </nav>

        <div className={`content-wrap ${navCollapsed ? 'collapsed' : ''}`} id="contentWrap">
          {isPreview && <PreviewBanner />}
          <AppLayoutProvider openMobileNav={openMobileNav}>
            <MobileNavBar onOpenMenu={openMobileNav} />
            <Outlet />
          </AppLayoutProvider>
        </div>
      </div>

      <SupportBubble />
    </div>
  )
}
