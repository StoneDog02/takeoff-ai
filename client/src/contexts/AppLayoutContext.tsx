import { createContext, useContext } from 'react'

export interface AppLayoutContextValue {
  openMobileNav: () => void
}

const AppLayoutContext = createContext<AppLayoutContextValue | null>(null)

export function AppLayoutProvider({ children, openMobileNav }: { children: React.ReactNode; openMobileNav: () => void }) {
  return (
    <AppLayoutContext.Provider value={{ openMobileNav }}>
      {children}
    </AppLayoutContext.Provider>
  )
}

export function useAppLayout() {
  const ctx = useContext(AppLayoutContext)
  return ctx
}
