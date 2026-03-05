import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[999] h-[68px] px-6 md:px-12 flex items-center justify-between transition-all duration-300 border-b ${
        scrolled
          ? 'bg-[rgba(11,14,20,0.94)] backdrop-blur-xl border-black/20'
          : 'bg-transparent border-transparent'
      }`}
    >
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <div className="w-8 h-8 bg-accent flex items-center justify-center [clip-path:polygon(0_0,100%_0,100%_75%,75%_100%,0_100%)]">
          <span className="font-sora font-extrabold text-sm text-white">T</span>
        </div>
        <span className="font-sora font-semibold text-base text-landing-white tracking-tight">
          Takeoff
        </span>
      </Link>
      <ul className="hidden md:flex items-center gap-9 list-none">
        <li>
          <a href="#features" className="text-white-dim text-sm no-underline hover:text-landing-white transition-colors">
            Features
          </a>
        </li>
        <li>
          <a href="#pricing" className="text-white-dim text-sm no-underline hover:text-landing-white transition-colors">
            Pricing
          </a>
        </li>
        <li>
          <a href="#testimonials" className="text-white-dim text-sm no-underline hover:text-landing-white transition-colors">
            Testimonials
          </a>
        </li>
        <li>
          <a href="#contact" className="text-white-dim text-sm no-underline hover:text-landing-white transition-colors">
            Contact
          </a>
        </li>
        <li>
          <Link
            to="/sign-up"
            className="flex items-center gap-1.5 bg-accent text-white py-2.5 px-5 rounded-md font-medium text-sm shadow-[0_0_20px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_30px_var(--color-accent-glow)] transition-all"
          >
            Get Started →
          </Link>
        </li>
      </ul>
    </nav>
  )
}
