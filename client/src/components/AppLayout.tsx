import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AppLayoutProvider } from '@/contexts/AppLayoutContext'

export function AppLayout() {
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const toggleCollapse = () => setNavCollapsed((c) => !c)
  const openMobileNav = () => setMobileNavOpen(true)
  const closeMobileNav = () => setMobileNavOpen(false)

  return (
    <div className="dashboard-app">
      <div className={`nav-overlay ${mobileNavOpen ? 'visible' : ''}`} onClick={closeMobileNav} aria-hidden />

      <div className="app">
        <nav className={`sidenav ${navCollapsed ? 'collapsed' : ''} ${mobileNavOpen ? 'open' : ''}`} id="sidenav">
          <div className="nav-header">
            <Link to="/" className="logo" aria-label="Takeoff AI home">
              <div className="logo-icon">
                <svg viewBox="0 0 14 14" aria-hidden><path d="M7 1L13 4.5V10.5L7 14L1 10.5V4.5L7 1Z" fill="currentColor" /></svg>
              </div>
              <span className="logo-text">Takeoff AI</span>
            </Link>
            <button type="button" className="collapse-btn" onClick={toggleCollapse} title={navCollapsed ? 'Expand' : 'Collapse'} aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M7.5 2L4 6l3.5 4" /></svg>
            </button>
          </div>

          <div className="nav-body">
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
            <NavLink to="/directory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 2h6v12H2zM8 2h6v12H8zM8 2v12M3 5h4M3 8h4M3 11h3" /></svg>
              <span className="nav-label">Directory</span>
            </NavLink>

            <div className="nav-divider" />
            <div className="nav-section-label">Account</div>
          </div>

          <div style={{ padding: '0 8px' }}>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              <span className="nav-label">Settings</span>
            </NavLink>
          </div>
          <div className="nav-divider" />
          <div className="nav-actions">
            <button type="button" className="icon-btn" aria-label="Notifications">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M8 2a4.5 4.5 0 0 1 4.5 4.5c0 3 1.5 4 1.5 4H2s1.5-1 1.5-4A4.5 4.5 0 0 1 8 2z" /><path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" /></svg>
              <span className="notif-dot" />
            </button>
            <ThemeToggle />
          </div>

          <div className="nav-footer">
            <div className="user-row">
              <div className="user-avatar">KR</div>
              <div className="user-info">
                <div className="user-name">Kyle Reynolds</div>
                <div className="user-role">Project Manager</div>
              </div>
            </div>
          </div>
        </nav>

        <div className={`content-wrap ${navCollapsed ? 'collapsed' : ''}`} id="contentWrap">
          <AppLayoutProvider openMobileNav={openMobileNav}>
            <Outlet />
          </AppLayoutProvider>
        </div>
      </div>
    </div>
  )
}
