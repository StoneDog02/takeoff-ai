import { Outlet, useLocation } from 'react-router-dom'

const APP_ROUTES = ['/dashboard', '/projects', '/estimates', '/revenue', '/teams', '/payroll', '/directory', '/contractors', '/messages', '/settings']

export function RootLayout() {
  const location = useLocation()
  const isMarketing =
    location.pathname === '/' ||
    location.pathname === '/landing' ||
    location.pathname === '/sign-up' ||
    location.pathname === '/sign-in'
  const isAppRoute = APP_ROUTES.some((route) => location.pathname === route || (route !== '/settings' && route !== '/messages' && location.pathname.startsWith(route + '/')))

  return (
    <div className="flex flex-col w-full min-h-screen">
      <main className={`flex-1 w-full min-h-0 flex flex-col ${isMarketing || isAppRoute ? 'p-0' : 'p-page'}`}>
        <Outlet />
      </main>
    </div>
  )
}
