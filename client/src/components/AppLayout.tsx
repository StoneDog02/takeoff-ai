import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PreviewBanner } from '@/components/PreviewBanner'
import { PublicDemoBanner } from '@/components/PublicDemoBanner'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { MobileNavBar } from '@/components/MobileNavBar'
import { AppLayoutProvider } from '@/contexts/AppLayoutContext'
import { OfflineSyncBanners } from '@/components/OfflineSyncBanners'
import { SupportBubble } from '@/components/support/SupportBubble'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { useSupportNewCount } from '@/hooks/useSupportNewCount'
import { useAuth } from '@/contexts/AuthContext'
import { usePreview } from '@/contexts/PreviewContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import type { FeatureFlag } from '@/lib/featureFlags'
import { TrialBanner, TRIAL_BANNER_SESSION_KEY } from '@/components/TrialBanner'
import { TrialWeekLeftModal } from '@/components/billing/TrialWeekLeftModal'
import { supabase } from '@/lib/supabaseClient'
import { api } from '@/api/client'
import { isPublicDemo, exitPublicDemo } from '@/lib/publicDemo'
import type { DismissedAlert } from '@/api/client'

function GatedNavItem({
  to,
  feature,
  end,
  children,
}: {
  to: string
  feature?: FeatureFlag
  end?: boolean
  children: ReactNode
}) {
  const { hasFeature, isLoading: subscriptionLoading } = useSubscription()
  const locked = feature != null && !subscriptionLoading && !hasFeature(feature)

  if (locked) {
    return (
      <Link
        to="/settings/billing"
        className="nav-item nav-item--locked"
        title="Upgrade your plan to unlock"
      >
        {children}
        <Lock className="nav-lock-icon" size={14} strokeWidth={2} aria-hidden />
      </Link>
    )
  }

  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      {children}
    </NavLink>
  )
}

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
  const isAffiliateActive = location.pathname.startsWith('/affiliate')
  const { user, isAdmin, type, role_label, employee, loading, has_affiliate_portal, refetch } = useAuth()
  const { previewRole } = usePreview()
  const { isTrialing, trialDaysRemaining, isLoading: subscriptionOrAuthLoading } = useSubscription()
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TRIAL_BANNER_SESSION_KEY) === '1',
  )
  const showAdminNavEnabled = isAdmin && previewRole !== 'project_manager'
  const supportNewCount = useSupportNewCount(showAdminNavEnabled)
  const { isOnline, syncPending, syncing } = useOfflineSync()

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

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (loading) return
    if (type === 'employee') navigate('/employee/clock', { replace: true })
  }, [type, loading, navigate])

  useEffect(() => {
    if (loading) return
    if (!isAdmin || previewRole === 'project_manager') return
    if (location.pathname.startsWith('/admin')) return
    if (location.pathname.startsWith('/employee')) return
    navigate('/admin', { replace: true })
  }, [isAdmin, previewRole, location.pathname, loading, navigate])

  // Require auth: redirect to sign-in when session is gone (e.g. after sign out)
  if (!loading && !user) {
    return <Navigate to="/sign-in" replace />
  }
  // Avoid flashing "User" / generic dashboard while auth is loading
  if (loading) {
    return (
      <div className="dashboard-app flex items-center justify-center min-h-screen">
        <LoadingSkeleton variant="inline" lines={3} />
      </div>
    )
  }

  const rawDisplayName =
    employee?.name ??
    user?.display_name ??
    user?.full_name ??
    (user?.email ? user.email.split('@')[0].replace(/^./, (c) => c.toUpperCase()) : null) ??
    'User'
  // If name looks like email local part (e.g. "Stoney.harward"), show as "Stoney Harward"
  const displayName =
    rawDisplayName.includes('.') && !rawDisplayName.includes(' ')
      ? rawDisplayName
          .split('.')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join(' ')
      : rawDisplayName
  const roleLabel = employee?.role ?? role_label ?? (isAdmin ? 'Admin' : 'Project Manager')
  // Initials: first + last name (e.g. "John Doe" → "JD"), or first two chars of display/email when single word
  const initials =
    displayName !== 'User'
      ? displayName
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || displayName.slice(0, 2).toUpperCase()
      : (user?.email ? user.email.split('@')[0].slice(0, 2).toUpperCase() : 'U')

  const showAdminNav = showAdminNavEnabled
  const showPmNav = !isAdmin || previewRole === 'project_manager'

  const showTrialBanner =
    !subscriptionOrAuthLoading && isTrialing && !trialBannerDismissed
  const trialBannerUrgent = trialDaysRemaining != null && trialDaysRemaining <= 3

  function dismissTrialBanner() {
    sessionStorage.setItem(TRIAL_BANNER_SESSION_KEY, '1')
    setTrialBannerDismissed(true)
  }

  const toggleCollapse = () => setNavCollapsed((c) => !c)
  const openMobileNav = () => setMobileNavOpen(true)
  const closeMobileNav = () => setMobileNavOpen(false)

  async function handleLogout() {
    if (isPublicDemo()) {
      const exitTo = exitPublicDemo()
      await refetch()
      navigate(exitTo ?? '/', { replace: true })
      return
    }
    await supabase?.auth.signOut()
    navigate('/sign-in', { replace: true })
  }

  return (
    <div className={`dashboard-app ${showTrialBanner ? 'dashboard-app--trial-banner' : ''}`}>
      {showTrialBanner ? (
        <TrialBanner
          trialDaysRemaining={trialDaysRemaining}
          urgent={trialBannerUrgent}
          onDismiss={dismissTrialBanner}
        />
      ) : null}
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
                <GatedNavItem to="/dashboard">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="1" y="1" width="6" height="6" rx="1.5" /><rect x="9" y="1" width="6" height="6" rx="1.5" /><rect x="1" y="9" width="6" height="6" rx="1.5" /><rect x="9" y="9" width="6" height="6" rx="1.5" /></svg>
                  <span className="nav-label">Dashboard</span>
                </GatedNavItem>
                <GatedNavItem to="/projects" feature="projects">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M2 6h12M6 2v12" /></svg>
                  <span className="nav-label">Projects</span>
                </GatedNavItem>
                <GatedNavItem to="/financials" feature="bankLink">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 12l4-6 3 4 5-8" /><path d="M2 12h12" /></svg>
                  <span className="nav-label">Financials</span>
                </GatedNavItem>
                <GatedNavItem to="/documents" feature="documentVault">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <rect x="2.5" y="1.5" width="11" height="13" rx="1.25" />
                    <line x1="5" y1="5" x2="11" y2="5" />
                    <line x1="5" y1="8" x2="11" y2="8" />
                    <line x1="5" y1="11" x2="9" y2="11" />
                    <circle cx="11.25" cy="4" r="0.65" fill="currentColor" stroke="none" />
                  </svg>
                  <span className="nav-label">Documents</span>
                </GatedNavItem>

                <div className="nav-divider" />
                <div className="nav-section-label">Manage</div>
                <GatedNavItem to="/teams" feature="crewBuilder">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M8 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" /></svg>
                  <span className="nav-label">Teams</span>
                </GatedNavItem>
                <GatedNavItem to="/payroll" feature="payroll">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 12h3l2-4 2 6 2-4 3 2" /><path d="M2 14h12" /></svg>
                  <span className="nav-label">Payroll</span>
                </GatedNavItem>
                <GatedNavItem to="/directory" feature="directory">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 2h6v12H2zM8 2h6v12H8zM8 2v12M3 5h4M3 8h4M3 11h3" /></svg>
                  <span className="nav-label">Directory</span>
                </GatedNavItem>

                <div className="nav-divider" />
              </>
            )}
            {has_affiliate_portal && (
              <>
                <div className="nav-section-label">Partner</div>
                <NavLink
                  to="/affiliate"
                  className={() => `nav-item ${isAffiliateActive ? 'active' : ''}`}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M8 1.5 14 5v6l-6 3.5L2 11V5l6-3.5z" />
                    <path d="M8 1.5v13M2 5l6 3.5L14 5" />
                  </svg>
                  <span className="nav-label">Referrals</span>
                </NavLink>
                <div className="nav-divider" />
              </>
            )}
            {showAdminNav && (
              <>
                <div className="nav-section-label">Admin</div>
                <NavLink end to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 12h3l2-4 2 6 2-4 3 2" /><path d="M2 14h12" /></svg>
                  <span className="nav-label">Admin</span>
                </NavLink>
                <NavLink
                  to="/admin/affiliates"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M8 1.5 14 5v6l-6 3.5L2 11V5l6-3.5z" />
                    <path d="M8 1.5v13M2 5l6 3.5L14 5" />
                  </svg>
                  <span className="nav-label">Affiliates</span>
                </NavLink>
                <NavLink
                  to="/admin/support"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6l-2 2V4z" /></svg>
                  <span className="nav-label">Support Inbox</span>
                  {supportNewCount > 0 ? (
                    <span
                      className="notif-dot support-nav-notif-dot support-nav-notif-dot--pulse"
                      aria-hidden
                    />
                  ) : null}
                  {supportNewCount > 0 ? (
                    <span className="sr-only">
                      {supportNewCount} new support message{supportNewCount === 1 ? '' : 's'}
                    </span>
                  ) : null}
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
          <PublicDemoBanner />
          {previewRole === 'project_manager' && <PreviewBanner />}
          <OfflineSyncBanners isOnline={isOnline} syncPending={syncPending} />
          <AppLayoutProvider openMobileNav={openMobileNav}>
            <MobileNavBar onOpenMenu={openMobileNav} />
            <Outlet />
          </AppLayoutProvider>
        </div>
      </div>

      <TrialWeekLeftModal />
      <SupportBubble connectionStatus={{ isOnline, syncing }} />

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
                      const href = a.type === 'budget_overrun' ? `/projects/${a.entityId}` : a.type === 'estimate' ? '/financials/invoicing' : '/financials/overview'
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
