/** Shown after an em dash or middle dot in tab titles: "Dashboard · Proj-X" */
export const APP_TAB_NAME = 'Proj-X'

/** Landing / marketing pages — short, scannable (avoid long em-dash taglines in every tab). */
export const LANDING_DOCUMENT_TITLE = 'Proj-X · Takeoffs & job management'

const SEP = ' · '

/**
 * Browser tab title for the current path. Pattern: "{context} · Proj-X" so tabs stay
 * distinct and support metadata (e.g. support page_title) stays readable.
 */
export function getDocumentTitle(pathname: string, search: string = ''): string {
  const p = pathname.replace(/\/$/, '') || '/'

  if (p === '/' || p === '/landing') return LANDING_DOCUMENT_TITLE

  if (p === '/financials') {
    const tab = new URLSearchParams(search).get('tab')
    if (tab === 'invoicing') return `Invoicing${SEP}${APP_TAB_NAME}`
  }

  const map: Record<string, string> = {
    '/privacy': 'Privacy',
    '/terms': 'Terms',
    '/sign-in': 'Sign in',
    '/sign-up': 'Sign up',
    '/auth/callback': 'Signing in',
    '/accept-invite': 'Invite',
    '/dashboard': 'Dashboard',
    '/projects': 'Projects',
    '/financials': 'Financials',
    '/accounting': 'Accounting',
    '/invoicing': 'Invoicing',
    '/documents': 'Documents',
    '/teams': 'Teams',
    '/payroll': 'Payroll',
    '/directory': 'Directory',
    '/settings': 'Settings',
    '/admin': 'Admin',
    '/admin/support': 'Support Inbox',
    '/takeoff': 'Takeoff',
    '/build-lists': 'Build lists',
    '/employee': 'Clock',
    '/employee/clock': 'Clock',
    '/employee/hours': 'My hours',
    '/employee/jobs': 'My jobs',
    '/employee/messages': 'Messages',
    '/employee/profile': 'Profile',
  }

  if (map[p]) return `${map[p]}${SEP}${APP_TAB_NAME}`

  if (p.startsWith('/projects/')) return `Project${SEP}${APP_TAB_NAME}`
  if (p.startsWith('/build-lists/')) return `Build list${SEP}${APP_TAB_NAME}`
  if (p.startsWith('/bid/')) return `Bid portal${SEP}${APP_TAB_NAME}`
  if (p.startsWith('/estimate/')) return `Estimate${SEP}${APP_TAB_NAME}`
  if (p.startsWith('/invoice/')) return `Invoice${SEP}${APP_TAB_NAME}`

  return APP_TAB_NAME
}
