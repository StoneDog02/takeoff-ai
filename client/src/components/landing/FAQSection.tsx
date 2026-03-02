import { useState } from 'react'

const items = [
  {
    question: "What's included in the subscription?",
    answer:
      'Every subscription includes access to our core takeoff processing, project scheduling tools, team management dashboard, and mobile app. Higher-tier plans add more storage, advanced features, and dedicated support.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Absolutely. You can upgrade or downgrade your plan at any time from your account settings. Changes take effect immediately, and we prorate any billing differences automatically.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes — every new account gets a 14-day free trial with full access to Professional plan features. No credit card required to get started.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, Amex), ACH bank transfers, and invoicing for Enterprise accounts. All payments are processed securely through Stripe.',
  },
  {
    question: 'Do you offer discounts for annual billing?',
    answer:
      'Yes — switching to annual billing saves you 20% on any plan. You can toggle between monthly and annual billing in the pricing section or your account settings.',
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="w-full bg-light-bg py-[120px] px-6 md:px-12">
      <div className="max-w-[1200px] mx-auto">
        <div className="reveal text-center">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent block mb-3">
            FAQ
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-text-dark tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-[17px] text-text-mid font-light max-w-[500px] mx-auto">Everything you need to know</p>
        </div>
        <div className="max-w-[760px] mx-auto mt-16">
          {items.map((item, i) => (
            <div
              key={item.question}
              className={`border-b border-[var(--color-border)] ${openIndex === i ? 'open' : ''}`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between py-6 gap-5 cursor-pointer list-none text-left bg-transparent border-none font-sora text-[17px] font-semibold text-text-dark tracking-tight leading-snug hover:opacity-90"
              >
                {item.question}
                <span
                  className={`w-7 h-7 rounded-full bg-light-bg-2 border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 text-xs text-text-mid transition-all duration-300 ${
                    openIndex === i ? 'bg-accent border-accent text-white rotate-180' : ''
                  }`}
                >
                  ▾
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === i ? 'max-h-[200px] pb-6' : 'max-h-0'
                }`}
              >
                <p className="text-[15px] text-text-mid leading-relaxed">{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
