import { supabase } from '@/lib/supabaseClient'

/** localStorage key for ?ref= and optional signup field */
export const REFERRAL_STORAGE_KEY = 'referral_code'

/**
 * sessionStorage flag: only set right before SignupWizard calls `onSignUp`, so we never
 * POST apply-referral on a normal sign-in when `referral_code` might still be in localStorage.
 */
const REFERRAL_SIGNUP_INTENT_KEY = 'referral_signup_pending'

export function persistReferralCodeFromUrl(search: string): void {
  try {
    const q = search.startsWith('?') ? search.slice(1) : search
    const ref = new URLSearchParams(q).get('ref')?.trim()
    if (ref) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, ref)
    }
  } catch {
    // ignore storage errors
  }
}

/** Manual entry overrides any URL-captured code for the next signup attempt. */
export function persistReferralCodeFromManualInput(code: string): void {
  try {
    const t = code.trim()
    if (t) localStorage.setItem(REFERRAL_STORAGE_KEY, t)
  } catch {
    // ignore
  }
}

export function setReferralSignupIntent(): void {
  try {
    sessionStorage.setItem(REFERRAL_SIGNUP_INTENT_KEY, '1')
  } catch {
    // ignore
  }
}

export function clearReferralSignupIntent(): void {
  try {
    sessionStorage.removeItem(REFERRAL_SIGNUP_INTENT_KEY)
  } catch {
    // ignore
  }
}

/**
 * After SIGNED_IN: if user just completed the signup wizard, consume referral_code and call apply-referral.
 * Errors are swallowed; localStorage is cleared after an attempt when a session exists.
 */
export async function tryApplyStoredReferralCode(): Promise<void> {
  if (!supabase) return
  try {
    if (sessionStorage.getItem(REFERRAL_SIGNUP_INTENT_KEY) !== '1') return
  } catch {
    return
  }

  let code = ''
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY)
    code = typeof raw === 'string' ? raw.trim() : ''
  } catch {
    return
  }
  if (!code) {
    clearReferralSignupIntent()
    return
  }

  let userId: string | null = null
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    userId = session?.user?.id ?? null
  } catch {
    return
  }
  if (!userId) {
    // Email confirmation: wait until a later SIGNED_IN when session exists.
    return
  }

  try {
    await supabase.functions.invoke('apply-referral', {
      body: { code, referee_id: userId },
    })
  } catch {
    // silent — do not block auth
  } finally {
    try {
      localStorage.removeItem(REFERRAL_STORAGE_KEY)
    } catch {
      // ignore
    }
    clearReferralSignupIntent()
  }
}
