import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PreviewBanner } from '@/components/PreviewBanner'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { AppLayoutProvider } from '@/contexts/AppLayoutContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePreview } from '@/contexts/PreviewContext'
import { supabase } from '@/lib/supabaseClient'
import { api } from '@/api/client'
import type { DismissedAlert } from '@/api/client'

export function AppLayout() {
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<DismissedAlert[]>([])
  const [dismissedAlertsLoading, setDismissedAlertsLoading] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin, type, role_label, employee } = useAuth()

  const displayName =
    employee?.name ??
    user?.display_name ??
    user?.full_name ??
    (user?.email ? user.email.split('@')[0].replace(/^./, (c) => c.toUpperCase()) : null) ??
    'User'
  const roleLabel = employee?.role ?? role_label ?? (isAdmin ? 'Admin' : 'Project Manager')
  const initials =
    displayName !== 'User'
      ? displayName
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || displayName.slice(0, 2).toUpperCase()
      : 'U'

  useEffect(() => {
    if (!profileMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileMenuOpen])


  useEffect(() => {
    if (!notificationsPanelOpen) return
    setDismissedAlertsLoading(true)
    api.dashboard.getDismissedAlerts().then((list) => {
      setDismissedAlerts(list)
      setDismissedAlertsLoading(false)
    }).catch(() => setDismissedAlertsLoading(false))
  }, [notificationsPanelOpen])
  const { previewRole } = usePreview()
  const showAdminNav = isAdmin && previewRole !== 'project_manager'
  const showPmNav = !isAdmin || previewRole === 'project_manager'

  useEffect(() => {
    if (type === 'employee') navigate('/employee/clock', { replace: true })
  }, [type, navigate])

  useEffect(() => {
    if (!isAdmin || previewRole === 'project_manager') return
    if (location.pathname !== '/admin') navigate('/admin', { replace: true })
  }, [isAdmin, previewRole, location.pathname, navigate])

  const toggleCollapse = () => setNavCollapsed((c) => !c)
  const openMobileNav = () => setMobileNavOpen(true)
  const closeMobileNav = () => setMobileNavOpen(false)

  async function handleLogout() {
    await supabase?.auth.signOut()
    navigate('/sign-in', { replace: true })
  }

  return (
    <div className="dashboard-app">
      <div className={`nav-overlay ${mobileNavOpen ? 'visible' : ''}`} onClick={closeMobileNav} aria-hidden />

      <div className="app">
        <nav className={`sidenav ${navCollapsed ? 'collapsed' : ''} ${mobileNavOpen ? 'open' : ''}`} id="sidenav">
          <div className="nav-header">
            <Link to="/" className="logo" aria-label="Proj-X home">
              <div className="logo-icon">
                <span className="logo-p" aria-hidden>P</span>
              </div>
              <span className="logo-text">Proj-X</span>
            </Link>
            <button type="button" className="collapse-btn" onClick={toggleCollapse} title={navCollapsed ? 'Expand' : 'Collapse'} aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M7.5 2L4 6l3.5 4" /></svg>
            </button>
          </div>

          <div className="nav-body">
            {showPmNav && (
              <>
                <div className="nav-section-label">Workspace</div>
                <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="1" y="1" width="6" height="6" rx="1.5" /><rect x="9" y="1" width="6" height="6" rx="1.5" /><rect x="1" y="9" width="6" height="6" rx="1.5" /><rect x="9" y="9" width="6" height="6" rx="1.5" /></svg>
                  <span className="nav-label">Dashboard</span>
                </NavLink>
                <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M2 6h12M6 2v12" /></svg>
                  <span className="nav-label">Projects</span>
                </NavLink>
                <NavLink to="/estimates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 12V4l6-2 6 2v8l-6 2-6-2z" /></svg>
                  <span className="nav-label">Estimates</span>
                </NavLink>
                <NavLink to="/revenue" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 12l4-6 3 4 5-8" /><path d="M2 12h12" /></svg>
                  <span className="nav-label">Revenue</span>
                </NavLink>

                <div className="nav-divider" />
                <div className="nav-section-label">Manage</div>
                <NavLink to="/teams" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M8 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" /></svg>
                  <span className="nav-label">Teams</span>
                </NavLink>
                <NavLink to="/payroll" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 12h3l2-4 2 6 2-4 3 2" /><path d="M2 14h12" /></svg>
                  <span className="nav-label">Payroll</span>
                </NavLink>
                <NavLink to="/directory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 2h6v12H2zM8 2h6v12H8zM8 2v12M3 5h4M3 8h4M3 11h3" /></svg>
                  <span className="nav-label">Directory</span>
                </NavLink>

                <div className="nav-divider" />
              </>
            )}
            {showAdminNav && (
              <>
                <div className="nav-section-label">Admin</div>
                <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 12h3l2-4 2 6 2-4 3 2" /><path d="M2 14h12" /></svg>
                  <span className="nav-label">Admin</span>
                </NavLink>
                <div className="nav-divider" />
              </>
            )}
          </div>

          <div className="nav-footer profile-menu-wrap" ref={profileMenuRef}>
            {profileMenuOpen && (
              <div className="profile-menu-popup" role="menu">
                <Link to="/settings" className="profile-menu-item" onClick={() => setProfileMenuOpen(false)} role="menuitem">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                  <span>Settings</span>
                </Link>
                <button
                  type="button"
                  className="profile-menu-item profile-menu-item-notif-btn"
                  onClick={() => {
                    setNotificationsPanelOpen(true)
                    setProfileMenuOpen(false)
                  }}
                  role="menuitem"
                >
                  <span className="profile-menu-item-icon-wrap">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M8 2a4.5 4.5 0 0 1 4.5 4.5c0 3 1.5 4 1.5 4H2s1.5-1 1.5-4A4.5 4.5 0 0 1 8 2z" /><path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" /></svg>
                  </span>
                  <span>Notifications</span>
                </button>
                <ThemeToggle className="profile-menu-item" />
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={handleLogout}
                  role="menuitem"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M11 11l3-3-3-3M11 4h3" /></svg>
                  <span>Log out</span>
                </button>
              </div>
            )}
            <button
              type="button"
              className="nav-footer-trigger"
              onClick={() => setProfileMenuOpen((o) => !o)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Open profile menu"
            >
              <div className="user-row">
                <div className="user-avatar" aria-hidden>{initials}</div>
                <div className="user-info">
                  <div className="user-name">{displayName}</div>
                  <div className="user-role">{roleLabel}</div>
                </div>
              </div>
            </button>
          </div>
        </nav>

        <div className={`content-wrap ${navCollapsed ? 'collapsed' : ''}`} id="contentWrap">
          {previewRole === 'project_manager' && <PreviewBanner />}
          <AppLayoutProvider openMobileNav={openMobileNav}>
            <Outlet />
          </AppLayoutProvider>
        </div>
      </div>

      {notificationsPanelOpen && (
        <>
          <div className="notifications-panel-overlay" onClick={() => setNotificationsPanelOpen(false)} aria-hidden />
          <div className="notifications-panel" role="dialog" aria-label="Notifications">
            <div className="notifications-panel-header">
              <h2 className="notifications-panel-title">Notifications</h2>
              <button type="button" className="notifications-panel-close" onClick={() => setNotificationsPanelOpen(false)} aria-label="Close notifications">
                ×
              </button>
            </div>
            <div className="notifications-panel-body">
              <div className="notifications-panel-section">
                <h3 className="notifications-panel-section-title">Closed alerts</h3>
                {dismissedAlertsLoading ? (
                  <div className="px-4 py-3">
                    <LoadingSkeleton variant="inline" lines={3} />
                  </div>
                ) : dismissedAlerts.length > 0 ? (
                  <ul className="notifications-panel-alerts" role="list">
                    {dismissedAlerts.map((a) => {
                      const href = a.type === 'budget_overrun' ? `/projects/${a.entityId}` : a.type === 'estimate' ? '/estimates' : '/revenue'
                      return (
                        <li key={a.id}>
                          <Link to={href} className="notifications-panel-alert" onClick={() => setNotificationsPanelOpen(false)}>
                            <span className="notifications-panel-alert-label">{a.label}</span>
                            <span className="notifications-panel-alert-sub">{a.sub}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="notifications-panel-empty">No closed alerts</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
