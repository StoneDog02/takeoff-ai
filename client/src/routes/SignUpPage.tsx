import { useNavigate } from 'react-router-dom'
import { AuthPageLayout } from '@/components/landing/AuthPageLayout'
import SignupWizard, { type SignupWizardForm } from '@/components/landing/SignupWizard'
import { supabase } from '@/lib/supabaseClient'

export function SignUpPage() {
  const navigate = useNavigate()

  async function handleSignUp(form: SignupWizardForm): Promise<string | undefined> {
    if (!supabase) {
      return 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    }
    const { error } = await supabase.auth.signUp({
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
    return undefined
  }

  function handleGoToDashboard() {
    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthPageLayout showSignInLink>
      <div className="w-full max-w-[900px] animate-[fadeUp_0.6s_ease_both]">
        <SignupWizard
          onSignUp={handleSignUp}
          onGoToDashboard={handleGoToDashboard}
        />
      </div>
    </AuthPageLayout>
  )
}
