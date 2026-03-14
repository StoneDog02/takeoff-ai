import { useNavigate } from 'react-router-dom'
import { AuthPageLayout } from '@/components/landing/AuthPageLayout'
import SignupWizard, { type SignupWizardForm } from '@/components/landing/SignupWizard'
import { supabase } from '@/lib/supabaseClient'
import { StripeElementsProvider } from '@/lib/stripe'
import { API_BASE } from '@/api/config'

export function SignUpPage() {
  const navigate = useNavigate()

  async function handleSignUp(form: SignupWizardForm): Promise<string | undefined> {
    if (!supabase) {
      return 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    }
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
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
    if (error) return error.message

    // Create Stripe subscription with 14-day trial when we have a session (e.g. email confirmation disabled)
    if (data.session && form.plan) {
      try {
        const res = await fetch(`${API_BASE}/stripe/create-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ email: form.email, price_id: form.plan }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return (json as { error?: string }).error || 'Subscription setup failed.'
      } catch {
        return 'Subscription setup failed. Your account was created — please contact support to activate your plan.'
      }
    }

    return undefined
  }

  function handleGoToDashboard() {
    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthPageLayout showSignInLink>
      <div className="w-full max-w-[900px] animate-[fadeUp_0.6s_ease_both]">
        <StripeElementsProvider>
          <SignupWizard
            onSignUp={handleSignUp}
            onGoToDashboard={handleGoToDashboard}
          />
        </StripeElementsProvider>
      </div>
    </AuthPageLayout>
  )
}
