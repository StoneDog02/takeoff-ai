import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/takeoff', label: 'Takeoff' },
  { to: '/build-lists', label: 'Build Lists' },
  { to: '/projects', label: 'Projects' },
  { to: '/estimates', label: 'Estimates' },
  { to: '/teams', label: 'Teams' },
  { to: '/revenue', label: 'Revenue' },
  { to: '/settings', label: 'Settings' },
]

export function Nav() {
  return (
    <nav className="border-b border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3">
      <div className="max-w-5xl mx-auto px-page py-4 flex items-center gap-6">
        <NavLink to="/" className="font-semibold text-accent">
          Takeoff AI
        </NavLink>
        <div className="flex gap-1">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-gray-600 dark:text-white-dim hover:bg-gray-50 dark:hover:bg-dark-4 hover:text-gray-900 dark:hover:text-landing-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
