import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { API_BASE } from '@/api/config'
import {
  plansToProducts,
  parseFeatures,
  DEFAULT_FEATURES,
  type FlatPlan,
  type StripeProductPlan,
} from '@/components/landing/PricingSection'
import { stripeBillingApi } from '@/api/stripeBilling'
import { Btn } from './SettingsPrimitives'

type BillingPlansModalProps = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  onNeedPaymentMethod?: () => void
  currentPriceId?: string | null
}

export function BillingPlansModal({
  open,
  onClose,
  onSuccess,
  onNeedPaymentMethod,
  currentPriceId,
}: BillingPlansModalProps) {
  const [yearly, setYearly] = useState(false)
  const [products, setProducts] = useState<StripeProductPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setCheckoutError(null)
    setSelectedProductId(null)
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/stripe/plans`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setLoadError((data as { error?: string }).error ?? 'Failed to load plans')
          setProducts([])
          return
        }
        const payload = data as { products?: StripeProductPlan[]; plans?: FlatPlan[] }
        const flatPlans = Array.isArray(payload.plans) ? payload.plans : []
        let list = flatPlans.length > 0 ? plansToProducts(flatPlans) : []
        if (list.length > 0 && Array.isArray(payload.products) && payload.products.length > 0) {
          const byName = new Map(payload.products.map((p) => [p.name, p]))
          list = list.map((card) => {
            const full = byName.get(card.name)
            if (!full) return card
            return {
              ...card,
              description: full.description,
              metadata: full.metadata || {},
              prices: full.prices?.length ? full.prices : card.prices,
            }
          })
        }
        setProducts(list)
        if (list.length > 0) {
          setSelectedProductId(list[0].productId)
        }
      } catch {
        if (!cancelled) {
          setLoadError('Failed to load plans')
          setProducts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const selectedProduct = useMemo(
    () => products.find((p) => p.productId === selectedProductId) ?? null,
    [products, selectedProductId]
  )

  const selectedPrice = useMemo(() => {
    if (!selectedProduct) return null
    const prices = Array.isArray(selectedProduct.prices) ? selectedProduct.prices : []
    const priceMonth = prices.find((p) => p.interval === 'month')
    const priceYear = prices.find((p) => p.interval === 'year')
    return yearly ? priceYear ?? priceMonth : priceMonth ?? priceYear
  }, [selectedProduct, yearly])

  const handleCheckout = async () => {
    if (!selectedPrice?.id) return
    setCheckoutError(null)
    setCheckoutLoading(true)
    try {
      await stripeBillingApi.subscribePlan(selectedPrice.id)
      onSuccess()
      onClose()
    } catch (e) {
      const err = e as Error & { code?: string }
      if (err.code === 'NO_PAYMENT_METHOD') {
        setCheckoutError('Add a payment method below, then try again.')
        onNeedPaymentMethod?.()
      } else {
        setCheckoutError(err.message || 'Could not update subscription.')
      }
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (!open) return null

  const samePlan = Boolean(currentPriceId && selectedPrice?.id === currentPriceId)

  return (
    <div
      className="dashboard-app"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        padding: 20,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-plans-modal-title"
    >
      <div
        className="teams-card max-h-[min(90vh,880px)] w-full max-w-[920px] overflow-hidden"
        style={{ display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-3 border-b border-black/10 px-5 py-4 dark:border-white/10"
        >
          <div>
            <h2
              id="billing-plans-modal-title"
              className="teams-section-title m-0 text-lg md:text-xl"
            >
              Plans & checkout
            </h2>
            <p className="teams-muted m-0 mt-1 text-[13px]">
              Choose a plan and billing interval. Changes to an active subscription are prorated.
            </p>
          </div>
          <button
            type="button"
            className="teams-btn teams-btn-ghost shrink-0 p-2"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-[13px] text-[#6b7280] dark:text-[var(--text-muted)]">Billing</span>
            <div className="inline-flex rounded-full border border-black/10 bg-[#f9fafb] p-0.5 dark:border-white/10 dark:bg-[var(--bg-hover)]">
              <button
                type="button"
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium ${
                  !yearly ? 'bg-white shadow-sm dark:bg-[var(--bg-panel)]' : 'text-[#6b7280]'
                }`}
                onClick={() => setYearly(false)}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium ${
                  yearly ? 'bg-white shadow-sm dark:bg-[var(--bg-panel)]' : 'text-[#6b7280]'
                }`}
                onClick={() => setYearly(true)}
              >
                Yearly
              </button>
            </div>
          </div>

          {loading && <p className="text-[13px] text-[#6b7280]">Loading plans…</p>}
          {loadError && <p className="text-[13px] text-red-600">{loadError}</p>}
          {!loading && !loadError && products.length === 0 && (
            <p className="text-[13px] text-[#6b7280]">No plans are available right now.</p>
          )}

          {!loading && !loadError && products.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const prices = Array.isArray(product.prices) ? product.prices : []
                const priceMonth = prices.find((p) => p.interval === 'month')
                const priceYear = prices.find((p) => p.interval === 'year')
                const price = yearly ? priceYear ?? priceMonth : priceMonth ?? priceYear
                const selected = product.productId === selectedProductId
                const featuresFromMeta = parseFeatures(product.metadata || {})
                const features = featuresFromMeta.length > 0 ? featuresFromMeta : DEFAULT_FEATURES
                return (
                  <button
                    key={product.productId}
                    type="button"
                    onClick={() => setSelectedProductId(product.productId)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-[#111] bg-[#fafafa] dark:border-[var(--text-primary)] dark:bg-[var(--bg-hover)]'
                        : 'border-black/10 bg-white hover:border-black/20 dark:border-white/10 dark:bg-[var(--bg-panel)]'
                    }`}
                  >
                    <div className="text-[15px] font-bold text-[#111] dark:text-[var(--text-primary)]">
                      {product.name}
                    </div>
                    {price ? (
                      <div className="mt-1 text-[20px] font-extrabold tracking-tight text-[#111] dark:text-[var(--text-primary)]">
                        {price.formatted}
                      </div>
                    ) : (
                      <div className="mt-1 text-[13px] text-[#9ca3af]">No price for this interval</div>
                    )}
                    <ul className="mt-3 list-none space-y-1 p-0 text-[12px] text-[#6b7280] dark:text-[var(--text-muted)]">
                      {features.slice(0, 4).map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>
          )}

          {checkoutError ? (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-200">
              {checkoutError}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-black/10 px-5 py-4 dark:border-white/10">
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            onClick={handleCheckout}
            disabled={!selectedPrice?.id || checkoutLoading || samePlan}
          >
            {checkoutLoading
              ? 'Working…'
              : samePlan
                ? 'Current plan'
                : selectedProduct
                  ? `Continue with ${selectedProduct.name}`
                  : 'Continue'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
