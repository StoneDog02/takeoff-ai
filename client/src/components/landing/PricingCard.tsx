import { useState } from 'react'
import { Link } from 'react-router-dom'

export interface PricingCardPrice {
  amount: number
  currency: string
  formatted: string
  interval: 'month' | 'year'
}

interface PricingCardProps {
  name: string
  description: string
  price: PricingCardPrice | null
  features: string[]
  cta: string
  /** Optional badge above name e.g. "LIMITED TIME OFFER" */
  offerBadge?: string
  /** Strikethrough price e.g. "$1,000 / mo" */
  originalPriceFormatted?: string
  /** Green badge e.g. "50% OFF" */
  discountBadge?: string
  /** Below price e.g. "Billed monthly — lock in this rate while it lasts." */
  billingNote?: string
  /** Highlight e.g. "30-day free trial" (shown under the description) */
  trialNote?: string
  /** Below CTA e.g. "No contracts — cancel anytime." */
  disclaimer?: string
  /** Signup flow: card is selectable and shows selected state */
  selectable?: boolean
  selected?: boolean
  onSelect?: () => void
  /** If set, CTA is a Link to this path; otherwise a button (for selectable) */
  ctaHref?: string
  /** When true, features are behind a "View features" toggle to keep the card short (e.g. signup flow) */
  collapsibleFeatures?: boolean
  /** Optional controlled open state (e.g. signup: only one card expanded at a time keyed by id) */
  featuresOpen?: boolean
  onToggleFeatures?: () => void
}

export function PricingCard({
  name,
  description,
  price,
  features,
  cta,
  offerBadge,
  originalPriceFormatted,
  discountBadge,
  billingNote,
  trialNote,
  disclaimer = 'No contracts — cancel anytime.',
  selectable = false,
  selected = false,
  onSelect,
  ctaHref = '/sign-up',
  collapsibleFeatures = false,
  featuresOpen: featuresOpenProp,
  onToggleFeatures,
}: PricingCardProps) {
  const [featuresOpenLocal, setFeaturesOpenLocal] = useState(false)
  const isControlled = featuresOpenProp !== undefined && onToggleFeatures !== undefined
  const featuresOpen = isControlled ? featuresOpenProp : featuresOpenLocal
  const setFeaturesOpen = isControlled ? onToggleFeatures : () => setFeaturesOpenLocal((o) => !o)

  // Stripe yearly prices are in cents per year; show per-month equivalent so "Save with yearly" is clear
  const isYearly = price?.interval === 'year'
  const displayCents = price
    ? isYearly
      ? Math.round(price.amount / 12) // per-month equivalent (cents)
      : price.amount
    : 0
  const dollars = Math.floor(displayCents / 100)
  const cents = displayCents % 100 // keep as 0–99 so we always show .XX
  const priceSuffix = price ? '/ month' : ''
  const symbol = price?.currency === 'usd' ? '$' : ''
  // When yearly, show full annual amount in billing note (e.g. "$4,799.99 billed annually — lock in this rate while it lasts")
  const yearlyTotalFormatted =
    price?.interval === 'year' && price.currency === 'usd'
      ? `$${(price.amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} billed annually — lock in this rate while it lasts`
      : null

  const cardContent = (
    <>
      {offerBadge && (
        <div className="pc-badge">
          <span className="pc-dot" />
          {offerBadge}
        </div>
      )}

      <h3 className="font-sora text-[28px] text-[#F7F6F3] m-0 mb-1 leading-tight">{name}</h3>
      <p className="text-sm text-[#666] m-0 mb-4">{description}</p>

      {trialNote && (
        <div className="mb-5">
          <span className="inline-flex items-center rounded-full border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-1.5 font-dm-sans text-[13px] font-semibold tracking-wide text-[#4ade80]">
            {trialNote}
          </span>
        </div>
      )}

      <div className="pc-price-block">
        {(originalPriceFormatted || discountBadge) && (
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {originalPriceFormatted && (
              <span className="text-[18px] text-[#555] font-normal pc-original-price">
                {originalPriceFormatted}
              </span>
            )}
            {discountBadge && (
              <span className="pc-savings">{discountBadge}</span>
            )}
          </div>
        )}
        <div className="flex items-baseline gap-0.5 mb-0.5">
          {price ? (
            <>
              <span className="text-2xl font-sora font-bold text-[#F7F6F3] align-top">{symbol}</span>
              <span className="text-4xl font-sora font-bold tracking-tight text-[#F7F6F3]">{dollars}</span>
              <span className="text-xl font-sora font-bold text-[#F7F6F3]">
                .{cents.toString().padStart(2, '0')}
              </span>
              <span className="ml-1 text-base text-[#666]">{priceSuffix}</span>
            </>
          ) : (
            <span className="text-2xl text-[#555]">—</span>
          )}
        </div>
      </div>

      <p className="text-xs text-[#666] m-0 mb-6">
        {yearlyTotalFormatted ?? billingNote ?? (price?.interval === 'year' ? 'Billed annually' : 'Billed monthly')}
      </p>

      <div className="h-px bg-[#333] mb-4" />

      {collapsibleFeatures ? (
        <div className="mb-6">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setFeaturesOpen()
            }}
            className="inline-flex items-center gap-1.5 p-0 border-0 bg-transparent text-xs font-medium text-[#c0392b] hover:text-[#e74c3c] hover:underline cursor-pointer transition-colors"
          >
            See all features
            <span className="text-[10px] leading-none opacity-80">
              {featuresOpen ? '−' : '+'}
            </span>
          </button>
          {featuresOpen && (
            <ul className="list-none flex flex-col gap-2.5 mt-3 p-0 m-0">
              {features.length > 0 ? (
                features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm font-medium text-[#F7F6F3]">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#c0392b] text-white text-[9px]">
                      ✓
                    </span>
                    {f}
                  </li>
                ))
              ) : (
                <li className="text-sm text-[#666]">All features included.</li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <ul className="list-none flex flex-col gap-3 mb-8 p-0 m-0">
          {features.length > 0 ? (
            features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm font-medium text-[#F7F6F3]">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#c0392b] text-white text-[10px]">
                  ✓
                </span>
                {f}
              </li>
            ))
          ) : (
            <li className="text-sm text-[#666]">All features included.</li>
          )}
        </ul>
      )}

      {ctaHref && !selectable ? (
        <Link
          to={ctaHref}
          className="mt-auto block w-full py-3.5 rounded-lg bg-[#2a2a2a] font-sora font-semibold text-[15px] text-center text-white no-underline transition-all hover:bg-[#333] border border-[#333]"
        >
          {cta}
        </Link>
      ) : selectable && onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className={`mt-auto block w-full py-3.5 rounded-lg font-sora font-semibold text-[15px] text-center text-white transition-all border ${
            selected
              ? 'bg-[#c0392b]/20 border-[#c0392b] hover:bg-[#c0392b]/30'
              : 'bg-[#2a2a2a] border-[#333] hover:bg-[#333]'
          }`}
        >
          {cta}
        </button>
      ) : (
        <div className="mt-auto block w-full py-3.5 rounded-lg bg-[#2a2a2a] font-sora font-semibold text-[15px] text-center text-white border border-[#333]">
          {cta}
        </div>
      )}

      <p className="mt-3 text-center text-xs text-[#666] m-0">{disclaimer}</p>
    </>
  )

  const baseClasses = 'pc-card flex flex-col text-left transition-all duration-200 w-full max-w-[400px]'

  if (selectable && onSelect) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
        className={`${baseClasses} cursor-pointer ${
          selected ? 'ring-2 ring-[#c0392b] ring-offset-2 ring-offset-transparent' : 'hover:border-[#404040]'
        }`}
      >
        {cardContent}
      </div>
    )
  }

  return <div className={baseClasses}>{cardContent}</div>
}
