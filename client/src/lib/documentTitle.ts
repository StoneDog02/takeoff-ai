/** Appended to every route-specific tab title after a pipe. */
export const DOCUMENT_TITLE_SUFFIX = ' | Proj-X – Construction Management Software'

/**
 * Browser tab title: "[Page Name] | Proj-X – Construction Management Software"
 */
export function getDocumentTitle(pathname: string, _search: string = ''): string {
  const p = pathname.replace(/\/$/, '') || '/'

  if (p === '/' || p === '/landing') return `Home${DOCUMENT_TITLE_SUFFIX}`

  const map: Record<string, string> = {
    '/privacy': 'Privacy',
    '/terms': 'Terms',
    '/sign-in': 'Sign in',
    '/sign-up': 'Sign up',
    '/affiliate': 'Partner dashboard',
    '/affiliate/setup': 'Partner setup',
    '/auth/callback': 'Signing in',
    '/accept-invite': 'Invite',
    '/dashboard': 'Dashboard',
    '/projects': 'Projects',
    '/financials': 'Financials',
    '/financials/overview': 'Financials',
    '/financials/transactions': 'Transactions',
    '/financials/reports': 'Reports',
    '/financials/invoicing': 'Invoicing',
    '/accounting': 'Accounting',
    '/documents': 'Documents',
    '/teams': 'Teams',
    '/payroll': 'Payroll',
    '/directory': 'Directory',
    '/settings': 'Settings',
    '/admin': 'Admin',
    '/admin/affiliates': 'Affiliates',
    '/admin/support': 'Support Inbox',
    '/takeoff': 'Takeoff',
    '/build-lists': 'Build lists',
    '/employee': 'Clock',
    '/employee/clock': 'Clock',
    '/employee/hours': 'My hours',
    '/employee/jobs': 'My jobs',
    '/employee/daily-logs': 'Daily logs',
    '/employee/messages': 'Messages',
    '/employee/profile': 'Profile',
  }

  if (map[p]) return `${map[p]}${DOCUMENT_TITLE_SUFFIX}`

  if (p.startsWith('/projects/')) return `Project${DOCUMENT_TITLE_SUFFIX}`
  if (p.startsWith('/build-lists/')) return `Build list${DOCUMENT_TITLE_SUFFIX}`
  if (p.startsWith('/bid/')) return `Bid portal${DOCUMENT_TITLE_SUFFIX}`
  if (p.startsWith('/estimate/')) return `Estimate${DOCUMENT_TITLE_SUFFIX}`
  if (p.startsWith('/invoice/')) return `Invoice${DOCUMENT_TITLE_SUFFIX}`

  return `App${DOCUMENT_TITLE_SUFFIX}`
}
