import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getMe, type MeResponse } from '@/api/me'

interface AuthState {
  user: MeResponse['user']
  isAdmin: boolean
  loading: boolean
  type: MeResponse['type']
  role_label?: string
  employee?: MeResponse['employee']
}

const defaultState: AuthState = {
  user: null,
  isAdmin: false,
  loading: true,
  type: 'contractor',
}

const AuthContext = createContext<AuthState & { refetch: () => Promise<void> }>({
  ...defaultState,
  refetch: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(defaultState)

  const refetch = useCallback(async () => {
    if (!supabase) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setState({
        user: null,
        isAdmin: false,
        loading: false,
        type: 'contractor',
        role_label: undefined,
      })
      return
    }
    try {
      const me = await getMe()
      setState({
        user: me.user,
        isAdmin: me.isAdmin,
        loading: false,
        type: me.type,
        role_label: me.role_label,
        employee: me.employee,
      })
    } catch {
      setState({
        user: null,
        isAdmin: false,
        loading: false,
        type: 'contractor',
        role_label: undefined,
      })
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    refetch()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refetch()
    })
    return () => subscription.unsubscribe()
  }, [refetch])

  return (
    <AuthContext.Provider value={{ ...state, refetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
