import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeroDashboardMock } from '@/components/landing/HeroDashboardMock'

const HERO_FEATURE_BADGES_ROW1 = [
  'Material Takeoffs',
  'Bid Sheets',
  'Job Tracking',
  'Invoicing',
  'Crew Management',
  'Timeclock',
] as const

const HERO_FEATURE_BADGES_ROW2 = ['Client Messaging', 'Sub Bids', 'Scheduling'] as const

const HERO_FEATURE_BADGES_MOBILE_ALL = [...HERO_FEATURE_BADGES_ROW1, ...HERO_FEATURE_BADGES_ROW2]
const HERO_FEATURE_BADGES_MOBILE_LAST = HERO_FEATURE_BADGES_MOBILE_ALL[HERO_FEATURE_BADGES_MOBILE_ALL.length - 1]
const HERO_FEATURE_BADGES_MOBILE_PAIRS = HERO_FEATURE_BADGES_MOBILE_ALL.slice(0, -1)
const HERO_FEATURE_BADGES_MOBILE_LEFT = HERO_FEATURE_BADGES_MOBILE_PAIRS.filter((_, i) => i % 2 === 0)
const HERO_FEATURE_BADGES_MOBILE_RIGHT = HERO_FEATURE_BADGES_MOBILE_PAIRS.filter((_, i) => i % 2 === 1)

const HERO_FEATURE_BADGES_ROW2_DESKTOP_COL_START = ['col-start-4', 'col-start-6', 'col-start-8'] as const

const heroFeatureBadgeClass =
  'inline-flex items-center justify-center w-max max-w-full min-w-0 justify-self-center py-2.5 px-2.5 sm:px-3 rounded-full text-xs sm:text-sm font-medium text-white-dim border border-white-faint/30 bg-dark-4/80 backdrop-blur-sm transition-all duration-200 hover:bg-accent/25 hover:border-accent-hover hover:text-landing-white whitespace-nowrap'

function HeroFeatureBadgesMobile() {
  const measureRef = useRef<HTMLDivElement>(null)
  const [uniformPx, setUniformPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const root = measureRef.current
      if (!root) return
      let max = 0
      for (const el of Array.from(root.children)) {
        if (el instanceof HTMLElement) {
          max = Math.max(max, Math.ceil(el.getBoundingClientRect().width))
        }
      }
      setUniformPx(max > 0 ? max : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const pillStyle =
    uniformPx != null ? ({ width: uniformPx, minWidth: uniformPx } as const) : undefined

  return (
    <>
      <div
        ref={measureRef}
        className="pointer-events-none absolute -left-[10000px] top-0 flex w-max flex-col gap-2 opacity-0"
        aria-hidden
      >
        {HERO_FEATURE_BADGES_MOBILE_ALL.map((label) => (
          <span key={label} className={heroFeatureBadgeClass}>
            {label}
          </span>
        ))}
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex justify-center gap-2 sm:gap-3">
          <div className="flex flex-col items-end gap-2 sm:gap-3">
            {HERO_FEATURE_BADGES_MOBILE_LEFT.map((label) => (
              <span key={label} className={heroFeatureBadgeClass} style={pillStyle}>
                {label}
              </span>
            ))}
          </div>
          <div className="flex flex-col items-start gap-2 sm:gap-3">
            {HERO_FEATURE_BADGES_MOBILE_RIGHT.map((label) => (
              <span key={label} className={heroFeatureBadgeClass} style={pillStyle}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <span className={heroFeatureBadgeClass} style={pillStyle}>
            {HERO_FEATURE_BADGES_MOBILE_LAST}
          </span>
        </div>
      </div>
    </>
  )
}

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center pt-[120px] pb-20 px-6 md:px-12 overflow-hidden text-center"
    >
      {/* Subtle blueprint grid background (matches reference HTML) */}
      <div className="absolute inset-0 hero-grid pointer-events-none" />
      {/* Vignette so grid is strongest around headline and fades to dark edges */}
      <div className="absolute inset-0 hero-grid-vignette pointer-events-none" />
      {/* Radial glow – slightly stronger so grid + headline glow feel more present */}
      <div
        className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.22) 0%, transparent 78%)',
        }}
      />
      {/* Tilted structural SVG in background – centered behind headline */}
      <div
        className="pointer-events-none absolute left-1/2 top-[28%] w-[min(120vw,1400px)] h-[min(120vw,1400px)] opacity-[0.65]"
        style={{
          transform: 'translate(calc(-50% - 4vw), -50%)',
          backgroundImage: 'url(/hero-structure.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          filter: 'brightness(2.2) contrast(1.25)',
        }}
        aria-hidden
      />

      <div className="relative z-10 max-w-[820px]">
        <div className="inline-flex items-center gap-2 bg-white-faint border border-border-dark rounded-full py-1.5 px-4 text-xs font-medium tracking-wider uppercase text-white-dim mb-8 backdrop-blur-sm animate-[fadeDown_0.8s_ease_both]">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-hover shadow-[0_0_8px_var(--color-accent-hover)]" />
          Trusted by 500+ Contractors
        </div>
        <h1 className="font-sora text-4xl md:text-6xl lg:text-7xl font-extrabold leading-none tracking-tight text-landing-white mb-6 animate-[fadeUp_0.8s_0.1s_ease_both]">
          Build Smarter
          <br />
          <em className="not-italic text-accent-hover relative inline-block">
            with Proj-X
            <span
              className="absolute bottom-1 left-0 right-0 h-0.5 rounded-sm opacity-40 bg-accent-hover"
              aria-hidden
            />
          </em>
        </h1>
        <p className="text-lg font-light text-white-dim leading-relaxed max-w-[500px] mx-auto mb-12 animate-[fadeUp_0.8s_0.2s_ease_both]">
          From takeoffs to payroll, bids to job tracking — everything your crew needs to run jobs and grow revenue, without the chaos.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-20 animate-[fadeUp_0.8s_0.3s_ease_both]">
          <Link
            to="/sign-up"
            className="inline-flex items-center gap-2 bg-accent text-white py-4 px-8 rounded-lg font-sora font-semibold text-[15px] tracking-tight no-underline transition-all duration-250 shadow-[0_0_30px_var(--color-accent-glow),0_4px_20px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_0_50px_var(--color-accent-glow),0_8px_30px_rgba(0,0,0,0.5)]"
          >
            Start Free Trial →
          </Link>
          <Link
            to="/sign-in"
            className="inline-flex items-center gap-2 bg-transparent text-landing-white py-4 px-8 rounded-lg font-sora font-medium text-[15px] border border-border-dark no-underline transition-all duration-250 hover:border-white-faint hover:bg-white-faint hover:-translate-y-0.5 backdrop-blur-sm"
          >
            Sign In
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 bg-transparent text-landing-white py-4 px-8 rounded-lg font-sora font-medium text-[15px] border border-border-dark no-underline transition-all duration-250 hover:border-white-faint hover:bg-white-faint hover:-translate-y-0.5 backdrop-blur-sm"
          >
            View Plans
          </a>
        </div>
      </div>

      {/* Dashboard mockup: real dashboard layout with mock data */}
      <div className="relative z-10 w-full max-w-[1000px] animate-[fadeUp_0.8s_0.4s_ease_both]">
        <div className="bg-dark-3 border border-border-dark rounded-2xl overflow-hidden shadow-[0_0_0_1px_var(--color-border-dark),0_40px_80px_rgba(0,0,0,0.6),0_0_100px_rgba(192,57,43,0.08)]">
          <div className="bg-dark-4 py-3 px-5 flex items-center gap-2 border-b border-border-dark">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
            <span className="ml-3 text-xs text-white-dim">app.proj-x.com/dashboard</span>
          </div>
          <div className="dark bg-[#0f172a] p-0 overflow-x-auto max-h-[70vh] overflow-y-auto">
            <HeroDashboardMock />
          </div>
        </div>
      </div>

      {/* Feature badges: below lg, two columns hug the center gutter; desktop keeps staggered 12-col layout */}
      <div className="relative z-10 w-full max-w-[1000px] mt-8 sm:mt-10 animate-[fadeUp_0.8s_0.5s_ease_both] px-1 sm:px-2">
        <div className="relative lg:hidden">
          <HeroFeatureBadgesMobile />
        </div>
        <div className="hidden lg:grid grid-cols-12 justify-items-center gap-x-3 gap-y-3">
          {HERO_FEATURE_BADGES_ROW1.map((label) => (
            <span key={label} className={`col-span-2 ${heroFeatureBadgeClass}`}>
              {label}
            </span>
          ))}
          {HERO_FEATURE_BADGES_ROW2.map((label, i) => (
            <span
              key={label}
              className={`${HERO_FEATURE_BADGES_ROW2_DESKTOP_COL_START[i]} col-span-2 ${heroFeatureBadgeClass}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
