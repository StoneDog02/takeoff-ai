import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/takeoff', label: 'Takeoff' },
  { to: '/build-lists', label: 'Build Lists' },
]

export function Nav() {
  return (
    <nav className="border-b border-border bg-surface-elevated">
      <div className="max-w-5xl mx-auto px-page py-4 flex items-center gap-6">
        <NavLink to="/" className="font-semibold text-primary">
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
                    ? 'bg-primary text-white'
                    : 'text-muted hover:bg-surface hover:text-gray-900'
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
