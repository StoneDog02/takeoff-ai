import type { ReactNode } from 'react'

interface TeamsTabLayoutProps {
  title: string
  description: string
  toolbar?: ReactNode
  children: ReactNode
}

/**
 * Consistent layout for each Teams sub-tab: section title + one-line description,
 * optional toolbar row, then main content. Keeps controls at the top and makes
 * each tab's purpose obvious.
 */
export function TeamsTabLayout({ title, description, toolbar, children }: TeamsTabLayoutProps) {
  return (
    <div className="teams-tab-layout">
      <header className="teams-tab-header">
        <h2 className="teams-tab-title">{title}</h2>
        <p className="teams-tab-description">{description}</p>
        {toolbar && <div className="teams-tab-toolbar">{toolbar}</div>}
      </header>
      <div className="teams-tab-content">{children}</div>
    </div>
  )
}
