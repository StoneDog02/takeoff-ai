import { createContext, useContext } from 'react'

export type SettingsMobileNavValue = { onBack: () => void } | null

export const SettingsMobileNavContext = createContext<SettingsMobileNavValue>(null)

export function useSettingsMobileNav() {
  return useContext(SettingsMobileNavContext)
}
