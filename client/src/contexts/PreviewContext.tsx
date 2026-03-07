import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'

const STORAGE_KEY = 'takeoff-admin-preview'

export type PreviewRole = 'project_manager' | 'employee'

export interface PreviewEmployee {
  id: string
  name: string
}

interface StoredPreview {
  role: PreviewRole
  employee: PreviewEmployee | null
}

function loadStored(): StoredPreview | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPreview
    if (parsed.role !== 'project_manager' && parsed.role !== 'employee') return null
    return parsed
  } catch {
    return null
  }
}

function saveStored(value: StoredPreview | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

interface PreviewState {
  previewRole: PreviewRole | null
  previewEmployee: PreviewEmployee | null
  isPreviewing: boolean
}

interface PreviewContextValue extends PreviewState {
  setPreviewAsPm: () => void
  setPreviewAsEmployee: (id: string, name: string) => void
  clearPreview: () => void
}

const defaultState: PreviewState = {
  previewRole: null,
  previewEmployee: null,
  isPreviewing: false,
}

const defaultValue: PreviewContextValue = {
  ...defaultState,
  setPreviewAsPm: () => {},
  setPreviewAsEmployee: () => {},
  clearPreview: () => {},
}

const PreviewContext = createContext<PreviewContextValue>(defaultValue)

export function PreviewProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  const [state, setState] = useState<PreviewState>(() => {
    const stored = loadStored()
    if (!stored) return defaultState
    return {
      previewRole: stored.role,
      previewEmployee: stored.employee,
      isPreviewing: true,
    }
  })

  useEffect(() => {
    if (!isAdmin) {
      setState(defaultState)
      saveStored(null)
    }
  }, [isAdmin])

  const setPreviewAsPm = useCallback(() => {
    const next = {
      previewRole: 'project_manager' as const,
      previewEmployee: null,
      isPreviewing: true,
    }
    setState(next)
    saveStored({ role: 'project_manager', employee: null })
  }, [])

  const setPreviewAsEmployee = useCallback((id: string, name: string) => {
    const employee = id && name ? { id, name } : null
    const next = {
      previewRole: 'employee' as const,
      previewEmployee: employee,
      isPreviewing: true,
    }
    setState(next)
    saveStored({ role: 'employee', employee })
  }, [])

  const clearPreview = useCallback(() => {
    setState(defaultState)
    saveStored(null)
  }, [])

  const value: PreviewContextValue = {
    ...state,
    setPreviewAsPm,
    setPreviewAsEmployee,
    clearPreview,
  }

  return (
    <PreviewContext.Provider value={value}>
      {children}
    </PreviewContext.Provider>
  )
}

export function usePreview() {
  return useContext(PreviewContext)
}
