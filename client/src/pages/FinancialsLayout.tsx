import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

const TAB_REDIRECTS: Record<string, string> = {
  overview: '/financials/overview',
  transactions: '/financials/transactions',
  reports: '/financials/reports',
  invoicing: '/financials/invoicing',
}

export function FinancialsLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname !== '/financials') return
    const tab = new URLSearchParams(location.search).get('tab')
    if (!tab) return
    const target = TAB_REDIRECTS[tab]
    if (target) navigate(target, { replace: true })
  }, [location.pathname, location.search, navigate])

  return (
    <div>
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 pt-6">
        <div className="estimates-page__tabs-row">
          <nav className="estimates-page__tabs estimates-page__tabs--bar" aria-label="Financials sections">
            <NavLink to="/financials/overview" className={({ isActive }) => `estimates-page__tab ${isActive ? 'active' : ''}`}>
              Overview
            </NavLink>
            <NavLink to="/financials/transactions" className={({ isActive }) => `estimates-page__tab ${isActive ? 'active' : ''}`}>
              Transactions
            </NavLink>
            <NavLink to="/financials/reports" className={({ isActive }) => `estimates-page__tab ${isActive ? 'active' : ''}`}>
              Reports
            </NavLink>
            <NavLink to="/financials/invoicing" className={({ isActive }) => `estimates-page__tab ${isActive ? 'active' : ''}`}>
              Invoicing
            </NavLink>
          </nav>
        </div>
      </div>
      <Outlet />
    </div>
  )
}
