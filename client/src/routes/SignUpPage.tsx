import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AuthPageLayout } from '@/components/landing/AuthPageLayout'
import SignupWizard, { type SignupWizardForm } from '@/components/landing/SignupWizard'
import { supabase } from '@/lib/supabaseClient'
import { persistReferralCodeFromUrl } from '@/lib/referralCapture'
import { StripeElementsProvider } from '@/lib/stripe'
import { API_BASE } from '@/api/config'
import { createInitialSubscriptionEdge } from '@/lib/billingEdge'
import {
  clearPendingSignupSubscription,
  savePendingSignupSubscription,
} from '@/lib/pendingSignupSubscription'

export function SignUpPage() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    persistReferralCodeFromUrl(window.location.search)
  }, [searchParams])

  async function handleSignUp(
    form: SignupWizardForm,
    ctx?: { stripeCustomerId?: string },
  ): Promise<string | undefined> {
    if (!supabase) {
      return 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    }
    const stripeCustomerId = ctx?.stripeCustomerId?.trim() ?? ''
    if (!stripeCustomerId.startsWith('cus_')) {
      return 'Payment profile was not created. Go back to the payment step or contact support.'
    }

    const redirectTo = `${window.location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: redirectTo || undefined,
        data: {
          full_name: [form.firstName, form.lastName].filter(Boolean).join(' ').trim() || undefined,
          company: form.company || undefined,
          company_size: form.companySize || undefined,
          role: form.role || undefined,
          phone: form.phone || undefined,
          trades: form.trades.length ? form.trades : undefined,
          plan: form.plan || undefined,
        },
      },
    })
    if (error) {
      const msg = error.message || ''
      if (msg.includes('already been registered') || msg.includes('already exists') || msg.toLowerCase().includes('already registered')) {
        return 'An account with this email already exists. Sign in instead.'
      }
      return error.message
    }

    const createSubForUser = async (
      userId: string,
      accessToken: string,
    ): Promise<string | undefined> => {
      const { errorMessage, httpStatus } = await createInitialSubscriptionEdge(
        {
          userId,
          stripeCustomerId,
          pricingSelection: form.pricingSelection,
        },
        { accessToken },
      )
      if (errorMessage || httpStatus >= 400) {
        return errorMessage ?? 'Subscription setup failed.'
      }
      clearPendingSignupSubscription()
      return undefined
    }

    // Session present (e.g. email confirmation disabled): create Stripe subscription + DB row immediately.
    // Pass access_token into the Edge call — getSession() may not have persisted yet right after signUp.
    if (data.session?.user?.id) {
      const at = data.session.access_token
      if (!at) {
        return 'Could not start your session. Please sign in and we will finish plan activation.'
      }
      try {
        const err = await createSubForUser(data.session.user.id, at)
        if (err) return err
      } catch {
        return 'Subscription setup failed. Your account was created — please contact support to activate your plan.'
      }
    } else if (data.user?.id) {
      // Email confirmation required: no JWT yet — finish subscription on first SIGNED_IN (see pendingSignupSubscription).
      savePendingSignupSubscription({
        email: form.email.trim(),
        stripeCustomerId,
        pricingSelection: form.pricingSelection,
      })
    } else {
      return 'Account could not be created. Please try again.'
    }

    if (data.session) {
      try {
        await fetch(`${API_BASE}/stripe/financial-connections-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`,
          },
        })
      } catch {
        // Linked banks remain on the Stripe customer; user can sync from Financials.
      }
    }

    return undefined
  }

  return (
    <AuthPageLayout showSignInLink>
      <div className="w-full max-w-[900px] animate-[fadeUp_0.6s_ease_both]">
        <StripeElementsProvider>
          <SignupWizard
            onSignUp={handleSignUp}
          />
        </StripeElementsProvider>
      </div>
    </AuthPageLayout>
  )
}
