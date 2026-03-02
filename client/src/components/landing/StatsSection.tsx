import { useEffect, useRef } from 'react'

const DURATION = 1600

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function runCountUp(
  el: HTMLElement,
  target: number,
  prefix: string,
  suffix: string
) {
  const start = performance.now()
  const formatter = (n: number) => n.toLocaleString()
  function update(now: number) {
    const elapsed = now - start
    const progress = Math.min(elapsed / DURATION, 1)
    const eased = easeOutCubic(progress)
    const current = Math.floor(eased * target)
    el.textContent = prefix + formatter(current) + suffix
    if (progress < 1) requestAnimationFrame(update)
    else el.textContent = prefix + formatter(target) + suffix
  }
  requestAnimationFrame(update)
}

const STATS = [
  { target: 500, prefix: '', suffix: '+', label: 'Active Contractors' },
  { target: 10000, prefix: '', suffix: '+', label: 'Projects Completed' },
  { target: 98, prefix: '', suffix: '%', label: 'Customer Satisfaction' },
  { target: 2, prefix: '$', suffix: 'M+', label: 'Revenue Managed' },
] as const

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const counters = section.querySelectorAll<HTMLElement>('[data-count-target]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          if (el.dataset.countAnimated === 'true') return
          el.dataset.countAnimated = 'true'
          const target = parseInt(el.dataset.countTarget ?? '0', 10)
          const prefix = el.dataset.countPrefix ?? ''
          const suffix = el.dataset.countSuffix ?? ''
          runCountUp(el, target, prefix, suffix)
        })
      },
      { threshold: 0.2 }
    )
    counters.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="stats"
      ref={sectionRef}
      className="w-full bg-dark-2 py-[100px] px-6 md:px-12 relative overflow-hidden text-center"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(192,57,43,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(192,57,43,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      {/* Radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(192,57,43,0.1) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="reveal">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent-hover block mb-3">
            BY THE NUMBERS
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-landing-white tracking-tight leading-tight">
            Trusted by Industry Leaders
          </h2>
          <p className="text-base text-white-dim mt-3">
            Join hundreds of contractors who trust Takeoff to run their business.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 max-w-[900px] mx-auto mt-14 reveal">
          {STATS.map((s, i) => (
            <div key={s.label} className="py-10 px-8 text-center relative">
              {i < STATS.length - 1 && (
                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-12 bg-border-dark hidden md:block"
                  aria-hidden
                />
              )}
              <span
                className="font-sora text-4xl md:text-5xl font-extrabold text-accent-hover tracking-tight block leading-none"
                data-count-target={s.target}
                data-count-prefix={s.prefix}
                data-count-suffix={s.suffix}
              >
                {s.prefix}0{s.suffix}
              </span>
              <span className="text-[13px] text-white-dim uppercase tracking-wider mt-2 block">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
