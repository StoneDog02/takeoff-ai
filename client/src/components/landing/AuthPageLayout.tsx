import { ReactNode } from 'react'
import { AuthNav } from './AuthNav'

type AuthPageLayoutProps = {
  /** When true, show "Sign in" in nav (for sign-up page); when false, show "Get Started" (for sign-in page) */
  showSignInLink?: boolean
  children: ReactNode
}

export function AuthPageLayout({ showSignInLink = false, children }: AuthPageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col w-full bg-dark text-landing-white font-dm-sans landing-noise">
      <AuthNav showSignIn={showSignInLink} />
      {/* Hero-style background */}
      <div className="fixed inset-0 hero-grid pointer-events-none" aria-hidden />
      <div className="fixed inset-0 hero-grid-vignette pointer-events-none" aria-hidden />
      <div
        className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(192,57,43,0.18) 0%, transparent 78%)',
        }}
        aria-hidden
      />
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center pt-[88px] pb-20 px-6">
        {children}
      </main>
    </div>
  )
}
