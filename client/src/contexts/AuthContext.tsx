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
import { tryApplyStoredReferralCode } from '@/lib/referralCapture'
import { tryCompletePendingSignupSubscription } from '@/lib/pendingSignupSubscription'
import { isPublicDemo, buildSyntheticMeResponse } from '@/lib/publicDemo'

interface AuthState {
  user: MeResponse['user']
  isAdmin: boolean
  bypass_feature_gates: boolean
  loading: boolean
  type: MeResponse['type']
  has_affiliate_portal: boolean
  role_label?: string
  employee?: MeResponse['employee']
  acting_as_employee?: boolean
}

const defaultState: AuthState = {
  user: null,
  isAdmin: false,
  bypass_feature_gates: false,
  loading: true,
  type: 'contractor',
  has_affiliate_portal: false,
}

const AuthContext = createContext<AuthState & { refetch: () => Promise<void> }>({
  ...defaultState,
  refetch: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(defaultState)

  const refetch = useCallback(async () => {
    if (!supabase) {
      if (isPublicDemo()) {
        const me = buildSyntheticMeResponse()
        setState({
          user: me.user,
          isAdmin: me.isAdmin,
          bypass_feature_gates: Boolean(me.bypass_feature_gates),
          loading: false,
          type: me.type,
          has_affiliate_portal: Boolean(me.has_affiliate_portal),
          role_label: me.role_label,
          employee: me.employee,
          acting_as_employee: me.acting_as_employee,
        })
      } else {
        setState((s) => ({ ...s, loading: false }))
      }
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      if (isPublicDemo()) {
        const me = buildSyntheticMeResponse()
        setState({
          user: me.user,
          isAdmin: me.isAdmin,
          bypass_feature_gates: Boolean(me.bypass_feature_gates),
          loading: false,
          type: me.type,
          has_affiliate_portal: Boolean(me.has_affiliate_portal),
          role_label: me.role_label,
          employee: me.employee,
          acting_as_employee: me.acting_as_employee,
        })
      } else {
        setState({
          user: null,
          isAdmin: false,
          bypass_feature_gates: false,
          loading: false,
          type: 'contractor',
          has_affiliate_portal: false,
          role_label: undefined,
          employee: undefined,
          acting_as_employee: undefined,
        })
      }
      return
    }
    try {
      const me = await getMe()
      setState({
        user: me.user,
        isAdmin: me.isAdmin,
        bypass_feature_gates: Boolean(me.bypass_feature_gates),
        loading: false,
        type: me.type,
        has_affiliate_portal: Boolean(me.has_affiliate_portal),
        role_label: me.role_label,
        employee: me.employee,
        acting_as_employee: me.acting_as_employee,
      })
      try {
        await tryCompletePendingSignupSubscription()
      } catch {
        // never block auth
      }
    } catch {
      setState({
        user: null,
        isAdmin: false,
        bypass_feature_gates: false,
        loading: false,
        type: 'contractor',
        has_affiliate_portal: false,
        role_label: undefined,
        employee: undefined,
        acting_as_employee: undefined,
      })
    }
  }, [])

  useEffect(() => {
    const onDemoChange = () => {
      void refetch()
    }
    window.addEventListener('takeoff-public-demo-change', onDemoChange)
    return () => window.removeEventListener('takeoff-public-demo-change', onDemoChange)
  }, [refetch])

  useEffect(() => {
    if (!supabase) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    refetch()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      void (async () => {
        if (event === 'SIGNED_IN') {
          try {
            await tryApplyStoredReferralCode()
          } catch {
            // never block auth
          }
          try {
            await tryCompletePendingSignupSubscription()
          } catch {
            // never block auth
          }
        }
        await refetch()
      })()
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
