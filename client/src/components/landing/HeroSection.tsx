import { Link } from 'react-router-dom'

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
          Build Smarter with
          <br />
          <em className="not-italic text-accent-hover relative inline-block">
            Faster Takeoffs
            <span
              className="absolute bottom-1 left-0 right-0 h-0.5 rounded-sm opacity-40 bg-accent-hover"
              aria-hidden
            />
          </em>
        </h1>
        <p className="text-lg font-light text-white-dim leading-relaxed max-w-[500px] mx-auto mb-12 animate-[fadeUp_0.8s_0.2s_ease_both]">
          Upload your plans. Get accurate material lists in minutes. Spend less time estimating and more time building.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-20 animate-[fadeUp_0.8s_0.3s_ease_both]">
          <Link
            to="/sign-up"
            className="inline-flex items-center gap-2 bg-accent text-white py-4 px-8 rounded-lg font-sora font-semibold text-[15px] tracking-tight no-underline transition-all duration-250 shadow-[0_0_30px_var(--color-accent-glow),0_4px_20px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_0_50px_var(--color-accent-glow),0_8px_30px_rgba(0,0,0,0.5)]"
          >
            Start Free Trial →
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 bg-transparent text-landing-white py-4 px-8 rounded-lg font-sora font-medium text-[15px] border border-border-dark no-underline transition-all duration-250 hover:border-white-faint hover:bg-white-faint hover:-translate-y-0.5 backdrop-blur-sm"
          >
            View Plans
          </a>
        </div>
      </div>

      {/* Dashboard mockup */}
      <div className="relative z-10 w-full max-w-[900px] animate-[fadeUp_0.8s_0.4s_ease_both]">
        <div className="bg-dark-3 border border-border-dark rounded-2xl overflow-hidden shadow-[0_0_0_1px_var(--color-border-dark),0_40px_80px_rgba(0,0,0,0.6),0_0_100px_rgba(192,57,43,0.08)]">
          <div className="bg-dark-4 py-3 px-5 flex items-center gap-2 border-b border-border-dark">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
            <span className="ml-3 text-xs text-white-dim">dashboard.takeoffai.com</span>
          </div>
          <div className="p-6 grid grid-cols-3 gap-3 min-h-[200px]">
            {/* Row 1 */}
            <div className="bg-dark-4 border border-accent/30 rounded-xl p-4 bg-accent/5">
              <div className="text-[10px] uppercase tracking-wider text-white-dim mb-2">Active Projects</div>
              <div className="font-sora text-2xl font-bold text-accent-hover">24</div>
              <div className="flex items-end gap-1 h-10 mt-2">
                {[30, 55, 80, 45, 90, 100, 65].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-white-faint"
                    style={{ height: `${h}%`, background: i === 2 || i === 5 ? 'var(--color-accent)' : undefined }}
                  />
                ))}
              </div>
            </div>
            <div className="bg-dark-4 border border-border-dark rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-white-dim mb-2">Revenue Managed</div>
              <div className="font-sora text-2xl font-bold text-landing-white">$2.4M</div>
              <div className="mt-2 text-[10px] text-white-dim">Target: $3M</div>
              <div className="h-1 bg-white-faint rounded mt-1.5 overflow-hidden">
                <div className="h-full w-4/5 bg-accent rounded" />
              </div>
            </div>
            <div className="bg-dark-4 border border-border-dark rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-white-dim mb-2">Satisfaction</div>
              <div className="font-sora text-2xl font-bold text-landing-white">98%</div>
              <div className="h-1 bg-white-faint rounded mt-3 overflow-hidden">
                <div className="h-full w-[98%] bg-accent rounded" />
              </div>
            </div>
            {/* Row 2: Recent Takeoffs (span 2) + Team Online */}
            <div className="bg-dark-4 border border-border-dark rounded-xl p-4 col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-white-dim mb-2">Recent Takeoffs</div>
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center justify-between px-2 py-1.5 bg-white-faint/40 rounded">
                  <span className="text-[11px] text-white-dim">Riverside Commercial — Floor 3</span>
                  <span className="text-[10px] text-accent-hover bg-accent-hover/10 px-2 py-0.5 rounded">Complete</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 bg-white-faint/40 rounded">
                  <span className="text-[11px] text-white-dim">Harbor View Residences — Unit 12</span>
                  <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">In Progress</span>
                </div>
              </div>
            </div>
            <div className="bg-dark-4 border border-border-dark rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-white-dim mb-2">Team Online</div>
              <div className="font-sora text-2xl font-bold text-landing-white">7</div>
              <div className="flex gap-1 mt-2">
                <div className="w-2 h-2 rounded-full bg-[#28CA41]" />
                <div className="w-2 h-2 rounded-full bg-[#28CA41]" />
                <div className="w-2 h-2 rounded-full bg-[#28CA41]" />
                <div className="w-2 h-2 rounded-full bg-white-faint" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero stats */}
      <div className="relative z-10 flex items-center justify-center gap-0 mt-12 animate-[fadeUp_0.8s_0.5s_ease_both]">
        {[
          { num: '500+', label: 'Active Contractors' },
          { num: '10K+', label: 'Projects Completed' },
          { num: '24/7', label: 'Support Available' },
        ].map((s, i) => (
          <div key={s.label} className="text-center py-0 px-14 relative">
            {i < 2 && (
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-8 bg-border-dark"
                aria-hidden
              />
            )}
            <span className="font-sora text-4xl font-extrabold text-accent-hover tracking-tight block">
              {s.num}
            </span>
            <span className="text-xs text-white-dim uppercase tracking-wider mt-1 block">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
