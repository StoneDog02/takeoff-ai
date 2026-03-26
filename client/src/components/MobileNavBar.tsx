/** Sticky mobile-only menu control; opens the app sidenav (see AppLayout / EmployeeLayout). */
export function MobileNavBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <div className="mobile-app-nav-shell">
      <button
        type="button"
        className="hamburger shrink-0 mobile-app-nav-trigger"
        onClick={onOpenMenu}
        aria-label="Open menu"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      </button>
    </div>
  )
}
