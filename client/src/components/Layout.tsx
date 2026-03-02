import { Outlet, useLocation } from 'react-router-dom'
import { Nav } from './Nav'

export function RootLayout() {
  const location = useLocation()
  const isMarketing =
    location.pathname === '/' ||
    location.pathname === '/landing' ||
    location.pathname === '/sign-up' ||
    location.pathname === '/sign-in'

  return (
    <div className="min-h-screen flex flex-col w-full">
      {!isMarketing && <Nav />}
      <main className={`flex-1 w-full ${isMarketing ? 'p-0' : 'p-page'}`}>
        <Outlet />
      </main>
    </div>
  )
}
