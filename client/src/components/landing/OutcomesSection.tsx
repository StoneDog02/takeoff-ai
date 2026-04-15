const OUTCOMES = [
  {
    title: 'One source of truth',
    body: 'Takeoffs, bids, invoices, and logs live together so nobody is guessing which version is current.',
  },
  {
    title: 'Protect every dollar',
    body: 'Track estimates against actuals and margins by job so surprises do not eat your profit.',
  },
  {
    title: 'Fewer late-night calls',
    body: 'Clients and subs get updates in context — less back-and-forth, clearer approvals.',
  },
  {
    title: 'Stay ahead of the schedule',
    body: 'See active work, crew, and timelines in one place so delays are visible before they snowball.',
  },
  {
    title: 'Look as professional as you build',
    body: 'Polished bid sheets and a real client portal help you win and retain the jobs you want.',
  },
] as const

export function OutcomesSection() {
  return (
    <section id="outcomes" className="w-full bg-dark py-[88px] md:py-[100px] px-6 md:px-12 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(192,57,43,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(192,57,43,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />
      <div className="max-w-[1200px] mx-auto relative z-10">
        <div className="reveal text-center max-w-[720px] mx-auto mb-14 md:mb-16">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent block mb-3">
            RUN YOUR BUSINESS
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-landing-white tracking-tight leading-tight mb-4">
            Take control by:
          </h2>
          <p className="text-base text-white-dim leading-relaxed m-0">
            The outcomes teams switch to Proj-X for — without adding another disconnected tool.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {OUTCOMES.map((o, i) => (
            <div
              key={o.title}
              className={`reveal rounded-2xl border border-border-dark bg-dark-3/90 backdrop-blur-sm p-6 md:p-7 ${
                i === 0 ? '' : i === 1 ? 'reveal-delay-1' : i === 2 ? 'reveal-delay-2' : i === 3 ? 'reveal-delay-3' : 'reveal-delay-1'
              }`}
            >
              <h3 className="font-sora text-base md:text-lg font-bold text-landing-white tracking-tight mb-2">{o.title}</h3>
              <p className="text-sm text-white-dim leading-relaxed m-0">{o.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
