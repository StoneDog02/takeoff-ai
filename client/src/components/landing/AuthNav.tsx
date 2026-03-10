import { Link } from 'react-router-dom'

type AuthNavProps = {
  /** When true, show "Sign in" link; when false, show "Get Started" link */
  showSignIn?: boolean
}

export function AuthNav({ showSignIn = false }: AuthNavProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[999] h-[68px] px-6 md:px-12 flex items-center justify-between bg-dark/85 backdrop-blur-xl border-b border-border-dark">
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <div className="w-8 h-8 bg-accent flex items-center justify-center [clip-path:polygon(0_0,100%_0,100%_75%,75%_100%,0_100%)]">
          <span className="font-sora font-extrabold text-sm text-white">P</span>
        </div>
        <span className="font-sora font-semibold text-base text-landing-white tracking-tight">
          Proj-X
        </span>
      </Link>
      {showSignIn ? (
        <Link
          to="/sign-in"
          className="text-white-dim text-sm no-underline hover:text-landing-white transition-colors font-medium"
        >
          Sign in
        </Link>
      ) : (
        <Link
          to="/sign-up"
          className="flex items-center gap-1.5 bg-accent text-white py-2.5 px-5 rounded-md font-medium text-sm shadow-[0_0_20px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_30px_var(--color-accent-glow)] transition-all"
        >
          Get Started →
        </Link>
      )}
    </nav>
  )
}
