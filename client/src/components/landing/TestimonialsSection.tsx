const testimonials = [
  {
    quote:
      'Takeoff cut our estimation time in half. What used to take our estimators two days now takes a couple hours. It\'s a tool that pays for itself every week.',
    name: 'John Martinez',
    handle: '@johnbuilds · General Contractor',
    avatar: 'JM',
    avatarBg: 'linear-gradient(135deg,#C0392B,#922B21)',
  },
  {
    quote:
      'Finally, material lists that actually match the plans. We used to waste so much on inaccurate takeoffs. This has saved us thousands per project.',
    name: 'Sarah Chen',
    handle: '@sarahchen · Project Manager',
    avatar: 'SC',
    avatarBg: 'linear-gradient(135deg,#1A5276,#154360)',
  },
  {
    quote:
      "Worth every penny. Our team won't go back to spreadsheets. The bid sheets alone save us hours of back-and-forth with homeowners.",
    name: 'Mike Torres',
    handle: '@mikectorres · Subcontractor',
    avatar: 'MT',
    avatarBg: 'linear-gradient(135deg,#1E8449,#145A32)',
  },
]

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="w-full bg-dark-2 py-[120px] px-6 md:px-12 relative overflow-hidden text-center"
    >
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(192,57,43,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(192,57,43,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="max-w-[1100px] mx-auto relative z-10">
        <div className="reveal">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent-hover block mb-3">
            TESTIMONIALS
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-landing-white tracking-tight">
            What Contractors Say
          </h2>
          <p className="text-base text-white-dim mt-3">Trusted by professionals across the industry.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mt-16 items-stretch">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="reveal flex flex-col min-h-0 bg-dark-3 border border-border-dark rounded-2xl p-8 text-left transition-all duration-300 hover:border-accent/25 hover:-translate-y-1 hover:shadow-2xl"
            >
              <span className="font-sora text-7xl leading-[0.7] text-accent opacity-30 block mb-4 flex-shrink-0">
                &ldquo;
              </span>
              <div className="flex gap-0.5 mb-4 text-accent-hover text-sm flex-shrink-0">★★★★★</div>
              <p className="text-[15px] text-white-dim leading-relaxed italic mb-6 flex-1 min-h-0">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3 pt-5 border-t border-border-dark flex-shrink-0 mt-auto">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-sora text-sm font-bold text-white flex-shrink-0"
                  style={{ background: t.avatarBg }}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="font-sora text-sm font-semibold text-landing-white">{t.name}</div>
                  <div className="text-xs text-white-dim mt-0.5">{t.handle}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
