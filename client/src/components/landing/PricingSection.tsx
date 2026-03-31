import { useState, useEffect } from 'react'
import { API_BASE } from '@/api/config'
import { PricingCard } from '@/components/landing/PricingCard'

/** Flat plan from API (one price per entry). */
export interface FlatPlan {
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
export function plansToProducts(plans: FlatPlan[]): StripeProductPlan[] {
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

export const DEFAULT_FEATURES = [
  'Full project management suite',
  'Estimates, takeoffs & invoicing',
  'Crew & payroll management',
  'Client communication portal',
  'Subcontractor bid collection',
]

export function parseFeatures(metadata: Record<string, string>): string[] {
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

        {/* Billing frequency */}
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
              <span className="ml-1.5 bg-[#22c55e] text-white text-[11px] font-semibold py-0.5 px-2 rounded-full">
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
          <div
            className={
              products.length === 1
                ? 'flex justify-center reveal mt-12'
                : 'grid md:grid-cols-3 gap-6 max-w-[1000px] mx-auto items-stretch reveal mt-12'
            }
          >
            {products.map((product) => {
              const prices = Array.isArray(product.prices) ? product.prices : []
              const priceMonth = prices.find((p) => p.interval === 'month')
              const priceYear = prices.find((p) => p.interval === 'year')
              const price = yearly ? priceYear ?? priceMonth : priceMonth ?? priceYear
              const featuresFromMeta = parseFeatures(product.metadata || {})
              const features = featuresFromMeta.length > 0 ? featuresFromMeta : DEFAULT_FEATURES
              const meta = product.metadata || {}
              const isStandard = product.name.toLowerCase() === 'standard'

              // When Stripe metadata is empty, show reference-style content so the card matches the design
              const offerBadge =
                meta.offer_badge ||
                (meta.limited_time_offer === 'true' ? 'LIMITED TIME OFFER' : undefined) ||
                (isStandard ? 'LIMITED TIME OFFER' : undefined)
              const originalPriceFormatted =
                meta.original_price_formatted || (isStandard ? '$1,000 / mo' : undefined)
              const discountBadge = meta.discount_badge || (isStandard ? '50% OFF' : undefined)
              const description =
                product.description ||
                (isStandard ? 'Everything you need to run your business.' : 'Subscribe to this plan.')
              const trialNote =
                meta.trial_note ||
                (isStandard ? '14-day free trial' : undefined)

              return (
                <PricingCard
                  key={product.productId}
                  name={product.name}
                  description={description}
                  price={price ? { amount: price.amount, currency: price.currency, formatted: price.formatted, interval: price.interval } : null}
                  features={features}
                  cta="Get Started"
                  offerBadge={offerBadge}
                  originalPriceFormatted={originalPriceFormatted}
                  discountBadge={discountBadge}
                  trialNote={trialNote}
                  billingNote={meta.billing_note || (yearly ? 'Billed annually — lock in this rate while it lasts.' : 'Billed monthly — lock in this rate while it lasts.')}
                  disclaimer="No contracts — cancel anytime."
                  ctaHref="/sign-up"
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
