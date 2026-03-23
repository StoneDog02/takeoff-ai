import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getDocumentTitle } from '@/lib/documentTitle'

/** Syncs `document.title` to the current route (see `getDocumentTitle`). */
export function PageTitle() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    document.title = getDocumentTitle(pathname, search)
  }, [pathname, search])

  return null
}
