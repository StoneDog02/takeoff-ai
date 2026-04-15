const BULLETS = [
  {
    title: 'You run multiple jobs a year',
    body: 'From estimates and bids to crew and daily logs — you need one system that stays organized as work scales.',
  },
  {
    title: 'You live in takeoffs and change orders',
    body: 'Accurate material lists, clear proposals, and tracked extras matter to your margins. Spreadsheets and scattered texts do not.',
  },
  {
    title: 'You want the field and office aligned',
    body: 'Subs, homeowners, and your team should see the same schedule, messages, and job status without chasing threads.',
  },
] as const

export function WhoItsForSection() {
  return (
    <section
      id="why-proj-x"
      className="w-full bg-dark-2 py-[72px] md:py-[88px] px-6 md:px-12 border-b border-border-dark"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="reveal max-w-[640px] mb-12 md:mb-14">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent-hover block mb-3">
            BUILT FOR YOU
          </span>
          <h2 className="font-sora text-3xl md:text-4xl font-extrabold text-landing-white tracking-tight leading-tight mb-3">
            Proj-X is for GCs who:
          </h2>
          <p className="text-[15px] md:text-base text-white-dim leading-relaxed">
            If this sounds like your shop, you are who we had in mind.
          </p>
        </div>

        <ul className="grid md:grid-cols-3 gap-6 md:gap-8 list-none p-0 m-0">
          {BULLETS.map((item, i) => (
            <li
              key={item.title}
              className={`reveal rounded-2xl border border-border-dark bg-dark-3/80 p-6 md:p-7 transition-all duration-300 hover:border-accent/20 hover:-translate-y-0.5 ${
                i === 0 ? '' : i === 1 ? 'reveal-delay-1' : 'reveal-delay-2'
              }`}
            >
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent/15 text-accent font-sora font-bold text-sm mb-4"
                aria-hidden
              >
                {i + 1}
              </span>
              <h3 className="font-sora text-lg font-bold text-landing-white tracking-tight mb-2">{item.title}</h3>
              <p className="text-sm text-white-dim leading-relaxed m-0">{item.body}</p>
            </li>
          ))}
        </ul>

        <p className="reveal reveal-delay-3 mt-10 text-center text-sm text-white-dim">
          <a
            href="#platform-capabilities"
            className="text-accent-hover no-underline font-medium hover:underline underline-offset-4"
          >
            See everything in one platform →
          </a>
        </p>
      </div>
    </section>
  )
}
