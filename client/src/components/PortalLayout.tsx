import { Outlet } from 'react-router-dom'
import { PageTitle } from '@/components/PageTitle'

/** Public token portals live outside `RootLayout`; still sync `document.title`. */
export function PortalLayout() {
  return (
    <>
      <PageTitle />
      <Outlet />
    </>
  )
}
