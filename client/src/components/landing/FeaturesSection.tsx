export function FeaturesSection() {
  const bento = [
    {
      colClass: 'md:col-span-5',
      featured: true,
      icon: '📋',
      title: 'Material Takeoffs',
      desc: 'Upload your plans and get an accurate, itemized material list in minutes. No more manual counting or costly estimation errors—focus on building, not spreadsheets.',
      extra: (
        <div className="mt-5 flex flex-col gap-1.5">
          {[
            { label: 'Foundation', w: '100%' },
            { label: 'Framing', w: '72%' },
            { label: 'Electrical', w: '40%' },
            { label: 'Finishing', w: '15%' },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <span className="text-[10px] text-white-dim w-20 flex-shrink-0">{t.label}</span>
              <div className="flex-1 h-1.5 bg-white-faint rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-accent opacity-70" style={{ width: t.w }} />
              </div>
            </div>
          ))}
        </div>
      ),
      revealDelay: '',
    },
    {
      colClass: 'md:col-span-4',
      featured: false,
      icon: '📄',
      title: 'Bid Sheet Builder',
      desc: 'Generate professional cost breakdowns from your takeoff list. Present clear, itemized proposals to homeowners in minutes—no more back-and-forth.',
      revealDelay: 'reveal-delay-1',
    },
    {
      colClass: 'md:col-span-3',
      featured: false,
      icon: '📤',
      title: 'Sub Bids',
      desc: 'Keep your subcontractor list in one place. Send plans out for bids simultaneously—all automated from your takeoff so subs get what they need fast.',
      revealDelay: 'reveal-delay-2',
    },
    {
      colClass: 'md:col-span-4',
      featured: false,
      icon: '💬',
      title: 'Communication Portal',
      desc: 'One hub for GC-to-homeowner and GC-to-subcontractor communication. Keep every conversation in context so nothing gets lost in email or texts.',
      revealDelay: '',
    },
    {
      colClass: 'md:col-span-8',
      featured: false,
      icon: '📊',
      title: 'Job Tracking & Profitability',
      desc: 'See all active jobs at a glance with status, timelines, and key details. Track job profitability in real time—estimated vs. actual costs and margins—so you know where you stand on every project.',
      extra: (
        <div className="mt-5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between py-2 px-3 bg-light-bg-2 rounded-md text-xs">
            <span className="text-text-mid">Riverside — Est. vs actual</span>
            <span className="text-accent font-semibold">+12%</span>
          </div>
          <div className="flex items-center justify-between py-2 px-3 bg-light-bg-2 rounded-md text-xs">
            <span className="text-text-mid">Harbor View — Margin</span>
            <span className="text-[#2ecc71] font-semibold">On track ✓</span>
          </div>
        </div>
      ),
      revealDelay: 'reveal-delay-1',
    },
  ]

  return (
    <section id="features" className="w-full bg-light-bg py-[120px] px-6 md:px-12">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-16 reveal">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent block mb-3">
            EVERYTHING YOU NEED
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-text-dark tracking-tight leading-tight mb-4">
            Built for Construction Professionals
          </h2>
          <p className="text-[17px] text-text-mid font-light leading-relaxed max-w-[500px]">
            Comprehensive tools designed specifically for contractors who build at scale.
          </p>
        </div>

        {/* Bento grid: row 1 = 5+4+3, row 2 = 4+8 (staggered) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {bento.map((card) => (
            <div
              key={card.title}
              className={`bento-card reveal ${card.revealDelay} col-span-12 ${card.colClass} rounded-2xl p-8 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                card.featured
                  ? 'bg-dark border border-transparent hover:shadow-card-dark'
                  : 'bg-white border border-black/10 hover:shadow-card-landing'
              }`}
            >
              {card.featured && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-accent-hover rounded-t-2xl" aria-hidden />
              )}
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5 ${
                  card.featured ? 'bg-accent/20' : 'bg-accent/10 text-accent'
                }`}
              >
                {card.icon}
              </div>
              <h3
                className={`font-sora text-lg font-bold tracking-tight mb-2.5 ${
                  card.featured ? 'text-landing-white' : 'text-[#1A1A24]'
                }`}
              >
                {card.title}
              </h3>
              <p className={`text-sm leading-relaxed ${card.featured ? 'text-white-dim' : 'text-[#4A4A5E]'}`}>
                {card.desc}
              </p>
              {card.extra && <div className="bento-visual">{card.extra}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
