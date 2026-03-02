import { useState } from 'react'

export function ContactSection() {
  const [sent, setSent] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSent(true)
  }

  return (
    <section
      id="contact"
      className="w-full bg-dark py-[120px] px-6 md:px-12 relative overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(192,57,43,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(192,57,43,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(192,57,43,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-[1100px] mx-auto relative z-10">
        <div className="reveal text-center mb-[72px]">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent-hover block mb-3">
            Contact
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-landing-white tracking-tight">
            Get in Touch
          </h2>
          <p className="text-base text-white-dim mt-3 max-w-[400px] mx-auto">
            Have questions? We&apos;re here to help contractors succeed.
          </p>
        </div>

        <div className="grid md:grid-cols-[1fr_1.4fr] gap-16 md:gap-20 items-start reveal">
          <div className="pt-2">
            {[
              { icon: '📞', label: 'Phone', value: '(555) 123-4567' },
              { icon: '✉️', label: 'Email', value: 'support@takeoffai.com' },
              { icon: '📍', label: 'Office', value: '123 Build Ave, Builder City, BC 12345' },
            ].map((d) => (
              <div key={d.label} className="flex items-start gap-4 mb-8">
                <div className="w-[42px] h-[42px] rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent-hover flex-shrink-0 text-base">
                  {d.icon}
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-white-dim block mb-1">
                    {d.label}
                  </span>
                  <div className="text-[15px] text-landing-white font-normal">{d.value}</div>
                </div>
              </div>
            ))}
            <div className="mt-10 p-6 bg-accent/5 border border-accent/15 rounded-xl">
              <div className="font-sora text-[15px] font-semibold text-landing-white mb-1.5">
                Response Time
              </div>
              <div className="text-sm text-white-dim leading-relaxed">
                We typically respond within 2 hours during business hours, and 24/7 for Enterprise
                clients.
              </div>
            </div>
          </div>

          {sent ? (
            <div className="bg-dark-3 border border-border-dark rounded-2xl p-10 text-center text-white-dim">
              Thanks for your message. We&apos;ll get back to you soon.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-dark-3 border border-border-dark rounded-2xl p-10"
            >
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-white-dim">
                    First Name
                  </label>
                  <input
                    type="text"
                    placeholder="John"
                    className="bg-dark-4 border border-border-dark rounded-lg py-3 px-4 font-dm-sans text-sm text-landing-white outline-none transition-[border-color] w-full focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(192,57,43,0.08)]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-white-dim">
                    Last Name
                  </label>
                  <input
                    type="text"
                    placeholder="Doe"
                    className="bg-dark-4 border border-border-dark rounded-lg py-3 px-4 font-dm-sans text-sm text-landing-white outline-none transition-[border-color] w-full focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(192,57,43,0.08)]"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 mb-4">
                <label className="text-xs font-medium uppercase tracking-wider text-white-dim">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  className="bg-dark-4 border border-border-dark rounded-lg py-3 px-4 font-dm-sans text-sm text-landing-white outline-none transition-[border-color] w-full focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(192,57,43,0.08)]"
                />
              </div>
              <div className="flex flex-col gap-2 mb-4">
                <label className="text-xs font-medium uppercase tracking-wider text-white-dim">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="How can we help?"
                  className="bg-dark-4 border border-border-dark rounded-lg py-3 px-4 font-dm-sans text-sm text-landing-white outline-none transition-[border-color] w-full focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(192,57,43,0.08)]"
                />
              </div>
              <div className="flex flex-col gap-2 mb-4">
                <label className="text-xs font-medium uppercase tracking-wider text-white-dim">
                  Message
                </label>
                <textarea
                  placeholder="Tell us more about your needs..."
                  rows={4}
                  className="bg-dark-4 border border-border-dark rounded-lg py-3 px-4 font-dm-sans text-sm text-landing-white outline-none transition-[border-color] w-full resize-y min-h-[120px] focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(192,57,43,0.08)] placeholder:opacity-50"
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 rounded-lg bg-accent text-white border-none font-sora font-semibold text-[15px] cursor-pointer transition-all duration-250 shadow-[0_4px_24px_var(--color-accent-glow)] mt-2 hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-[0_8px_36px_var(--color-accent-glow)]"
              >
                Send Message →
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
