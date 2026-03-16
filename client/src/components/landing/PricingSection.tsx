import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '@/api/config'

/** Flat plan from API (one price per entry). */
interface FlatPlan {
  id: string
  name: string
  amount: number
  currency: string
  interval: 'month' | 'year'
  formatted: string
}

/** Product from Stripe with nested prices (month/year). */
export interface StripeProductPlan {
  productId: string
  name: string
  description: string
  metadata: Record<string, string>
  prices: Array<{
    id: string
    amount: number
    currency: string
    interval: 'month' | 'year'
    formatted: string
  }>
}

/** Build product list from flat plans when API returns only plans (e.g. older server). */
function plansToProducts(plans: FlatPlan[]): StripeProductPlan[] {
  const byName = new Map<string, FlatPlan[]>()
  for (const p of plans) {
    const list = byName.get(p.name) ?? []
    list.push(p)
    byName.set(p.name, list)
  }
  return Array.from(byName.entries()).map(([name, priceEntries]) => ({
    productId: `product-${name}`,
    name,
    description: '',
    metadata: {},
    prices: priceEntries.map((e) => ({
      id: e.id,
      amount: e.amount,
      currency: e.currency,
      interval: e.interval,
      formatted: e.formatted,
    })),
  }))
}

function parseFeatures(metadata: Record<string, string>): string[] {
  const raw = metadata?.features
  if (!raw || typeof raw !== 'string') return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : trimmed.split(/\n/).map((s) => s.trim()).filter(Boolean)
  } catch {
    return trimmed.split(/\n/).map((s) => s.trim()).filter(Boolean)
  }
}

export function PricingSection() {
  const [yearly, setYearly] = useState(false)
  const [products, setProducts] = useState<StripeProductPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/stripe/plans`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError((data as { error?: string }).error ?? 'Failed to load plans')
          setProducts([])
          return
        }
        const payload = data as { products?: StripeProductPlan[]; plans?: FlatPlan[] }
        // Use same source as signup: build from plans so we always show what signup shows
        const flatPlans = Array.isArray(payload.plans) ? payload.plans : []
        let list = flatPlans.length > 0 ? plansToProducts(flatPlans) : []
        // Enrich with products when available (description, metadata)
        if (list.length > 0 && Array.isArray(payload.products) && payload.products.length > 0) {
          const byName = new Map(payload.products.map((p) => [p.name, p]))
          list = list.map((card) => {
            const full = byName.get(card.name)
            if (!full) return card
            return { ...card, description: full.description, metadata: full.metadata || {}, prices: full.prices?.length ? full.prices : card.prices }
          })
        }
        setProducts(list)
        setError(null)
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load plans')
          setProducts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

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

        {/* Plans: fetched from Stripe */}
        {loading && (
          <div className="reveal mt-12 text-text-mid text-sm">Loading plans…</div>
        )}
        {error && !loading && (
          <div className="reveal mt-12 text-text-mid text-sm">{error}</div>
        )}
        {!loading && !error && products.length === 0 && (
          <div className="reveal mt-12 text-text-mid text-sm max-w-md mx-auto">
            No plans available. Make sure Stripe is configured and you have active products with recurring prices.
          </div>
        )}
        {!loading && !error && products.length > 0 && (
          <div className="grid md:grid-cols-3 gap-5 max-w-[1000px] mx-auto items-stretch reveal mt-12">
            {products.map((product) => {
              const prices = Array.isArray(product.prices) ? product.prices : []
              const priceMonth = prices.find((p) => p.interval === 'month')
              const priceYear = prices.find((p) => p.interval === 'year')
              const price = yearly ? priceYear ?? priceMonth : priceMonth ?? priceYear
              const features = parseFeatures(product.metadata || {})
              const popular = product.metadata?.popular === 'true'
              const displayAmount = price
                ? (price.amount / 100).toFixed(price.amount % 100 === 0 ? 0 : 2)
                : '—'

              return (
                <div
                  key={product.productId}
                  className={`relative flex flex-col rounded-[20px] p-10 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border ${
                    popular
                      ? 'bg-gray-900 border-accent/30 scale-[1.02] shadow-[0_30px_80px_rgba(0,0,0,0.25),0_0_60px_rgba(192,57,43,0.1)]'
                      : 'bg-white border-black/10'
                  }`}
                >
                  {popular && (
                    <>
                      <div className="absolute inset-0 rounded-[20px] overflow-hidden pointer-events-none">
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-accent-hover rounded-t-[20px]" />
                      </div>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white font-sora text-[11px] font-bold tracking-wider uppercase py-1 px-4 rounded-full whitespace-nowrap shadow-[0_4px_20px_var(--color-accent-glow)]">
                        Most Popular
                      </div>
                    </>
                  )}
                  <div className={popular ? 'text-white font-sora text-lg font-bold mb-1' : 'font-sora text-lg font-bold text-text-dark mb-1'}>
                    {product.name}
                  </div>
                  <div className={popular ? 'text-gray-300 text-[13px] mb-7' : 'text-[13px] text-text-light mb-7'}>
                    {product.description || 'Subscribe to this plan.'}
                  </div>
                  <div className="mb-1">
                    <span className={popular ? 'font-sora text-5xl font-extrabold text-white tracking-tight leading-none' : 'font-sora text-5xl font-extrabold text-text-dark tracking-tight leading-none'}>
                      {price?.currency === 'usd' ? `$${displayAmount}` : displayAmount}
                    </span>
                    <span className={popular ? 'text-sm text-gray-400' : 'text-sm text-text-light'}>
                      /month
                    </span>
                  </div>
                  <p className="text-xs text-text-light mb-6">
                    {yearly ? 'Billed annually' : 'Billed monthly'}
                  </p>
                  <div className={`h-px mb-6 ${popular ? 'bg-white/20' : 'bg-black/10'}`} />
                  <ul className="list-none flex flex-col gap-3 mb-8">
                    {features.length > 0 ? features.map((f) => (
                      <li
                        key={f}
                        className={`flex items-start gap-2.5 text-sm leading-snug ${popular ? 'text-gray-300' : 'text-text-mid'}`}
                      >
                        <span
                          className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-accent text-[10px] ${
                            popular ? 'bg-accent/30' : 'bg-accent/10'
                          }`}
                        >
                          ✓
                        </span>
                        {f}
                      </li>
                    )) : (
                      <li className={`text-sm ${popular ? 'text-gray-400' : 'text-text-light'}`}>
                        All features included.
                      </li>
                    )}
                  </ul>
                  <Link
                    to="/sign-up"
                    className={`mt-auto block w-full py-3.5 rounded-lg font-sora font-semibold text-[15px] text-center no-underline transition-all ${
                      popular
                        ? 'bg-accent text-white shadow-[0_4px_20px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-[0_8px_30px_var(--color-accent-glow)]'
                        : 'bg-transparent border border-black/10 text-text-dark hover:bg-light-bg-2'
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
