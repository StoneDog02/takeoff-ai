import { useState } from 'react'
import { Link } from 'react-router-dom'

const plans = [
  {
    name: 'Starter',
    desc: 'Perfect for individual contractors',
    monthly: 49,
    yearly: 39,
    features: [
      'Up to 5 active projects',
      'Takeoff processing',
      'Basic scheduling tools',
      'Email support',
      'Mobile app access',
      'Document storage (5GB)',
    ],
    popular: false,
  },
  {
    name: 'Professional',
    desc: 'For growing contracting businesses',
    monthly: 99,
    yearly: 79,
    features: [
      'Unlimited projects',
      'Takeoff processing & bid sheets',
      'Advanced scheduling',
      'Priority support',
      'Team collaboration',
      'Document storage (50GB)',
      'Equipment tracking',
      'Custom reports',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    desc: 'For large contracting firms',
    monthly: 199,
    yearly: 159,
    features: [
      'Everything in Professional',
      'Dedicated account manager',
      '24/7 phone support',
      'Unlimited storage',
      'Takeoff processing at scale',
      'API access',
      'Custom integrations',
      'White-label options',
    ],
    popular: false,
  },
]

export function PricingSection() {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="pricing" className="w-full bg-light-bg py-[120px] px-6 md:px-12 text-center">
      <div className="max-w-[1100px] mx-auto">
        <div className="reveal">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent block mb-3">
            PRICING
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-text-dark tracking-tight mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-[17px] text-text-mid font-light max-w-[500px] mx-auto mb-4">
            Choose the plan that fits your business. All plans are charged by subscription — pick monthly or save with annual billing.
          </p>
        </div>

        {/* Billing frequency: subscription offer */}
        <div className="reveal mb-4">
          <p className="text-sm text-text-mid mb-3">Billing frequency</p>
          <div className="inline-flex bg-light-bg-2 border border-black/10 rounded-full p-1">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={`px-6 py-2.5 rounded-full border-none font-dm-sans text-sm font-medium cursor-pointer transition-all ${
                !yearly ? 'bg-white text-text-dark shadow-sm' : 'bg-transparent text-text-mid'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={`px-6 py-2.5 rounded-full border-none font-dm-sans text-sm font-medium cursor-pointer transition-all flex items-center ${
                yearly ? 'bg-white text-text-dark shadow-sm' : 'bg-transparent text-text-mid'
              }`}
            >
              Yearly
              <span className="ml-1.5 bg-accent text-white text-[11px] font-semibold py-0.5 px-2 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
          <p className="text-xs text-text-light mt-2">
            {yearly ? 'Billed annually' : 'Billed monthly'}
          </p>
        </div>

        {/* Plans: charge by plan */}
        <div className="grid md:grid-cols-3 gap-5 max-w-[1000px] mx-auto items-stretch reveal mt-12">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-[20px] p-10 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border ${
                plan.popular
                  ? 'bg-gray-900 border-accent/30 scale-[1.02] shadow-[0_30px_80px_rgba(0,0,0,0.25),0_0_60px_rgba(192,57,43,0.1)]'
                  : 'bg-white border-black/10'
              }`}
            >
              {plan.popular && (
                <>
                  <div className="absolute inset-0 rounded-[20px] overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-accent-hover rounded-t-[20px]" />
                  </div>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white font-sora text-[11px] font-bold tracking-wider uppercase py-1 px-4 rounded-full whitespace-nowrap shadow-[0_4px_20px_var(--color-accent-glow)]">
                    Most Popular
                  </div>
                </>
              )}
              <div className={plan.popular ? 'text-white font-sora text-lg font-bold mb-1' : 'font-sora text-lg font-bold text-text-dark mb-1'}>
                {plan.name}
              </div>
              <div className={plan.popular ? 'text-gray-300 text-[13px] mb-7' : 'text-[13px] text-text-light mb-7'}>
                {plan.desc}
              </div>
              <div className="mb-1">
                <span className={plan.popular ? 'font-sora text-5xl font-extrabold text-white tracking-tight leading-none' : 'font-sora text-5xl font-extrabold text-text-dark tracking-tight leading-none'}>
                  ${yearly ? plan.yearly : plan.monthly}
                </span>
                <span className={plan.popular ? 'text-sm text-gray-400' : 'text-sm text-text-light'}>
                  /month
                </span>
              </div>
              <p className="text-xs text-text-light mb-6">
                {yearly ? 'Billed annually' : 'Billed monthly'}
              </p>
              <div className={`h-px mb-6 ${plan.popular ? 'bg-white/20' : 'bg-black/10'}`} />
              <ul className="list-none flex flex-col gap-3 mb-8">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-sm leading-snug ${plan.popular ? 'text-gray-300' : 'text-text-mid'}`}
                  >
                    <span
                      className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-accent text-[10px] ${
                        plan.popular ? 'bg-accent/30' : 'bg-accent/10'
                      }`}
                    >
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/sign-up"
                className={`mt-auto block w-full py-3.5 rounded-lg font-sora font-semibold text-[15px] text-center no-underline transition-all ${
                  plan.popular
                    ? 'bg-accent text-white shadow-[0_4px_20px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-[0_8px_30px_var(--color-accent-glow)]'
                    : 'bg-transparent border border-black/10 text-text-dark hover:bg-light-bg-2'
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
