import { Outlet } from 'react-router-dom'
import { Nav } from './Nav'

export function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 p-page">
        <Outlet />
      </main>
    </div>
  )
}
