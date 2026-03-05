import { createContext, useContext, useLayoutEffect, useState } from 'react'

const STORAGE_KEY = 'takeoff-theme'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  // Fallback: sync with class already on <html> (e.g. from index.html script)
  if (document.documentElement.classList.contains('dark')) return 'dark'
  return 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  // Set class explicitly so Tailwind's dark: variant has a clear ancestor.
  // darkMode: 'class' in tailwind.config.js targets .dark; we need it on an ancestor of the app.
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  root.setAttribute('data-theme', theme)
}

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
} | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  // Keep <html> and localStorage in sync with theme (runs on mount and whenever theme changes)
  useLayoutEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = (next: Theme) => {
    applyTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {/* Wrapper with .dark class so Tailwind dark: utilities apply when theme is dark.
          Tailwind v3 darkMode: 'class' matches when .dark is an ancestor. */}
      <div
        id="theme-root"
        className={theme === 'dark' ? 'dark' : ''}
        data-theme={theme}
        suppressHydrationWarning
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
